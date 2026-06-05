export enum ISamplerFormat {
    RG_UINT,
    RGBA_UINT,
}

export interface ISampler {
    width: number;
    height: number;
    depth: number;
    format: ISamplerFormat;
    source: Uint8Array;
}

export interface ISplatData {
    counts: number;
    shDegree: number;
    samplers: ISampler[];
    extras?: any[];
}

export interface ISingleSplat {
    x: number;
    y: number;
    z: number;
    sx: number;
    sy: number;
    sz: number;
    qx: number;
    qy: number;
    qz: number;
    qw: number;
    r: number;
    g: number;
    b: number;
    a: number;
}

export const SH_MAPS: Record<number, number> = {
    0: 0,
    1: 9,
    2: 24,
    3: 45,
};

export function computeTextureSize(counts: number, maxTextureSize: number): { w: number; h: number; d: number } {
    if (counts === 0) {
        return { w: 0, h: 0, d: 0 };
    }
    const width = Math.min(Math.ceil(Math.sqrt(counts) / 2) * 2, maxTextureSize);
    const height = Math.min(Math.ceil(counts / width), maxTextureSize);
    const depth = Math.ceil(counts / (width * height));
    return { w: width, h: height, d: depth };
}

export function clamp(v: number, min: number, max: number): number {
    return Math.min(Math.max(v, min), max);
}

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
        if (frac !== 0) {
            return halfSign | 0x7fff;
        }
        return halfSign | 0x7c00;
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
            let mant = frac;
            let e = -14;
            while ((mant & 0x400) === 0) {
                mant <<= 1;
                e--;
            }
            mant &= 0x3ff;
            const newExp = e + 127;
            const newFrac = mant << 13;
            f32bits = (sign << 31) | (newExp << 23) | newFrac;
        }
    } else if (exp === 0x1f) {
        if (frac === 0) {
            f32bits = (sign << 31) | 0x7f800000;
        } else {
            f32bits = (sign << 31) | 0x7fc00000;
        }
    } else {
        const newExp = exp - 15 + 127;
        const newFrac = frac << 13;
        f32bits = (sign << 31) | (newExp << 23) | newFrac;
    }

    u32buffer[0] = f32bits;
    return f32buffer[0];
}

class Vector3 {
    constructor(
        public x: number,
        public y: number,
        public z: number,
    ) {}

    set(x: number, y: number, z: number): this {
        this.x = x;
        this.y = y;
        this.z = z;
        return this;
    }

    length(): number {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }

    divideScalar(scalar: number): this {
        const invLength = 1 / scalar;
        this.x *= invLength;
        this.y *= invLength;
        this.z *= invLength;
        return this;
    }

    normalize(): this {
        return this.divideScalar(this.length() || 1);
    }
}

export class Quaternion {
    constructor(
        public x: number,
        public y: number,
        public z: number,
        public w: number,
    ) {}

    set(x: number, y: number, z: number, w: number): this {
        this.x = x;
        this.y = y;
        this.z = z;
        this.w = w;
        return this;
    }

    normalize(): this {
        const length = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w);
        if (length === 0) {
            return this;
        }
        const invLength = 1 / length;
        this.x *= invLength;
        this.y *= invLength;
        this.z *= invLength;
        this.w *= invLength;
        return this;
    }
}

const tempArr = new Array(4);
const tempVec = new Vector3(0, 0, 0);
const tempQuat = new Quaternion(0, 0, 0, 1);
export function encodeQuatOct(x: number, y: number, z: number, w: number): number[] {
    const q = tempQuat.set(x, y, z, w).normalize();
    if (q.w < 0) {
        q.set(-q.x, -q.y, -q.z, -q.w);
    }
    const theta = 2 * Math.acos(q.w);
    const xyz_norm = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z);
    const axis = xyz_norm < 1e-6 ? tempVec.set(1, 0, 0) : tempVec.set(q.x, q.y, q.z).divideScalar(xyz_norm);

    const sum = Math.abs(axis.x) + Math.abs(axis.y) + Math.abs(axis.z);
    let p_x = axis.x / sum;
    let p_y = axis.y / sum;
    if (axis.z < 0) {
        const tmp = p_x;
        p_x = (1 - Math.abs(p_y)) * (p_x >= 0 ? 1 : -1);
        p_y = (1 - Math.abs(tmp)) * (p_y >= 0 ? 1 : -1);
    }
    tempArr[0] = p_x;
    tempArr[1] = p_y;
    tempArr[2] = theta / Math.PI;
    return tempArr;
}

export function decodeQuatOct(u: number, v: number, angle: number): number[] {
    let f_x = u;
    let f_y = v;
    const f_z = 1 - (Math.abs(f_x) + Math.abs(f_y));
    const t = Math.max(-f_z, 0);
    f_x += f_x >= 0 ? -t : t;
    f_y += f_y >= 0 ? -t : t;
    const axis = tempVec.set(f_x, f_y, f_z).normalize();
    const theta = angle * Math.PI;
    const halfTheta = theta * 0.5;
    const s = Math.sin(halfTheta);
    tempArr[0] = axis.x * s;
    tempArr[1] = axis.y * s;
    tempArr[2] = axis.z * s;
    tempArr[3] = Math.cos(halfTheta);
    return tempArr;
}
