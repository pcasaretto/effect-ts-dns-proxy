import { Effect, Fiber, Scope } from 'effect'
import * as dgram from 'node:dgram'

// Test helper to create a UDP server effect that can be easily tested
export const createTestUDPServer = (port: number, handler: (msg: Buffer, rinfo: dgram.RemoteInfo, socket: dgram.Socket) => void) =>
  Effect.gen(function* () {
    const socket = dgram.createSocket("udp4")

    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        socket.close()
      })
    )

    yield* Effect.async<void, Error>((resume) => {
      socket.on("error", (err) => {
        resume(Effect.fail(err))
      })

      socket.on("message", (msg, rinfo) => {
        handler(msg, rinfo, socket)
      })

      socket.on("listening", () => {
        resume(Effect.succeed(undefined))
      })

      socket.bind(port)
    })

    yield* Effect.never
  })

// Helper to wait for server to be ready
export const waitForServer = (port: number, timeout: number = 1000): Promise<void> => {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const checkPort = () => {
      const client = dgram.createSocket('udp4')
      
      // Send a dummy packet to check if server is listening
      client.send(Buffer.from('ping'), port, 'localhost', (err) => {
        client.close()
        
        if (!err) {
          resolve()
        } else if (Date.now() - start > timeout) {
          reject(new Error(`Server on port ${port} did not start within ${timeout}ms`))
        } else {
          setTimeout(checkPort, 50)
        }
      })
    }
    
    checkPort()
  })
}