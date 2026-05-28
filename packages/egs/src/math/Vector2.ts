import { PickReadonly, Size } from '../utils/Utils';
import { Matrix3 } from './Matrix3';
import { Matrix4 } from './Matrix4';
import { Vector } from './Vector';
import { logger } from '../utils/Logger';
/**
 * Class representing a 2D {@link https://en.wikipedia.org/wiki/Vector_space| vector}.
 * A 2D vector is an ordered pair of numbers (labeled x and y).
 */
export class Vector2 implements Vector {
    /**
     * the x value of this vector.
     * @defaultValue `0`.
     */
    public x: number;
    /**
     * the y value of this vector.
     * @defaultValue `0`.
     */
    public y: number;
    /**
     * Check the type whether it belongs to Vector2.
     * This value should not be changed by user.
     */
    public isVector2 = true;

    constructor(_x?: number, _y?: number) {
        this.x = _x || 0;
        this.y = _y || 0;
    }
    /**
     * @internal
     */
    public getSerializeData() {
        return this.toArray();
    }
    /**
     * @internal
     */
    public setSerializeData(value: any): void {
        this.fromArray(value);
    }
    /**
     * Same to x.
     */
    get width(): number {
        return this.x;
    }

    set width(w: number) {
        this.x = w;
    }
    /**
     * Same to y.
     */
    get height(): number {
        return this.y;
    }

    set height(h: number) {
        this.y = h;
    }
    /**
     * Sets the {@link x| x} and {@link y| y} components of this vector.
     */
    public set(x: number, y: number): Vector2 {
        this.x = x;
        this.y = y;
        return this;
    }
    /**
     * Sets the {@link x| x} and {@link y| y} values of this vector both equal to scalar.
     */
    public setScalar(scalar: number): Vector2 {
        this.x = scalar;
        this.y = scalar;
        return this;
    }
    /**
     * Replaces this vector's {@link x| x} value with {@link Float| x}.
     */
    public setX(x: number): Vector2 {
        this.x = x;
        return this;
    }
    /**
     * Replaces this vector's {@link y| y} value with {@link Float| y}.
     */
    public setY(y: number): Vector2 {
        this.y = y;
        return this;
    }
    /**
     * If index equals 0 set {@link x| x} to {@link Float| value}.
     * If index equals 1 set {@link y| y} to {@link Float| value}.
     */
    public setComponent(index: number, value: number): Vector2 {
        switch (index) {
            case 0: this.x = value;
                break;
            case 1: this.y = value;
                break;
            default:
                throw new Error('index is out of range: ' + index);
        }
        return this;
    }
    /**
     * If index equals 0 returns the {@link x| x} value.
     * If index equals 1 returns the {@link y| y} value.
     * @param index 0 or 1.
     */
    public getComponent(index: number): number {
        switch (index) {
            case 0:
                return this.x;
            case 1:
                return this.y;
            default:
                throw new Error('index is out of range: ' + index);
        }
    }
    /**
     * Returns a new Vector2 with the same {@link x| x} and {@link y| y} values as this one.
     */
    public clone(): Vector2 {
        return new Vector2(this.x, this.y);
    }
    public cloneReadonly() {
        return this.clone() as any as ReadonlyVector2;
    }
    /**
     * Copies the values of the passed Vector2's {@link x| x} and {@link y| y} properties to this Vector2.
     */
    public copy(v: Vector2): Vector2 {
        this.x = v.x;
        this.y = v.y;
        return this;
    }
    /**
     * Adds {@link Vector2| v} to this vector.
     */
    public add(v: Vector2): Vector2 {
        this.x += v.x;
        this.y += v.y;
        return this;
    }
    /**
     * Adds the scalar value s to this vector's {@link x| x} and {@link y| y} values.
     */
    public addScalar(s: number): Vector2 {
        this.x += s;
        this.y += s;
        return this;
    }
    /**
     * Sets this vector to {@link Vector2| a} + {@link Vector2| b}.
     */
    public addVectors(a: Vector2, b: Vector2): Vector2 {
        this.x = a.x + b.x;
        this.y = a.y + b.y;
        return this;
    }
    /**
     * Adds the multiple of {@link Vector2| v} and s to this vector.
     */
    public addScaledVector(v: Vector2, s: number): Vector2 {
        this.x += v.x * s;
        this.y += v.y * s;
        return this;
    }
    /**
     * Subtracts {@link Vector2| v} from this vector.
     */
    public sub(v: Vector2): Vector2 {
        this.x -= v.x;
        this.y -= v.y;
        return this;
    }
    /**
     * Subtracts s from this vector's {@link x| x} and {@link y| y} components.
     */
    public subScalar(s: number): Vector2 {
        this.x -= s;
        this.y -= s;
        return this;
    }
    /**
     * Sets this vector to {@link Vector2| a} - {@link Vector2| b}.
     */
    public subVectors(a: Vector2, b: Vector2): Vector2 {
        this.x = a.x - b.x;
        this.y = a.y - b.y;
        return this;
    }
    /**
     * Multiplies this vector by {@link Vector2| v}.
     */
    public multiply(v: Vector2): Vector2 {
        this.x *= v.x;
        this.y *= v.y;
        return this;
    }
    /**
     * Multiplies this vector by scalar s.
     */
    public multiplyScalar(scalar: number): Vector2 {
        this.x *= scalar;
        this.y *= scalar;
        return this;
    }
    /**
     * Divides this vector by {@link Vector2| v}.
     */
    public divide(v: Vector2): Vector2 {
        this.x /= v.x;
        this.y /= v.y;
        return this;
    }
    /**
     * Divides this vector by scalar s.<br />
     * Sets vector to `( 0, 0 )` if s = 0.
     */
    public divideScalar(scalar: number): Vector2 {
        return this.multiplyScalar(1 / scalar);
    }
    /**
     * Multiplies this vector (with an implicit 1 as the 3rd component) by m.
     */
    public applyMatrix3(m: Matrix3): Vector2 {
        const x = this.x;
        const y = this.y;
        const e = m._elements;
        this.x = e[0] * x + e[3] * y + e[6];
        this.y = e[1] * x + e[4] * y + e[7];
        if (!m.is2x3) {
            const w = 1 / (e[2] * x + e[5] * y + e[8]);
            this.x *= w;
            this.y *= w;
        }
        return this;
    }
    /**
     * Multiplies this vector (with an implicit 1 as the 4rd component) by m.
     */
    public applyMatrix4(m: Matrix4): Vector2 {
        const x = this.x;
        const y = this.y;
        const e = m._elements;
        this.x = e[0] * x + e[4] * y + e[12];
        this.y = e[1] * x + e[5] * y + e[13];
        return this;
    }
    /**
     * If this vector's x or y value is greater than the max vector's x or y value, it is replaced by the corresponding value.
     * If this vector's x or y value is less than the min vector's x or y value, it is replaced by the corresponding value.
     * @param min the minimum x and y values.
     * @param max the maximum x and y values in the desired range.
     */
    public min(v: Vector2): Vector2 {
        this.x = Math.min(this.x, v.x);
        this.y = Math.min(this.y, v.y);
        return this;
    }
    /**
     * If this vector's x or y value is greater than the max vector's x or y value, it is replaced by the corresponding value.
     * If this vector's x or y value is less than the min vector's x or y value, it is replaced by the corresponding value.
     * @param min the minimum x and y values.
     * @param max the maximum x and y values in the desired range.
     */
    public max(v: Vector2): Vector2 {
        this.x = Math.max(this.x, v.x);
        this.y = Math.max(this.y, v.y);
        return this;
    }
    /**
     * If this vector's x or y value is greater than the max vector's x or y value, it is replaced by the corresponding value. <br /><br />
     * If this vector's x or y value is less than the min vector's x or y value, it is replaced by the corresponding value.
     * @param min the minimum x and y values.
     * @param max the maximum x and y values in the desired range.
     */
    public clamp(min: Vector2, max: Vector2): Vector2 {
        // assumes min < max, component-wise
        this.x = Math.max(min.x, Math.min(max.x, this.x));
        this.y = Math.max(min.y, Math.min(max.y, this.y));
        return this;
    }
    /**
     * If this vector's x or y values are greater than the max value, they are replaced by the max value. <br /><br />
     * If this vector's x or y values are less than the min value, they are replaced by the min value.
     * @param min the minimum value the components will be clamped to.
     * @param max the maximum value the components will be clamped to.
     */
    public clampScalar(minVal: number, maxVal: number): Vector2 {
        tmp1Vec2.set(minVal, minVal);
        tmp2Vec2.set(maxVal, maxVal);
        return this.clamp(tmp1Vec2, tmp2Vec2);
    }
    /**
     * If this vector's length is greater than the max value, it is replaced by the max value. <br /><br />
     * If this vector's length is less than the min value, it is replaced by the min value.
     * @param min the minimum value the length will be clamped to.
     * @param max the maximum value the length will be clamped to.
     */
    public clampLength(min: number, max: number): Vector2 {
        const length = this.length();
        return this.divideScalar(length || 1).multiplyScalar(Math.max(min, Math.min(max, length)));
    }
    /**
     * The components of this vector are rounded down to the nearest integer value.
     */
    public floor(): Vector2 {
        this.x = Math.floor(this.x);
        this.y = Math.floor(this.y);
        return this;
    }
    /**
     * The {@link x| x} and {@link y| y} components of this vector are rounded up to the nearest integer value.
     */
    public ceil(): Vector2 {
        this.x = Math.ceil(this.x);
        this.y = Math.ceil(this.y);
        return this;
    }
    /**
     * The components of this vector are rounded to the nearest integer value.
     */
    public round(): Vector2 {
        this.x = Math.round(this.x);
        this.y = Math.round(this.y);
        return this;
    }
    /**
     * The components of this vector are rounded towards zero (up if negative, down if positive) to an integer value.
     */
    public roundToZero(): Vector2 {
        this.x = (this.x < 0) ? Math.ceil(this.x) : Math.floor(this.x);
        this.y = (this.y < 0) ? Math.ceil(this.y) : Math.floor(this.y);
        return this;
    }
    /**
     * Inverts this vector - i.e. sets x = -x and y = -y.
     */
    public negate(): Vector2 {
        this.x = - this.x;
        this.y = - this.y;
        return this;
    }
    /**
     * Calculates the {@link https://en.wikipedia.org/wiki/Dot_product| dot product} of this vector and {@link Vector2| v}.
     */
    public dot(v: Vector2): number {
        return this.x * v.x + this.y * v.y;
    }
    /**
     * Calculates the cross product of this vector and {@link Vector2| v}.
     * @tips that a 'cross-product' in 2D is not well-defined. This function computes a geometric cross-product often used in 2D graphics
     */
    public cross(v: Vector2): number {
        return this.x * v.y - this.y * v.x;
    }
    /**
     * Computes the square of the {@link https://en.wikipedia.org/wiki/Euclidean_distance| Euclidean length } (straight-line length) from (0, 0) to (x, y).
     * If you are comparing the lengths of vectors, you should compare the length squared instead as it is slightly more efficient to calculate.
     */
    public lengthSq(): number {
        return this.x * this.x + this.y * this.y;
    }
    /**
     * Computes the Euclidean length (straight-line length) from (0, 0) to (x, y).
     */
    public length(): number {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }
    /**
     * Computes the {@link http://en.wikipedia.org/wiki/Taxicab_geometry| Manhattan length } of this vector.
     */
    public manhattanLength(): number {
        return Math.abs(this.x) + Math.abs(this.y);
    }
    /**
     * Converts this vector to a {@link https://en.wikipedia.org/wiki/Unit_vector| unit vector }.
     * that is, sets it equal to a vector with the same direction as this one, but {@link length| length} 1.
     */
    public normalize(): Vector2 {
        return this.divideScalar(this.length() || 1);
    }
    /**
     * Computes the angle in radians of this vector with respect to the positive x-axis.
     */
    public angle(): number {
        // computes the angle in radians with respect to the positive x-axis
        let angle = Math.atan2(this.y, this.x);
        if (angle < 0) {
            angle += 2 * Math.PI;
        }
        return angle;
    }
    /**
     * Computes the distance from this vector to {@link Vector2| v}.
     */
    public distanceTo(v: Vector2): number {
        return Math.sqrt(this.distanceToSquared(v));
    }
    /**
     * Computes the squared distance from this vector to {@link Vector2| v}.
     * If you are just comparing the distance with another distance,
     * you should compare the distance squared instead as it is slightly more efficient to calculate.
     */
    public distanceToSquared(v: Vector2): number {
        const dx = this.x - v.x;
        const dy = this.y - v.y;
        return dx * dx + dy * dy;
    }
    /**
     * Computes the {@link https://en.wikipedia.org/wiki/Taxicab_geometry| Manhattan distance} from this vector to {@link Vector2| v}.
     */
    public manhattanDistanceTo(v: Vector2): number {
        return Math.abs(this.x - v.x) + Math.abs(this.y - v.y);
    }
    /**
     * Sets this vector to a vector with given length the same direction as this one.
     */
    public setLength(length: number): Vector2 {
        return this.normalize().multiplyScalar(length);
    }
    /**
     * Linearly interpolates between this vector and {@link Vector2| v},
     * where alpha is the percent distance along the line - alpha = 0 will be this vector, and alpha = 1 will be {@link Vector2| v}.
     * @param v {@link Vector2| Vector2} to interpolate towards.
     * @param alpha interpolation factor, typically in the closed interval [0, 1].
     */
    public lerp(v: Vector2, alpha: number): Vector2 {
        this.x += (v.x - this.x) * alpha;
        this.y += (v.y - this.y) * alpha;
        return this;
    }
    /**
     * Sets this vector to be the vector linearly interpolated between {@link Vector2| v1} and
     * {@link Vector2| v2} where alpha is the percent distance along the line connecting the two vectors -
     * alpha = 0 will be {@link Vector2| v1}, and alpha = 1 will be {@link Vector2| v2}.
     * @param v1 the starting {@link Vector2| Vector2}.
     * @param v2 {@link Vector2| Vector2} to interpolate towards.
     * @param alpha interpolation factor, typically in the closed interval [0, 1].
     */
    public lerpVectors(v1: Vector2, v2: Vector2, alpha: number): Vector2 {
        return this.subVectors(v2, v1).multiplyScalar(alpha).add(v1);
    }
    /**
     * Checks for strict equality of this vector and {@link Vector2| v}.
     */
    public equals(v: Vector2): boolean {
        return ((v.x === this.x) && (v.y === this.y));
    }
    /**
     * Sets this vector's {@link x| x} value to be array[ offset ] and {@link y| y} value to be array[ offset + 1 ].
     * @param array the source array.
     * @param offset (optional) offset into the array.
     * @defaultValue is 0.
     */
    public fromArray(array: ArrayLike<number>, offset?: number): Vector2 {
        if (offset === undefined) {
            offset = 0;
        }
        this.x = array[offset];
        this.y = array[offset + 1];
        return this;
    }
    /**
     * There are 2 elements in this vector.
     */
    public getNumberCount() {
        return 2;
    }
    /**
     * Returns an array [x, y], or copies x and y into the provided array.
     * @param array (optional) array to store this vector to. If this is not provided, a new array will be created.
     * @param offset (optional) optional offset into the array.
     */
    public toArray(array?: number[], offset?: number): number[] {
        if (array === undefined) {
            array = [];
        }
        if (offset === undefined) {
            offset = array.length;
        }
        array[offset] = this.x;
        array[offset + 1] = this.y;
        return array;
    }
    /**
     * @deprecated please use BufferAttribute.getVector2
     * Sets this vector's {@link .x| x} and {@link .y| y} values from the {@link BufferAttribute| attribute}.
     * @param attribute the source attribute.
     * @param index index in the attribute.
     */
    public fromBufferAttribute(attribute: { getX: (number: number) => number, getY: (number: number) => number, }, index: number, offset?: number): Vector2 {
        if (offset !== undefined) {
            logger.warn('EGS.Vector2: offset has been removed from .fromBufferAttribute().');
        }
        logger.warn('Deprecated! Please use BufferAttribute.getVector2.');
        this.x = attribute.getX(index);
        this.y = attribute.getY(index);
        return this;
    }
    /**
     * Rotates this vector around {@link Vector2| center} by {@link Float| angle} radians.
     * @param center the point around which to rotate.
     * @param angle the angle to rotate, in radians.
     */
    public rotateAround(center: Vector2, angle: number): Vector2 {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        const x = this.x - center.x;
        const y = this.y - center.y;
        this.x = x * c - y * s + center.x;
        this.y = x * s + y * c + center.y;
        return this;
    }

    public intoSize(): Size {
        return {
            width: this.x,
            height: this.y
        };
    }
}

export type ReadonlyVector2 = PickReadonly<Vector2,
    'x' | 'y' | 'width' | 'height' | 'isVector2' | 'dot' | 'cross' | 'lengthSq' | 'length' | 'angle' |
    'manhattanLength' | 'distanceTo' | 'distanceToSquared' | 'manhattanDistanceTo' | 'getNumberCount' | 'equals' | 'toArray' | 'intoSize'>;

const tmp1Vec2 = new Vector2();
const tmp2Vec2 = new Vector2();
