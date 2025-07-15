import dgram from 'node:dgram';

const client = dgram.createSocket('udp4');
const message = Buffer.from('Hello from UDP client!');
const port = 15432;
const host = 'localhost';

client.on('message', (msg, rinfo) => {
  console.log(`Received echo: ${msg.toString()}`);
  console.log(`From: ${rinfo.address}:${rinfo.port}`);
  client.close();
});

client.on('error', (err) => {
  console.error('Client error:', err);
  client.close();
});

console.log(`Sending message to ${host}:${port}`);
client.send(message, port, host, (err) => {
  if (err) {
    console.error('Send error:', err);
    client.close();
  } else {
    console.log('Message sent successfully');
  }
});