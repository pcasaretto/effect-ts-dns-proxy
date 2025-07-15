import { describe, it, expect } from 'vitest'
import { Effect } from 'effect'
import { 
  parseHeader, 
  parseQuestions, 
  parseDomainName,
  getRecordTypeName,
  DNSRecordType,
  DNSFlags,
  createResponse
} from './dns-packet.js'

describe('DNS Packet Parsing', () => {
  describe('parseDomainName', () => {
    it('parses simple domain names', () => {
      const buffer = Buffer.from([
        6, 103, 111, 111, 103, 108, 101,  // "google"
        3, 99, 111, 109,                   // "com"
        0                                   // end
      ])
      
      const result = parseDomainName(buffer, 0)
      expect(result.name).toBe('google.com')
      expect(result.offset).toBe(12)
    })

    it('parses multi-label domain names', () => {
      const buffer = Buffer.from([
        3, 119, 119, 119,                  // "www"
        7, 101, 120, 97, 109, 112, 108, 101, // "example"
        3, 99, 111, 109,                   // "com"
        0                                   // end
      ])
      
      const result = parseDomainName(buffer, 0)
      expect(result.name).toBe('www.example.com')
      expect(result.offset).toBe(17)
    })

    it('handles compressed domain names', () => {
      const buffer = Buffer.alloc(50)
      
      // First occurrence at offset 12: google.com
      buffer[12] = 6
      buffer.write('google', 13)
      buffer[19] = 3
      buffer.write('com', 20)
      buffer[23] = 0
      
      // Compressed reference at offset 30: pointer to offset 12
      buffer[30] = 0xC0 // Compression flag
      buffer[31] = 12   // Offset pointer
      
      const result = parseDomainName(buffer, 30)
      expect(result.name).toBe('google.com')
      expect(result.offset).toBe(32)
    })

    it('parses empty domain (root)', () => {
      const buffer = Buffer.from([0])
      const result = parseDomainName(buffer, 0)
      expect(result.name).toBe('')
      expect(result.offset).toBe(1)
    })
  })

  describe('parseHeader', () => {
    it('parses valid DNS headers', async () => {
      const buffer = Buffer.alloc(12)
      buffer.writeUInt16BE(0x1234, 0)  // ID
      buffer.writeUInt16BE(0x0100, 2)  // Flags (standard query, recursion desired)
      buffer.writeUInt16BE(1, 4)        // QDCOUNT
      buffer.writeUInt16BE(0, 6)        // ANCOUNT
      buffer.writeUInt16BE(0, 8)        // NSCOUNT
      buffer.writeUInt16BE(0, 10)       // ARCOUNT
      
      const header = await Effect.runPromise(parseHeader(buffer))
      expect(header.id).toBe(0x1234)
      expect(header.flags).toBe(0x0100)
      expect(header.qdcount).toBe(1)
      expect(header.ancount).toBe(0)
      expect(header.nscount).toBe(0)
      expect(header.arcount).toBe(0)
    })

    it('fails on buffer too short', async () => {
      const buffer = Buffer.alloc(8) // Too short
      
      await expect(
        Effect.runPromise(parseHeader(buffer))
      ).rejects.toThrow()
    })

    it('parses response headers correctly', async () => {
      const buffer = Buffer.alloc(12)
      buffer.writeUInt16BE(0x5678, 0)  // ID
      buffer.writeUInt16BE(0x8180, 2)  // Flags (response, recursion available)
      buffer.writeUInt16BE(1, 4)        // QDCOUNT
      buffer.writeUInt16BE(2, 6)        // ANCOUNT
      buffer.writeUInt16BE(0, 8)        // NSCOUNT
      buffer.writeUInt16BE(0, 10)       // ARCOUNT
      
      const header = await Effect.runPromise(parseHeader(buffer))
      expect(header.id).toBe(0x5678)
      expect(header.flags & DNSFlags.QR).toBe(DNSFlags.QR) // Is response
      expect(header.flags & DNSFlags.RA).toBe(DNSFlags.RA) // Recursion available
      expect(header.ancount).toBe(2)
    })
  })

  describe('parseQuestions', () => {
    it('parses single questions', async () => {
      const buffer = Buffer.alloc(50)
      let offset = 0
      
      // Write domain name: google.com
      buffer[offset++] = 6
      buffer.write('google', offset)
      offset += 6
      buffer[offset++] = 3
      buffer.write('com', offset)
      offset += 3
      buffer[offset++] = 0
      
      // Write type (A record) and class (IN)
      buffer.writeUInt16BE(DNSRecordType.A, offset)
      offset += 2
      buffer.writeUInt16BE(1, offset) // IN class
      
      const questions = await Effect.runPromise(parseQuestions(buffer, 0, 1))
      expect(questions).toHaveLength(1)
      expect(questions[0].name).toBe('google.com')
      expect(questions[0].type).toBe(DNSRecordType.A)
      expect(questions[0].class).toBe(1)
    })

    it('parses multiple questions', async () => {
      const buffer = Buffer.alloc(100)
      let offset = 0
      
      // First question: example.com A
      buffer[offset++] = 7
      buffer.write('example', offset)
      offset += 7
      buffer[offset++] = 3
      buffer.write('com', offset)
      offset += 3
      buffer[offset++] = 0
      buffer.writeUInt16BE(DNSRecordType.A, offset)
      offset += 2
      buffer.writeUInt16BE(1, offset)
      offset += 2
      
      // Second question: test.org AAAA
      buffer[offset++] = 4
      buffer.write('test', offset)
      offset += 4
      buffer[offset++] = 3
      buffer.write('org', offset)
      offset += 3
      buffer[offset++] = 0
      buffer.writeUInt16BE(DNSRecordType.AAAA, offset)
      offset += 2
      buffer.writeUInt16BE(1, offset)
      
      const questions = await Effect.runPromise(parseQuestions(buffer, 0, 2))
      expect(questions).toHaveLength(2)
      expect(questions[0].name).toBe('example.com')
      expect(questions[0].type).toBe(DNSRecordType.A)
      expect(questions[1].name).toBe('test.org')
      expect(questions[1].type).toBe(DNSRecordType.AAAA)
    })

    it('handles empty questions list', async () => {
      const buffer = Buffer.alloc(10)
      const questions = await Effect.runPromise(parseQuestions(buffer, 0, 0))
      expect(questions).toHaveLength(0)
    })
  })

  describe('getRecordTypeName', () => {
    it('returns correct names for known types', () => {
      expect(getRecordTypeName(DNSRecordType.A)).toBe('A')
      expect(getRecordTypeName(DNSRecordType.AAAA)).toBe('AAAA')
      expect(getRecordTypeName(DNSRecordType.CNAME)).toBe('CNAME')
      expect(getRecordTypeName(DNSRecordType.MX)).toBe('MX')
      expect(getRecordTypeName(DNSRecordType.TXT)).toBe('TXT')
      expect(getRecordTypeName(DNSRecordType.NS)).toBe('NS')
      expect(getRecordTypeName(DNSRecordType.SOA)).toBe('SOA')
      expect(getRecordTypeName(DNSRecordType.PTR)).toBe('PTR')
      expect(getRecordTypeName(DNSRecordType.SRV)).toBe('SRV')
      expect(getRecordTypeName(DNSRecordType.ANY)).toBe('ANY')
    })

    it('returns TYPE{n} for unknown types', () => {
      expect(getRecordTypeName(999)).toBe('TYPE999')
      expect(getRecordTypeName(65535)).toBe('TYPE65535')
    })
  })

  describe('DNS Flags', () => {
    it('has correct flag values', () => {
      expect(DNSFlags.QR).toBe(0x8000)      // Query/Response bit
      expect(DNSFlags.OPCODE).toBe(0x7800)  // Operation code
      expect(DNSFlags.AA).toBe(0x0400)      // Authoritative answer
      expect(DNSFlags.TC).toBe(0x0200)      // Truncated
      expect(DNSFlags.RD).toBe(0x0100)      // Recursion desired
      expect(DNSFlags.RA).toBe(0x0080)      // Recursion available
      expect(DNSFlags.RCODE).toBe(0x000F)   // Response code
    })
  })

  describe('createResponse', () => {
    it('returns response buffer as-is for simple proxy', () => {
      const queryBuffer = Buffer.from([1, 2, 3])
      const responseBuffer = Buffer.from([4, 5, 6])
      const clientRinfo = { address: '127.0.0.1', port: 12345 }
      
      const result = createResponse(queryBuffer, responseBuffer, clientRinfo)
      expect(result).toBe(responseBuffer)
    })
  })
})