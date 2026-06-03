import { SplatData } from './SplatData';
import { type ISplatData, type ISingleSplat, Quaternion, ISamplerFormat, SH_MAPS } from './utils';

const tempQuat = new Quaternion(0, 0, 0, 1);

enum ColIdx {
    x = 0,
    y = 1,
    z = 2,
    sx = 3,
    sy = 4,
    sz = 5,
    qx = 6,
    qy = 7,
    qz = 8,
    qw = 9,
    r = 10,
    g = 11,
    b = 12,
    a = 13,
}

export class RawSplatData extends SplatData {
    counts: number = 0;
    shDegree: number = 0;

    private shCounts: number;
    private table: Float32Array[];

    init(counts: number, shDegree: number) {
        this.counts = counts;
        this.shDegree = Math.min(shDegree, this.maxShDegree);
        const shCounts = this.shCounts = SH_MAPS[shDegree];
        this.table = new Array(14 + shCounts).fill(0).map(() => new Float32Array(counts));
    }

    set(i: number, single: ISingleSplat) {
        const { table } = this;

        table[ColIdx.x][i] = single.x;
        table[ColIdx.y][i] = single.y;
        table[ColIdx.z][i] = single.z;

        table[ColIdx.sx][i] = single.sx;
        table[ColIdx.sy][i] = single.sy;
        table[ColIdx.sz][i] = single.sz;

        tempQuat.set(single.qx, single.qy, single.qz, single.qw).normalize();
        table[ColIdx.qx][i] = tempQuat.x;
        table[ColIdx.qy][i] = tempQuat.y;
        table[ColIdx.qz][i] = tempQuat.z;
        table[ColIdx.qw][i] = tempQuat.w;

        table[ColIdx.r][i] = single.r;
        table[ColIdx.g][i] = single.g;
        table[ColIdx.b][i] = single.b;
        table[ColIdx.a][i] = single.a;
    }

    setCenter(i: number, x: number, y: number, z: number) {
        const { table } = this;
        table[ColIdx.x][i] = x;
        table[ColIdx.y][i] = y;
        table[ColIdx.z][i] = z;
    }

    setScale(i: number, sx: number, sy: number, sz: number) {
        const { table } = this;
        table[ColIdx.sx][i] = sx;
        table[ColIdx.sy][i] = sy;
        table[ColIdx.sz][i] = sz;
    }

    setQuat(i: number, qx: number, qy: number, qz: number, qw: number) {
        const { table } = this;
        tempQuat.set(qx, qy, qz, qw).normalize();
        table[ColIdx.qx][i] = tempQuat.x;
        table[ColIdx.qy][i] = tempQuat.y;
        table[ColIdx.qz][i] = tempQuat.z;
        table[ColIdx.qw][i] = tempQuat.w;
    }

    setColor(i: number, r: number, g: number, b: number) {
        const { table } = this;
        table[ColIdx.r][i] = r;
        table[ColIdx.g][i] = g;
        table[ColIdx.b][i] = b;
    }

    setAlpha(i: number, a: number) {
        const { table } = this;
        table[ColIdx.a][i] = a;
    }

    setShN(i: number, shN: number[]) {
        const { table, shCounts } = this;
        const offset = ColIdx.a + 1;
        for (let j = 0; j < shCounts; j++) {
            table[offset + j][i] = shN[j];
        }
    };

    get(i: number, single: ISingleSplat) {
        const { table } = this;
        single.x = table[ColIdx.x][i];
        single.y = table[ColIdx.y][i];
        single.z = table[ColIdx.z][i];
        single.sx = table[ColIdx.sx][i];
        single.sy = table[ColIdx.sy][i];
        single.sz = table[ColIdx.sz][i];
        single.qx = table[ColIdx.qx][i];
        single.qy = table[ColIdx.qy][i];
        single.qz = table[ColIdx.qz][i];
        single.qw = table[ColIdx.qw][i];
        single.r = table[ColIdx.r][i];
        single.g = table[ColIdx.g][i];
        single.b = table[ColIdx.b][i];
        single.a = table[ColIdx.a][i];
    }

    getCenter(i: number, single: ISingleSplat) {
        const { table } = this;
        single.x = table[ColIdx.x][i];
        single.y = table[ColIdx.y][i];
        single.z = table[ColIdx.z][i];
    }

    getScale(i: number, single: ISingleSplat) {
        const { table } = this;
        single.sx = table[ColIdx.sx][i];
        single.sy = table[ColIdx.sy][i];
        single.sz = table[ColIdx.sz][i];
    }

    getQuat(i: number, single: ISingleSplat) {
        const { table } = this;
        single.qx = table[ColIdx.qx][i];
        single.qy = table[ColIdx.qy][i];
        single.qz = table[ColIdx.qz][i];
        single.qw = table[ColIdx.qw][i];
    }

    getColor(i: number, single: ISingleSplat) {
        const { table } = this;
        single.r = table[ColIdx.r][i];
        single.g = table[ColIdx.g][i];
        single.b = table[ColIdx.b][i];
    }

    getAlpha(i: number, single: ISingleSplat) {
        const { table } = this;
        single.a = table[ColIdx.a][i];
    }

    getShN(i: number, shN: number[]) {
        const { shCounts, table } = this;
        const offset = ColIdx.a + 1;
        for (let j = 0; j < shCounts; j++) {
            shN[j] = table[offset + j][i];
        }
    }

    fillCenters(centers: Float32Array) {
        const { counts, table } = this;
        const xBuffer = table[ColIdx.x];
        const yBuffer = table[ColIdx.y];
        const zBuffer = table[ColIdx.z];
        for (let i = 0; i < counts; i++) {
            const i3 = i * 3;
            centers[i3 + 0] = xBuffer[i];
            centers[i3 + 1] = yBuffer[i];
            centers[i3 + 2] = zBuffer[i];
        }
    }

    serialize(): ISplatData {
        return {
            counts: this.counts,
            shDegree: this.shDegree,
            samplers: this.table.map(buffer => ({
                width: this.counts, height: 1, depth: 1,
                format: ISamplerFormat.RGBA_UINT,
                source: new Uint8Array(buffer.buffer),
            })),
        };
    }

    deserialize(data: ISplatData) {
        const { counts, shDegree, samplers } = data;
        this.counts = counts;
        this.shDegree = shDegree;
        this.shCounts = SH_MAPS[shDegree];
        this.table = samplers.map(sampler => new Float32Array(sampler.source.buffer));
    }
}
