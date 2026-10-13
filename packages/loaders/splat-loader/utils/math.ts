export function clamp(v: number, min: number, max: number): number {
    return Math.min(Math.max(v, min), max);
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
const tempQuat = new Quaternion(0, 0, 0, 1);
export function encodeQuatOct(x: number, y: number, z: number, w: number): number[] {
    const q = tempQuat.set(x, y, z, w).normalize();
    if (q.w < 0) {
        q.set(-q.x, -q.y, -q.z, -q.w);
    }
    const theta = 2 * Math.acos(q.w);
    const xyz_norm = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z);
    let axisX: number;
    let axisY: number;
    let axisZ: number;
    if (xyz_norm < 1e-6) {
        axisX = 1;
        axisY = 0;
        axisZ = 0;
    } else {
        const invLength = 1 / xyz_norm;
        axisX = q.x * invLength;
        axisY = q.y * invLength;
        axisZ = q.z * invLength;
    }

    const sum = Math.abs(axisX) + Math.abs(axisY) + Math.abs(axisZ);
    let p_x = axisX / sum;
    let p_y = axisY / sum;
    if (axisZ < 0) {
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
    const invLength = 1 / (Math.sqrt(f_x * f_x + f_y * f_y + f_z * f_z) || 1);
    const theta = angle * Math.PI;
    const halfTheta = theta * 0.5;
    const s = Math.sin(halfTheta);
    tempArr[0] = f_x * invLength * s;
    tempArr[1] = f_y * invLength * s;
    tempArr[2] = f_z * invLength * s;
    tempArr[3] = Math.cos(halfTheta);
    return tempArr;
}

export function mix(min: number, max: number, s: number) {
    return (1.0 - s) * min + s * max;
}

export function logTransform(value: number) {
    return Math.sign(value) * Math.log(Math.abs(value) + 1);
}
