import { Effect, Console, Config } from "effect";
import * as dgram from "node:dgram";
import { NodeRuntime } from "@effect/platform-node";
const createUDPServer = (port) => Effect.gen(function* () {
    const socket = dgram.createSocket("udp4");
    yield* Effect.addFinalizer(() => Effect.sync(() => {
        socket.close();
        console.log("UDP server stopped");
    }));
    yield* Effect.async((resume) => {
        socket.on("error", (err) => {
            console.error("Server error:", err);
            resume(Effect.fail(err));
        });
        socket.on("message", (msg, rinfo) => {
            console.log(`Received ${msg.length} bytes from ${rinfo.address}:${rinfo.port}`);
            console.log(`Message: ${msg.toString()}`);
            socket.send(msg, rinfo.port, rinfo.address, (err) => {
                if (err) {
                    console.error("Error sending response:", err);
                }
                else {
                    console.log(`Echoed message back to ${rinfo.address}:${rinfo.port}`);
                }
            });
        });
        socket.on("listening", () => {
            const address = socket.address();
            console.log(`UDP server listening on ${address.address}:${address.port}`);
            resume(Effect.succeed(undefined));
        });
        socket.bind(port);
    });
    yield* Effect.never;
});
const program = Effect.gen(function* () {
    const port = yield* Config.integer("PORT").pipe(Config.withDefault(15432));
    yield* Console.log(`Starting UDP echo server on port ${port}...`);
    yield* createUDPServer(port);
}).pipe(Effect.catchAllCause((cause) => Console.error("Server failed:", cause)));
NodeRuntime.runMain(program.pipe(Effect.scoped));
//# sourceMappingURL=udp-echo-server.js.map