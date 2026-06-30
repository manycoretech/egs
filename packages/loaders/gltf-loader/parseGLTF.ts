import type { GLTF } from './type.js';
import { textDecoder } from './const.js';

const BINARY_HEADER_MAGIC = 'glTF';
const HEADER_LENGTH = 12;
const CHUNK_TYPES = {
    JSON: 0x4e4f534a,
    BIN: 0x004e4942,
} as const;

function parseGLB(data: ArrayBuffer): { content: GLTF; body: ArrayBuffer | undefined } {
    const headerView = new DataView(data, 0, HEADER_LENGTH);
    const header = {
        magic: textDecoder.decode(new Uint8Array(data.slice(0, 4))),
        version: headerView.getUint32(4, true),
        length: headerView.getUint32(8, true),
    };

    if (header.version < 2.0) {
        throw new Error('EGS.GLTFLoader: Legacy binary file detected.');
    }
    if (header.magic !== BINARY_HEADER_MAGIC) {
        throw new Error('EGS.GLTFLoader: Unsupported glTF-Binary header.');
    }

    const chunkContentsLength = header.length - HEADER_LENGTH;
    const chunkView = new DataView(data, HEADER_LENGTH);

    let content: GLTF | undefined;
    let body: ArrayBuffer | undefined;
    let chunkIndex = 0;
    while (chunkIndex < chunkContentsLength) {
        const chunkLength = chunkView.getUint32(chunkIndex, true);
        chunkIndex += 4;
        const chunkType = chunkView.getUint32(chunkIndex, true);
        chunkIndex += 4;

        if (chunkType === CHUNK_TYPES.JSON) {
            const contentArray = new Uint8Array(data, HEADER_LENGTH + chunkIndex, chunkLength);
            content = JSON.parse(textDecoder.decode(contentArray));
        } else if (chunkType === CHUNK_TYPES.BIN) {
            const byteOffset = HEADER_LENGTH + chunkIndex;
            body = data.slice(byteOffset, byteOffset + chunkLength);
        }

        // Clients must ignore chunks with unknown types.
        chunkIndex += chunkLength;
    }

    if (!content) {
        throw new Error('EGS.GLTFLoader: JSON content not found.');
    }

    return { content, body };
}

export function parseGLTF(data: ArrayBuffer | string): { data: GLTF; binaryBuffer: ArrayBuffer | undefined } {
    let json: GLTF;
    let binaryBuffer: ArrayBuffer | undefined;
    if (typeof data === 'string') {
        json = JSON.parse(data);
    } else if (data instanceof ArrayBuffer) {
        const magic = textDecoder.decode(new Uint8Array(data, 0, 4));
        if (magic === BINARY_HEADER_MAGIC) {
            const result = parseGLB(data);
            json = result.content;
            binaryBuffer = result.body;
        } else {
            json = JSON.parse(textDecoder.decode(data));
        }
    } else {
        json = data;
    }

    return { data: json, binaryBuffer };
}
