import { CompressedSplatData } from '../splat/index.js';
import { createZstdDecompressor } from '../utils/zstd.js';
import { ByteStreamCursor, StreamChunkDecoder, forEachSplatChunk, type ChunkDecoder } from '../utils/stream.js';
import { decode111011s, fromHalf } from '../utils/packing.js';
import { decodeImage } from '../utils/texture.js';
import { decodeQuatOct, logTransform } from '../utils/math.js';
import { type IData, type IFile } from '../types.js';
import { SH_C0, SH_MAPS } from '../utils/splat.js';

interface Metadata {
    version: number;
    layout: 'low' | 'high';
    counts: number;
    shDegree: number;
    box: {
        min: [number, number, number];
        max: [number, number, number];
    };
}

const ESZ_MAGIC = 0x262834;
const ESZ_VERSION = 2;
const HIGH_PRECISION_STRIDE = 16;

const TEMP_ROT: number[] = new Array(4);
const PERM_TABLE = [
    // original quat idx ---> actual storage idx
    [0, 1, 2, 3],
    [3, 1, 2, 0],
    [1, 3, 2, 0],
    [1, 2, 3, 0],
];
const COLOR_SCALE = SH_C0 / 0.15;
const SCALE_LUT = new Float32Array(256);
const COLOR_LUT = new Float32Array(256);
for (let i = 0; i < 256; i++) {
    SCALE_LUT[i] = Math.exp(i / 16 - 10);
    COLOR_LUT[i] = (i / 255 - 0.5) * COLOR_SCALE + 0.5;
}

export class EszFile implements IFile {
    private async readLowPrecisionLayout(data: IData, blockOffset: number, meta: Metadata, cursor: ByteStreamCursor) {
        const {
            counts,
            shDegree,
            box: {
                min: [boxMinX, boxMinY, boxMinZ],
                max: [boxMaxX, boxMaxY, boxMaxZ],
            },
        } = meta;

        const decoders: Array<(start: number, size: number) => void> = [];
        const readImage = async () => {
            const size = await cursor.readUint32();
            const buffer = await cursor.readExact(size);
            return (await decodeImage(buffer as Uint8Array<ArrayBuffer>)).data;
        };

        {
            const minX = logTransform(boxMinX);
            const minY = logTransform(boxMinY);
            const minZ = logTransform(boxMinZ);
            const maxX = logTransform(boxMaxX);
            const maxY = logTransform(boxMaxY);
            const maxZ = logTransform(boxMaxZ);
            const rangeX = (maxX - minX) / 65535;
            const rangeY = (maxY - minY) / 65535;
            const rangeZ = (maxZ - minZ) / 65535;

            const meansL = await readImage();
            const meansU = await readImage();
            decoders.push((start, size) => {
                for (let i = start; i < start + size; i++) {
                    const target = blockOffset + i;
                    const o = i * 4;
                    const x = minX + rangeX * (meansL[o + 0] + (meansU[o + 0] << 8));
                    const y = minY + rangeY * (meansL[o + 1] + (meansU[o + 1] << 8));
                    const z = minZ + rangeZ * (meansL[o + 2] + (meansU[o + 2] << 8));
                    data.setCenter(
                        target,
                        Math.sign(x) * (Math.exp(Math.abs(x)) - 1),
                        Math.sign(y) * (Math.exp(Math.abs(y)) - 1),
                        Math.sign(z) * (Math.exp(Math.abs(z)) - 1),
                    );
                }
            });
        }

        {
            const scales = await readImage();
            decoders.push((start, size) => {
                for (let i = start; i < start + size; i++) {
                    const o = i * 4;
                    data.setScale(
                        blockOffset + i,
                        SCALE_LUT[scales[o + 0]],
                        SCALE_LUT[scales[o + 1]],
                        SCALE_LUT[scales[o + 2]],
                    );
                }
            });
        }

        {
            const quats = await readImage();
            decoders.push((start, size) => {
                for (let i = start; i < start + size; i++) {
                    const o = i * 4;
                    TEMP_ROT[0] = (quats[o + 0] / 255 - 0.5) * Math.SQRT2;
                    TEMP_ROT[1] = (quats[o + 1] / 255 - 0.5) * Math.SQRT2;
                    TEMP_ROT[2] = (quats[o + 2] / 255 - 0.5) * Math.SQRT2;
                    TEMP_ROT[3] = Math.sqrt(
                        Math.max(
                            0,
                            1.0 - TEMP_ROT[0] * TEMP_ROT[0] - TEMP_ROT[1] * TEMP_ROT[1] - TEMP_ROT[2] * TEMP_ROT[2],
                        ),
                    );
                    const perm = PERM_TABLE[quats[o + 3] - 252];
                    data.setQuat(
                        blockOffset + i,
                        TEMP_ROT[perm[0]],
                        TEMP_ROT[perm[1]],
                        TEMP_ROT[perm[2]],
                        TEMP_ROT[perm[3]],
                    );
                }
            });
        }

        {
            const colors = await readImage();
            decoders.push((start, size) => {
                for (let i = start; i < start + size; i++) {
                    const target = blockOffset + i;
                    const o = i * 4;
                    data.setColor(target, COLOR_LUT[colors[o + 0]], COLOR_LUT[colors[o + 1]], COLOR_LUT[colors[o + 2]]);
                    data.setAlpha(target, colors[o + 3] / 255);
                }
            });
        }

        if (shDegree > 0) {
            const shCounts = SH_MAPS[shDegree];
            const shCoeffs = shCounts / 3;
            const shN = new Array(shCounts).fill(0);
            const buffer = await readImage();
            decoders.push((start, size) => {
                for (let i = start; i < start + size; i++) {
                    const o = i * shCoeffs * 4;
                    for (let j = 0; j < shCoeffs; j++) {
                        shN[j * 3 + 0] = (buffer[o + j * 4 + 0] - 128) / 128;
                        shN[j * 3 + 1] = (buffer[o + j * 4 + 1] - 128) / 128;
                        shN[j * 3 + 2] = (buffer[o + j * 4 + 2] - 128) / 128;
                    }
                    data.setShN(blockOffset + i, shN);
                }
            });
        }
        await forEachSplatChunk(data, blockOffset, counts, (start, size) => {
            for (const decode of decoders) {
                decode(start, size);
            }
        });
    }

    private async readHighPrecisionLayout(data: IData, blockOffset: number, meta: Metadata, cursor: ByteStreamCursor) {
        const { counts, shDegree } = meta;
        const shGroups = SH_MAPS[shDegree] / 3;
        const segmentCount = 2 + Math.ceil(shGroups / 4);
        const expectedLength = counts * HIGH_PRECISION_STRIDE;

        if (data instanceof CompressedSplatData) {
            for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex++) {
                const length = await cursor.readUint32(true);
                if (length !== expectedLength) {
                    throw new Error(`Invalid ESZ high segment size: expected ${expectedLength}, got ${length}`);
                }
                await forEachSplatChunk(
                    data,
                    blockOffset,
                    counts,
                    async (start, size) => {
                        const target = data.serialize().samplers[segmentIndex].source;
                        if (target.byteLength) {
                            const offset = (data as IData).availableChunkCounts === undefined ? blockOffset + start : 0;
                            await cursor.readInto(target, offset * HIGH_PRECISION_STRIDE, size * HIGH_PRECISION_STRIDE);
                        } else {
                            await cursor.skip(size * HIGH_PRECISION_STRIDE);
                        }
                    },
                    segmentIndex,
                );
            }
            return;
        }

        const decoders: ChunkDecoder[] = [];
        const segment = (decode: (view: DataView, start: number, counts: number) => void) => {
            decoders.push({
                async init() {
                    const length = await cursor.readUint32(true);
                    if (length !== expectedLength) {
                        throw new Error('Invalid ESZ high segment size.');
                    }
                    return [counts, HIGH_PRECISION_STRIDE];
                },
                decode: (start, size, bytes) =>
                    decode(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), start, size),
            });
        };
        segment((view, start, batchCounts) => {
            for (let i = 0; i < batchCounts; i++) {
                const target = blockOffset + start + i;
                const o = i * HIGH_PRECISION_STRIDE;
                data.setCenter(
                    target,
                    view.getFloat32(o + 0, true),
                    view.getFloat32(o + 4, true),
                    view.getFloat32(o + 8, true),
                );
                data.setAlpha(target, fromHalf(view.getUint16(o + 12, true)));
            }
        });

        segment((view, start, batchCounts) => {
            for (let i = 0; i < batchCounts; i++) {
                const target = blockOffset + start + i;
                const o = i * HIGH_PRECISION_STRIDE;
                data.setColor(
                    target,
                    fromHalf(view.getUint16(o + 0, true)),
                    fromHalf(view.getUint16(o + 2, true)),
                    fromHalf(view.getUint16(o + 4, true)),
                );
                data.setScale(
                    target,
                    Math.exp(fromHalf(view.getUint16(o + 6, true))),
                    Math.exp(fromHalf(view.getUint16(o + 8, true))),
                    Math.exp(fromHalf(view.getUint16(o + 10, true))),
                );
                const packedQuat = view.getUint32(o + 12, true);
                const quat = decodeQuatOct(
                    ((packedQuat & 0x3ff) / 1023) * 2 - 1,
                    (((packedQuat >>> 10) & 0x3ff) / 1023) * 2 - 1,
                    ((packedQuat >>> 20) & 0xfff) / 4095,
                );
                data.setQuat(target, quat[0], quat[1], quat[2], quat[3]);
            }
        });

        const shN = new Array(SH_MAPS[shDegree]).fill(0);
        for (let groupOffset = 0; groupOffset < shGroups; groupOffset += 4) {
            const groupCounts = Math.min(4, shGroups - groupOffset);
            segment((view, start, batchCounts) => {
                for (let i = 0; i < batchCounts; i++) {
                    const target = blockOffset + start + i;
                    if (groupOffset > 0) {
                        data.getShN(target, shN);
                    } else {
                        shN.fill(0);
                    }
                    const o = i * HIGH_PRECISION_STRIDE;
                    for (let j = 0; j < groupCounts; j++) {
                        decode111011s(view.getUint32(o + j * 4, true), shN, (groupOffset + j) * 3);
                    }
                    data.setShN(target, shN);
                }
            });
        }
        await new StreamChunkDecoder(cursor).decodeColumns(decoders, data, blockOffset);
    }

    async read(stream: ReadableStream<Uint8Array>, _contentLength: number, data: IData) {
        const decompressor = await createZstdDecompressor(128 * 1024);
        const decompressed = stream.pipeThrough(
            new TransformStream<Uint8Array, Uint8Array>({
                transform(chunk, controller) {
                    for (const output of decompressor.feed(chunk) as Uint8Array[]) {
                        controller.enqueue(output);
                    }
                },
                flush(controller) {
                    for (const output of decompressor.finish() as Uint8Array[]) {
                        controller.enqueue(output);
                    }
                },
            }),
        );
        const cursor = new ByteStreamCursor(decompressed);
        try {
            if ((await cursor.readUint32(true)) !== ESZ_MAGIC) {
                throw new Error('Invalid ESZ file: missing EGS magic');
            }

            const metaLength = await cursor.readUint32(true);
            const metaBuffer = await cursor.readExact(metaLength);
            const meta = JSON.parse(new TextDecoder().decode(metaBuffer)) as Metadata;
            if (meta.version !== ESZ_VERSION) {
                throw new Error(`Unsupported ESZ version: ${meta.version}`);
            }
            if (meta.layout !== 'low' && meta.layout !== 'high') {
                throw new Error(`Unsupported ESZ layout: ${meta.layout}`);
            }

            const offset = await data.initBlock(meta.counts, meta.shDegree);
            if (meta.layout === 'high') {
                await this.readHighPrecisionLayout(data, offset, meta, cursor);
            } else {
                await this.readLowPrecisionLayout(data, offset, meta, cursor);
            }
            data.finishBlock();
        } finally {
            await cursor.cancel().catch(() => {});
            decompressor.free();
        }
    }

    async write(_stream: WritableStream<Uint8Array>, _data: IData) {
        throw new Error('Method not implemented.');
    }
}
