import { Matrix4 } from './Matrix4';
import { Quaternion } from './Quaternion';
import { BufferAttribute } from '../elements/attributes/BufferAttribute';
import type { PickReadonly } from '../utils/Utils';
/**
 * Class representing a 4D {@link https://en.wikipedia.org/wiki/Vector_space| vector}.
 * A 4D vector is an ordered quadruplet of numbers (labeled x, y, z, and w).
 */
export class Vector4 {
    /**
     * the x value of this vector.
     * @defaultValue `0`.
     */
    x: number;
    /**
     * the y value of this vector.
     * @defaultValue `0`.
     */
    y: number;
    /**
     * the z value of this vector.
     * @defaultValue `0`.
     */
    z: number;
    /**
     * the w value of this vector.
     * @defaultValue `0`.
     */
    w: number;
    /**
     * Check the type whether it belongs to Vector4.
     * This value should not be changed by user.
     */
    isVector4 = true;

    constructor(_x?: number, _y?: number, _z?: number, _w?: number) {
        this.x = _x || 0;
        this.y = _y || 0;
        this.z = _z || 0;
        this.w = (_w !== undefined) ? _w : 1;
    }
    /**
     * @internal
     */
    getSerializeData() {
        return this.toArray();
    }
    /**
     * @internal
     */
    setSerializeData(value: any): void {
        this.fromArray(value);
    }
    /**
     * Sets the {@link x| x}, {@link y| y}, {@link z| z} and {@link w| w} components of this vector.
     */
    set(x: number, y: number, z: number, w: number): Vector4 {
        this.x = x;
        this.y = y;
        this.z = z;
        this.w = w;
        return this;
    }
    /**
     * Sets the {@link x| x}, {@link y| y}, {@link z| z} and {@link w| w} values of this vector both equal to scalar.
     */
    setScalar(scalar: number): Vector4 {
        this.x = scalar;
        this.y = scalar;
        this.z = scalar;
        this.w = scalar;
        return this;
    }
    /**
     * Replaces this vector's {@link x| x} value with x.
     */
    setX(x: number): Vector4 {
        this.x = x;
        return this;
    }
    /**
     * Replaces this vector's {@link y| y} value with y.
     */
    setY(y: number): Vector4 {
        this.y = y;
        return this;
    }
    /**
     * Replaces this vector's {@link z| z} value with z.
     */
    setZ(z: number): Vector4 {
        this.z = z;
        return this;
    }
    /**
     * Replaces this vector's {@link w| w} value with w.
     */
    setW(w: number): Vector4 {
        this.w = w;
        return this;
    }
    /**
     * If index equals 0 set {@link x| x} to value.
     * If index equals 1 set {@link y| y} to value.
     * If index equals 2 set {@link z| z} to value.
     * If index equals 3 set {@link w| w} to value.
     * @param index 0, 1 or 2.
     */
    setComponent(index: number, value: number): Vector4 {
        switch (index) {
            case 0: this.x = value;
                break;
            case 1: this.y = value;
                break;
            case 2: this.z = value;
                break;
            case 3: this.w = value;
                break;
            default:
                throw new Error('index is out of range: ' + index);
        }
        return this;
    }
    /**
     * If index equals 0 returns the {@link x| x} value.
     * If index equals 1 returns the {@link y| y} value.
     * If index equals 2 returns the {@link z| z} value.
     * If index equals 3 returns the {@link w| w} value.
     * @param index 0, 1, 2 or 3.
     */
    getComponent(index: number): number {
        switch (index) {
            case 0:
                return this.x;
            case 1:
                return this.y;
            case 2:
                return this.z;
            case 3:
                return this.w;
            default:
                throw new Error('index is out of range: ' + index);
        }
    }
    /**
     * Returns a new Vector4 with the same {@link x| x}, {@link y| y}, {@link z| z} and {@link w| w} values as this one.
     */
    clone(): Vector4 {
        return new Vector4(this.x, this.y, this.z, this.w);
    }
    cloneReadonly() {
        return this.clone() as any as ReadonlyVector4;
    }
    /**
     * Copies the values of the passed Vector4's {@link x| x}, {@link y| y}, {@link z| z} and {@link w| w} properties to this Vector4.
     */
    copy(v: Vector4): Vector4 {
        this.x = v.x;
        this.y = v.y;
        this.z = v.z;
        this.w = (v.w !== undefined) ? v.w : 1;
        return this;
    }
    /**
     * Adds {@link Vector4| v} to this vector.
     */
    add(v: Vector4): Vector4 {
        this.x += v.x;
        this.y += v.y;
        this.z += v.z;
        this.w += v.w;
        return this;
    }
    /**
     * Adds the scalar value s to this vector's {@link x| x}, {@link y| y}, {@link z| z} and {@link w| w} values.
     */
    addScalar(s: number): Vector4 {
        this.x += s;
        this.y += s;
        this.z += s;
        this.w += s;
        return this;
    }
    /**
     * Sets this vector to {@link Vector4| a} + {@link Vector4| b}.
     */
    addVectors(a: Vector4, b: Vector4): Vector4 {
        this.x = a.x + b.x;
        this.y = a.y + b.y;
        this.z = a.z + b.z;
        this.w = a.w + b.w;
        return this;
    }
    /**
     * Adds the multiple of {@link Vector4| v} and s to this vector.
     */
    addScaledVector(v: Vector4, s: number): Vector4 {
        this.x += v.x * s;
        this.y += v.y * s;
        this.z += v.z * s;
        this.w += v.w * s;
        return this;
    }
    /**
     * Subtracts {@link Vector4| v} from this vector.
     */
    sub(v: Vector4): Vector4 {
        this.x -= v.x;
        this.y -= v.y;
        this.z -= v.z;
        this.w -= v.w;
        return this;
    }
    /**
     * Subtracts s from this vector's {@link x| x}, {@link y| y}, {@link z| z} and {@link w| w} components.
     */
    subScalar(s: number): Vector4 {
        this.x -= s;
        this.y -= s;
        this.z -= s;
        this.w -= s;
        return this;
    }
    /**
     * Sets this vector to {@link Vector4| a} - {@link Vector4| b}.
     */
    subVectors(a: Vector4, b: Vector4): Vector4 {
        this.x = a.x - b.x;
        this.y = a.y - b.y;
        this.z = a.z - b.z;
        this.w = a.w - b.w;
        return this;
    }
    /**
     * Multiplies this vector by scalar s.
     */
    multiplyScalar(scalar: number): Vector4 {
        this.x *= scalar;
        this.y *= scalar;
        this.z *= scalar;
        this.w *= scalar;
        return this;
    }
    /**
     * Multiplies this vector by 4 x 4 {@link Matrix4| m}.
     */
    applyMatrix4(m: Matrix4): Vector4 {
        const x = this.x;
        const y = this.y;
        const z = this.z;
        const w = this.w;
        const e = m._elements;
        this.x = e[0] * x + e[4] * y + e[8] * z + e[12] * w;
        this.y = e[1] * x + e[5] * y + e[9] * z + e[13] * w;
        this.z = e[2] * x + e[6] * y + e[10] * z + e[14] * w;
        this.w = e[3] * x + e[7] * y + e[11] * z + e[15] * w;
        return this;
    }
    /**
     * Divides this vector by scalar s.
     * Sets vector to `( 0, 0, 0, 0 )` if `s = 0`.
     */
    divideScalar(scalar: number): Vector4 {
        return this.multiplyScalar(1 / scalar);
    }
    /**
     * If this vector's x, y, z or w value is greater than the max vector's x, y, z or w value, it is replaced by the corresponding value. <br /><br />
     * If this vector's x, y, z or w value is less than the min vector's x, y, z or w value, it is replaced by the corresponding value.
     * @param min the minimum {@link x| x}, {@link y| y}, {@link z| z} and {@link w| w} values.
     * @param max the maximum {@link x| x}, {@link y| y}, {@link z| z} and {@link w| w} values in the desired range.
     */
    min(v: Vector4): Vector4 {
        this.x = Math.min(this.x, v.x);
        this.y = Math.min(this.y, v.y);
        this.z = Math.min(this.z, v.z);
        this.w = Math.min(this.w, v.w);
        return this;
    }
    /**
     * If this vector's x, y, z or w value is greater than the max vector's x, y, z or w value, it is replaced by the corresponding value. <br /><br />
     * If this vector's x, y, z or w value is less than the min vector's x, y, z or w value, it is replaced by the corresponding value.
     * @param min the minimum {@link x| x}, {@link y| y}, {@link z| z} and {@link w| w} values.
     * @param max the maximum {@link x| x}, {@link y| y}, {@link z| z} and {@link w| w} values in the desired range.
     */
    max(v: Vector4): Vector4 {
        this.x = Math.max(this.x, v.x);
        this.y = Math.max(this.y, v.y);
        this.z = Math.max(this.z, v.z);
        this.w = Math.max(this.w, v.w);
        return this;
    }
    /**
     * If this vector's x, y, z or w value is greater than the max vector's x, y, z or w value, it is replaced by the corresponding value. <br /><br />
     * If this vector's x, y, z or w value is less than the min vector's x, y, z or w value, it is replaced by the corresponding value.
     * @param min the minimum {@link x| x}, {@link y| y}, {@link z| z} and {@link w| w} values.
     * @param max the maximum {@link x| x}, {@link y| y}, {@link z| z} and {@link w| w} values in the desired range.
     */
    clamp(min: Vector4, max: Vector4): Vector4 {
        // assumes min < max, component-wise
        this.x = Math.max(min.x, Math.min(max.x, this.x));
        this.y = Math.max(min.y, Math.min(max.y, this.y));
        this.z = Math.max(min.z, Math.min(max.z, this.z));
        this.w = Math.max(min.w, Math.min(max.w, this.w));
        return this;
    }
    /**
     * If this vector's x, y, z or w values are greater than the max value, they are replaced by the max value. <br /><br />
     * If this vector's x, y, z or w values are less than the min value, they are replaced by the min value.
     * @param min the minimum {@link x| x}, {@link y| y}, {@link z| z} and {@link w| w} values.
     * @param max the maximum {@link x| x}, {@link y| y}, {@link z| z} and {@link w| w} values in the desired range.
     */
    clampScalar(minVal: number, maxVal: number): Vector4 {
        tempMin.set(minVal, minVal, minVal, minVal);
        tempMax.set(maxVal, maxVal, maxVal, maxVal);
        return this.clamp(tempMin, tempMax);
    }
    /**
     * If this vector's length is greater than the max value, it is replaced by the max value. <br /><br />
     * If this vector's length is less than the min value, it is replaced by the min value.
     * @param min the minimum {@link x| x}, {@link y| y}, {@link z| z} and {@link w| w} values.
     * @param max the maximum {@link x| x}, {@link y| y}, {@link z| z} and {@link w| w} values in the desired range.
     */
    clampLength(min: number, max: number): Vector4 {
        const length = this.length();
        return this.divideScalar(length || 1).multiplyScalar(Math.max(min, Math.min(max, length)));
    }
    /**
     * The components of this vector are rounded down to the nearest integer value.
     */
    floor(): Vector4 {
        this.x = Math.floor(this.x);
        this.y = Math.floor(this.y);
        this.z = Math.floor(this.z);
        this.w = Math.floor(this.w);
        return this;
    }
    /**
     * The {@link x| x}, {@link y| y}, {@link z| z} and {@link w| w} components of this vector are rounded up to the nearest integer value.
     */
    ceil(): Vector4 {
        this.x = Math.ceil(this.x);
        this.y = Math.ceil(this.y);
        this.z = Math.ceil(this.z);
        this.w = Math.ceil(this.w);
        return this;
    }
    /**
     * The components of this vector are rounded to the nearest integer value.
     */
    round(): Vector4 {
        this.x = Math.round(this.x);
        this.y = Math.round(this.y);
        this.z = Math.round(this.z);
        this.w = Math.round(this.w);
        return this;
    }
    /**
     * The components of this vector are rounded towards zero (up if negative, down if positive) to an integer value.
     */
    roundToZero(): Vector4 {
        this.x = (this.x < 0) ? Math.ceil(this.x) : Math.floor(this.x);
        this.y = (this.y < 0) ? Math.ceil(this.y) : Math.floor(this.y);
        this.z = (this.z < 0) ? Math.ceil(this.z) : Math.floor(this.z);
        this.w = (this.w < 0) ? Math.ceil(this.w) : Math.floor(this.w);
        return this;
    }
    /**
     * Inverts this vector - i.e. sets x = -x, y = -y, z = -z and w = -w.
     */
    negate(): Vector4 {
        this.x = - this.x;
        this.y = - this.y;
        this.z = - this.z;
        this.w = - this.w;
        return this;
    }
    /**
     * Calculates the {@link https://en.wikipedia.org/wiki/Dot_product| dot product} of this vector and {@link Vector4| v}.
     */
    dot(v: Vector4): number {
        return this.x * v.x + this.y * v.y + this.z * v.z + this.w * v.w;
    }
    /**
     * Computes the square of the {@link https://en.wikipedia.org/wiki/Euclidean_distance| Euclidean length }
     * (straight-line length) from (0, 0, 0, 0) to (x, y, z, w).
     * If you are comparing the lengths of vectors, you should compare the length squared instead as it is slightly more efficient to calculate.
     */
    lengthSq(): number {
        return this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w;
    }
    /**
     * Computes the Euclidean length (straight-line length) from (0, 0, 0, 0) to (x, y, z, w).
     */
    length(): number {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w);
    }
    /**
     * Computes the {@link http://en.wikipedia.org/wiki/Taxicab_geometry| Manhattan length } of this vector.
     */
    manhattanLength(): number {
        return Math.abs(this.x) + Math.abs(this.y) + Math.abs(this.z) + Math.abs(this.w);
    }
    /**
     * Converts this vector to a {@link https://en.wikipedia.org/wiki/Unit_vector| unit vector }
     * - that is, sets it equal to a vector with the same direction as this one, but {@link length| length} 1.
     */
    normalize(): Vector4 {
        return this.divideScalar(this.length() || 1);
    }
    /**
     * Sets this vector to a vector with given length the same direction as this one.
     */
    setLength(length: number): Vector4 {
        return this.normalize().multiplyScalar(length);
    }
    /**
     * Linearly interpolates between this vector and {@link Vector4| v},
     * where alpha is the percent distance along the line - alpha = 0 will be this vector, and alpha = 1 will be {@link Vector4| v}.
     * @param v {@link Vector4| Vector4} to interpolate towards.
     * @param alpha interpolation factor, typically in the closed interval [0, 1].
     */
    lerp(v: Vector4, alpha: number): Vector4 {
        this.x += (v.x - this.x) * alpha;
        this.y += (v.y - this.y) * alpha;
        this.z += (v.z - this.z) * alpha;
        this.w += (v.w - this.w) * alpha;
        return this;
    }
    /**
     * Sets this vector to be the vector linearly interpolated between {@link Vector4| v1} and
     * {@link Vector4| v2} where alpha is the percent distance along the line connecting the two vectors
     * - alpha = 0 will be {@link Vector4| v1}, and alpha = 1 will be {@link Vector4| v2}.
     * @param v1 the starting {@link Vector4| Vector4}.
     * @param v2 {@link Vector4| Vector4} to interpolate towards.
     * @param alpha interpolation factor, typically in the closed interval [0, 1].
     */
    lerpVectors(v1: Vector4, v2: Vector4, alpha: number): Vector4 {
        return this.subVectors(v2, v1).multiplyScalar(alpha).add(v1);
    }
    /**
     * Checks for strict equality of this vector and {@link Vector4| v}.
     */
    equals(v: Vector4): boolean {
        return ((v.x === this.x) && (v.y === this.y) && (v.z === this.z) && (v.w === this.w));
    }
    /**
     * Sets the {@link x| x}, {@link y| y} and {@link z| z} components of this vector to the quaternion's axis and {@link w| w} to the angle.
     * @param q a normalized {@link Quaterion| Quaterion}
     */
    setAxisAngleFromQuaternion(q: Quaternion): Vector4 {
        // http://www.euclideanspace.com/maths/geometry/rotations/conversions/quaternionToAngle/index.htm
        // q is assumed to be normalized
        this.w = 2 * Math.acos(q.w);
        const s = Math.sqrt(1 - q.w * q.w);
        if (s < 0.0001) {
            this.x = 1;
            this.y = 0;
            this.z = 0;
        } else {
            this.x = q.x / s;
            this.y = q.y / s;
            this.z = q.z / s;
        }
        return this;
    }
    /**
     * {@link Matrix4| m} a {@link Matrix4| Matrix4} of which the upper left 3x3 matrix is a pure rotation matrix.
     * Sets the {@link x| x}, {@link y| y} and {@link z| z} to the axis of rotation and {@link w| w} to the angle.
     */
    setAxisAngleFromRotationMatrix(m: Matrix4): Vector4 {
        // http://www.euclideanspace.com/maths/geometry/rotations/conversions/matrixToAngle/index.htm
        // assumes the upper 3x3 of m is a pure rotation matrix (i.e, unscaled)
        let angle: number;
        let x: number;
        let y: number;
        let z: number;                      // variables for result
        const epsilon = 0.01;               // margin to allow for rounding errors
        const epsilon2 = 0.1;               // margin to distinguish between 0 and 180 degrees
        const te = m._elements;

        const m11 = te[0], m12 = te[4], m13 = te[8],
            m21 = te[1], m22 = te[5], m23 = te[9],
            m31 = te[2], m32 = te[6], m33 = te[10];

        if ((Math.abs(m12 - m21) < epsilon) &&
            (Math.abs(m13 - m31) < epsilon) &&
            (Math.abs(m23 - m32) < epsilon)) {
            // singularity found
            // first check for identity matrix which must have +1 for all terms
            // in leading diagonal and zero in other terms

            if ((Math.abs(m12 + m21) < epsilon2) &&
                (Math.abs(m13 + m31) < epsilon2) &&
                (Math.abs(m23 + m32) < epsilon2) &&
                (Math.abs(m11 + m22 + m33 - 3) < epsilon2)) {

                // this singularity is identity matrix so angle = 0
                this.set(1, 0, 0, 0);
                return this; // zero angle, arbitrary axis
            }

            // otherwise this singularity is angle = 180
            angle = Math.PI;

            const xx = (m11 + 1) / 2;
            const yy = (m22 + 1) / 2;
            const zz = (m33 + 1) / 2;
            const xy = (m12 + m21) / 4;
            const xz = (m13 + m31) / 4;
            const yz = (m23 + m32) / 4;

            if ((xx > yy) && (xx > zz)) {
                // m11 is the largest diagonal term
                if (xx < epsilon) {
                    x = 0;
                    y = 0.707106781;
                    z = 0.707106781;
                } else {
                    x = Math.sqrt(xx);
                    y = xy / x;
                    z = xz / x;
                }
            } else if (yy > zz) {
                // m22 is the largest diagonal term
                if (yy < epsilon) {
                    x = 0.707106781;
                    y = 0;
                    z = 0.707106781;

                } else {
                    y = Math.sqrt(yy);
                    x = xy / y;
                    z = yz / y;
                }
            } else {
                // m33 is the largest diagonal term so base result on this
                if (zz < epsilon) {
                    x = 0.707106781;
                    y = 0.707106781;
                    z = 0;
                } else {
                    z = Math.sqrt(zz);
                    x = xz / z;
                    y = yz / z;
                }
            }
            this.set(x, y, z, angle);
            return this; // return 180 deg rotation
        }

        // as we have reached here there are no singularities so we can handle normally
        let s = Math.sqrt((m32 - m23) * (m32 - m23) +
            (m13 - m31) * (m13 - m31) +
            (m21 - m12) * (m21 - m12)); // used to normalize

        if (Math.abs(s) < 0.001) {
            s = 1;
        }

        // prevent divide by zero, should not happen if matrix is orthogonal and should be
        // caught by singularity test above, but I've left it in just in case
        this.x = (m32 - m23) / s;
        this.y = (m13 - m31) / s;
        this.z = (m21 - m12) / s;
        this.w = Math.acos((m11 + m22 + m33 - 1) / 2);
        return this;
    }
    /**
     * Sets this vector's {@link x| x} value to be array[ offset + 0 ], {@link y| y} value to be array[ offset + 1 ]
     * {@link z| z} value to be array[ offset + 2 ] and {@link w| w} value to be array[ offset + 3 ].
     * @param array the source array.
     * @param offset (optional) offset into the array.
     * @defaultValue `0`.
     */
    fromArray(array: ArrayLike<number>, offset?: number): Vector4 {
        if (offset === undefined) {
            offset = 0;
        }

        this.x = array[offset];
        this.y = array[offset + 1];
        this.z = array[offset + 2];
        this.w = array[offset + 3];
        return this;
    }
    /**
     * There are 4 elements in this vector.
     */
    getNumberCount() {
        return 4;
    }
    /**
     * Returns an array [x, y, z, w], or copies x, y, z and w into the provided array.
     * @param array (optional) array to store this vector to. If this is not provided, a new array will be created.
     * @param offset (optional) optional offset into the array.
     */
    toArray(array?: number[], offset?: number): number[] {
        if (array === undefined) {
            array = [];
        }
        if (offset === undefined) {
            offset = array.length;
        }
        array[offset] = this.x;
        array[offset + 1] = this.y;
        array[offset + 2] = this.z;
        array[offset + 3] = this.w;
        return array;
    }
    /**
     * Sets this vector's {@link x| x}, {@link y| y}, {@link z| z} and {@link w| w} values from the {@link BufferAttribute| attribute}.
     * @param attribute the source attribute.
     * @param index index in the attribute.
     */
    fromBufferAttribute(attribute: BufferAttribute, index: number): Vector4 {
        this.x = attribute.getX(index);
        this.y = attribute.getY(index);
        this.z = attribute.getZ(index);
        this.w = attribute.getW(index);
        return this;
    }
}

/**
 * Readonly view of the public Vector4 API.
 */
export type ReadonlyVector4 = PickReadonly<Vector4,
    'x' | 'y' | 'z' | 'w' | 'dot' | 'lengthSq' |
    'length' | 'manhattanLength' | 'getNumberCount' | 'equals' | 'toArray'>;

const tempMin = new Vector4();
const tempMax = new Vector4();
