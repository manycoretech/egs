import { Matrix4 } from './Matrix4';
import { _Math } from './Math';
import { Quaternion } from './Quaternion';
import { Vector3 } from './Vector3';
import { logger } from '../utils/Logger';

/**
 * Euler-angle rotation represented by x, y, z radians and an order.
 */
export class Euler {
    /**
     * The angle of the x axis in radians.
     */
    _x: number;
    /**
     * The angle of the y axis in radians.
     */
    _y: number;
    /**
     * The angle of the z axis in radians.
     */
    _z: number;
    /**
     * A string representing the order that the rotations are applied.
     */
    _order: string;
    /**
     * Check the type whether it belongs to Euler.
     * This value should not be changed by user.
     */
    isEuler = true;
    /**
     * The function will be called when {@link _x| x}, {@link _y| y} {@link _z| z} and {@link _order| order} is changed.
     */
    onChangeCallback: Function;
    /**
     * All possible value for {@link _order| order}.
     */
    static RotationOrders = ['XYZ', 'YZX', 'ZXY', 'XZY', 'YXZ', 'ZYX'];
    /**
     * The default of {@link _order| order}.
     */
    static DefaultOrder = 'XYZ';

    /**
     * @param x rotation x
     * @param y rotation y
     * @param z rotation z
     * @param order euler order, values in `RotationOrders`
     */
    constructor(x?: number, y?: number, z?: number, order?: string) {
        this._x = x || 0;
        this._y = y || 0;
        this._z = z || 0;
        this._order = order || Euler.DefaultOrder;
        this.onChangeCallback = function () {};
    }

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

    get order(): string {
        return this._order;
    }

    set order(value: string) {
        this._order = value;
        this.onChangeCallback();
    }
    /**
     * Sets the angles of this euler transform and optionally the {@link order| order}.
     */
    set(x: number, y: number, z: number, order?: string): Euler {
        this._x = x;
        this._y = y;
        this._z = z;
        this._order = order || this._order;
        this.onChangeCallback();
        return this;
    }
    /**
     * Returns a new Euler with the same parameters as this one.
     */
    clone(): Euler {
        return new Euler(this._x, this._y, this._z, this._order);
    }
    /**
     * Copies value of {@link Euler| euler} to this euler.
     */
    copy(euler: Euler): Euler {
        this._x = euler._x;
        this._y = euler._y;
        this._z = euler._z;
        this._order = euler._order;
        this.onChangeCallback();
        return this;
    }
    /**
     * Sets the angles of this euler transform from a pure rotation matrix based on the orientation specified by order.
     * @param m a {@link Matrix4| Matrix4} of which the upper 3x3 of matrix is a pure
     * {@link https://en.wikipedia.org/wiki/Rotation_matrix| rotation matrix} (i.e. unscaled).
     * @param order (optional) a string representing the order that the rotations are applied.
     */
    setFromRotationMatrix(m: Matrix4, order?: string, update?: boolean): Euler {
        const clamp = _Math.clamp;
        // assumes the upper 3x3 of m is a pure rotation matrix (i.e, unscaled)
        const te = m._elements;
        const m11 = te[0],
            m12 = te[4],
            m13 = te[8],
            m21 = te[1],
            m22 = te[5],
            m23 = te[9],
            m31 = te[2],
            m32 = te[6],
            m33 = te[10];
        order = order || this._order;
        switch (order) {
            case 'XYZ':
                {
                    this._y = Math.asin(clamp(m13, -1, 1));
                    if (Math.abs(m13) < 0.99999) {
                        this._x = Math.atan2(-m23, m33);
                        this._z = Math.atan2(-m12, m11);
                    } else {
                        this._x = Math.atan2(m32, m22);
                        this._z = 0;
                    }
                }
                break;
            case 'YXZ':
                {
                    this._x = Math.asin(-clamp(m23, -1, 1));
                    if (Math.abs(m23) < 0.99999) {
                        this._y = Math.atan2(m13, m33);
                        this._z = Math.atan2(m21, m22);
                    } else {
                        this._y = Math.atan2(-m31, m11);
                        this._z = 0;
                    }
                }
                break;
            case 'ZXY':
                {
                    this._x = Math.asin(clamp(m32, -1, 1));
                    if (Math.abs(m32) < 0.99999) {
                        this._y = Math.atan2(-m31, m33);
                        this._z = Math.atan2(-m12, m22);
                    } else {
                        this._y = 0;
                        this._z = Math.atan2(m21, m11);
                    }
                }
                break;
            case 'ZYX':
                {
                    this._y = Math.asin(-clamp(m31, -1, 1));
                    if (Math.abs(m31) < 0.99999) {
                        this._x = Math.atan2(m32, m33);
                        this._z = Math.atan2(m21, m11);
                    } else {
                        this._x = 0;
                        this._z = Math.atan2(-m12, m22);
                    }
                }
                break;
            case 'YZX':
                {
                    this._z = Math.asin(clamp(m21, -1, 1));
                    if (Math.abs(m21) < 0.99999) {
                        this._x = Math.atan2(-m23, m22);
                        this._y = Math.atan2(-m31, m11);
                    } else {
                        this._x = 0;
                        this._y = Math.atan2(m13, m33);
                    }
                }
                break;
            case 'XZY':
                {
                    this._z = Math.asin(-clamp(m12, -1, 1));
                    if (Math.abs(m12) < 0.99999) {
                        this._x = Math.atan2(m32, m22);
                        this._y = Math.atan2(m13, m11);
                    } else {
                        this._x = Math.atan2(-m23, m33);
                        this._y = 0;
                    }
                }
                break;
            default:
                logger.unsupported('EGS.Euler: .setFromRotationMatrix() given unsupported order: ' + order);
                break;
        }
        this._order = order;
        if (update !== false) {
            this.onChangeCallback();
        }
        return this;
    }
    /**
     * Sets the angles of this euler transform from a normalized quaternion based on the orientation specified by {@link order| order}.
     * @param q a normalized quaternion.
     * @param order (optional) a string representing the order that the rotations are applied.
     */
    setFromQuaternion(q: Quaternion, order?: string, update?: boolean): Euler {
        // let matrix = new Matrix4();
        tmpMatrix.makeRotationFromQuaternion(q);
        return this.setFromRotationMatrix(tmpMatrix, order, update);
    }
    /**
     * Set the {@link x| x}, {@link y| y} and {@link z| z} from vector, and optionally update the {@link order| order}.
     * @param vector {@link Vector3| Vector3}.
     * @param order (optional) a string representing the order that the rotations are applied.
     */
    setFromVector3(v: Vector3, order?: string): Euler {
        return this.set(v.x, v.y, v.z, order || this._order);
    }
    /**
     * Resets the euler angle with a new order by creating a quaternion from this euler angle
     * and then setting this euler angle with the quaternion and the new order.
     * @WARNING this discards revolution information.
     */
    reorder(newOrder: string): Euler {
        // WARNING: this discards revolution information -bhouston
        // let q = new Quaternion();
        tmpQ.setFromEuler(this);
        return this.setFromQuaternion(tmpQ, newOrder);
    }
    /**
     * Checks for strict equality of this euler and {@link Euler| euler}.
     */
    equals(euler: Euler): boolean {
        return euler._x === this._x && euler._y === this._y && euler._z === this._z && euler._order === this._order;
    }
    /**
     * Array of length 3 or 4. The optional 4th argument corresponds from the {@link order| order}.
     * Assigns this euler's {@link x| x} angle from array[0].
     * Assigns this euler's {@link y| y} angle from array[1].
     * Assigns this euler's {@link z| z} angle from array[2].
     * Optionally assigns this euler's {@link order| order} from array[3].
     */
    fromArray(array: ArrayLike<number>): Euler {
        this._x = array[0];
        this._y = array[1];
        this._z = array[2];
        this.onChangeCallback();
        return this;
    }
    /**
     * Returns an array of the form [{@link x| x}, {@link y| y}, {@link z| z}, {@link order| order}].
     * @param array (optional) array to store the euler in.
     * @param offset (optional) offset in the array.
     */
    toArray(array?: number[], offset?: number): number[] {
        if (array === undefined) {
            array = [];
        }
        if (offset === undefined) {
            offset = 0;
        }
        array[offset] = this._x;
        array[offset + 1] = this._y;
        array[offset + 2] = this._z;
        (array[offset + 3] as any) = this._order;
        return array;
    }

    /**
     * @param optionalResult (optional) If specified, the result will be copied into this Vector, otherwise a new one will be created.
     * Returns the Euler's {@link x| x}, {@link y| y} and {@link z| z} properties as a {@link Vector3| Vector3}.
     */
    toVector3(optionalResult?: Vector3): Vector3 {
        if (optionalResult) {
            return optionalResult.set(this._x, this._y, this._z);
        } else {
            return new Vector3(this._x, this._y, this._z);
        }
    }
    /**
     * A method to call {@link onChangeCallback| onChangeCallback}.
     */
    onChange(callback: Function): void {
        this.onChangeCallback = callback;
    }
}
const tmpMatrix = new Matrix4();
const tmpQ = new Quaternion();
