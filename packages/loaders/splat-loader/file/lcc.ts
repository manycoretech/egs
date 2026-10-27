import { forEachSplatChunk } from '../utils/stream.js';
import { type IFile, type IData, type ISingleSplat } from '../types.js';
import { mix } from '../utils/math.js';
import { type FileContext, getFileEntry, resolveFilePath } from '../utils/zip.js';

interface MetaAttribute {
    name: string;
    min: number[];
    max: number[];
}

interface Metadata {
    totalLevel: number;
    fileType: string;
    splats: number[];
    attributes: MetaAttribute[];
}

interface LodInfo {
    points: number;
    offset: number;
    size: number;
}

interface BlockInfo {
    x: number;
    y: number;
    lods: LodInfo[];
}

const SQRT_2 = 1.414213562373095;
const SQRT_2_INV = 0.7071067811865475;
function decodeRotation(v: number) {
    const d0 = (v & 1023) / 1023.0;
    const d1 = ((v >> 10) & 1023) / 1023.0;
    const d2 = ((v >> 20) & 1023) / 1023.0;
    const d3 = (v >> 30) & 3;

    const qx = d0 * SQRT_2 - SQRT_2_INV;
    const qy = d1 * SQRT_2 - SQRT_2_INV;
    const qz = d2 * SQRT_2 - SQRT_2_INV;
    let sum = qx * qx + qy * qy + qz * qz;
    sum = Math.min(1.0, sum);
    const qw = Math.sqrt(1 - sum);

    if (d3 === 0) {
        return [qw, qx, qy, qz];
    } else if (d3 === 1) {
        return [qx, qw, qy, qz];
    } else if (d3 === 2) {
        return [qx, qy, qw, qz];
    }

    return [qx, qy, qz, qw];
}

function DecodePacked_11_10_11(enc: number) {
    return [(enc & 0x7ff) / 2047.0, ((enc >> 11) & 0x3ff) / 1023.0, ((enc >> 21) & 0x7ff) / 2047.0];
}

// https://github.com/xgrids/LCCWhitepaper
export class LccFile implements IFile {
    private counts: number = 0;
    private shDegree: number = 0;
    private meta: Metadata;

    async read(stream: ReadableStream<Uint8Array>, _contentLength: number, data: IData, context?: FileContext) {
        if (!context) {
            throw new Error('LCC metadata requires a file index.');
        }
        this.meta = await new Response(stream).json();
        this.counts = this.meta.splats[0];
        this.shDegree = context.files[resolveFilePath(context.path, 'shcoef.bin')] ? 3 : 0;
        const BlockOffset = await data.initBlock(this.counts, this.shDegree);
        const names = ['index.bin', 'data.bin', ...(this.shDegree ? ['shcoef.bin'] : [])];
        const refs = Object.fromEntries(names.map(name => [name, getFileEntry(context, name)]));

        const setFn = data.set.bind(data) as IData['set'];
        const setShFn = data.setShN.bind(data) as IData['setShN'];

        const { meta } = this;

        const infos: BlockInfo[] = [];
        {
            const buffer = refs['index.bin'];
            const index = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
            const infoCounts = Math.floor(index.byteLength / (4 + 16 * meta.totalLevel));
            let offset = 0;
            for (let i = 0; i < infoCounts; i++) {
                const x = index.getInt16(offset, true);
                offset += 2;
                const y = index.getInt16(offset, true);
                offset += 2;

                const lods: LodInfo[] = [];
                for (let j = 0; j < meta.totalLevel; j++) {
                    const points = index.getInt32(offset, true);
                    offset += 4;
                    const ldOffset = Number(index.getBigInt64(offset, true));
                    offset += 8;
                    const size = index.getInt32(offset, true);
                    offset += 4;
                    lods.push({ points, offset: ldOffset, size });
                }

                infos.push({ x, y, lods });
            }
        }

        const attributes = meta.attributes.reduce<Record<string, MetaAttribute>>((p, c) => {
            p[c.name] = c;
            return p;
        }, {});
        const {
            scale: { min: scaleMin, max: scaleMax },
            shcoef: { min: shMin, max: shMax },
        } = attributes;

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
        const shData = new Array(45);
        let index = BlockOffset;
        for (let i = 0; i < infos.length; i++) {
            const info = infos[i];
            const { points, offset, size } = info.lods[0];
            const dataview = new DataView(refs['data.bin'].buffer, refs['data.bin'].byteOffset + offset, size);
            const shN = refs['shcoef.bin']
                ? new DataView(refs['shcoef.bin'].buffer, refs['shcoef.bin'].byteOffset + offset * 2, size * 2)
                : undefined;
            await forEachSplatChunk(data, index, points, (start, size) => {
                for (let j = start; j < start + size; j++) {
                    const off = j * 32;

                    single.x = dataview.getFloat32(off + 0, true);
                    single.y = dataview.getFloat32(off + 4, true);
                    single.z = dataview.getFloat32(off + 8, true);

                    single.r = dataview.getUint8(off + 12) / 255.0;
                    single.g = dataview.getUint8(off + 13) / 255.0;
                    single.b = dataview.getUint8(off + 14) / 255.0;
                    single.a = dataview.getUint8(off + 15) / 255.0;

                    single.sx = mix(scaleMin[0], scaleMax[0], dataview.getUint16(off + 16, true) / 65535.0);
                    single.sy = mix(scaleMin[1], scaleMax[1], dataview.getUint16(off + 18, true) / 65535.0);
                    single.sz = mix(scaleMin[2], scaleMax[2], dataview.getUint16(off + 20, true) / 65535.0);

                    const quat = decodeRotation(dataview.getUint32(off + 22, true));
                    single.qx = quat[0];
                    single.qy = quat[1];
                    single.qz = quat[2];
                    single.qw = quat[3];

                    setFn(index, single);

                    if (shN) {
                        const shOff = off * 2;
                        for (let k = 0; k < 15; k++) {
                            const v = DecodePacked_11_10_11(shN.getUint32(shOff + k * 4, true));
                            shData[k * 3] = mix(shMin[0], shMax[0], v[0]);
                            shData[k * 3 + 1] = mix(shMin[1], shMax[1], v[1]);
                            shData[k * 3 + 2] = mix(shMin[2], shMax[2], v[2]);
                        }
                        setShFn(index, shData);
                    }

                    index++;
                }
            });
        }
        data.finishBlock();
    }

    async write(_stream: WritableStream<Uint8Array>, _data: IData) {
        throw new Error('Method not implemented.');
    }
}
