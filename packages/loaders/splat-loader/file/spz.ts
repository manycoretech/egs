import { ISingleSplat, IData, IFile, SH_MAPS, SH_C0, BufferReader, fromHalf, clamp, StreamChunkDecoder } from './utils';

const SPZ_MAGIC = 0x5053474e; // NGSP = Niantic gaussian splat
const SPZ_VERSION = 3;
const FLAG_ANTIALIASED = 0x1;

const COLOR_SCALE = SH_C0 / 0.15;
const rotation: number[] = new Array(4);
const SH_SCALE1 = 1 << 3;
const SH_SCALE2 = 1 << 4;
export class SpzFile implements IFile {
    async read(stream: ReadableStream<Uint8Array>, _contentLength: number, data: IData) {
        const setCenter = data.setCenter.bind(data);
        const setAlpha = data.setAlpha.bind(data);
        const setColor = data.setColor.bind(data);
        const setScale = data.setScale.bind(data);
        const setQuat = data.setQuat.bind(data);
        const setShN = data.setShN.bind(data);

        const SCALE_LUT = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
            SCALE_LUT[i] = Math.exp(i / 16 - 10);
        }
        const COLOR_LUT = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
            COLOR_LUT[i] = (i / 255 - 0.5) * COLOR_SCALE + 0.5;
        }

        let version: number = SPZ_VERSION;
        let counts: number = 0;
        let shDegree: number = 0;
        let fractionalBits: number = 12;
        let flags: number = FLAG_ANTIALIASED;
        let reserved: number = 0;

        let isF16 = false;
        let useSmallestThreeQuat = true;
        let fraction = 1;
        let fractionInv = 1;
        let shCounts = 0;
        let BlockOffset: number = 0;
        const shN: number[] = [];

        const reader = new BufferReader();
        const decoder = new StreamChunkDecoder(reader);
        decoder.setDecoders([
            {
                init: () => [1, 16],
                decode: async (_offset, _counts, buf) => {
                    const header = new DataView(buf.buffer);
                    if (header.getUint32(0, true) !== SPZ_MAGIC) {
                        throw new Error('Invalid SPZ file');
                    }
                    version = header.getUint32(4, true);
                    if (version < 1 || version > 3) {
                        throw new Error(`Unsupported SPZ version: ${version}`);
                    }
                    counts = header.getUint32(8, true);
                    shDegree = header.getUint8(12);
                    fractionalBits = header.getUint8(13);
                    flags = header.getUint8(14);
                    reserved = header.getUint8(15);

                    isF16 = version < 2;
                    useSmallestThreeQuat = version >= 3;
                    fraction = 1 << fractionalBits;
                    fractionInv = 1 / fraction;
                    shCounts = SH_MAPS[shDegree];

                    BlockOffset = await data.initBlock(counts, shDegree);
                    if (flags || reserved) {
                        //
                    }
                },
            },
            {
                init: () => [counts, isF16 ? 6 : 9],
                decode: (offset, counts, buf) => {
                    offset += BlockOffset;
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
                    offset += BlockOffset;
                    for (let i = 0; i < counts; i++) {
                        setAlpha(offset + i, buf[i] / 255);
                    }
                },
            },
            {
                init: () => [counts, 3],
                decode: (offset, counts, buf) => {
                    offset += BlockOffset;
                    for (let i = 0; i < counts; i++) {
                        const o = i * 3;
                        setColor(offset + i, COLOR_LUT[buf[o]], COLOR_LUT[buf[o + 1]], COLOR_LUT[buf[o + 2]]);
                    }
                },
            },
            {
                init: () => [counts, 3],
                decode: (offset, counts, buf) => {
                    offset += BlockOffset;
                    for (let i = 0; i < counts; i++) {
                        const o = i * 3;
                        setScale(offset + i, SCALE_LUT[buf[o]], SCALE_LUT[buf[o + 1]], SCALE_LUT[buf[o + 2]]);
                    }
                },
            },
            {
                init: () => [counts, useSmallestThreeQuat ? 4 : 3],
                decode: (offset, counts, buf) => {
                    offset += BlockOffset;
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
                                const mag = temp & 0x1FF;
                                const sign = (temp >>> 9) & 1;
                                temp >>>= 10;

                                const v = Math.SQRT1_2 * (mag / 0x1FF) * (sign ? -1 : 1);
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
            {
                init: () => [counts, shCounts],
                decode: (offset, counts, buf) => {
                    offset += BlockOffset;
                    for (let i = 0; i < counts; i++) {
                        const o = i * shCounts;
                        for (let j = 0; j < shCounts; j++) {
                            shN[j] = (buf[o + j] - 128) / 128;
                        }
                        setShN(offset + i, shN);
                    }
                },
            },
        ]);

        const source = stream.pipeThrough<Uint8Array>(new (self as any).DecompressionStream('gzip')).getReader();
        while (true) {
            const { done, value } = await source.read();
            if (done) {
                break;
            }
            reader.write(value!);
            decoder.flush();
        }
        data.finishBlock();
    }

    async write(writeStream: WritableStream<Uint8Array>, data: IData) {
        const compressStream = new (self as any).CompressionStream('gzip') as TransformStream<Uint8Array, Uint8Array>;
        const pipePromise = compressStream.readable.pipeTo(writeStream);
        const writer = compressStream.writable.getWriter();

        const version: number = SPZ_VERSION;
        const counts: number = data.counts;
        const shDegree: number = data.shDegree;
        const fractionalBits: number = 12;
        const flags: number = FLAG_ANTIALIASED;
        const reserved: number = 0;

        const fraction = 1 << fractionalBits;
        const shCounts = SH_MAPS[shDegree];

        // header
        {
            const buffer = new Uint8Array(16);
            const header = new DataView(buffer.buffer);
            header.setUint32(0, SPZ_MAGIC, true);
            header.setUint32(4, version, true);
            header.setUint32(8, counts, true);
            header.setUint8(12, shDegree);
            header.setUint8(13, fractionalBits);
            header.setUint8(14, flags);
            header.setUint8(15, reserved);
            writer.write(buffer);
        }

        const single: ISingleSplat = {
            x: 0, y: 0, z: 0,
            sx: 0, sy: 0, sz: 0,
            qx: 0, qy: 0, qz: 0, qw: 0,
            r: 0, g: 0, b: 0, a: 0,
            shN: new Array(shCounts),
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
            const shN = single.shN;
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
                            chunk[o + k] = clamp(Math.floor((Math.round(shN[k] * 128) + 128 + SH_SCALE1 / 2) / SH_SCALE1) * SH_SCALE1, 0, 255);
                            continue;
                        }
                        chunk[o + k] = clamp(Math.floor((Math.round(shN[k] * 128) + 128 + SH_SCALE2 / 2) / SH_SCALE2) * SH_SCALE2, 0, 255);
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
