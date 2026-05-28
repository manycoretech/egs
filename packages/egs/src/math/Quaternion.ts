import { Euler } from './Euler';
import { Vector3 } from './Vector3';
import { Matrix4 } from './Matrix4';
import { _Math } from './Math';
/**
 * Implementation of a {@link http://en.wikipedia.org/wiki/Quaternion| quaternion}.
 * Quaternions are used to represent {@link https://en.wikipedia.org/wiki/Quaternions_and_spatial_rotation| rotations}.
 */
export class Quaternion {
    private _x: number;
    private _y: number;
    private _z: number;
    private _w: number;
    /**
     * Check the type whether it belongs to Matrix3.
     * This value should not be changed by user.
     */
    public isQuaternion = true;

    constructor(x?: number, y?: number, z?: number, w?: number) {
        this._x = x || 0;
        this._y = y || 0;
        this._z = z || 0;
        this._w = (w !== undefined) ? w : 1;
    }
    /**
     * The function will be called when {@link _x| x}, {@link _y| y} {@link _z| z} and {@link _w| w} is changed.
     */
    public onChangeCallback() { }

    get x(): number {
        return this._x;
    }

    set x(value: number) {
        this._x = value;
        this.onChangeCallback();
    }

    get y(): number {
        return this._y;
    }

    set y(value: number) {
        this._y = value;
        this.onChangeCallback();
    }

    get z(): number {
        return this._z;
    }

    set z(value: number) {
        this._z = value;
        this.onChangeCallback();
    }

    get w(): number {
        return this._w;
    }

    set w(value: number) {
        this._w = value;
        this.onChangeCallback();
    }
    /**
     * Handles the spherical linear interpolation between quaternions.
     * t represents the amount of rotation between this quaternion (where t is 0) and qb (where t is 1).
     * This quaternion is set to the result. Also see the static version of the `slerp` below.
     * <pre>
     * // rotate a mesh towards a target quaternion
     * mesh.quaternion.slerp( endQuaternion, 0.01 );
     * </pre>
     * @param qb The other quaternion rotation.
     * @param t interpolation factor in the closed interval [0, 1].
     */
    public static slerp(qa: Quaternion, qb: Quaternion, qm: Quaternion, t: number): Quaternion {
        return qm.copy(qa).slerp(qb, t);
    }
    /**
     * Like the static {@link slerp| slerp} method above, but operates directly on flat arrays of numbers.
     * @param dst The output array.
     * @param dstOffset An offset into the output array.
     * @param src0 The source array of the starting quaternion.
     * @param srcOffset0 An offset into the array `src0`.
     * @param src1 The source array of the target quaternions.
     * @param srcOffset1 An offset into the array `src1`.
     * @param t Normalized interpolation factor (between 0 and 1).
     */
    public static slerpFlat(dst: number[], dstOffset: number, src0: number[], srcOffset0: number, src1: number[], srcOffset1: number, t: number): void {
        // fuzz-free, array-based Quaternion SLERP operation
        let x0 = src0[srcOffset0 + 0],
            y0 = src0[srcOffset0 + 1],
            z0 = src0[srcOffset0 + 2],
            w0 = src0[srcOffset0 + 3];
        const x1 = src1[srcOffset1 + 0];
        const y1 = src1[srcOffset1 + 1];
        const z1 = src1[srcOffset1 + 2];
        const w1 = src1[srcOffset1 + 3];
        if (w0 !== w1 || x0 !== x1 || y0 !== y1 || z0 !== z1) {
            let s = 1 - t;
            const cos = x0 * x1 + y0 * y1 + z0 * z1 + w0 * w1;
            const dir = (cos >= 0 ? 1 : - 1);
            const sqrSin = 1 - cos * cos;

            // Skip the Slerp for tiny steps to avoid numeric problems:
            if (sqrSin > Number.EPSILON) {
                const sin = Math.sqrt(sqrSin);
                const len = Math.atan2(sin, cos * dir);
                s = Math.sin(s * len) / sin;
                t = Math.sin(t * len) / sin;
            }
            const tDir = t * dir;
            x0 = x0 * s + x1 * tDir;
            y0 = y0 * s + y1 * tDir;
            z0 = z0 * s + z1 * tDir;
            w0 = w0 * s + w1 * tDir;
            // Normalize in case we just did a lerp:
            if (s === 1 - t) {
                const f = 1 / Math.sqrt(x0 * x0 + y0 * y0 + z0 * z0 + w0 * w0);
                x0 *= f;
                y0 *= f;
                z0 *= f;
                w0 *= f;
            }
        }
        dst[dstOffset] = x0;
        dst[dstOffset + 1] = y0;
        dst[dstOffset + 2] = z0;
        dst[dstOffset + 3] = w0;
    }
    /**
     * Sets {@link x| x}, {@link y| y}, {@link z| z}, {@link w| w} properties of this quaternion.
     */
    public set(x: number, y: number, z: number, w: number): Quaternion {
        this._x = x;
        this._y = y;
        this._z = z;
        this._w = w;
        this.onChangeCallback();
        return this;
    }
    /**
     * Creates a new Quaternion with identical {@link x| x}, {@link y| y},{@link z| z} and {@link w| w} properties to this one.
     */
    public clone(): Quaternion {
        return new Quaternion(this._x, this._y, this._z, this._w);
    }
    /**
     * Copies the {@link x| x}, {@link y| y}, {@link z| z} and {@link w| w} properties of {@link Quaternion| q} into this quaternion.
     */
    public copy(quaternion: Quaternion): Quaternion {
        this._x = quaternion.x;
        this._y = quaternion.y;
        this._z = quaternion.z;
        this._w = quaternion.w;
        this.onChangeCallback();
        return this;
    }
    /**
     * Sets this quaternion from the rotation specified by {@link Euler| Euler} angle.
     */
    public setFromEuler(euler: Euler, update?: boolean): Quaternion {
        const x = euler.x;
        const y = euler.y;
        const z = euler.z;
        const order = euler.order;
        // http://www.mathworks.com/matlabcentral/fileexchange/
        // 20696-function-to-convert-between-dcm-euler-angles-quaternions-and-euler-vectors/
        // content/SpinCalc.m
        const c1 = Math.cos(x / 2);
        const c2 = Math.cos(y / 2);
        const c3 = Math.cos(z / 2);
        const s1 = Math.sin(x / 2);
        const s2 = Math.sin(y / 2);
        const s3 = Math.sin(z / 2);
        switch (order) {
            case 'XYZ':
                {
                    this._x = s1 * c2 * c3 + c1 * s2 * s3;
                    this._y = c1 * s2 * c3 - s1 * c2 * s3;
                    this._z = c1 * c2 * s3 + s1 * s2 * c3;
                    this._w = c1 * c2 * c3 - s1 * s2 * s3;
                }
                break;
            case 'YXZ':
                {
                    this._x = s1 * c2 * c3 + c1 * s2 * s3;
                    this._y = c1 * s2 * c3 - s1 * c2 * s3;
                    this._z = c1 * c2 * s3 - s1 * s2 * c3;
                    this._w = c1 * c2 * c3 + s1 * s2 * s3;
                }
                break;
            case 'ZXY':
                {
                    this._x = s1 * c2 * c3 - c1 * s2 * s3;
                    this._y = c1 * s2 * c3 + s1 * c2 * s3;
                    this._z = c1 * c2 * s3 + s1 * s2 * c3;
                    this._w = c1 * c2 * c3 - s1 * s2 * s3;
                }
                break;
            case 'ZYX':
                {
                    this._x = s1 * c2 * c3 - c1 * s2 * s3;
                    this._y = c1 * s2 * c3 + s1 * c2 * s3;
                    this._z = c1 * c2 * s3 - s1 * s2 * c3;
                    this._w = c1 * c2 * c3 + s1 * s2 * s3;
                }
                break;
            case 'YZX':
                {
                    this._x = s1 * c2 * c3 + c1 * s2 * s3;
                    this._y = c1 * s2 * c3 + s1 * c2 * s3;
                    this._z = c1 * c2 * s3 - s1 * s2 * c3;
                    this._w = c1 * c2 * c3 - s1 * s2 * s3;
                }
                break;
            case 'XZY':
                {
                    this._x = s1 * c2 * c3 - c1 * s2 * s3;
                    this._y = c1 * s2 * c3 - s1 * c2 * s3;
                    this._z = c1 * c2 * s3 + s1 * s2 * c3;
                    this._w = c1 * c2 * c3 + s1 * s2 * s3;
                }
                break;
            default:
                break;
        }
        if (update !== false) {
            this.onChangeCallback();
        }
        return this;
    }
    /**
     * Sets this quaternion from rotation specified by {@link Vector3| axis} and {@link Float| angle}.
     * Adapted from the method {@link http://www.euclideanspace.com/maths/geometry/rotations/conversions/angleToQuaternion/index.htm| here}.
     * @param Axis is assumed to be normalized.
     * @param angle is in radians.
     */
    public setFromAxisAngle(axis: Vector3, angle: number): Quaternion {
        // http://www.euclideanspace.com/maths/geometry/rotations/conversions/angleToQuaternion/index.htm
        // assumes axis is normalized
        const halfAngle = angle / 2;
        const s = Math.sin(halfAngle);
        this._x = axis.x * s;
        this._y = axis.y * s;
        this._z = axis.z * s;
        this._w = Math.cos(halfAngle);
        this.onChangeCallback();
        return this;
    }
    /**
     * Sets this quaternion from rotation component of {@link Matrix4| m}.
     * Adapted from the method {@link http://www.euclideanspace.com/maths/geometry/rotations/conversions/angleToQuaternion/index.htm| here}.
     * @param m a {@link Matrix4| Matrix4} of which the upper 3x3 of matrix is a pure {@link https://en.wikipedia.org/wiki/Rotation_matrix| rotation matrix}.
     */
    public setFromRotationMatrix(m: Matrix4): Quaternion {
        // http://www.euclideanspace.com/maths/geometry/rotations/conversions/matrixToQuaternion/index.htm
        // assumes the upper 3x3 of m is a pure rotation matrix (i.e, unscaled)
        const te = m._elements;
        const m11 = te[0], m12 = te[4], m13 = te[8],
            m21 = te[1], m22 = te[5], m23 = te[9],
            m31 = te[2], m32 = te[6], m33 = te[10],
            trace = m11 + m22 + m33;
        let s;

        if (trace > 0) {
            s = 0.5 / Math.sqrt(trace + 1.0);
            this._w = 0.25 / s;
            this._x = (m32 - m23) * s;
            this._y = (m13 - m31) * s;
            this._z = (m21 - m12) * s;
        } else if (m11 > m22 && m11 > m33) {
            s = 2.0 * Math.sqrt(1.0 + m11 - m22 - m33);
            this._w = (m32 - m23) / s;
            this._x = 0.25 * s;
            this._y = (m12 + m21) / s;
            this._z = (m13 + m31) / s;
        } else if (m22 > m33) {
            s = 2.0 * Math.sqrt(1.0 + m22 - m11 - m33);
            this._w = (m13 - m31) / s;
            this._x = (m12 + m21) / s;
            this._y = 0.25 * s;
            this._z = (m23 + m32) / s;
        } else {
            s = 2.0 * Math.sqrt(1.0 + m33 - m11 - m22);
            this._w = (m21 - m12) / s;
            this._x = (m13 + m31) / s;
            this._y = (m23 + m32) / s;
            this._z = 0.25 * s;
        }
        this.onChangeCallback();
        return this;
    }
    /**
     * Sets this quaternion to the rotation required to rotate direction vector {@link Vector3| vFrom} to direction vector {@link Vector3| vTo}.
     * Adapted from the method {@link http://lolengine.net/blog/2013/09/18/beautiful-maths-quaternion-from-vectors| here}.
     * {@link Vector3| vFrom} and {@link Vector3| vTo} are assumed to be normalized.
     */
    public setFromUnitVectors(vFrom: Vector3, vTo: Vector3): Quaternion {
        // assumes direction vectors vFrom and vTo are normalized
        let r;
        const EPS = 0.000001;
        r = vFrom.dot(vTo) + 1;
        if (r < EPS) {
            r = 0;
            if (Math.abs(vFrom.x) > Math.abs(vFrom.z)) {
                tmpVec3.set(- vFrom.y, vFrom.x, 0);
            } else {
                tmpVec3.set(0, - vFrom.z, vFrom.y);
            }
        } else {
            tmpVec3.crossVectors(vFrom, vTo);
        }
        this._x = tmpVec3.x;
        this._y = tmpVec3.y;
        this._z = tmpVec3.z;
        this._w = r;
        return this.normalize();
    }
    /**
     * @internal
     */
    public inverse(): Quaternion {
        // quaternion is assumed to have unit length
        return this.conjugate();
    }
    /**
     * Returns the rotational conjugate of this quaternion. The conjugate of a quaternion
     * represents the same rotation in the opposite direction about the rotational axis.
     */
    public conjugate(): Quaternion {
        this._x *= - 1;
        this._y *= - 1;
        this._z *= - 1;
        this.onChangeCallback();
        return this;
    }
    /**
     * Calculates the {@link https://en.wikipedia.org/wiki/Dot_product| dot product} of quaternions {@link Quaternion| v} and this one.
     */
    public dot(v: Quaternion): number {
        return this._x * v._x + this._y * v._y + this._z * v._z + this._w * v._w;
    }
    /**
     * Computes the squared {@link https://en.wikipedia.org/wiki/Euclidean_distance| Euclidean length}
     * (straight-line length) of this quaternion, considered as a 4 dimensional vector.
     * This can be useful if you are comparing the lengths of two quaternions,
     * as this is a slightly more efficient calculation than {@link length| length}().
     */
    public lengthSq(): number {
        return this._x * this._x + this._y * this._y + this._z * this._z + this._w * this._w;
    }
    /**
     * Computes the Euclidean length (straight-line length) of this quaternion, considered as a 4 dimensional vector.
     */
    public length(): number {
        return Math.sqrt(this._x * this._x + this._y * this._y + this._z * this._z + this._w * this._w);
    }
    /**
     * Normalizes this quaternion - that is, calculated the quaternion that performs the same rotation as this one,
     * but has {@link length| length} equal to `1`.
     */
    public normalize(): Quaternion {
        let l = this.length();
        if (l === 0) {
            this._x = 0;
            this._y = 0;
            this._z = 0;
            this._w = 1;
        } else {
            l = 1 / l;
            this._x = this._x * l;
            this._y = this._y * l;
            this._z = this._z * l;
            this._w = this._w * l;
        }
        this.onChangeCallback();
        return this;
    }
    /**
     * Multiplies this quaternion by {@link Quaternion| q}.
     */
    public multiply(q: Quaternion): Quaternion {
        return this.multiplyQuaternions(this, q);
    }
    /**
     * Pre-multiplies this quaternion by {@link Quaternion| q}.
     */
    public premultiply(q: Quaternion): Quaternion {
        return this.multiplyQuaternions(q, this);
    }
    /**
     * Sets this quaternion to {@link Quaternion| a} x {@link Quaternion| b}.
     * Adapted from the method outlined {@link http://www.euclideanspace.com/maths/algebra/realNormedAlgebra/quaternions/code/index.htm| here}.
     */
    public multiplyQuaternions(a: Quaternion, b: Quaternion): Quaternion {
        // from http://www.euclideanspace.com/maths/algebra/realNormedAlgebra/quaternions/code/index.htm
        const qax = a._x, qay = a._y, qaz = a._z, qaw = a._w,
            qbx = b._x, qby = b._y, qbz = b._z, qbw = b._w;
        this._x = qax * qbw + qaw * qbx + qay * qbz - qaz * qby;
        this._y = qay * qbw + qaw * qby + qaz * qbx - qax * qbz;
        this._z = qaz * qbw + qaw * qbz + qax * qby - qay * qbx;
        this._w = qaw * qbw - qax * qbx - qay * qby - qaz * qbz;
        this.onChangeCallback();
        return this;
    }
    /**
     * Handles the spherical linear interpolation between quaternions. t represents the
     * amount of rotation between this quaternion (where t is 0) and {@link Quaternion| qb} (where t is 1).
     * This quaternion is set to the result.
     * Also see the static version of the method {@link slerp| slerp}.
     * <pre>
     * // rotate a mesh towards a target quaternion
     * mesh.quaternion.slerp( endQuaternion, 0.01 );
     * </pre>
     * @param qb The other quaternion rotation.
     * @param t interpolation factor in the closed interval [0, 1].
     */
    public slerp(qb: Quaternion, t: number): Quaternion {
        if (t === 0) {
            return this;
        }
        if (t === 1) {
            return this.copy(qb);
        }
        const x = this._x, y = this._y, z = this._z, w = this._w;
        // http://www.euclideanspace.com/maths/algebra/realNormedAlgebra/quaternions/slerp/
        let cosHalfTheta = w * qb._w + x * qb._x + y * qb._y + z * qb._z;
        if (cosHalfTheta < 0) {
            this._w = - qb._w;
            this._x = - qb._x;
            this._y = - qb._y;
            this._z = - qb._z;
            cosHalfTheta = - cosHalfTheta;
        } else {
            this.copy(qb);
        }
        if (cosHalfTheta >= 1.0) {
            this._w = w;
            this._x = x;
            this._y = y;
            this._z = z;
            return this;
        }

        const sqrSinHalfTheta = 1.0 - cosHalfTheta * cosHalfTheta;
        if (sqrSinHalfTheta <= Number.EPSILON) {
            const s = 1 - t;
            this._w = s * w + t * this._w;
            this._x = s * x + t * this._x;
            this._y = s * y + t * this._y;
            this._z = s * z + t * this._z;
            return this.normalize();
        }

        const sinHalfTheta = Math.sqrt(sqrSinHalfTheta);
        const halfTheta = Math.atan2(sinHalfTheta, cosHalfTheta);
        const ratioA = Math.sin((1 - t) * halfTheta) / sinHalfTheta;
        const ratioB = Math.sin(t * halfTheta) / sinHalfTheta;

        this._w = (w * ratioA + this._w * ratioB);
        this._x = (x * ratioA + this._x * ratioB);
        this._y = (y * ratioA + this._y * ratioB);
        this._z = (z * ratioA + this._z * ratioB);
        this.onChangeCallback();
        return this;
    }
    /**
     * Compares the {@link x| x}, {@link y| y},{@link z| z} and {@link w| w} properties of
     * {@link Quaternion| v} to the equivalent properties of this quaternion to determine if they represent the same rotation.
     * @param v Quaternion that this quaternion will be compared to.
     */
    public equals(quaternion: Quaternion): boolean {
        return (quaternion._x === this._x) && (quaternion._y === this._y) && (quaternion._z === this._z) && (quaternion._w === this._w);
    }
    /**
     * Sets this quaternion's {@link x| x}, {@link y| y}, {@link z| z} and {@link w| w} properties from an array.
     * @param array array of format (x, y, z, w) used to construct the quaternion.
     * @param offset (optional) an offset into the array.
     */
    public fromArray(array: ArrayLike<number>, offset?: number): Quaternion {
        if (offset === undefined) {
            offset = 0;
        }
        this._x = array[offset];
        this._y = array[offset + 1];
        this._z = array[offset + 2];
        this._w = array[offset + 3];
        this.onChangeCallback();
        return this;
    }
    /**
     * Returns the numerical elements of this quaternion in an array of format [x, y, z, w].
     * @param array An optional array to store the quaternion. If not specified, a new array will be created.
     * @param offset (optional) if specified, the result will be copied into this array.
     */
    public toArray(array?: number[], offset?: number): number[] {
        if (array === undefined) {
            array = [];
        }
        if (offset === undefined) {
            offset = 0;
        }
        array[offset] = this._x;
        array[offset + 1] = this._y;
        array[offset + 2] = this._z;
        array[offset + 3] = this._w;
        return array;
    }
    /**
     * A method to call {@link onChangeCallback| onChangeCallback}.
     */
    public onChange(callback: Function): Quaternion {
        (this.onChangeCallback as any) = callback;
        return this;
    }
}
const tmpVec3 = new Vector3();
