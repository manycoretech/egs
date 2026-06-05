import { SplatData } from './SplatData';
import {
    type ISampler,
    ISamplerFormat,
    type ISingleSplat,
    type ISplatData,
    computeTextureSize,
    clamp,
    toHalf,
    fromHalf,
    encodeQuatOct,
    decodeQuatOct,
} from './utils';

function packSint5x9ToUint32x2(data: number[], out: Uint32Array, offset: number) {
    const q0 = ((data[0] * 16 + 16.5) | 0) & 31;
    const q1 = ((data[1] * 16 + 16.5) | 0) & 31;
    const q2 = ((data[2] * 16 + 16.5) | 0) & 31;
    const q3 = ((data[3] * 16 + 16.5) | 0) & 31;
    const q4 = ((data[4] * 16 + 16.5) | 0) & 31;
    const q5 = ((data[5] * 16 + 16.5) | 0) & 31;
    const q6 = ((data[6] * 16 + 16.5) | 0) & 31;
    const q7 = ((data[7] * 16 + 16.5) | 0) & 31;
    const q8 = ((data[8] * 16 + 16.5) | 0) & 31;

    let low = 0;
    let high = 0;
    low |= q0 << 0;
    low |= q1 << 5;
    low |= q2 << 10;
    low |= q3 << 15;
    low |= q4 << 20;
    low |= q5 << 25;
    low |= (q6 & 0x3) << 30;
    high |= q6 >>> 2;
    high |= q7 << 3;
    high |= q8 << 8;

    out[offset] = low;
    out[offset + 1] = high;
}

function unpackSint5x9FromUint32x2(low: number, high: number, out: number[], offset: number) {
    out[offset + 0] = (((low >>> 0) & 0x1f) - 16) * 0.0625;
    out[offset + 1] = (((low >>> 5) & 0x1f) - 16) * 0.0625;
    out[offset + 2] = (((low >>> 10) & 0x1f) - 16) * 0.0625;
    out[offset + 3] = (((low >>> 15) & 0x1f) - 16) * 0.0625;
    out[offset + 4] = (((low >>> 20) & 0x1f) - 16) * 0.0625;
    out[offset + 5] = (((low >>> 25) & 0x1f) - 16) * 0.0625;

    const lowBits = (low >>> 30) & 0x3;
    const highBits = (high & 0x7) << 2;
    out[offset + 6] = ((lowBits | highBits) - 16) * 0.0625;
    out[offset + 7] = (((high >>> 3) & 0x1f) - 16) * 0.0625;
    out[offset + 8] = (((high >>> 8) & 0x1f) - 16) * 0.0625;
}

function packSint4ToUint8(v0: number, v1: number): number {
    const l = ((v0 * 8 + 8.5) | 0) & 15;
    const h = ((v1 * 8 + 8.5) | 0) & 15;
    return (h << 4) | l;
}

function unpackUint8ToSint4x2(value: number, out: number[], offset: number) {
    out[offset] = (value & 0x0f) * 0.125 - 1.0;
    out[offset + 1] = ((value >> 4) & 0x0f) * 0.125 - 1.0;
}

function toUnsignedChar(v: number): number {
    return clamp((v * 128 + 128.5) | 0, 0, 255);
}

function fromUnsignedChar(v: number): number {
    return (v - 128) / 128;
}

function toUnsignedCharV2(v: number): number {
    return clamp((v * 255 + 0.5) | 0, 0, 255);
}

const LN_SCALE_MIN = -12;
const LN_SCALE_MAX = 9;
const LN_SCALE = 254.0 / (LN_SCALE_MAX - LN_SCALE_MIN);
const LN_SCALE_INV = 1 / LN_SCALE;
export class SuperCompressedSplatData extends SplatData {
    counts: number = 0;
    shDegree: number = 0;

    private splatSampler: ISampler;
    private splatUint8Buffer: Uint8Array;
    private splatUint16Buffer: Uint16Array;

    private sh1Sampler: ISampler;
    private sh1Uint8Buffer: Uint8Array;
    private sh1Uint32Buffer: Uint32Array;

    private sh2Sampler: ISampler;
    private sh2Uint8Buffer: Uint8Array;

    init(counts: number, shDegree: number) {
        this.counts = counts;
        this.shDegree = Math.min(shDegree, this.maxShDegree);

        const { w: width, h: height, d: depth } = computeTextureSize(counts, this.maxTextureSize);
        const pixelCounts = width * height * depth;

        const splatSampler = (this.splatSampler = {
            width,
            height,
            depth,
            format: ISamplerFormat.RGBA_UINT,
            source: new Uint8Array(16 * pixelCounts),
        });
        this.splatUint8Buffer = splatSampler.source;
        this.splatUint16Buffer = new Uint16Array(splatSampler.source.buffer);

        const sh1Sampler = (this.sh1Sampler = {
            width,
            height,
            depth,
            format: shDegree === 1 ? ISamplerFormat.RG_UINT : ISamplerFormat.RGBA_UINT,
            source: new Uint8Array((shDegree >= 1 ? (shDegree === 1 ? 8 : 16) : 0) * pixelCounts),
        });
        this.sh1Uint8Buffer = sh1Sampler.source;
        this.sh1Uint32Buffer = new Uint32Array(sh1Sampler.source.buffer);
        const sh2Sampler = (this.sh2Sampler = {
            width,
            height,
            depth,
            format: ISamplerFormat.RGBA_UINT,
            source: new Uint8Array((shDegree >= 3 ? 16 : 0) * pixelCounts),
        });
        this.sh2Uint8Buffer = sh2Sampler.source;
    }

    set(i: number, single: ISingleSplat) {
        const { splatUint16Buffer, splatUint8Buffer } = this;
        const i8 = i * 8;
        const i16 = i * 16;

        splatUint16Buffer[i8 + 0] = toHalf(single.x);
        splatUint16Buffer[i8 + 1] = toHalf(single.y);
        splatUint16Buffer[i8 + 2] = toHalf(single.z);

        splatUint8Buffer[i16 + 6] = clamp(((Math.log(single.sx) - LN_SCALE_MIN) * LN_SCALE + 1.5) | 0, 0, 255);
        splatUint8Buffer[i16 + 7] = clamp(((Math.log(single.sy) - LN_SCALE_MIN) * LN_SCALE + 1.5) | 0, 0, 255);
        splatUint8Buffer[i16 + 8] = clamp(((Math.log(single.sz) - LN_SCALE_MIN) * LN_SCALE + 1.5) | 0, 0, 255);

        const oct = encodeQuatOct(single.qx, single.qy, single.qz, single.qw);
        splatUint8Buffer[i16 + 9] = toUnsignedChar(oct[0]);
        splatUint8Buffer[i16 + 10] = toUnsignedChar(oct[1]);
        splatUint8Buffer[i16 + 11] = toUnsignedCharV2(oct[2]);

        splatUint8Buffer[i16 + 12] = toUnsignedCharV2(single.r);
        splatUint8Buffer[i16 + 13] = toUnsignedCharV2(single.g);
        splatUint8Buffer[i16 + 14] = toUnsignedCharV2(single.b);
        splatUint8Buffer[i16 + 15] = toUnsignedCharV2(single.a);
    }

    setCenter(i: number, x: number, y: number, z: number) {
        const { splatUint16Buffer } = this;
        const offset = i * 8;
        splatUint16Buffer[offset + 0] = toHalf(x);
        splatUint16Buffer[offset + 1] = toHalf(y);
        splatUint16Buffer[offset + 2] = toHalf(z);
    }

    setScale(i: number, sx: number, sy: number, sz: number) {
        const { splatUint8Buffer } = this;
        const offset = i * 16;
        splatUint8Buffer[offset + 6] = clamp(((Math.log(sx) - LN_SCALE_MIN) * LN_SCALE + 1.5) | 0, 0, 255);
        splatUint8Buffer[offset + 7] = clamp(((Math.log(sy) - LN_SCALE_MIN) * LN_SCALE + 1.5) | 0, 0, 255);
        splatUint8Buffer[offset + 8] = clamp(((Math.log(sz) - LN_SCALE_MIN) * LN_SCALE + 1.5) | 0, 0, 255);
    }

    setQuat(i: number, qx: number, qy: number, qz: number, qw: number) {
        const { splatUint8Buffer } = this;
        const offset = i * 16;
        const oct = encodeQuatOct(qx, qy, qz, qw);
        splatUint8Buffer[offset + 9] = toUnsignedChar(oct[0]);
        splatUint8Buffer[offset + 10] = toUnsignedChar(oct[1]);
        splatUint8Buffer[offset + 11] = toUnsignedCharV2(oct[2]);
    }

    setColor(i: number, r: number, g: number, b: number) {
        const { splatUint8Buffer } = this;
        const offset = i * 16;
        splatUint8Buffer[offset + 12] = toUnsignedCharV2(r);
        splatUint8Buffer[offset + 13] = toUnsignedCharV2(g);
        splatUint8Buffer[offset + 14] = toUnsignedCharV2(b);
    }

    setAlpha(i: number, a: number) {
        const { splatUint8Buffer } = this;
        const offset = i * 16;
        splatUint8Buffer[offset + 15] = toUnsignedCharV2(a);
    }

    setShN(i: number, shN: number[]) {
        const { shDegree, sh1Uint32Buffer, sh1Uint8Buffer, sh2Uint8Buffer } = this;

        if (shDegree >= 1) {
            const offset = (shDegree === 1 ? 2 : 4) * i;
            packSint5x9ToUint32x2(shN, sh1Uint32Buffer, offset);
        }

        if (shDegree >= 2) {
            const offset = 16 * i + 8;
            sh1Uint8Buffer[offset + 0] = packSint4ToUint8(shN[9], shN[10]);
            sh1Uint8Buffer[offset + 1] = packSint4ToUint8(shN[11], shN[12]);
            sh1Uint8Buffer[offset + 2] = packSint4ToUint8(shN[13], shN[14]);
            sh1Uint8Buffer[offset + 3] = packSint4ToUint8(shN[15], shN[16]);
            sh1Uint8Buffer[offset + 4] = packSint4ToUint8(shN[17], shN[18]);
            sh1Uint8Buffer[offset + 5] = packSint4ToUint8(shN[19], shN[20]);
            sh1Uint8Buffer[offset + 6] = packSint4ToUint8(shN[21], shN[22]);
            sh1Uint8Buffer[offset + 7] = packSint4ToUint8(shN[23], 0);
        }

        if (shDegree >= 3) {
            const offset = 16 * i;
            sh2Uint8Buffer[offset + 0] = packSint4ToUint8(shN[24], shN[25]);
            sh2Uint8Buffer[offset + 1] = packSint4ToUint8(shN[26], shN[27]);
            sh2Uint8Buffer[offset + 2] = packSint4ToUint8(shN[28], shN[29]);
            sh2Uint8Buffer[offset + 3] = packSint4ToUint8(shN[30], shN[31]);
            sh2Uint8Buffer[offset + 4] = packSint4ToUint8(shN[32], shN[33]);
            sh2Uint8Buffer[offset + 5] = packSint4ToUint8(shN[34], shN[35]);
            sh2Uint8Buffer[offset + 6] = packSint4ToUint8(shN[36], shN[37]);
            sh2Uint8Buffer[offset + 7] = packSint4ToUint8(shN[38], shN[39]);
            sh2Uint8Buffer[offset + 8] = packSint4ToUint8(shN[40], shN[41]);
            sh2Uint8Buffer[offset + 9] = packSint4ToUint8(shN[42], shN[43]);
            sh2Uint8Buffer[offset + 10] = packSint4ToUint8(shN[44], 0);
        }
    }

    get(i: number, single: ISingleSplat) {
        const { splatUint16Buffer, splatUint8Buffer } = this;

        const i8 = i * 8;
        const i16 = i * 16;

        single.x = fromHalf(splatUint16Buffer[i8 + 0]);
        single.y = fromHalf(splatUint16Buffer[i8 + 1]);
        single.z = fromHalf(splatUint16Buffer[i8 + 2]);

        const uScaleX = splatUint8Buffer[i16 + 6];
        const uScaleY = splatUint8Buffer[i16 + 7];
        const uScaleZ = splatUint8Buffer[i16 + 8];
        single.sx = Math.exp(LN_SCALE_MIN + (uScaleX - 1) * LN_SCALE_INV);
        single.sy = Math.exp(LN_SCALE_MIN + (uScaleY - 1) * LN_SCALE_INV);
        single.sz = Math.exp(LN_SCALE_MIN + (uScaleZ - 1) * LN_SCALE_INV);

        const u = fromUnsignedChar(splatUint8Buffer[i16 + 9]);
        const v = fromUnsignedChar(splatUint8Buffer[i16 + 10]);
        const angle = splatUint8Buffer[i16 + 11] / 255;
        const quat = decodeQuatOct(u, v, angle);
        single.qx = quat[0];
        single.qy = quat[1];
        single.qz = quat[2];
        single.qw = quat[3];

        single.r = splatUint8Buffer[i16 + 12] / 255;
        single.g = splatUint8Buffer[i16 + 13] / 255;
        single.b = splatUint8Buffer[i16 + 14] / 255;
        single.a = splatUint8Buffer[i16 + 15] / 255;
    }

    getCenter(i: number, single: ISingleSplat) {
        const { splatUint16Buffer } = this;
        const i8 = i * 8;
        single.x = fromHalf(splatUint16Buffer[i8 + 0]);
        single.y = fromHalf(splatUint16Buffer[i8 + 1]);
        single.z = fromHalf(splatUint16Buffer[i8 + 2]);
    }

    getScale(i: number, single: ISingleSplat) {
        const { splatUint8Buffer } = this;
        const i16 = i * 16;
        const uScaleX = splatUint8Buffer[i16 + 6];
        const uScaleY = splatUint8Buffer[i16 + 7];
        const uScaleZ = splatUint8Buffer[i16 + 8];
        single.sx = Math.exp(LN_SCALE_MIN + (uScaleX - 1) * LN_SCALE_INV);
        single.sy = Math.exp(LN_SCALE_MIN + (uScaleY - 1) * LN_SCALE_INV);
        single.sz = Math.exp(LN_SCALE_MIN + (uScaleZ - 1) * LN_SCALE_INV);
    }

    getQuat(i: number, single: ISingleSplat) {
        const { splatUint8Buffer } = this;
        const i16 = i * 16;
        const u = fromUnsignedChar(splatUint8Buffer[i16 + 9]);
        const v = fromUnsignedChar(splatUint8Buffer[i16 + 10]);
        const angle = splatUint8Buffer[i16 + 11] / 255;
        const quat = decodeQuatOct(u, v, angle);
        single.qx = quat[0];
        single.qy = quat[1];
        single.qz = quat[2];
        single.qw = quat[3];
    }

    getColor(i: number, single: ISingleSplat) {
        const { splatUint8Buffer } = this;
        const i16 = i * 16;
        single.r = splatUint8Buffer[i16 + 12] / 255;
        single.g = splatUint8Buffer[i16 + 13] / 255;
        single.b = splatUint8Buffer[i16 + 14] / 255;
    }

    getAlpha(i: number, single: ISingleSplat) {
        const { splatUint8Buffer } = this;
        const i16 = i * 16;
        single.a = splatUint8Buffer[i16 + 15] / 255;
    }

    getShN(i: number, shN: number[]) {
        const { shDegree, sh1Uint32Buffer, sh1Uint8Buffer, sh2Uint8Buffer } = this;

        if (shDegree >= 1) {
            const offset = (shDegree === 1 ? 2 : 4) * i;
            const low = sh1Uint32Buffer[offset];
            const high = sh1Uint32Buffer[offset + 1];
            unpackSint5x9FromUint32x2(low, high, shN, 0);
        }

        if (shDegree >= 2) {
            const offset = 16 * i + 8;
            unpackUint8ToSint4x2(sh1Uint8Buffer[offset + 0], shN, 9);
            unpackUint8ToSint4x2(sh1Uint8Buffer[offset + 1], shN, 11);
            unpackUint8ToSint4x2(sh1Uint8Buffer[offset + 2], shN, 13);
            unpackUint8ToSint4x2(sh1Uint8Buffer[offset + 3], shN, 15);
            unpackUint8ToSint4x2(sh1Uint8Buffer[offset + 5], shN, 17);
            unpackUint8ToSint4x2(sh1Uint8Buffer[offset + 6], shN, 19);
            unpackUint8ToSint4x2(sh1Uint8Buffer[offset + 7], shN, 21);
            shN[23] = (sh2Uint8Buffer[offset + 8] & 0x0f) * 0.125 - 1.0;
        }

        if (shDegree >= 3) {
            const offset = 16 * i;
            unpackUint8ToSint4x2(sh2Uint8Buffer[offset + 0], shN, 24);
            unpackUint8ToSint4x2(sh2Uint8Buffer[offset + 1], shN, 26);
            unpackUint8ToSint4x2(sh2Uint8Buffer[offset + 2], shN, 28);
            unpackUint8ToSint4x2(sh2Uint8Buffer[offset + 3], shN, 30);
            unpackUint8ToSint4x2(sh2Uint8Buffer[offset + 4], shN, 32);
            unpackUint8ToSint4x2(sh2Uint8Buffer[offset + 5], shN, 34);
            unpackUint8ToSint4x2(sh2Uint8Buffer[offset + 6], shN, 36);
            unpackUint8ToSint4x2(sh2Uint8Buffer[offset + 7], shN, 38);
            unpackUint8ToSint4x2(sh2Uint8Buffer[offset + 8], shN, 40);
            unpackUint8ToSint4x2(sh2Uint8Buffer[offset + 9], shN, 42);
            shN[44] = (sh2Uint8Buffer[offset + 10] & 0x0f) * 0.125 - 1.0;
        }
    }

    fillCenters(centers: Float32Array) {
        const { counts, splatUint16Buffer } = this;
        for (let i = 0; i < counts; i++) {
            const i3 = i * 3;
            const i8 = i * 8;
            centers[i3 + 0] = fromHalf(splatUint16Buffer[i8 + 0]);
            centers[i3 + 1] = fromHalf(splatUint16Buffer[i8 + 1]);
            centers[i3 + 2] = fromHalf(splatUint16Buffer[i8 + 2]);
        }
    }

    serialize(): ISplatData {
        return {
            counts: this.counts,
            shDegree: this.shDegree,
            samplers: [this.splatSampler, this.sh1Sampler, this.sh2Sampler],
        };
    }

    deserialize(data: ISplatData) {
        const { counts, shDegree, samplers } = data;
        this.counts = counts;
        this.shDegree = shDegree;

        const { w: width, h: height, d: depth } = computeTextureSize(counts, this.maxTextureSize);
        const pixelCounts = width * height * depth;

        const splatSampler = (this.splatSampler = samplers[0] ?? {
            width,
            height,
            depth,
            format: ISamplerFormat.RGBA_UINT,
            source: new Uint8Array(16 * pixelCounts),
        });
        this.splatUint8Buffer = new Uint8Array(splatSampler.source.buffer);
        this.splatUint16Buffer = new Uint16Array(splatSampler.source.buffer);

        const sh1Sampler = (this.sh1Sampler = samplers[1] ?? {
            width,
            height,
            depth,
            format: shDegree === 1 ? ISamplerFormat.RG_UINT : ISamplerFormat.RGBA_UINT,
            source: new Uint8Array((shDegree >= 1 ? (shDegree === 1 ? 8 : 16) : 0) * pixelCounts),
        });
        this.sh1Uint8Buffer = sh1Sampler.source;
        this.sh1Uint32Buffer = new Uint32Array(sh1Sampler.source.buffer);
        const sh2Sampler = (this.sh2Sampler = samplers[2] ?? {
            width,
            height,
            depth,
            format: ISamplerFormat.RGBA_UINT,
            source: new Uint8Array((shDegree >= 3 ? 16 : 0) * pixelCounts),
        });
        this.sh2Uint8Buffer = sh2Sampler.source;
    }
}
