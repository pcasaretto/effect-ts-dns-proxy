import { Effect } from "effect"

// DNS Header flags
export const DNSFlags = {
  QR: 0x8000,     // Query/Response
  OPCODE: 0x7800, // Operation Code
  AA: 0x0400,     // Authoritative Answer
  TC: 0x0200,     // Truncated
  RD: 0x0100,     // Recursion Desired
  RA: 0x0080,     // Recursion Available
  Z: 0x0070,      // Reserved
  RCODE: 0x000F   // Response Code
}

// DNS Question structure
export interface DNSQuestion {
  name: string
  type: number
  class: number
}

// DNS Header structure
export interface DNSHeader {
  id: number
  flags: number
  qdcount: number
  ancount: number
  nscount: number
  arcount: number
}

// Parse domain name from DNS packet
export const parseDomainName = (buffer: Buffer, offset: number): { name: string; offset: number } => {
  const labels: string[] = []
  let currentOffset = offset
  let jumped = false
  let jumpOffset = -1

  while (true) {
    const length = buffer[currentOffset]
    
    if (length === 0) {
      currentOffset++
      break
    }
    
    // Check for compression pointer
    if ((length & 0xC0) === 0xC0) {
      if (!jumped) {
        jumpOffset = currentOffset + 2
      }
      const pointer = ((length & 0x3F) << 8) | buffer[currentOffset + 1]
      currentOffset = pointer
      jumped = true
      continue
    }
    
    // Read label
    currentOffset++
    const label = buffer.subarray(currentOffset, currentOffset + length).toString()
    labels.push(label)
    currentOffset += length
  }
  
  return {
    name: labels.join('.'),
    offset: jumped && jumpOffset !== -1 ? jumpOffset : currentOffset
  }
}

// Parse DNS header from buffer
export const parseHeader = (buffer: Buffer): Effect.Effect<DNSHeader, Error> =>
  Effect.try(() => {
    if (buffer.length < 12) {
      throw new Error("DNS packet too short for header")
    }
    
    return {
      id: buffer.readUInt16BE(0),
      flags: buffer.readUInt16BE(2),
      qdcount: buffer.readUInt16BE(4),
      ancount: buffer.readUInt16BE(6),
      nscount: buffer.readUInt16BE(8),
      arcount: buffer.readUInt16BE(10)
    }
  })

// Parse DNS questions from buffer
export const parseQuestions = (buffer: Buffer, offset: number, count: number): Effect.Effect<DNSQuestion[], Error> =>
  Effect.try(() => {
    const questions: DNSQuestion[] = []
    let currentOffset = offset
    
    for (let i = 0; i < count; i++) {
      const { name, offset: newOffset } = parseDomainName(buffer, currentOffset)
      currentOffset = newOffset
      
      const type = buffer.readUInt16BE(currentOffset)
      const cls = buffer.readUInt16BE(currentOffset + 2)
      currentOffset += 4
      
      questions.push({ name, type, class: cls })
    }
    
    return questions
  })

// Create DNS response with modified flags
export const createResponse = (
  queryBuffer: Buffer,
  responseBuffer: Buffer,
  clientRinfo: { address: string; port: number }
): Buffer => {
  // For a simple proxy, we just forward the upstream response as-is
  return responseBuffer
}

// DNS record types
export const DNSRecordType = {
  A: 1,
  NS: 2,
  CNAME: 5,
  SOA: 6,
  PTR: 12,
  MX: 15,
  TXT: 16,
  AAAA: 28,
  SRV: 33,
  ANY: 255
} as const

export const getRecordTypeName = (type: number): string => {
  const typeNames: Record<number, string> = {
    1: 'A',
    2: 'NS',
    5: 'CNAME',
    6: 'SOA',
    12: 'PTR',
    15: 'MX',
    16: 'TXT',
    28: 'AAAA',
    33: 'SRV',
    255: 'ANY'
  }
  return typeNames[type] || `TYPE${type}`
}