import { Effect } from "effect";
export declare const DNSFlags: {
    QR: number;
    OPCODE: number;
    AA: number;
    TC: number;
    RD: number;
    RA: number;
    Z: number;
    RCODE: number;
};
export interface DNSQuestion {
    name: string;
    type: number;
    class: number;
}
export interface DNSHeader {
    id: number;
    flags: number;
    qdcount: number;
    ancount: number;
    nscount: number;
    arcount: number;
}
export declare const parseDomainName: (buffer: Buffer, offset: number) => {
    name: string;
    offset: number;
};
export declare const parseHeader: (buffer: Buffer) => Effect.Effect<DNSHeader, Error>;
export declare const parseQuestions: (buffer: Buffer, offset: number, count: number) => Effect.Effect<DNSQuestion[], Error>;
export declare const createResponse: (queryBuffer: Buffer, responseBuffer: Buffer, clientRinfo: {
    address: string;
    port: number;
}) => Buffer;
export declare const DNSRecordType: {
    readonly A: 1;
    readonly NS: 2;
    readonly CNAME: 5;
    readonly SOA: 6;
    readonly PTR: 12;
    readonly MX: 15;
    readonly TXT: 16;
    readonly AAAA: 28;
    readonly SRV: 33;
    readonly ANY: 255;
};
export declare const getRecordTypeName: (type: number) => string;
//# sourceMappingURL=dns-packet.d.ts.map