import { Effect } from "effect";
export const DNSFlags = {
    QR: 0x8000,
    OPCODE: 0x7800,
    AA: 0x0400,
    TC: 0x0200,
    RD: 0x0100,
    RA: 0x0080,
    Z: 0x0070,
    RCODE: 0x000F
};
export const parseDomainName = (buffer, offset) => {
    const labels = [];
    let currentOffset = offset;
    let jumped = false;
    let jumpOffset = -1;
    while (true) {
        const length = buffer[currentOffset];
        if (length === 0) {
            currentOffset++;
            break;
        }
        if ((length & 0xC0) === 0xC0) {
            if (!jumped) {
                jumpOffset = currentOffset + 2;
            }
            const pointer = ((length & 0x3F) << 8) | buffer[currentOffset + 1];
            currentOffset = pointer;
            jumped = true;
            continue;
        }
        currentOffset++;
        const label = buffer.subarray(currentOffset, currentOffset + length).toString();
        labels.push(label);
        currentOffset += length;
    }
    return {
        name: labels.join('.'),
        offset: jumped && jumpOffset !== -1 ? jumpOffset : currentOffset
    };
};
export const parseHeader = (buffer) => Effect.try(() => {
    if (buffer.length < 12) {
        throw new Error("DNS packet too short for header");
    }
    return {
        id: buffer.readUInt16BE(0),
        flags: buffer.readUInt16BE(2),
        qdcount: buffer.readUInt16BE(4),
        ancount: buffer.readUInt16BE(6),
        nscount: buffer.readUInt16BE(8),
        arcount: buffer.readUInt16BE(10)
    };
});
export const parseQuestions = (buffer, offset, count) => Effect.try(() => {
    const questions = [];
    let currentOffset = offset;
    for (let i = 0; i < count; i++) {
        const { name, offset: newOffset } = parseDomainName(buffer, currentOffset);
        currentOffset = newOffset;
        const type = buffer.readUInt16BE(currentOffset);
        const cls = buffer.readUInt16BE(currentOffset + 2);
        currentOffset += 4;
        questions.push({ name, type, class: cls });
    }
    return questions;
});
export const createResponse = (queryBuffer, responseBuffer, clientRinfo) => {
    return responseBuffer;
};
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
};
export const getRecordTypeName = (type) => {
    const typeNames = {
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
    };
    return typeNames[type] || `TYPE${type}`;
};
//# sourceMappingURL=dns-packet.js.map