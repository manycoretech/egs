import { Matrix4 } from './Matrix4';
import { Vector3 } from './Vector3';
import { BufferAttribute } from '../elements/attributes/BufferAttribute';
import { logger } from '../utils/Logger';
import { _Math } from './Math';
import { Vector2 } from './Vector2';
import { PickReadonly } from '../utils/Utils';
/**
 * A class representing a 3x3 {@link https://en.wikipedia.org/wiki/Matrix_(mathematics)| matrix}.
 */
export class Matrix3 {
    /**
     * A {@link https://en.wikipedia.org/wiki/Row-_and_column-major_order | column-major } list of matrix values.
     * @internal
     */
    public _elements: Float32Array;

    /**
     * Check the type whether it belongs to Matrix3.
     * This value should not be changed by user.
     */
    public isMatrix3 = true;
    /**
     * If this value is true, then fast matrix operations can be used.
     * If not, then we presume the matrix to the points needs to do some
     * 'fake' 3d projection transforms.
     * @remarks see {@link multiplyMatrixFast | multiplyMatrixFast } for more detail
     */
    public is2x3 = false;

    private static defaultElements = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);

    /**
     * A {@link https://en.wikipedia.org/wiki/Row-_and_column-major_order#Column-major_order| column-major } list of matrix values.
     */
    get elements() {
        return this._elements;
    }

    /**
     * @deprecated use `fromArray` instead;
     */
    set elements(v: Float32Array) {
        logger.error(`set Matrix3.elements is not allowed and deprecated, use fromArray stead, call stack ${new Error().stack}`);
        this._elements = v;
    }

    constructor() {
        this._elements = Matrix3.defaultElements.slice();
    }
    /**
     * @ignore
     */
    public getSerializeData() {
        return this.toArray();
    }
    /**
     * @ignore
     */
    public setSerializeData(value: any): void {
        this.fromArray(value);
    }
    /**
     * Sets the 3x3 matrix values to the given {@link https://en.wikipedia.org/wiki/Row-_and_column-major_order | row-major } sequence of values.
     * @param n11 value to put in row 1, col 1.
     * @param n12 value to put in row 1, col 2.
     * @param n32 value to put in row 3, col 2.
     * @param n33 value to put in row 3, col 3.
     */
    public set(n11: number, n12: number, n13: number, n21: number, n22: number, n23: number, n31: number, n32: number, n33: number): Matrix3 {
        const te = this._elements;
        te[0] = n11; te[1] = n21; te[2] = n31;
        te[3] = n12; te[4] = n22; te[5] = n32;
        te[6] = n13; te[7] = n23; te[8] = n33;
        return this;
    }
    /**
     * Resets this matrix to the 3x3 identity matrix:
     * <pre><code>
     * 1, 0, 0
     * 0, 1, 0
     * 0, 0, 1
     * </code>
     * <pre/>
     */
    public identity(): Matrix3 {
        this.set(1, 0, 0, 0, 1, 0, 0, 0, 1);
        return this;
    }
    /**
     * Creates a new Matrix3 and with identical elements to this one.
     */
    public clone(): Matrix3 {
        return new Matrix3().fromArray(this._elements);
    }
    public cloneReadonly() {
        return this.clone() as any as ReadonlyMatrix3;
    }
    /**
     * Copies the elements of matrix {@link Matrix3| m} into this matrix.
     */
    public copy(m: Matrix3): Matrix3 {
        this._elements = m._elements.slice();
        this.is2x3 = m.is2x3;
        return this;
    }
    /**
     * Set this matrix to the upper 3x3 matrix of the Matrix4 {@link Matrix4| m}.
     */
    public setFromMatrix4(m: Matrix4): Matrix3 {
        const me = m._elements;
        this.set(me[0], me[4], me[8], me[1], me[5], me[9], me[2], me[6], me[10]);
        return this;
    }
    /**
     * Apply this matrix to given {@link BufferAttribute| attribute buffer}.
     */
    public applyToBufferAttribute(attribute: BufferAttribute, __forceJSImpl: boolean = false): BufferAttribute {
        const array = attribute.array;
        const itemSize = attribute.itemSize;
        for (let i = 0, l = attribute.count; i < l; i++) {
            tmpVec3.x = array[i * itemSize];
            tmpVec3.y = array[i * itemSize + 1];
            tmpVec3.z = array[i * itemSize + 2];
            tmpVec3.applyMatrix3(this);
            attribute.setXYZ(i, tmpVec3.x, tmpVec3.y, tmpVec3.z);
        }

        return attribute;
    }
    /**
     * Post-multiplies this matrix by {@link Matrix3| m}.
     */
    public multiply(m: Matrix3): Matrix3 {
        return this.multiplyMatrices(this, m);
    }
    /**
     * Pre-multiplies this matrix by {@link Matrix3| m}.
     */
    public premultiply(m: Matrix3): Matrix3 {
        return this.multiplyMatrices(m, this);
    }
    /**
     * Sets this matrix to {@link Matrix3| a} x {@link Matrix3| b}.
     */
    public multiplyMatrices(a: Matrix3, b: Matrix3): Matrix3 {
        const ae = a._elements;
        const be = b._elements;
        const te = this._elements;

        const a11 = ae[0], a12 = ae[3], a13 = ae[6],
            a21 = ae[1], a22 = ae[4], a23 = ae[7],
            a31 = ae[2], a32 = ae[5], a33 = ae[8],

            b11 = be[0], b12 = be[3], b13 = be[6],
            b21 = be[1], b22 = be[4], b23 = be[7],
            b31 = be[2], b32 = be[5], b33 = be[8];

        te[0] = a11 * b11 + a12 * b21 + a13 * b31;
        te[3] = a11 * b12 + a12 * b22 + a13 * b32;
        te[6] = a11 * b13 + a12 * b23 + a13 * b33;

        te[1] = a21 * b11 + a22 * b21 + a23 * b31;
        te[4] = a21 * b12 + a22 * b22 + a23 * b32;
        te[7] = a21 * b13 + a22 * b23 + a23 * b33;

        te[2] = a31 * b11 + a32 * b21 + a33 * b31;
        te[5] = a31 * b12 + a32 * b22 + a33 * b32;
        te[8] = a31 * b13 + a32 * b23 + a33 * b33;

        this.is2x3 = false;
        return this;
    }
    public addMatrices(a: Matrix3, b: Matrix3): Matrix3 {
        const ae = a._elements;
        const be = b._elements;
        const te = this._elements;

        const a11 = ae[0], a12 = ae[3], a13 = ae[6],
            a21 = ae[1], a22 = ae[4], a23 = ae[7],
            a31 = ae[2], a32 = ae[5], a33 = ae[8],

            b11 = be[0], b12 = be[3], b13 = be[6],
            b21 = be[1], b22 = be[4], b23 = be[7],
            b31 = be[2], b32 = be[5], b33 = be[8];

        te[0] = a11 + b11;
        te[3] = a12 + b12;
        te[6] = a13 + b13;

        te[1] = a21 + b21;
        te[4] = a22 + b22;
        te[7] = a23 + b23;

        te[2] = a31 + b31;
        te[5] = a32 + b32;
        te[8] = a33 + b33;

        this.is2x3 = false;
        return this;
    }
    /**
     * Multiplies every component of the matrix by the scalar value `s`.
     */
    public multiplyScalar(s: number): Matrix3 {
        const te = this._elements;
        te[0] *= s; te[3] *= s; te[6] *= s;
        te[1] *= s; te[4] *= s; te[7] *= s;
        te[2] *= s; te[5] *= s; te[8] *= s;
        return this;
    }
    /**
     * Computes and returns the {@link https://en.wikipedia.org/wiki/Determinant| determinant} of this matrix.
     */
    public determinant(): number {
        const te = this._elements;
        const a = te[0], b = te[1], c = te[2],
            d = te[3], e = te[4], f = te[5],
            g = te[6], h = te[7], i = te[8];
        return a * e * i - a * f * h - b * d * i + b * f * g + c * d * h - c * e * g;
    }
    /**
     * Return the inverse matrix of given matrix.
     */
    public getInverse(matrix: Matrix3, throwOnDegenerate?: boolean): Matrix3 {
        const te = this._elements;
        const me = matrix._elements,
            n11 = me[0], n21 = me[1], n31 = me[2],
            n12 = me[3], n22 = me[4], n32 = me[5],
            n13 = me[6], n23 = me[7], n33 = me[8],
            t11 = n33 * n22 - n32 * n23,
            t12 = n32 * n13 - n33 * n12,
            t13 = n23 * n12 - n22 * n13,
            det = n11 * t11 + n21 * t12 + n31 * t13;
        if (det === 0) {
            const msg = 'EGS.Matrix3: .getInverse() can\'t invert matrix, determinant is 0';
            if (throwOnDegenerate === true) {
                logger.unsupported(msg);
            }
            return this.identity();
        }
        const detInv = 1 / det;

        te[0] = t11 * detInv;
        te[1] = (n31 * n23 - n33 * n21) * detInv;
        te[2] = (n32 * n21 - n31 * n22) * detInv;
        te[3] = t12 * detInv;
        te[4] = (n33 * n11 - n31 * n13) * detInv;
        te[5] = (n31 * n12 - n32 * n11) * detInv;
        te[6] = t13 * detInv;
        te[7] = (n21 * n13 - n23 * n11) * detInv;
        te[8] = (n22 * n11 - n21 * n12) * detInv;
        return this;
    }
    /**
     * Return the transpose matrix of this.
     */
    public transpose(): Matrix3 {
        let tmp: number;
        const m = this._elements;
        tmp = m[1]; m[1] = m[3]; m[3] = tmp;
        tmp = m[2]; m[2] = m[6]; m[6] = tmp;
        tmp = m[5]; m[5] = m[7]; m[7] = tmp;
        return this;
    }
    /**
     * Sets this matrix as the upper left 3x3 of the {@link https://en.wikipedia.org/wiki/Normal_matrix| normal matrix} of the passed {@link Matrix4| matrix4}.
     * The normal matrix is the {@link https://en.wikipedia.org/wiki/Invertible_matrix| inverse } {@link https://en.wikipedia.org/wiki/Transpose | transpose } of the matrix {@link Matrix4| m}.
     * @param m {@link Matrix4| Matrix4}
     */
    public getNormalMatrix(matrix4: Matrix4): Matrix3 {
        return this.setFromMatrix4(matrix4).getInverse(this).transpose();
    }
    /**
     * Transpose this matrix into the supplied array, and returns itself unchanged.
     * @param array array to store the resulting vector in.
     */
    public transposeIntoArray(r: Matrix3): Matrix3 {
        const m = this._elements;
        r._elements[0] = m[0];
        r._elements[1] = m[3];
        r._elements[2] = m[6];
        r._elements[3] = m[1];
        r._elements[4] = m[4];
        r._elements[5] = m[7];
        r._elements[6] = m[2];
        r._elements[7] = m[5];
        r._elements[8] = m[8];
        return this;
    }
    /**
     * Build transform matrix.
     * @param tx A translate add to u.
     * @param tx A translate add to v.
     * @param sx Scale multiply to u.
     * @param sy Scale multiply to v.
     * @param rotation A rotation apply to u and v.
     * @param cx Translate u influenced by same rotation.
     * @param cy Translate v influenced by same rotation.
     */
    public setUVTransform(tx: number, ty: number, sx: number, sy: number, rotation: number, cx: number, cy: number): void {
        const c = Math.cos(rotation);
        const s = Math.sin(rotation);
        this.set(sx * c, sx * s, -sx * (c * cx + s * cy) + cx + tx,
            -sy * s, sy * c, -sy * (-s * cx + c * cy) + cy + ty,
            0, 0, 1
        );
    }
    /**
     * Apply a scale on this matrix.
     * @param sx scale the value of first row.
     * @param sy scale the value of second row.
     */
    public scale(sx: number, sy: number): Matrix3 {
        const te = this._elements;
        te[0] *= sx; te[3] *= sx; te[6] *= sx;
        te[1] *= sy; te[4] *= sy; te[7] *= sy;
        return this;
    }
    /**
     * Apply a rotation on this matrix.
     * @param theta a value in radius.
     */
    public rotate(theta: number): Matrix3 {
        const c = Math.cos(theta);
        const s = Math.sin(theta);
        const te = this._elements;
        const a11 = te[0], a12 = te[3], a13 = te[6],
            a21 = te[1], a22 = te[4], a23 = te[7];

        te[0] = c * a11 + s * a21;
        te[3] = c * a12 + s * a22;
        te[6] = c * a13 + s * a23;

        te[1] = - s * a11 + c * a21;
        te[4] = - s * a12 + c * a22;
        te[7] = - s * a13 + c * a23;
        return this;
    }
    /**
     * Apply a translation to this matrix.
     * @param tx translate first row by tx.
     * @param ty translate second row by ty.
     */
    public translate(tx: number, ty: number): Matrix3 {
        const te = this._elements;
        te[0] += tx * te[2]; te[3] += tx * te[5]; te[6] += tx * te[8];
        te[1] += ty * te[2]; te[4] += ty * te[5]; te[7] += ty * te[8];
        return this;
    }
    /**
     * Return true if this matrix and {@link Matrix3| m} are equal.
     */
    public equals(matrix: Matrix3): boolean {
        const te = this._elements;
        const me = matrix._elements;
        for (let i = 0; i < 9; i++) {
            if (te[i] !== me[i]) {
                return false;
            }
        }
        return true;
    }
    /**
     * Apply this matrix on vector pos, and store the result in newPos (if it is given) or as return.
     */
    public apply(pos: Vector2, newPos?: Vector2): Vector2 {
        newPos = newPos || new Vector2();

        const x = pos.x;
        const y = pos.y;

        newPos.x = (this._elements[0] * x) + (this._elements[3] * y) + this._elements[6];
        newPos.y = (this._elements[1] * x) + (this._elements[4] * y) + this._elements[7];

        if (!this.is2x3) {
            const w = 1 / (this._elements[2] * x + this._elements[5] * y + this._elements[8]);
            newPos.x *= w;
            newPos.y *= w;
        }

        return newPos;
    }
    /**
     * Apply this matrix on given array.
     * Each vector item of array should hold three elements.
     */
    public applyToArray(array: Float32Array) {
        for (let i = 0, l = array.length / 3; i < l; i++) {
            const x = array[i * 3];
            const y = array[i * 3 + 1];

            array[i * 3] = (this._elements[0] * x) + (this._elements[3] * y) + this._elements[6];
            array[i * 3 + 1] = (this._elements[1] * x) + (this._elements[4] * y) + this._elements[7];
        }
        return array;
    }
    /**
     * Apply this matrix's inverse on vector pos, and store the result in newPos (if it is given) or as return.
     */
    public applyInverse(pos: Vector2, newPos?: Vector2): Vector2 {
        newPos = newPos || new Vector2();
        const a = this._elements[0];
        const b = this._elements[1];
        const c = this._elements[3];
        const d = this._elements[4];
        const tx = this._elements[6];
        const ty = this._elements[7];
        const id = 1 / ((a * d) + (c * -b));

        const x = pos.x;
        const y = pos.y;

        newPos.x = (d * id * x) + (-c * id * y) + (((ty * c) - (tx * d)) * id);
        newPos.y = (a * id * y) + (-b * id * x) + (((-ty * a) + (tx * b)) * id);

        return newPos;
    }
    /**
     * Sets the elements of this matrix based on an array in column-major format.
     * @param array the array to read the elements from.
     * @param offset (optional) index of first element in the array.
     * @defaultValue `0`.
     */
    public fromArray(array: ArrayLike<number>, offset?: number): Matrix3 {
        if (offset === undefined) {
            offset = 0;
        }
        for (let i = 0; i < 9; i++) {
            this._elements[i] = array[i + offset];
        }
        return this;
    }
    /**
     * There are 9 elements in this matrix.
     */
    public getNumberCount() {
        return 9;
    }
    /**
     * Writes the elements of this matrix to an array in column-major format.
     * @param array (optional) array to store the resulting vector in. If not given a new array will be created.
     * @param offset (optional) offset in the array at which to put the result.
     */
    public toArray(array?: number[], offset?: number): number[] {
        if (array === undefined) {
            array = [];
        }
        if (offset === undefined) {
            offset = 0;
        }
        const te = this._elements;

        array[offset] = te[0];
        array[offset + 1] = te[1];
        array[offset + 2] = te[2];

        array[offset + 3] = te[3];
        array[offset + 4] = te[4];
        array[offset + 5] = te[5];

        array[offset + 6] = te[6];
        array[offset + 7] = te[7];
        array[offset + 8] = te[8];
        return array;
    }

    public toStd140Array(array?: number[], offset = 0): number[] {
        if (array === undefined) {
            array = [];
        }
        const te = this._elements;

        array[offset] = te[0];
        array[offset + 1] = te[1];
        array[offset + 2] = te[2];
        array[offset + 3] = 0;

        array[offset + 4] = te[3];
        array[offset + 5] = te[4];
        array[offset + 6] = te[5];
        array[offset + 7] = 0;

        array[offset + 8] = te[6];
        array[offset + 9] = te[7];
        array[offset + 10] = te[8];
        array[offset + 11] = 0;
        return array;
    }
    /**
     * Sets the matrix based on all the available properties.
     * @param x Position on the x axis.
     * @param y Position on the y axis.
     * @param pivotX Pivot on the x axis.
     * @param pivotY Pivot on the y axis.
     * @param scaleX Scale on the x axis.
     * @param scaleY Scale on the y axis.
     * @param rotation Rotation in radians.
     * @param skewX Skew on the x axis.
     * @param skewY Skew on the y axis.
     * @return This matrix. Good for chaining method calls.
     */
    public compose(x: number, y: number, pivotX: number, pivotY: number, scaleX: number,
        scaleY: number, rotation: number, skewX: number, skewY: number): this {
        this._elements[0] = Math.cos(rotation + skewY) * scaleX;
        this._elements[1] = Math.sin(rotation + skewY) * scaleX;
        this._elements[2] = 0;
        this._elements[3] = -Math.sin(rotation - skewX) * scaleY;
        this._elements[4] = Math.cos(rotation - skewX) * scaleY;
        this._elements[5] = 0;

        this._elements[6] = x - ((pivotX * this._elements[0]) + (pivotY * this._elements[3]));
        this._elements[7] = y - ((pivotX * this._elements[1]) + (pivotY * this._elements[4]));
        this._elements[8] = 1;

        this.is2x3 = true;
        return this;
    }
    /**
     * Decomposes the matrix (x, y, scaleX, scaleY, and rotation) and sets the properties on to a transform.
     * @return The transform with the newly applied properties.
     */
    public decompose() {
        const transform: {
            x: number, y: number, scaleX: number,
            scaleY: number, rotation: number, skewX: number, skewY: number
        } = <any>{};

        // sort out rotation / skew..
        const a = this._elements[0];
        const b = this._elements[1];
        const c = this._elements[3];
        const d = this._elements[4];

        const skewX = -Math.atan2(-c, d);
        const skewY = Math.atan2(b, a);

        const delta = Math.abs(skewX + skewY);

        if (delta < 0.00001 || Math.abs(_Math.PI_2 - delta) < 0.00001) {
            transform.rotation = skewY;
            transform.skewX = transform.skewY = 0;
        } else {
            transform.rotation = 0;
            transform.skewX = skewX;
            transform.skewY = skewY;
        }

        // next set scale
        transform.scaleX = Math.sqrt((a * a) + (b * b));
        transform.scaleY = Math.sqrt((c * c) + (d * d));

        // next set position
        transform.x = this._elements[6];
        transform.y = this._elements[7];

        return transform;
    }
    /**
     * Return an orthogonal projection matrix which is set by parameter.
     * @remarks See {@link OrthographicCamera | OrthographicCamera } for more details.
     */
    public makeOrthographic(left: number, right: number, top: number, bottom: number): Matrix3 {
        const te = this._elements;
        const w = 1.0 / (right - left);
        const h = 1.0 / (top - bottom);

        const x = (right + left) * w;
        const y = (top + bottom) * h;

        te[0] = 2 * w; te[3] = 0; te[6] = - x;
        te[1] = 0; te[4] = 2 * h; te[7] = - y;
        te[2] = 0; te[5] = 0; te[8] = 1;
        return this;
    }
    /**
     * This multiplication is specifically used for 2x3 matrixes calculation.
     */
    public static multiplyMatrixFast(a: Matrix3, b: Matrix3, result: Matrix3): Matrix3 {
        if (!a.is2x3 || !b.is2x3) {
            result.multiplyMatrices(a, b);
            return result;
        }

        if (a._elements[0] !== 1 || a._elements[1] !== 0 || a._elements[3] !== 0 || a._elements[4] !== 1) {
            result._elements[0] = (b._elements[0] * a._elements[0]) + (b._elements[1] * a._elements[3]);
            result._elements[1] = (b._elements[0] * a._elements[1]) + (b._elements[1] * a._elements[4]);
            result._elements[3] = (b._elements[3] * a._elements[0]) + (b._elements[4] * a._elements[3]);
            result._elements[4] = (b._elements[3] * a._elements[1]) + (b._elements[4] * a._elements[4]);
        } else {
            result._elements[0] = b._elements[0];
            result._elements[1] = b._elements[1];
            result._elements[3] = b._elements[3];
            result._elements[4] = b._elements[4];
        }

        result._elements[6] = (b._elements[6] * a._elements[0]) + (b._elements[7] * a._elements[3]) + a._elements[6];
        result._elements[7] = (b._elements[6] * a._elements[1]) + (b._elements[7] * a._elements[4]) + a._elements[7];

        result._elements[2] = 0;
        result._elements[5] = 0;
        result._elements[8] = 1;

        result.is2x3 = true;

        return result;
    }

}

const tmpVec3 = new Vector3();

export type ReadonlyMatrix3 = PickReadonly<Matrix3,
    'elements' | 'equals' | 'getSerializeData'
    | 'applyToBufferAttribute' | 'determinant' | 'transposeIntoArray'
    | 'applyToArray' | 'applyInverse' | 'getNumberCount' | 'toArray'
    | 'decompose'
>;
