import { Effect, Console, Config, Queue, Fiber, Ref, Schedule, Logger, LogLevel } from "effect"
import { Buffer } from 'node:buffer';
import * as dgram from "node:dgram"
import { NodeRuntime } from "@effect/platform-node"
import { parseHeader, parseQuestions, getRecordTypeName } from "./dns-packet.js"

interface DNSQuery {
  clientRinfo: dgram.RemoteInfo
  queryBuffer: Buffer
  timestamp: number
}

const createDNSProxy = (port: number, upstreamDNS: string, upstreamPort: number) =>
  Effect.gen(function* () {
    // Create server socket for receiving queries
    const serverSocket = dgram.createSocket("udp4")
    
    // Create client socket for forwarding to upstream
    const clientSocket = dgram.createSocket("udp4")
    
    // Map to track queries by ID
    const pendingQueries = yield* Ref.make<Map<number, DNSQuery>>(new Map())
    
    // Add finalizers for cleanup
    yield* Effect.addFinalizer(() =>
      Effect.gen(function* () {
        serverSocket.close()
        clientSocket.close()
        yield* Effect.logInfo("DNS proxy stopped")
      })
    )
    
    // Handle responses from upstream DNS
    clientSocket.on("error", (err) => {
      Effect.logError("Client socket error", err).pipe(Effect.runPromise)
    })
    
    clientSocket.on("message", (responseBuffer, upstreamRinfo) => {
        Effect.gen(function* () {
          const header = yield* parseHeader(responseBuffer)
          const queries = yield* Ref.get(pendingQueries)
          const query = queries.get(header.id)
          
          if (query) {
            const elapsed = Date.now() - query.timestamp
            yield* Effect.logInfo("Response received", {
              queryId: header.id,
              elapsed: `${elapsed}ms`
            })
            
            // Forward response back to original client
            yield* Effect.async<void, Error>((resume) => {
              serverSocket.send(responseBuffer, query.clientRinfo.port, query.clientRinfo.address, (err) => {
                if (err) {
                  resume(Effect.fail(err))
                } else {
                  resume(Effect.succeed(undefined))
                }
              })
            }).pipe(
              Effect.tap(() => 
                Effect.logInfo("Response forwarded", {
                  to: `${query.clientRinfo.address}:${query.clientRinfo.port}`
                })
              ),
              Effect.catchAll((err) => 
                Effect.logError("Error forwarding response", err)
              )
            )
            
            // Remove from pending queries
            yield* Ref.update(pendingQueries, (map) => {
              const newMap = new Map(map)
              newMap.delete(header.id)
              return newMap
            })
          } else {
            yield* Effect.logWarning("Received response for unknown query", {
              queryId: header.id
            })
          }
        }).pipe(
          Effect.catchAll((error) =>
            Effect.logError("Error processing upstream response", error)
          ),
          Effect.runPromise
        )
    })
    
    // Start the proxy server
    yield* Effect.async<void, Error>((resume) => {
      serverSocket.on("error", (err) => {
        Effect.logError("Server socket error", err).pipe(Effect.runPromise)
        resume(Effect.fail(err))
      })
      
      serverSocket.on("message", (queryBuffer, clientRinfo) => {
        Effect.gen(function* () {
          const header = yield* parseHeader(queryBuffer)
          const questions = yield* parseQuestions(queryBuffer, 12, header.qdcount)
          
          // Log query details
          if (questions.length > 0) {
            const q = questions[0]
            yield* Effect.logInfo("DNS query received", {
              from: `${clientRinfo.address}:${clientRinfo.port}`,
              domain: q.name,
              type: getRecordTypeName(q.type),
              queryId: header.id
            })
          }
          
          // Store query info for response matching
          const query: DNSQuery = {
            clientRinfo,
            queryBuffer,
            timestamp: Date.now()
          }
          
          yield* Ref.update(pendingQueries, (map) => {
            const newMap = new Map(map)
            newMap.set(header.id, query)
            return newMap
          })
          
          // Forward query to upstream DNS
          yield* Effect.async<void, Error>((resume) => {
            clientSocket.send(queryBuffer, upstreamPort, upstreamDNS, (err) => {
              if (err) {
                resume(Effect.fail(err))
              } else {
                resume(Effect.succeed(undefined))
              }
            })
          }).pipe(
            Effect.tap(() =>
              Effect.logInfo("Query forwarded", {
                queryId: header.id,
                to: `${upstreamDNS}:${upstreamPort}`
              })
            ),
            Effect.catchAll((err) =>
              Effect.logError("Error forwarding query", err)
            )
          )
        }).pipe(
          Effect.catchAll((error) =>
            Effect.logError("Error processing query", error)
          ),
          Effect.runPromise
        )
      })
      
      serverSocket.on("listening", () => {
        const address = serverSocket.address()
        Effect.gen(function* () {
          yield* Effect.logInfo("DNS proxy started", {
            listening: `${address.address}:${address.port}`,
            upstream: `${upstreamDNS}:${upstreamPort}`
          })
        }).pipe(Effect.runPromise)
        resume(Effect.succeed(undefined))
      })
      
      serverSocket.bind(port)
    })
    
    // Clean up old pending queries periodically
    yield* Effect.repeat(
      Effect.gen(function* () {
        const now = Date.now()
        const removedIds: number[] = []
        yield* Ref.update(pendingQueries, (map) => {
          const newMap = new Map(map)
          for (const [id, query] of newMap) {
            if (now - query.timestamp > 5000) { // 5 second timeout
              removedIds.push(id)
              newMap.delete(id)
            }
          }
          return newMap
        })
        
        if (removedIds.length > 0) {
          yield* Effect.logWarning("Removed timed out queries", {
            queryIds: removedIds,
            count: removedIds.length
          })
        }
      }),
      Schedule.fixed("10 seconds")
    ).pipe(
      Effect.fork,
      Effect.interruptible
    )
    
    yield* Effect.never
  })

const program = Effect.gen(function* () {
  const port = yield* Config.integer("DNS_PORT").pipe(
    Config.withDefault(5353)
  )
  
  const upstreamDNS = yield* Config.string("UPSTREAM_DNS").pipe(
    Config.withDefault("8.8.8.8")
  )
  
  const upstreamPort = yield* Config.integer("UPSTREAM_PORT").pipe(
    Config.withDefault(53)
  )
  
  yield* Effect.logInfo("Starting DNS proxy", {
    port,
    upstreamDNS,
    upstreamPort
  })
  
  yield* createDNSProxy(port, upstreamDNS, upstreamPort)
}).pipe(
  Effect.catchAllCause((cause) =>
    Effect.logError("DNS proxy failed", cause)
  )
)

// Configure pretty logging for better readability
const layer = Logger.pretty

NodeRuntime.runMain(
  program.pipe(
    Effect.scoped,
    Effect.provide(layer)
  )
)
