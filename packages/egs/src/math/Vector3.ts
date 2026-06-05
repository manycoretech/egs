import type { Camera3D } from '../scene/cameras/Camera3D';
import type { Matrix3 } from './Matrix3';
import type { Quaternion } from './Quaternion';
import { _Math } from './Math';
import type { Cylindrical } from './Cylindrical';
import type { Spherical } from './Spherical';
import type { PickReadonly } from '../utils/Utils';
import type { BufferAttribute } from '../elements/attributes/BufferAttribute';
import type { Vector } from './Vector';
import { Matrix4 } from './Matrix4';
/**
 * Class representing a 3D {@link https://en.wikipedia.org/wiki/Vector_space| vector}.
 * A 3D vector is an ordered triplet of numbers (labeled x, y, and z).
 */
export class Vector3 implements Vector {
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
     * Check the type whether it belongs to Vector3.
     * This value should not be changed by user.
     */
    isVector3 = true;

    constructor(_x?: number, _y?: number, _z?: number) {
        this.x = _x || 0;
        this.y = _y || 0;
        this.z = _z || 0;
    }
    /**
     * If NaN exists in three elements, return true.
     */
    hasNan(): boolean {
        return isNaN(this.x) || isNaN(this.y) || isNaN(this.z);
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
     * Set the {@link x| x}, {@link y| y} and {@link z| z} components of this vector.
     */
    set(x: number, y: number, z: number): Vector3 {
        this.x = x;
        this.y = y;
        this.z = z;
        return this;
    }
    /**
     * Set the {@link x| x}, {@link y| y} and {@link z| z} values of this vector both equal to scalar.
     */
    setScalar(scalar: number): Vector3 {
        this.x = scalar;
        this.y = scalar;
        this.z = scalar;
        return this;
    }
    /**
     * Replace this vector's {@link x| x} value with x.
     */
    setX(x: number): Vector3 {
        this.x = x;
        return this;
    }
    /**
     * Replace this vector's {@link y| y} value with y.
     */
    setY(y: number): Vector3 {
        this.y = y;
        return this;
    }
    /**
     * Replace this vector's {@link z| z} value with z.
     */
    setZ(z: number): Vector3 {
        this.z = z;
        return this;
    }
    /**
     * If index equals 0 set {@link x| x} to {@link Float| value}.
     * If index equals 1 set {@link y| y} to {@link Float| value}.
     * If index equals 2 set {@link z| z} to {@link Float| value}.
     */
    setComponent(index: number, value: number): Vector3 {
        switch (index) {
            case 0:
                this.x = value;
                break;
            case 1:
                this.y = value;
                break;
            case 2:
                this.z = value;
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
     * @param index 0, 1 or 2.
     */
    getComponent(index: number): number {
        switch (index) {
            case 0:
                return this.x;
            case 1:
                return this.y;
            case 2:
                return this.z;
            default:
                throw new Error('index is out of range: ' + index);
        }
    }
    /**
     * Returns a new vector3 with the same {@link x| x}, {@link y| y} and {@link z| z} values as this one.
     */
    clone(): Vector3 {
        return new Vector3(this.x, this.y, this.z);
    }
    cloneReadonly() {
        return this.clone() as any as ReadonlyVector3;
    }
    /**
     * Copies the values of the passed vector3's {@link x| x}, {@link y| y} and {@link z| z} properties to this vector3.
     */
    copy(v: Vector3): Vector3 {
        return this.set(v.x, v.y, v.z);
    }
    /**
     * Adds {@link Vector3| v} to this vector.
     */
    add(v: Vector3): Vector3 {
        this.x += v.x;
        this.y += v.y;
        this.z += v.z;
        return this;
    }
    /**
     * Adds the scalar value s to this vector's {@link x| x}, {@link y| y} and {@link z| z} values.
     */
    addScalar(s: number): Vector3 {
        this.x += s;
        this.y += s;
        this.z += s;
        return this;
    }
    /**
     * Sets this vector to {@link Vector3| a} + {@link Vector3| b}.
     */
    addVectors(a: Vector3, b: Vector3): Vector3 {
        this.x = a.x + b.x;
        this.y = a.y + b.y;
        this.z = a.z + b.z;
        return this;
    }
    /**
     * Adds the multiple of {@link Vector3| v} and s to this vector.
     */
    addScaledVector(v: Vector3, s: number): Vector3 {
        this.x += v.x * s;
        this.y += v.y * s;
        this.z += v.z * s;
        return this;
    }
    /**
     * Subtracts {@link Vector3| v} from this vector.
     */
    sub(v: Vector3): Vector3 {
        this.x -= v.x;
        this.y -= v.y;
        this.z -= v.z;
        return this;
    }
    /**
     * Subtracts s from this vector's {@link x| x}, {@link y| y} and {@link z| z} components.
     */
    subScalar(s: number): Vector3 {
        this.x -= s;
        this.y -= s;
        this.z -= s;
        return this;
    }
    /**
     * Sets this vector to {@link Vector3| a} - {@link Vector3| b}.
     */
    subVectors(a: Vector3, b: Vector3): Vector3 {
        this.x = a.x - b.x;
        this.y = a.y - b.y;
        this.z = a.z - b.z;
        return this;
    }
    /**
     * Multiplies this vector by {@link Vector3| v}.
     */
    multiply(v: Vector3): Vector3 {
        this.x *= v.x;
        this.y *= v.y;
        this.z *= v.z;
        return this;
    }
    /**
     * Multiplies this vector by scalar s.
     */
    multiplyScalar(scalar: number): Vector3 {
        this.x *= scalar;
        this.y *= scalar;
        this.z *= scalar;
        return this;
    }
    /**
     * Sets this vector equal to {@link Vector3| a} * {@link Vector3| b}, component-wise.
     */
    multiplyVectors(a: Vector3, b: Vector3): Vector3 {
        this.x = a.x * b.x;
        this.y = a.y * b.y;
        this.z = a.z * b.z;
        return this;
    }
    /**
     * Multiplies this vector by {@link Matrix3| m}
     */
    applyMatrix3(m: Matrix3): Vector3 {
        const x = this.x;
        const y = this.y;
        const z = this.z;
        const e = m._elements;
        this.x = e[0] * x + e[3] * y + e[6] * z;
        this.y = e[1] * x + e[4] * y + e[7] * z;
        this.z = e[2] * x + e[5] * y + e[8] * z;
        return this;
    }
    /**
     * Multiplies this vector (with an implicit 1 in the 4th dimension) and m, and divides by perspective.
     */
    applyMatrix4(m: Matrix4): Vector3 {
        const x = this.x;
        const y = this.y;
        const z = this.z;
        const e = m._elements;
        const w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]);
        this.x = (e[0] * x + e[4] * y + e[8] * z + e[12]) * w;
        this.y = (e[1] * x + e[5] * y + e[9] * z + e[13]) * w;
        this.z = (e[2] * x + e[6] * y + e[10] * z + e[14]) * w;
        return this;
    }
    /**
     * Applies a {@link Quaternion| Quaternion} transform to this vector.
     */
    applyQuaternion(q: Quaternion): Vector3 {
        const x = this.x;
        const y = this.y;
        const z = this.z;
        const qx = q.x;
        const qy = q.y;
        const qz = q.z;
        const qw = q.w;

        // calculate quat * vector
        const ix = qw * x + qy * z - qz * y;
        const iy = qw * y + qz * x - qx * z;
        const iz = qw * z + qx * y - qy * x;
        const iw = -qx * x - qy * y - qz * z;

        // calculate result * inverse quat
        this.x = ix * qw + iw * -qx + iy * -qz - iz * -qy;
        this.y = iy * qw + iw * -qy + iz * -qx - ix * -qz;
        this.z = iz * qw + iw * -qz + ix * -qy - iy * -qx;
        return this;
    }
    /**
     * Projects this vector from world space into the camera's normalized device coordinate (NDC) space.
     * @param camera camera to use in the projection.
     */
    project(camera: Camera3D): Vector3 {
        return this.applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix);
    }
    /**
     * Projects this vector from the camera's normalized device coordinate (NDC) space into world space.
     * @param camera camera to use in the projection.
     */
    unproject(camera: Camera3D): Vector3 {
        if (!tmpMat) {
            tmpMat = new Matrix4();
        }
        tmpMat.multiplyMatrices(camera.matrixWorld, tmpMat.getInverse(camera.projectionMatrix));
        return this.applyMatrix4(tmpMat);
    }
    /**
     * Transforms the direction of this vector by a matrix (the upper left 3 x 3 subset of a {@link Matrix4| m}) and then {@link normalize| normalizes} the result.
     */
    transformDirection(m: Matrix4): Vector3 {
        // input: EGS.Matrix4 affine matrix
        // vector interpreted as a direction
        const x = this.x;
        const y = this.y;
        const z = this.z;
        const e = m._elements;
        this.x = e[0] * x + e[4] * y + e[8] * z;
        this.y = e[1] * x + e[5] * y + e[9] * z;
        this.z = e[2] * x + e[6] * y + e[10] * z;
        return this.normalize();
    }
    /**
     * Divides this vector by {@link Vector3| v}.
     */
    divide(v: Vector3): Vector3 {
        this.x /= v.x;
        this.y /= v.y;
        this.z /= v.z;
        return this;
    }
    /**
     * Divides this vector by scalar s.
     * Sets vector to `( 0, 0, 0 )` if `s = 0`.
     */
    divideScalar(scalar: number): Vector3 {
        return this.multiplyScalar(1 / scalar);
    }
    /**
     * If this vector's x, y or z value is greater than the max vector's x, y or z value, it is replaced by the corresponding value. <br /><br />
     * If this vector's x, y or z value is less than the min vector's x, y or z value, it is replaced by the corresponding value.
     * @param min the minimum {@link x| x}, {@link y| y} and {@link z| z} values.
     * @param max the maximum {@link x| x}, {@link y| y} and {@link z| z} values in the desired range.
     */
    min(v: Vector3): Vector3 {
        this.x = Math.min(this.x, v.x);
        this.y = Math.min(this.y, v.y);
        this.z = Math.min(this.z, v.z);
        return this;
    }
    /**
     * If this vector's x, y or z value is greater than the max vector's x, y or z value, it is replaced by the corresponding value. <br /><br />
     * If this vector's x, y or z value is less than the min vector's x, y or z value, it is replaced by the corresponding value.
     * @param min the minimum {@link x| x}, {@link y| y} and {@link z| z} values.
     * @param max the maximum {@link x| x}, {@link y| y} and {@link z| z} values in the desired range.
     */
    max(v: Vector3): Vector3 {
        this.x = Math.max(this.x, v.x);
        this.y = Math.max(this.y, v.y);
        this.z = Math.max(this.z, v.z);
        return this;
    }
    /**
     * If this vector's x, y or z value is greater than the max vector's x, y or z value, it is replaced by the corresponding value. <br /><br />
     * If this vector's x, y or z value is less than the min vector's x, y or z value, it is replaced by the corresponding value.
     * @param min the minimum {@link x| x}, {@link y| y} and {@link z| z} values.
     * @param max the maximum {@link x| x}, {@link y| y} and {@link z| z} values in the desired range.
     */
    clamp(min: Vector3, max: Vector3): Vector3 {
        // assumes min < max, component-wise
        this.x = Math.max(min.x, Math.min(max.x, this.x));
        this.y = Math.max(min.y, Math.min(max.y, this.y));
        this.z = Math.max(min.z, Math.min(max.z, this.z));
        return this;
    }
    /**
     * If this vector's x, y or z values are greater than the max value, they are replaced by the max value. <br /><br />
     * If this vector's x, y or z values are less than the min value, they are replaced by the min value.
     * @param min the minimum value the components will be clamped to.
     * @param max the maximum value the components will be clamped to.
     */
    clampScalar(minVal: number, maxVal: number): Vector3 {
        tmp1Vec3.set(minVal, minVal, minVal);
        tmp2Vec3.set(maxVal, maxVal, maxVal);
        return this.clamp(tmp1Vec3, tmp2Vec3);
    }
    /**
     * If this vector's length is greater than the max value, the vector will be scaled down so its length is the max value. <br /><br />
     * If this vector's length is less than the min value, the vector will be scaled up so its length is the min value.
     * @param min the minimum value the length will be clamped to.
     * @param max the maximum value the length will be clamped to.
     */
    clampLength(min: number, max: number): Vector3 {
        const length = this.length();
        return this.divideScalar(length || 1).multiplyScalar(Math.max(min, Math.min(max, length)));
    }
    /**
     * The components of this vector are rounded down to the nearest integer value.
     */
    floor(): Vector3 {
        this.x = Math.floor(this.x);
        this.y = Math.floor(this.y);
        this.z = Math.floor(this.z);
        return this;
    }
    /**
     * The {@link x| x}, {@link y| y} and {@link z| z} components of this vector are rounded up to the nearest integer value.
     */
    ceil(): Vector3 {
        this.x = Math.ceil(this.x);
        this.y = Math.ceil(this.y);
        this.z = Math.ceil(this.z);
        return this;
    }
    /**
     * The components of this vector are rounded to the nearest integer value.
     */
    round(): Vector3 {
        this.x = Math.round(this.x);
        this.y = Math.round(this.y);
        this.z = Math.round(this.z);
        return this;
    }
    /**
     * The components of this vector are rounded towards zero (up if negative, down if positive) to an integer value.
     */
    roundToZero(): Vector3 {
        this.x = this.x < 0 ? Math.ceil(this.x) : Math.floor(this.x);
        this.y = this.y < 0 ? Math.ceil(this.y) : Math.floor(this.y);
        this.z = this.z < 0 ? Math.ceil(this.z) : Math.floor(this.z);
        return this;
    }
    /**
     * Inverts this vector - i.e. sets x = -x, y = -y and z = -z.
     */
    negate(): Vector3 {
        this.x = -this.x;
        this.y = -this.y;
        this.z = -this.z;
        return this;
    }
    /**
     * Calculate the {@link https://en.wikipedia.org/wiki/Dot_product| dot product} of this vector and {@link Vector3| v}.
     */
    dot(v: Vector3): number {
        return this.x * v.x + this.y * v.y + this.z * v.z;
    }
    /**
     * Computes the square of the {@link https://en.wikipedia.org/wiki/Euclidean_distance| Euclidean length}
     * (straight-line length) from (0, 0, 0) to (x, y, z). If you are 	comparing the lengths of
     * vectors, you should compare the length squared instead as it is slightly more efficient to calculate.
     */
    lengthSq(): number {
        return this.x * this.x + this.y * this.y + this.z * this.z;
    }
    /**
     * Computes the Euclidean length (straight-line length) from (0, 0, 0) to (x, y, z).
     */
    length(): number {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }
    /**
     * Computes the {@link http://en.wikipedia.org/wiki/Taxicab_geometry| Manhattan length} of this vector.
     */
    manhattanLength(): number {
        return Math.abs(this.x) + Math.abs(this.y) + Math.abs(this.z);
    }
    /**
     * Convert this vector to a {@link https://en.wikipedia.org/wiki/Unit_vector| unit vector}
     * - that is, sets it equal to a vector with the same direction as this one, but {@link length| length} 1.
     */
    normalize(): Vector3 {
        return this.divideScalar(this.length() || 1);
    }
    /**
     * Sets this vector to a vector with given length the same direction as this one.
     */
    setLength(length: number): Vector3 {
        return this.normalize().multiplyScalar(length);
    }
    /**
     * Linearly interpolate between this vector and {@link Vector3| v}, where alpha is the
     * percent distance along the line - alpha = 0 will be this vector, and alpha = 1 will be {@link Vector3| v}.
     * @param v {@link Vector3| Vector3} to interpolate towards.
     * @param alpha interpolation factor, typically in the closed interval [0, 1].
     */
    lerp(v: Vector3, alpha: number): Vector3 {
        this.x += (v.x - this.x) * alpha;
        this.y += (v.y - this.y) * alpha;
        this.z += (v.z - this.z) * alpha;
        return this;
    }
    /**
     * Sets this vector to be the vector linearly interpolated between {@link Vector3| v1} and
     * {@link Vector3| v2} where alpha is the percent distance along the line connecting the two vectors -
     * alpha = 0 will be {@link Vector3| v1}, and alpha = 1 will be {@link Vector3| v2}.
     * @param v1 the starting {@link Vector3| Vector3}.
     * @param v2 {@link Vector3| Vector3} to interpolate towards.
     * @param alpha interpolation factor, typically in the closed interval [0, 1].
     */
    lerpVectors(v1: Vector3, v2: Vector3, alpha: number): Vector3 {
        return this.subVectors(v2, v1).multiplyScalar(alpha).add(v1);
    }
    /**
     * Sets this vector to {@link https://en.wikipedia.org/wiki/Cross_product| cross product} of itself and {@link Vector3| v}.
     */
    cross(v: Vector3): Vector3 {
        return this.crossVectors(this, v);
    }
    /**
     * Sets this vector to cross product of {@link Vector3| a} and {@link Vector3| b}.
     */
    crossVectors(a: Vector3, b: Vector3): Vector3 {
        const ax = a.x;
        const ay = a.y;
        const az = a.z;
        const bx = b.x;
        const by = b.y;
        const bz = b.z;

        this.x = ay * bz - az * by;
        this.y = az * bx - ax * bz;
        this.z = ax * by - ay * bx;
        return this;
    }
    /**
     * {@link https://en.wikipedia.org/wiki/Vector_projection| Projects} this vector onto {@link Vector3| vector}.
     */
    projectOnVector(vector: Vector3): Vector3 {
        const scalar = vector.dot(this) / vector.lengthSq();
        return this.copy(vector).multiplyScalar(scalar);
    }
    /**
     * {@link https://en.wikipedia.org/wiki/Vector_projection| Projects} this vector onto a plane by subtracting this vector projected onto the plane's normal from this vector.
     * @param planeNormal A vector representing a plane normal.
     */
    projectOnPlane(planeNormal: Vector3): Vector3 {
        tmp1Vec3.copy(this).projectOnVector(planeNormal);
        return this.sub(tmp1Vec3);
    }
    /**
     * Reflect this vector off of plane orthogonal to {@link Vector3| normal}.
     * Normal is assumed to have unit length.
     * @param normal the normal to the reflecting plane.
     */
    reflect(normal: Vector3): Vector3 {
        // reflect incident vector off plane orthogonal to normal
        // normal is assumed to have unit length
        return this.sub(tmp1Vec3.copy(normal).multiplyScalar(2 * this.dot(normal)));
    }
    /**
     * Returns the angle between this vector and vector {@link Vector3| v} in radians.
     */
    angleTo(v: Vector3): number {
        const theta = this.dot(v) / Math.sqrt(this.lengthSq() * v.lengthSq());
        // clamp, to handle numerical problems
        return Math.acos(_Math.clamp(theta, -1, 1));
    }
    /**
     * Computes the distance from this vector to {@link Vector3| v}.
     */
    distanceTo(v: Vector3): number {
        return Math.sqrt(this.distanceToSquared(v));
    }
    /**
     * Computes the squared distance from this vector to {@link Vector3| v}.
     * If you are just comparing the distance with another distance,
     * you should compare the distance squared instead as it is slightly more efficient to calculate.
     */
    distanceToSquared(v: Vector3): number {
        const dx = this.x - v.x;
        const dy = this.y - v.y;
        const dz = this.z - v.z;
        return dx * dx + dy * dy + dz * dz;
    }
    /**
     * Computes the {@link https://en.wikipedia.org/wiki/Taxicab_geometry| Manhattan distance} from this vector to {@link Vector3| v}.
     */
    manhattanDistanceTo(v: Vector3): number {
        return Math.abs(this.x - v.x) + Math.abs(this.y - v.y) + Math.abs(this.z - v.z);
    }
    /**
     * Sets this vector from the spherical coordinates {@link Spherical| s}.
     */
    setFromSpherical(s: Spherical): Vector3 {
        return this.setFromSphericalCoords(s.radius, s.phi, s.theta);
    }
    /**
     * Sets this vector from the spherical coordinates {@link Spherical| radius}, {@link Spherical| phi} and {@link Spherical| theta}.
     */
    setFromSphericalCoords(radius: number, phi: number, theta: number): Vector3 {
        const sinPhiRadius = Math.sin(phi) * radius;
        this.x = sinPhiRadius * Math.sin(theta);
        this.y = Math.cos(phi) * radius;
        this.z = sinPhiRadius * Math.cos(theta);
        return this;
    }
    /**
     * Sets this vector from the cylindrical coordinates {@link Cylindrical| c}.
     */
    setFromCylindrical(c: Cylindrical): Vector3 {
        return this.setFromCylindricalCoords(c.radius, c.theta, c.y);
    }
    /**
     * Sets this vector from the cylindrical coordinates {@link Cylindrical| radius}, {@link Cylindrical| theta} and {@link Cylindrical| y}.
     */
    setFromCylindricalCoords(radius: number, theta: number, y: number): Vector3 {
        this.x = radius * Math.sin(theta);
        this.y = y;
        this.z = radius * Math.cos(theta);
        return this;
    }
    /**
     * Sets this vector to the position elements of the {@link https://en.wikipedia.org/wiki/Transformation_matrix| transformation matrix} {@link Matrix4| m}.
     */
    setFromMatrixPosition(m: Matrix4): Vector3 {
        const e = m._elements;
        this.x = e[12];
        this.y = e[13];
        this.z = e[14];
        return this;
    }
    /**
     * Sets this vector's {@link x| x}, {@link y| y} and {@link z| z} components from {@link Integer| index} column of {@link Matrix4| matrix}.
     */
    setFromMatrixColumn(matrix: Matrix4, index: number): Vector3 {
        return this.fromArray(matrix._elements, index * 4);
    }
    /**
     * Sets this vector to the scale elements of the {@link https://en.wikipedia.org/wiki/Transformation_matrix| transformation matrix} {@link Matrix4| m}.
     */
    setFromMatrixScale(m: Matrix4): Vector3 {
        const sx = this.setFromMatrixColumn(m, 0).length();
        const sy = this.setFromMatrixColumn(m, 1).length();
        const sz = this.setFromMatrixColumn(m, 2).length();
        this.x = sx;
        this.y = sy;
        this.z = sz;
        return this;
    }
    /**
     * Checks for strict equality of this vector and {@link Vector3| v}.
     */
    equals(v: Vector3): boolean {
        return v.x === this.x && v.y === this.y && v.z === this.z;
    }
    /**
     * Sets this vector's {@link x| x} value to be array[ offset + 0 ], {@link y| y} value to be array[ offset + 1 ] and {@link z| z} value to be array[ offset + 2 ].
     * @param array the source array.
     * @param offset ( optional) offset into the array.
     * @defaultValue `0`.
     */
    fromArray(array: ArrayLike<number>, offset?: number): Vector3 {
        if (offset === undefined) {
            offset = 0;
        }
        this.x = array[offset];
        this.y = array[offset + 1];
        this.z = array[offset + 2];
        return this;
    }
    /**
     * There are 3 elements in this vector.
     */
    getNumberCount() {
        return 3;
    }
    /**
     * Returns an array [x, y, z], or copies x, y and z into the provided array.
     * @param array (optional) array to store this vector to.
     * If this is not provided a new array will be created.
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
        return array;
    }
    /**
     * Sets this vector's {@link x| x}, {@link y| y} and {@link z| z} values from the {@link BufferAttribute| attribute}.
     * @param attribute the source attribute.
     * @param index index in the attribute.
     */
    fromBufferAttribute(attribute: BufferAttribute, index: number): Vector3 {
        this.x = attribute.getX(index);
        this.y = attribute.getY(index);
        this.z = attribute.getZ(index);
        return this;
    }
}

/**
 * Readonly view of the public Vector3 API.
 */
export type ReadonlyVector3 = PickReadonly<
    Vector3,
    | 'x'
    | 'y'
    | 'z'
    | 'dot'
    | 'angleTo'
    | 'lengthSq'
    | 'length'
    | 'distanceTo'
    | 'manhattanLength'
    | 'distanceToSquared'
    | 'manhattanDistanceTo'
    | 'getNumberCount'
    | 'equals'
    | 'toArray'
>;

const tmp1Vec3 = new Vector3();
const tmp2Vec3 = new Vector3();
let tmpMat: Matrix4 | undefined;
