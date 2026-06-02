import { type ISingleSplat } from '@qunhe/egs-splat-loader';
import { type BVHSource } from '@qunhe/egs-lib';
import { SplatOperator } from './SplatOperator';

export type SplatEllipsoidPrimitive = ISingleSplat;

export class SplatEllipsoidPrimitiveSource implements BVHSource<SplatEllipsoidPrimitive> {
    private operator: SplatOperator;
    private radiusScale: number;
    private indices: Uint32Array;

    constructor(operator: SplatOperator, radiusScale: number = Math.sqrt(8)) {
        this.operator = operator;
        this.radiusScale = radiusScale;
    }

    build() {
        const { radiusScale, operator } = this;
        const count = operator.getActiveCounts();
        const indices = new Uint32Array(count);
        const centers = new Float32Array(count * 3);
        const boxMins = new Float32Array(count * 3);
        const boxMaxs = new Float32Array(count * 3);

        let offset = 0;
        operator.foreachSplat((i, single) => {
            indices[offset] = i;
            const o = offset * 3;
            centers[o + 0] = single.x;
            centers[o + 1] = single.y;
            centers[o + 2] = single.z;
            computeEllipsoidAABB(single, radiusScale, boxMins, boxMaxs, o);
            offset++;
        });

        this.indices = indices;
        return { count, indices, centers, boxMins, boxMaxs };
    }

    createEmpty(): SplatEllipsoidPrimitive {
        return {
            x: 0, y: 0, z: 0,
            sx: 0, sy: 0, sz: 0,
            qx: 0, qy: 0, qz: 0, qw: 0,
            r: 0, g: 0, b: 0, a: 0,
        };
    }

    get(localIdx: number, primitive: SplatEllipsoidPrimitive) {
        const { operator, indices } = this;
        operator.readSplat(indices[localIdx], primitive);
    }
}

function square(v: number) {
    return v * v;
}

function normalizeScale(scale: number, radiusScale: number) {
    const scaled = Math.abs(scale) * radiusScale;
    return Number.isFinite(scaled) ? scaled : 0;
}

function computeEllipsoidAABB(
    splat: ISingleSplat,
    radiusScale: number,
    boxMins: Float32Array,
    boxMaxs: Float32Array,
    offset: number,
) {
    const { x, y, z, sx, sy, sz } = splat;
    let { qx, qy, qz, qw } = splat;
    const rx = normalizeScale(sx, radiusScale);
    const ry = normalizeScale(sy, radiusScale);
    const rz = normalizeScale(sz, radiusScale);

    const quatLength = Math.hypot(qx, qy, qz, qw);
    if (Number.isFinite(quatLength) && quatLength > 0) {
        const invLength = 1 / quatLength;
        qx *= invLength;
        qy *= invLength;
        qz *= invLength;
        qw *= invLength;
    } else {
        qx = 0;
        qy = 0;
        qz = 0;
        qw = 1;
    }

    const x2 = qx + qx;
    const y2 = qy + qy;
    const z2 = qz + qz;
    const xx = qx * x2;
    const xy = qx * y2;
    const xz = qx * z2;
    const yy = qy * y2;
    const yz = qy * z2;
    const zz = qz * z2;
    const wx = qw * x2;
    const wy = qw * y2;
    const wz = qw * z2;

    const m11 = 1 - (yy + zz);
    const m12 = xy - wz;
    const m13 = xz + wy;
    const m21 = xy + wz;
    const m22 = 1 - (xx + zz);
    const m23 = yz - wx;
    const m31 = xz - wy;
    const m32 = yz + wx;
    const m33 = 1 - (xx + yy);

    const ex = Math.sqrt(square(m11 * rx) + square(m12 * ry) + square(m13 * rz));
    const ey = Math.sqrt(square(m21 * rx) + square(m22 * ry) + square(m23 * rz));
    const ez = Math.sqrt(square(m31 * rx) + square(m32 * ry) + square(m33 * rz));

    boxMins[offset + 0] = x - ex;
    boxMins[offset + 1] = y - ey;
    boxMins[offset + 2] = z - ez;
    boxMaxs[offset + 0] = x + ex;
    boxMaxs[offset + 1] = y + ey;
    boxMaxs[offset + 2] = z + ez;
}
