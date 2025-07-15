# Effect JS UDP Echo Server & DNS Proxy

A demonstration of network programming with Effect JS, featuring a UDP echo server and DNS proxy server with comprehensive logging and error handling.

## Features

- **UDP Echo Server**: Simple server that echoes back any UDP packets
- **DNS Proxy**: Forwards DNS queries to upstream servers with caching and timeout management
- **Effect Integration**: Demonstrates Effect's resource management, error handling, and logging
- **TypeScript**: Fully typed with strict mode enabled
- **Comprehensive Tests**: Unit tests for DNS packet parsing

## Installation

```bash
npm install
```

## Usage

### UDP Echo Server

Start the echo server (default port: 15432):

```bash
npm run dev

# Or with custom port:
PORT=8080 npm run dev
```

Test it:
```bash
echo "Hello, UDP!" | nc -u localhost 15432
```

### DNS Proxy

Start the DNS proxy (default port: 5353, upstream: 8.8.8.8):

```bash
npm run dns-proxy

# Or with custom configuration:
DNS_PORT=5354 UPSTREAM_DNS=1.1.1.1 UPSTREAM_PORT=53 npm run dns-proxy
```

Test it:
```bash
# Query A record
dig @localhost -p 5354 google.com

# Query AAAA record
dig @localhost -p 5354 google.com AAAA

# Multiple queries
dig @localhost -p 5354 example.com +short
```

## Project Structure

```
dns/
├── src/
│   ├── udp-echo-server.ts    # UDP echo server implementation
│   ├── dns-proxy.ts          # DNS proxy server
│   ├── dns-packet.ts         # DNS packet parsing utilities
│   ├── dns.test.ts          # Unit tests
│   └── test-helpers.ts      # Test utilities
├── test-client.js           # UDP echo test client
├── test-dns.js             # DNS proxy test client
└── TEST-README.md          # Testing documentation
```

## Key Effect Concepts Demonstrated

1. **Resource Management**
   - Automatic cleanup with finalizers
   - Scoped resources for socket lifecycle

2. **Error Handling**
   - Type-safe error propagation
   - Graceful error recovery

3. **Logging**
   - Structured logging with Effect.log*
   - Pretty printing with Logger.pretty

4. **Concurrency**
   - Fiber-based server management
   - Concurrent request handling

5. **Configuration**
   - Environment variable handling with Config
   - Default values and validation

## Development

```bash
# Run in watch mode
npm run dev

# Build TypeScript
npm run build

# Run tests
npm test

# Type checking
npm run typecheck
```

## Architecture

### UDP Echo Server
- Creates a UDP socket using Node's dgram module
- Wraps callbacks in Effect for better error handling
- Uses Effect.never to keep the server running
- Automatic cleanup on shutdown

### DNS Proxy
- Two sockets: server (receives queries) and client (forwards to upstream)
- Tracks pending queries by transaction ID
- Implements timeout for unresponsive queries
- Full Effect-based logging throughout

### DNS Packet Parser
- Pure functions for parsing DNS wire format
- Handles domain name compression
- Supports common DNS record types
- Effect-wrapped for error handling

## Testing

See [TEST-README.md](./TEST-README.md) for comprehensive testing guide.

## License

MIT