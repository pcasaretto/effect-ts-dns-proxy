import dgram from 'node:dgram';
import dns from 'node:dns';
import { Buffer } from 'node:buffer';

// Create a simple DNS query for google.com
function createDNSQuery(domain) {
  const parts = domain.split('.');
  const queryBuffer = Buffer.alloc(512);
  
  // Transaction ID
  queryBuffer.writeUInt16BE(0x1234, 0);
  
  // Flags: Standard query
  queryBuffer.writeUInt16BE(0x0100, 2);
  
  // Questions: 1
  queryBuffer.writeUInt16BE(1, 4);
  
  // Answer RRs: 0
  queryBuffer.writeUInt16BE(0, 6);
  
  // Authority RRs: 0
  queryBuffer.writeUInt16BE(0, 8);
  
  // Additional RRs: 0
  queryBuffer.writeUInt16BE(0, 10);
  
  // Write domain name
  let offset = 12;
  for (const part of parts) {
    queryBuffer.writeUInt8(part.length, offset);
    offset++;
    queryBuffer.write(part, offset);
    offset += part.length;
  }
  queryBuffer.writeUInt8(0, offset); // End of domain
  offset++;
  
  // Type: A record
  queryBuffer.writeUInt16BE(1, offset);
  offset += 2;
  
  // Class: IN
  queryBuffer.writeUInt16BE(1, offset);
  offset += 2;
  
  return queryBuffer.subarray(0, offset);
}

// Test the DNS proxy
const client = dgram.createSocket('udp4');
const query = createDNSQuery('google.com');

client.on('message', (msg, rinfo) => {
  console.log('Received DNS response');
  console.log(`Response size: ${msg.length} bytes`);
  
  // Parse response header
  const id = msg.readUInt16BE(0);
  const flags = msg.readUInt16BE(2);
  const qdcount = msg.readUInt16BE(4);
  const ancount = msg.readUInt16BE(6);
  
  console.log(`Transaction ID: 0x${id.toString(16)}`);
  console.log(`Response flags: 0x${flags.toString(16)}`);
  console.log(`Questions: ${qdcount}`);
  console.log(`Answers: ${ancount}`);
  
  if (ancount > 0) {
    console.log('DNS query successful!');
  }
  
  client.close();
});

client.on('error', (err) => {
  console.error('Client error:', err);
  client.close();
});

console.log('Sending DNS query for google.com to localhost:5354');
client.send(query, 5354, 'localhost', (err) => {
  if (err) {
    console.error('Send error:', err);
    client.close();
  }
});

// Timeout after 5 seconds
setTimeout(() => {
  console.log('Query timed out');
  client.close();
}, 5000);