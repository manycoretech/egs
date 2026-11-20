import { clampInteger } from './math.js';

const f32buffer = new Float32Array(1);
const u32buffer = new Uint32Array(f32buffer.buffer);
export function toHalf(f: number): number {
    f32buffer[0] = f;
    const bits = u32buffer[0];

    const sign = (bits >> 31) & 0x1;
    const exp = (bits >> 23) & 0xff;
    const frac = bits & 0x7fffff;
    const halfSign = sign << 15;

    if (exp === 0xff) {
        return halfSign | (frac !== 0 ? 0x7fff : 0x7c00);
    }

    const newExp = exp - 127 + 15;

    if (newExp >= 0x1f) {
        return halfSign | 0x7c00;
    }
    if (newExp <= 0) {
        if (newExp < -10) {
            return halfSign;
        }
        const subFrac = (frac | 0x800000) >> (1 - newExp + 13);
        return halfSign | subFrac;
    }

    const halfFrac = frac >> 13;
    return halfSign | (newExp << 10) | halfFrac;
}

const HALF_VALUES = new Float32Array(65536);
for (let exponent = 0; exponent < 32; exponent++) {
    const scale = 2 ** (exponent === 0 ? -14 : exponent - 15);
    for (let fraction = 0; fraction < 1024; fraction++) {
        let value: number;
        if (exponent === 31) {
            value = fraction === 0 ? Infinity : NaN;
        } else {
            value = (exponent === 0 ? fraction / 1024 : 1 + fraction / 1024) * scale;
        }
        const bits = exponent * 1024 + fraction;
        HALF_VALUES[bits] = value;
        HALF_VALUES[bits + 32768] = -value;
    }
}

export function fromHalf(h: number): number {
    return HALF_VALUES[h & 0xffff];
}

export function encode111011s(a: number, b: number, c: number) {
    return (
        (clampInteger(((a * 0.5 + 0.5) * 2047) | 0, 2047) << 21) |
        (clampInteger(((b * 0.5 + 0.5) * 1023) | 0, 1023) << 11) |
        clampInteger(((c * 0.5 + 0.5) * 2047) | 0, 2047)
    );
}

export function decode111011s(decode: number, out: number[], offset: number) {
    out[offset + 0] = (((decode >>> 21) & 2047) / 2047) * 2 - 1;
    out[offset + 1] = (((decode >>> 11) & 1023) / 1023) * 2 - 1;
    out[offset + 2] = ((decode & 2047) / 2047) * 2 - 1;
}

export function packSint5x9ToUint32x2(data: number[], out: Uint32Array, offset: number) {
    const q0 = clampInteger((data[0] * 16 + 16.5) | 0, 31);
    const q1 = clampInteger((data[1] * 16 + 16.5) | 0, 31);
    const q2 = clampInteger((data[2] * 16 + 16.5) | 0, 31);
    const q3 = clampInteger((data[3] * 16 + 16.5) | 0, 31);
    const q4 = clampInteger((data[4] * 16 + 16.5) | 0, 31);
    const q5 = clampInteger((data[5] * 16 + 16.5) | 0, 31);
    const q6 = clampInteger((data[6] * 16 + 16.5) | 0, 31);
    const q7 = clampInteger((data[7] * 16 + 16.5) | 0, 31);
    const q8 = clampInteger((data[8] * 16 + 16.5) | 0, 31);

    out[offset] = q0 | (q1 << 5) | (q2 << 10) | (q3 << 15) | (q4 << 20) | (q5 << 25) | ((q6 & 0x3) << 30);
    out[offset + 1] = (q6 >>> 2) | (q7 << 3) | (q8 << 8);
}

export function unpackSint5x9FromUint32x2(low: number, high: number, out: number[], offset: number) {
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

export function packSint4ToUint8(v0: number, v1: number): number {
    const l = clampInteger((v0 * 8 + 8.5) | 0, 15);
    const h = clampInteger((v1 * 8 + 8.5) | 0, 15);
    return (h << 4) | l;
}

export function unpackUint8ToSint4x2(value: number, out: number[], offset: number) {
    out[offset] = (value & 0x0f) * 0.125 - 1.0;
    out[offset + 1] = ((value >> 4) & 0x0f) * 0.125 - 1.0;
}

export function toUnsignedChar(v: number): number {
    return clampInteger((v * 128 + 128.5) | 0, 255);
}

export function fromUnsignedChar(v: number): number {
    return (v - 128) / 128;
}

export function toUnsignedCharV2(v: number): number {
    return clampInteger((v * 255 + 0.5) | 0, 255);
}
