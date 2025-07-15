import { Effect, Console, Config, Ref, Schedule } from "effect";
import * as dgram from "node:dgram";
import { NodeRuntime } from "@effect/platform-node";
import { parseHeader, parseQuestions, getRecordTypeName } from "./dns-packet.js";
const createDNSProxy = (port, upstreamDNS, upstreamPort) => Effect.gen(function* () {
    const serverSocket = dgram.createSocket("udp4");
    const clientSocket = dgram.createSocket("udp4");
    const pendingQueries = yield* Ref.make(new Map());
    yield* Effect.addFinalizer(() => Effect.sync(() => {
        serverSocket.close();
        clientSocket.close();
        console.log("DNS proxy stopped");
    }));
    clientSocket.on("error", (err) => {
        console.error("Client socket error:", err);
    });
    clientSocket.on("message", (responseBuffer, upstreamRinfo) => {
        Effect.gen(function* () {
            try {
                const header = yield* parseHeader(responseBuffer);
                const queries = yield* Ref.get(pendingQueries);
                const query = queries.get(header.id);
                if (query) {
                    const elapsed = Date.now() - query.timestamp;
                    console.log(`Response for query ID ${header.id} (${elapsed}ms)`);
                    serverSocket.send(responseBuffer, query.clientRinfo.port, query.clientRinfo.address, (err) => {
                        if (err) {
                            console.error("Error forwarding response:", err);
                        }
                        else {
                            console.log(`Forwarded response to ${query.clientRinfo.address}:${query.clientRinfo.port}`);
                        }
                    });
                    yield* Ref.update(pendingQueries, (map) => {
                        const newMap = new Map(map);
                        newMap.delete(header.id);
                        return newMap;
                    });
                }
                else {
                    console.warn(`Received response for unknown query ID: ${header.id}`);
                }
            }
            catch (error) {
                console.error("Error processing upstream response:", error);
            }
        }).pipe(Effect.runPromise);
    });
    yield* Effect.async((resume) => {
        serverSocket.on("error", (err) => {
            console.error("Server socket error:", err);
            resume(Effect.fail(err));
        });
        serverSocket.on("message", (queryBuffer, clientRinfo) => {
            Effect.gen(function* () {
                try {
                    const header = yield* parseHeader(queryBuffer);
                    const questions = yield* parseQuestions(queryBuffer, 12, header.qdcount);
                    if (questions.length > 0) {
                        const q = questions[0];
                        console.log(`Query from ${clientRinfo.address}:${clientRinfo.port} - ${q.name} (${getRecordTypeName(q.type)})`);
                    }
                    const query = {
                        clientRinfo,
                        queryBuffer,
                        timestamp: Date.now()
                    };
                    yield* Ref.update(pendingQueries, (map) => {
                        const newMap = new Map(map);
                        newMap.set(header.id, query);
                        return newMap;
                    });
                    clientSocket.send(queryBuffer, upstreamPort, upstreamDNS, (err) => {
                        if (err) {
                            console.error("Error forwarding query:", err);
                        }
                        else {
                            console.log(`Forwarded query ID ${header.id} to ${upstreamDNS}:${upstreamPort}`);
                        }
                    });
                }
                catch (error) {
                    console.error("Error processing query:", error);
                }
            }).pipe(Effect.runPromise);
        });
        serverSocket.on("listening", () => {
            const address = serverSocket.address();
            console.log(`DNS proxy listening on ${address.address}:${address.port}`);
            console.log(`Forwarding queries to ${upstreamDNS}:${upstreamPort}`);
            resume(Effect.succeed(undefined));
        });
        serverSocket.bind(port);
    });
    yield* Effect.repeat(Effect.gen(function* () {
        const now = Date.now();
        yield* Ref.update(pendingQueries, (map) => {
            const newMap = new Map(map);
            for (const [id, query] of newMap) {
                if (now - query.timestamp > 5000) {
                    console.warn(`Removing timed out query ID: ${id}`);
                    newMap.delete(id);
                }
            }
            return newMap;
        });
    }), Schedule.fixed("10 seconds")).pipe(Effect.fork, Effect.interruptible);
    yield* Effect.never;
});
const program = Effect.gen(function* () {
    const port = yield* Config.integer("DNS_PORT").pipe(Config.withDefault(5353));
    const upstreamDNS = yield* Config.string("UPSTREAM_DNS").pipe(Config.withDefault("8.8.8.8"));
    const upstreamPort = yield* Config.integer("UPSTREAM_PORT").pipe(Config.withDefault(53));
    yield* Console.log(`Starting DNS proxy on port ${port}...`);
    yield* createDNSProxy(port, upstreamDNS, upstreamPort);
}).pipe(Effect.catchAllCause((cause) => Console.error("DNS proxy failed:", cause)));
NodeRuntime.runMain(program.pipe(Effect.scoped));
//# sourceMappingURL=dns-proxy.js.map