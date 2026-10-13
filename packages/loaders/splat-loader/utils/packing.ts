import { clamp } from './math.js';

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

export function fromHalf(h: number): number {
    const sign = (h >> 15) & 0x1;
    const exp = (h >> 10) & 0x1f;
    const frac = h & 0x3ff;

    let f32bits: number;
    if (exp === 0) {
        if (frac === 0) {
            f32bits = sign << 31;
        } else {
            // Shift the highest set bit of the 10-bit fraction into the implicit leading bit.
            const shift = Math.clz32(frac) - 21;
            const newExp = 127 - 14 - shift;
            const newFrac = ((frac << shift) & 0x3ff) << 13;
            f32bits = (sign << 31) | (newExp << 23) | newFrac;
        }
    } else if (exp === 0x1f) {
        f32bits = (sign << 31) | (frac === 0 ? 0x7f800000 : 0x7fc00000);
    } else {
        const newExp = exp - 15 + 127;
        const newFrac = frac << 13;
        f32bits = (sign << 31) | (newExp << 23) | newFrac;
    }

    u32buffer[0] = f32bits;
    return f32buffer[0];
}

export function encode111011s(a: number, b: number, c: number) {
    return (
        (clamp(((a * 0.5 + 0.5) * 2047) | 0, 0, 2047) << 21) |
        (clamp(((b * 0.5 + 0.5) * 1023) | 0, 0, 1023) << 11) |
        clamp(((c * 0.5 + 0.5) * 2047) | 0, 0, 2047)
    );
}

export function decode111011s(decode: number, out: number[], offset: number) {
    out[offset + 0] = (((decode >>> 21) & 2047) / 2047) * 2 - 1;
    out[offset + 1] = (((decode >>> 11) & 1023) / 1023) * 2 - 1;
    out[offset + 2] = ((decode & 2047) / 2047) * 2 - 1;
}

export function packSint5x9ToUint32x2(data: number[], out: Uint32Array, offset: number) {
    const q0 = clamp((data[0] * 16 + 16.5) | 0, 0, 31);
    const q1 = clamp((data[1] * 16 + 16.5) | 0, 0, 31);
    const q2 = clamp((data[2] * 16 + 16.5) | 0, 0, 31);
    const q3 = clamp((data[3] * 16 + 16.5) | 0, 0, 31);
    const q4 = clamp((data[4] * 16 + 16.5) | 0, 0, 31);
    const q5 = clamp((data[5] * 16 + 16.5) | 0, 0, 31);
    const q6 = clamp((data[6] * 16 + 16.5) | 0, 0, 31);
    const q7 = clamp((data[7] * 16 + 16.5) | 0, 0, 31);
    const q8 = clamp((data[8] * 16 + 16.5) | 0, 0, 31);

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
    const l = clamp((v0 * 8 + 8.5) | 0, 0, 15);
    const h = clamp((v1 * 8 + 8.5) | 0, 0, 15);
    return (h << 4) | l;
}

export function unpackUint8ToSint4x2(value: number, out: number[], offset: number) {
    out[offset] = (value & 0x0f) * 0.125 - 1.0;
    out[offset + 1] = ((value >> 4) & 0x0f) * 0.125 - 1.0;
}

export function toUnsignedChar(v: number): number {
    return clamp((v * 128 + 128.5) | 0, 0, 255);
}

export function fromUnsignedChar(v: number): number {
    return (v - 128) / 128;
}

export function toUnsignedCharV2(v: number): number {
    return clamp((v * 255 + 0.5) | 0, 0, 255);
}
