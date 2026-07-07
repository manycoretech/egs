import { createZstdDecompressor } from '../zstd/index.js';
import {
    type ISingleSplat,
    type IData,
    type IFile,
    SH_MAPS,
    SH_C0,
    BufferReader,
    fromHalf,
    clamp,
    StreamChunkDecoder,
    type ChunkDecoder,
    ByteStreamCursor,
} from '../utils.js';

const SPZ_MAGIC = 0x5053474e; // NGSP = Niantic gaussian splat
const SPZ_VERSION = 4;
const SPZ_LEGACY_VERSION = 3;
const FLAG_ANTIALIASED = 0x1;
const MAX_SAFE_STREAM_SIZE = BigInt(Number.MAX_SAFE_INTEGER);

const COLOR_SCALE = SH_C0 / 0.15;
const rotation: number[] = new Array(4);
const SH_SCALE1 = 1 << 3;
const SH_SCALE2 = 1 << 4;

const SCALE_LUT = new Float32Array(256);
const COLOR_LUT = new Float32Array(256);
for (let i = 0; i < 256; i++) {
    SCALE_LUT[i] = Math.exp(i / 16 - 10);
    COLOR_LUT[i] = (i / 255 - 0.5) * COLOR_SCALE + 0.5;
}

function createAttributeDecoder(
    reader: BufferReader,
    data: IData,
    blockOffset: number,
    version: number,
    counts: number,
    shCounts: number,
    fractionalBits: number,
) {
    const isF16 = version < 2;
    const useSmallestThreeQuat = version >= 3;
    const fractionInv = 1 / (1 << fractionalBits);
    const setCenter = data.setCenter.bind(data) as IData['setCenter'];
    const setAlpha = data.setAlpha.bind(data) as IData['setAlpha'];
    const setColor = data.setColor.bind(data) as IData['setColor'];
    const setScale = data.setScale.bind(data) as IData['setScale'];
    const setQuat = data.setQuat.bind(data) as IData['setQuat'];
    const setShN = data.setShN.bind(data) as IData['setShN'];
    const shN: number[] = new Array(shCounts).fill(0);

    const decoders: ChunkDecoder[] = [
        {
            init: () => [counts, isF16 ? 6 : 9],
            decode: (offset, counts, buf) => {
                offset += blockOffset;
                let x: number, y: number, z: number;
                for (let i = 0; i < counts; i++) {
                    if (isF16) {
                        const o = i * 6;
                        x = fromHalf((buf[o + 1] << 8) | buf[o]);
                        y = fromHalf((buf[o + 3] << 8) | buf[o + 2]);
                        z = fromHalf((buf[o + 5] << 8) | buf[o + 4]);
                    } else {
                        const o = i * 9;
                        x = (((buf[o + 2] << 24) | (buf[o + 1] << 16) | (buf[o] << 8)) >> 8) * fractionInv;
                        y = (((buf[o + 5] << 24) | (buf[o + 4] << 16) | (buf[o + 3] << 8)) >> 8) * fractionInv;
                        z = (((buf[o + 8] << 24) | (buf[o + 7] << 16) | (buf[o + 6] << 8)) >> 8) * fractionInv;
                    }
                    setCenter(offset + i, x, y, z);
                }
            },
        },
        {
            init: () => [counts, 1],
            decode: (offset, counts, buf) => {
                offset += blockOffset;
                for (let i = 0; i < counts; i++) {
                    setAlpha(offset + i, buf[i] / 255);
                }
            },
        },
        {
            init: () => [counts, 3],
            decode: (offset, counts, buf) => {
                offset += blockOffset;
                for (let i = 0; i < counts; i++) {
                    const o = i * 3;
                    setColor(offset + i, COLOR_LUT[buf[o]], COLOR_LUT[buf[o + 1]], COLOR_LUT[buf[o + 2]]);
                }
            },
        },
        {
            init: () => [counts, 3],
            decode: (offset, counts, buf) => {
                offset += blockOffset;
                for (let i = 0; i < counts; i++) {
                    const o = i * 3;
                    setScale(offset + i, SCALE_LUT[buf[o]], SCALE_LUT[buf[o + 1]], SCALE_LUT[buf[o + 2]]);
                }
            },
        },
        {
            init: () => [counts, useSmallestThreeQuat ? 4 : 3],
            decode: (offset, counts, buf) => {
                offset += blockOffset;
                let qx: number, qy: number, qz: number, qw: number;
                for (let i = 0; i < counts; i++) {
                    if (!useSmallestThreeQuat) {
                        const o = i * 3;
                        qx = buf[o] / 127.5 - 1;
                        qy = buf[o + 1] / 127.5 - 1;
                        qz = buf[o + 2] / 127.5 - 1;
                        qw = Math.sqrt(Math.max(0, 1 - qx * qx - qy * qy - qz * qz));
                    } else {
                        const o = i * 4;
                        const packed = buf[o] | (buf[o + 1] << 8) | (buf[o + 2] << 16) | (buf[o + 3] << 24);
                        const largest = packed >>> 30;
                        let temp = packed;
                        let sum = 0;
                        for (let j = 3; j >= 0; j--) {
                            if (j === largest) {
                                continue;
                            }
                            const mag = temp & 0x1ff;
                            const sign = (temp >>> 9) & 1;
                            temp >>>= 10;

                            const v = Math.SQRT1_2 * (mag / 0x1ff) * (sign ? -1 : 1);
                            rotation[j] = v;
                            sum += v * v;
                        }
                        rotation[largest] = Math.sqrt(1 - sum);
                        qx = rotation[0];
                        qy = rotation[1];
                        qz = rotation[2];
                        qw = rotation[3];
                    }
                    setQuat(offset + i, qx, qy, qz, qw);
                }
            },
        },
    ];

    if (shCounts > 0) {
        decoders.push({
            init: () => [counts, shCounts],
            decode: (offset, counts, buf) => {
                offset += blockOffset;
                for (let i = 0; i < counts; i++) {
                    const o = i * shCounts;
                    for (let j = 0; j < shCounts; j++) {
                        shN[j] = (buf[o + j] - 128) / 128;
                    }
                    setShN(offset + i, shN);
                }
            },
        });
    }

    const decoder = new StreamChunkDecoder(reader);
    decoder.setDecoders(decoders);
    return decoder;
}

export class SpzFile implements IFile {
    private async readStream(stream: ReadableStream<Uint8Array>, data: IData) {
        const cursor = new ByteStreamCursor(stream);
        const header = await cursor.readExact(32);
        const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
        if (view.getUint32(0, true) !== SPZ_MAGIC) {
            throw new Error('Invalid SPZ file');
        }
        const version = view.getUint32(4, true);
        if (version !== SPZ_VERSION) {
            throw new Error(`Unsupported SPZ version: ${version}`);
        }
        const counts = view.getUint32(8, true);
        const shDegree = view.getUint8(12);
        const shCounts = SH_MAPS[shDegree];
        if (shCounts === undefined) {
            throw new Error(`Unsupported SPZ SH degree: ${shDegree}`);
        }
        const fractionalBits = view.getUint8(13);
        const numStreams = view.getUint8(15);
        const tocByteOffset = view.getUint32(16, true);
        const expectedSizes = [counts * 9, counts, counts * 3, counts * 3, counts * 4];
        if (shDegree > 0) {
            expectedSizes.push(counts * shCounts);
        }
        if (numStreams !== expectedSizes.length) {
            throw new Error(`Invalid SPZ v4 stream count: ${numStreams}`);
        }
        if (tocByteOffset < 32) {
            throw new Error(`Invalid SPZ v4 TOC offset: ${tocByteOffset}`);
        }

        if (tocByteOffset > 32) {
            await cursor.skip(tocByteOffset - 32);
        }

        const toc = await cursor.readExact(numStreams * 16);
        const tocView = new DataView(toc.buffer, toc.byteOffset, toc.byteLength);
        const reader = new BufferReader();
        const blockOffset = await data.initBlock(counts, shDegree);
        const decoder = createAttributeDecoder(reader, data, blockOffset, version, counts, shCounts, fractionalBits);

        for (let i = 0; i < numStreams; i++) {
            const entryOffset = i * 16;
            const compressedSize64 = tocView.getBigUint64(entryOffset, true);
            const uncompressedSize64 = tocView.getBigUint64(entryOffset + 8, true);
            if (compressedSize64 > MAX_SAFE_STREAM_SIZE || uncompressedSize64 > MAX_SAFE_STREAM_SIZE) {
                throw new Error(`SPZ stream size is too large at index ${i}`);
            }

            const compressedSize = Number(compressedSize64);
            const uncompressedSize = Number(uncompressedSize64);
            if (uncompressedSize !== expectedSizes[i]) {
                throw new Error(`Invalid SPZ v4 stream size at index ${i}`);
            }

            const decompressor = await createZstdDecompressor(128 * 1024);
            let produced = 0;
            const onChunk = (chunk: Uint8Array) => {
                produced += chunk.byteLength;
                reader.write(chunk);
                decoder.flush();
            };

            try {
                await cursor.readChunks(compressedSize, chunk => decompressor.feedView(chunk, onChunk));
                decompressor.finishView(onChunk);
            } finally {
                decompressor.free();
            }

            if (produced !== uncompressedSize) {
                throw new Error(`Invalid SPZ v4 decompressed size at index ${i}`);
            }
        }
    }

    private async readLegacyStream(stream: ReadableStream<Uint8Array>, data: IData) {
        const source = stream.pipeThrough<Uint8Array>(new (self as any).DecompressionStream('gzip')).getReader();
        const reader = new BufferReader();
        let decoder: StreamChunkDecoder | undefined;

        while (true) {
            const { done, value } = await source.read();
            if (done) {
                break;
            }
            reader.write(value);

            if (!decoder) {
                if (reader.remaining < 16) {
                    continue;
                }

                const header = reader.read(16);
                const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
                if (view.getUint32(0, true) !== SPZ_MAGIC) {
                    throw new Error('Invalid SPZ file');
                }

                const version = view.getUint32(4, true);
                if (version < 1 || version > SPZ_LEGACY_VERSION) {
                    throw new Error(`Unsupported SPZ version: ${version}`);
                }
                const counts = view.getUint32(8, true);
                const shDegree = view.getUint8(12);
                const shCounts = SH_MAPS[shDegree];
                if (shCounts === undefined) {
                    throw new Error(`Unsupported SPZ SH degree: ${shDegree}`);
                }
                const fractionalBits = view.getUint8(13);

                const blockOffset = await data.initBlock(counts, shDegree);
                decoder = createAttributeDecoder(reader, data, blockOffset, version, counts, shCounts, fractionalBits);
            }

            decoder.flush();
        }
    }

    async read(stream: ReadableStream<Uint8Array>, _contentLength: number, data: IData) {
        const [probeStream, dataStream] = stream.tee();
        const cursor = new ByteStreamCursor(probeStream);
        let prefix: Uint8Array;
        try {
            prefix = await cursor.readExact(4);
        } catch (error) {
            dataStream.cancel(error).catch(() => {});
            throw error;
        } finally {
            cursor.cancel().catch(() => {});
        }

        const isSpz = new Uint32Array(prefix.buffer)[0] === SPZ_MAGIC;
        await (isSpz ? this.readStream(dataStream, data) : this.readLegacyStream(dataStream, data));
        data.finishBlock();
    }

    async write(writeStream: WritableStream<Uint8Array>, data: IData) {
        const compressStream = new (self as any).CompressionStream('gzip') as TransformStream<Uint8Array, Uint8Array>;
        const pipePromise = compressStream.readable.pipeTo(writeStream);
        const writer = compressStream.writable.getWriter();

        const counts: number = data.counts;
        const shDegree: number = data.shDegree;
        const fractionalBits: number = 12;

        const fraction = 1 << fractionalBits;
        const shCounts = SH_MAPS[shDegree];

        // header
        {
            const buffer = new Uint8Array(16);
            const header = new DataView(buffer.buffer);
            header.setUint32(0, SPZ_MAGIC, true);
            header.setUint32(4, SPZ_LEGACY_VERSION, true);
            header.setUint32(8, counts, true);
            header.setUint8(12, shDegree);
            header.setUint8(13, fractionalBits);
            header.setUint8(14, FLAG_ANTIALIASED);
            header.setUint8(15, 0);
            writer.write(buffer);
        }

        const single: ISingleSplat = {
            x: 0,
            y: 0,
            z: 0,
            sx: 0,
            sy: 0,
            sz: 0,
            qx: 0,
            qy: 0,
            qz: 0,
            qw: 0,
            r: 0,
            g: 0,
            b: 0,
            a: 0,
        };

        // center
        {
            const ItemSize = 9;
            const chunkSize = 4096;
            const chunkCounts = Math.ceil(data.counts / chunkSize);
            for (let i = 0; i < chunkCounts; i++) {
                if (writer.desiredSize! <= 0) {
                    await writer.ready;
                }

                const currentChunkSize = Math.min(chunkSize, data.counts - i * chunkSize);
                const chunk = new Uint8Array(currentChunkSize * ItemSize);
                const offset = i * chunkSize;
                for (let j = 0; j < currentChunkSize; j++) {
                    data.getCenter(offset + j, single);
                    const o = j * ItemSize;
                    const ix = clamp(single.x * fraction, -0x7fffff, 0x7fffff);
                    chunk[o + 0] = ix & 0xff;
                    chunk[o + 1] = (ix >> 8) & 0xff;
                    chunk[o + 2] = (ix >> 16) & 0xff;
                    const iy = clamp(single.y * fraction, -0x7fffff, 0x7fffff);
                    chunk[o + 3] = iy & 0xff;
                    chunk[o + 4] = (iy >> 8) & 0xff;
                    chunk[o + 5] = (iy >> 16) & 0xff;
                    const iz = clamp(single.z * fraction, -0x7fffff, 0x7fffff);
                    chunk[o + 6] = iz & 0xff;
                    chunk[o + 7] = (iz >> 8) & 0xff;
                    chunk[o + 8] = (iz >> 16) & 0xff;
                }

                writer.write(chunk);
                await Promise.resolve();
            }
        }

        // alpha
        {
            const chunkSize = 65536;
            const chunkCounts = Math.ceil(data.counts / chunkSize);
            for (let i = 0; i < chunkCounts; i++) {
                if (writer.desiredSize! <= 0) {
                    await writer.ready;
                }

                const currentChunkSize = Math.min(chunkSize, data.counts - i * chunkSize);
                const chunk = new Uint8Array(currentChunkSize);
                const offset = i * chunkSize;
                for (let j = 0; j < currentChunkSize; j++) {
                    data.getAlpha(offset + j, single);
                    chunk[j] = clamp(Math.round(single.a * 255), 0, 255);
                }

                writer.write(chunk);
                await Promise.resolve();
            }
        }

        // color
        {
            const ItemSize = 3;
            const chunkSize = 16384;
            const chunkCounts = Math.ceil(data.counts / chunkSize);
            for (let i = 0; i < chunkCounts; i++) {
                if (writer.desiredSize! <= 0) {
                    await writer.ready;
                }

                const currentChunkSize = Math.min(chunkSize, data.counts - i * chunkSize);
                const chunk = new Uint8Array(currentChunkSize * ItemSize);
                const offset = i * chunkSize;
                for (let j = 0; j < currentChunkSize; j++) {
                    data.getColor(offset + j, single);
                    const o = j * ItemSize;
                    chunk[o + 0] = clamp(Math.round(((single.r - 0.5) / COLOR_SCALE + 0.5) * 255), 0, 255);
                    chunk[o + 1] = clamp(Math.round(((single.g - 0.5) / COLOR_SCALE + 0.5) * 255), 0, 255);
                    chunk[o + 2] = clamp(Math.round(((single.b - 0.5) / COLOR_SCALE + 0.5) * 255), 0, 255);
                }

                writer.write(chunk);
                await Promise.resolve();
            }
        }

        // scale
        {
            const ItemSize = 3;
            const chunkSize = 16384;
            const chunkCounts = Math.ceil(data.counts / chunkSize);
            for (let i = 0; i < chunkCounts; i++) {
                if (writer.desiredSize! <= 0) {
                    await writer.ready;
                }

                const currentChunkSize = Math.min(chunkSize, data.counts - i * chunkSize);
                const chunk = new Uint8Array(currentChunkSize * ItemSize);
                const offset = i * chunkSize;
                for (let j = 0; j < currentChunkSize; j++) {
                    data.getScale(offset + j, single);
                    const o = j * ItemSize;
                    chunk[o + 0] = clamp(Math.round((Math.log(single.sx) + 10) * 16), 0, 255);
                    chunk[o + 1] = clamp(Math.round((Math.log(single.sy) + 10) * 16), 0, 255);
                    chunk[o + 2] = clamp(Math.round((Math.log(single.sz) + 10) * 16), 0, 255);
                }

                writer.write(chunk);
                await Promise.resolve();
            }
        }

        // quat
        {
            const ItemSize = 4;
            const chunkSize = 16384;
            const chunkCounts = Math.ceil(data.counts / chunkSize);
            for (let i = 0; i < chunkCounts; i++) {
                if (writer.desiredSize! <= 0) {
                    await writer.ready;
                }

                const currentChunkSize = Math.min(chunkSize, data.counts - i * chunkSize);
                const chunk = new Uint8Array(currentChunkSize * ItemSize);
                const offset = i * chunkSize;
                for (let j = 0; j < currentChunkSize; j++) {
                    data.getQuat(offset + j, single);
                    const o = j * ItemSize;
                    rotation[0] = single.qx;
                    rotation[1] = single.qy;
                    rotation[2] = single.qz;
                    rotation[3] = single.qw;
                    let iLargest = 0;
                    for (let i = 1; i < 4; ++i) {
                        if (Math.abs(rotation[i]) > Math.abs(rotation[iLargest])) {
                            iLargest = i;
                        }
                    }
                    const negate = rotation[iLargest] < 0 ? 1 : 0;
                    let comp = iLargest;
                    for (let i = 0; i < 4; ++i) {
                        if (i !== iLargest) {
                            const negbit = (rotation[i] < 0 ? 1 : 0) ^ negate;
                            const mag = Math.floor(((1 << 9) - 1) * (Math.abs(rotation[i]) / Math.SQRT1_2) + 0.5);
                            comp = (comp << 10) | (negbit << 9) | mag;
                        }
                    }
                    chunk[o + 0] = comp & 0xff;
                    chunk[o + 1] = (comp >> 8) & 0xff;
                    chunk[o + 2] = (comp >> 16) & 0xff;
                    chunk[o + 3] = (comp >> 24) & 0xff;
                }

                writer.write(chunk);
                await Promise.resolve();
            }
        }

        // shN
        if (shDegree > 0) {
            const shN = new Array(shCounts);
            const ItemSize = shCounts;
            const chunkSize = 1024;
            const chunkCounts = Math.ceil(data.counts / chunkSize);
            for (let i = 0; i < chunkCounts; i++) {
                if (writer.desiredSize! <= 0) {
                    await writer.ready;
                }

                const currentChunkSize = Math.min(chunkSize, data.counts - i * chunkSize);
                const chunk = new Uint8Array(currentChunkSize * ItemSize);
                const offset = i * chunkSize;
                for (let j = 0; j < currentChunkSize; j++) {
                    data.getShN(offset + j, shN);
                    const o = j * ItemSize;
                    for (let k = 0; k < ItemSize; k++) {
                        if (k < 9) {
                            chunk[o + k] = clamp(
                                Math.floor((Math.round(shN[k] * 128) + 128 + SH_SCALE1 / 2) / SH_SCALE1) * SH_SCALE1,
                                0,
                                255,
                            );
                            continue;
                        }
                        chunk[o + k] = clamp(
                            Math.floor((Math.round(shN[k] * 128) + 128 + SH_SCALE2 / 2) / SH_SCALE2) * SH_SCALE2,
                            0,
                            255,
                        );
                    }
                }

                writer.write(chunk);
                await Promise.resolve();
            }
        }

        await writer.close();
        await pipePromise;
    }
}
