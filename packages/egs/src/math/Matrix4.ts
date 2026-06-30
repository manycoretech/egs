import { Vector3 } from './Vector3.js';
import type { Euler } from './Euler.js';
import type { Quaternion } from './Quaternion.js';
import type { BufferAttribute } from '../elements/attributes/BufferAttribute.js';
import { logger } from '../utils/Logger.js';
import { Vector2 } from './Vector2.js';
import { _Math } from './Math.js';
import type { PickReadonly } from '../utils/Utils.js';

let tmp1Vec3: Vector3;
let tmp2Vec3: Vector3;
let tmp3Vec3: Vector3;
let tmpMinVec3: Vector3;
let tmpMaxVec3: Vector3;
let tmpMat4: Matrix4;

/**
 * 4x4 matrix used for 3D transformations and projections.
 */
export class Matrix4 {
    /**
     * @internal
     */
    _elements: Float32Array;
    /**
     * Check the type whether it belongs to Matrix4.
     * This value should not be changed by user.
     */
    isMatrix4 = true;

    private static defaultElements = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

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
        logger.error(
            `set Matrix4.elements is not allowed and deprecated, use fromArray stead, call stack ${new Error().stack}`,
        );
        this._elements = v;
    }

    constructor() {
        this._elements = Matrix4.defaultElements.slice();
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
     * Set the {@link elements| elements} of this matrix to the supplied row-major values n11, n12, ... n44.
     */
    set(
        n11: number,
        n12: number,
        n13: number,
        n14: number,
        n21: number,
        n22: number,
        n23: number,
        n24: number,
        n31: number,
        n32: number,
        n33: number,
        n34: number,
        n41: number,
        n42: number,
        n43: number,
        n44: number,
    ): Matrix4 {
        const te = this._elements;
        te[0] = n11;
        te[4] = n12;
        te[8] = n13;
        te[12] = n14;
        te[1] = n21;
        te[5] = n22;
        te[9] = n23;
        te[13] = n24;
        te[2] = n31;
        te[6] = n32;
        te[10] = n33;
        te[14] = n34;
        te[3] = n41;
        te[7] = n42;
        te[11] = n43;
        te[15] = n44;
        return this;
    }
    /**
     * Resets this matrix to the {@link https://en.wikipedia.org/wiki/Identity_matrix | identity matrix}.
     */
    identity(): Matrix4 {
        this.set(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
        return this;
    }
    /**
     * Creates a new Matrix4 with identical {@link elements | elements } to this one.
     */
    clone(): Matrix4 {
        return new Matrix4().fromArray(this._elements);
    }
    cloneReadonly() {
        return this.clone() as any as ReadonlyMatrix4;
    }
    /**
     * Copies the {@link elements| elements} of matrix {@link Matrix4| m} into this matrix.
     */
    copy(m: Matrix4): Matrix4 {
        const te = this._elements;
        const me = m._elements;
        te[0] = me[0];
        te[1] = me[1];
        te[2] = me[2];
        te[3] = me[3];
        te[4] = me[4];
        te[5] = me[5];
        te[6] = me[6];
        te[7] = me[7];
        te[8] = me[8];
        te[9] = me[9];
        te[10] = me[10];
        te[11] = me[11];
        te[12] = me[12];
        te[13] = me[13];
        te[14] = me[14];
        te[15] = me[15];
        return this;
    }
    /**
     * Copies the translation component of the supplied matrix {@link Matrix4| m} into this matrix's translation component.
     */
    copyPosition(m: Matrix4): Matrix4 {
        const te = this._elements;
        const me = m._elements;
        te[12] = me[12];
        te[13] = me[13];
        te[14] = me[14];
        return this;
    }
    /**
     * Extracts the {@link https://en.wikipedia.org/wiki/Basis_(linear_algebra)| basis} of this matrix into the three axis vectors provided. If this matrix is:
     * <pre>
     * a, b, c, d,
     * e, f, g, h,
     * i, j, k, l,
     * m, n, o, p
     * </pre>
     * then the {@link Vector3| xAxis}, {@link Vector3| yAxis}, {@link Vector3| zAxis} will be set to:
     * <pre>
     * xAxis = (a, e, i)
     * yAxis = (b, f, j)
     * zAxis = (c, g, k)
     * </pre>
     */
    extractBasis(xAxis: Vector3, yAxis: Vector3, zAxis: Vector3): Matrix4 {
        xAxis.setFromMatrixColumn(this, 0);
        yAxis.setFromMatrixColumn(this, 1);
        zAxis.setFromMatrixColumn(this, 2);
        return this;
    }
    /**
     * Set this to the basis matrix consisting of the three provided basis vectors:
     * <pre>
     * xAxis.x, yAxis.x, zAxis.x, 0,
     * xAxis.y, yAxis.y, zAxis.y, 0,
     * xAxis.z, yAxis.z, zAxis.z, 0,
     * 0,       0,       0,       1
     * </pre>
     */
    makeBasis(xAxis: Vector3, yAxis: Vector3, zAxis: Vector3): Matrix4 {
        this.set(xAxis.x, yAxis.x, zAxis.x, 0, xAxis.y, yAxis.y, zAxis.y, 0, xAxis.z, yAxis.z, zAxis.z, 0, 0, 0, 0, 1);
        return this;
    }
    /**
     * Extracts the rotation component of the supplied matrix {@link Matrix4| m} into this matrix's rotation component.
     */
    extractRotation(m: Matrix4): Matrix4 {
        const te = this._elements;
        const me = m._elements;
        if (tmp1Vec3 === undefined) {
            tmp1Vec3 = new Vector3();
        }
        const scaleX = 1 / tmp1Vec3.setFromMatrixColumn(m, 0).length();
        const scaleY = 1 / tmp1Vec3.setFromMatrixColumn(m, 1).length();
        const scaleZ = 1 / tmp1Vec3.setFromMatrixColumn(m, 2).length();

        te[0] = me[0] * scaleX;
        te[1] = me[1] * scaleX;
        te[2] = me[2] * scaleX;
        te[3] = 0;

        te[4] = me[4] * scaleY;
        te[5] = me[5] * scaleY;
        te[6] = me[6] * scaleY;
        te[7] = 0;

        te[8] = me[8] * scaleZ;
        te[9] = me[9] * scaleZ;
        te[10] = me[10] * scaleZ;
        te[11] = 0;

        te[12] = 0;
        te[13] = 0;
        te[14] = 0;
        te[15] = 1;

        return this;
    }
    /**
     * Sets the rotation component (the upper left 3x3 matrix) of this matrix to the rotation specified by the given {@link Euler| euler}.
     * The rest of the matrix is set to the identity. Depending on the {@link Euler.order| order} of the {@link Euler| euler}, there are six possible outcomes.
     * @remarks See {@link https://en.wikipedia.org/wiki/Euler_angles#Rotation_matrix| this page} for a complete list.
     */
    makeRotationFromEuler(euler: Euler): Matrix4 {
        const te = this._elements;
        const x = euler.x;
        const y = euler.y;
        const z = euler.z;
        const a = Math.cos(x);
        const b = Math.sin(x);
        const c = Math.cos(y);
        const d = Math.sin(y);
        const e = Math.cos(z);
        const f = Math.sin(z);
        switch (euler.order) {
            case 'XYZ':
                {
                    const ae = a * e;
                    const af = a * f;
                    const be = b * e;
                    const bf = b * f;
                    te[0] = c * e;
                    te[4] = -c * f;
                    te[8] = d;
                    te[1] = af + be * d;
                    te[5] = ae - bf * d;
                    te[9] = -b * c;
                    te[2] = bf - ae * d;
                    te[6] = be + af * d;
                    te[10] = a * c;
                }
                break;
            case 'YXZ':
                {
                    const ce = c * e;
                    const cf = c * f;
                    const de = d * e;
                    const df = d * f;
                    te[0] = ce + df * b;
                    te[4] = de * b - cf;
                    te[8] = a * d;
                    te[1] = a * f;
                    te[5] = a * e;
                    te[9] = -b;
                    te[2] = cf * b - de;
                    te[6] = df + ce * b;
                    te[10] = a * c;
                }
                break;
            case 'ZXY':
                {
                    const ce = c * e;
                    const cf = c * f;
                    const de = d * e;
                    const df = d * f;
                    te[0] = ce - df * b;
                    te[4] = -a * f;
                    te[8] = de + cf * b;
                    te[1] = cf + de * b;
                    te[5] = a * e;
                    te[9] = df - ce * b;
                    te[2] = -a * d;
                    te[6] = b;
                    te[10] = a * c;
                }
                break;
            case 'ZYX':
                {
                    const ae = a * e;
                    const af = a * f;
                    const be = b * e;
                    const bf = b * f;
                    te[0] = c * e;
                    te[4] = be * d - af;
                    te[8] = ae * d + bf;
                    te[1] = c * f;
                    te[5] = bf * d + ae;
                    te[9] = af * d - be;
                    te[2] = -d;
                    te[6] = b * c;
                    te[10] = a * c;
                }
                break;
            case 'YZX':
                {
                    const ac = a * c;
                    const ad = a * d;
                    const bc = b * c;
                    const bd = b * d;
                    te[0] = c * e;
                    te[4] = bd - ac * f;
                    te[8] = bc * f + ad;
                    te[1] = f;
                    te[5] = a * e;
                    te[9] = -b * e;
                    te[2] = -d * e;
                    te[6] = ad * f + bc;
                    te[10] = ac - bd * f;
                }
                break;
            case 'XZY':
                {
                    const ac = a * c;
                    const ad = a * d;
                    const bc = b * c;
                    const bd = b * d;
                    te[0] = c * e;
                    te[4] = -f;
                    te[8] = d * e;
                    te[1] = ac * f + bd;
                    te[5] = a * e;
                    te[9] = ad * f - bc;
                    te[2] = bc * f - ad;
                    te[6] = b * e;
                    te[10] = bd * f + ac;
                }
                break;
            default:
                break;
        }
        // bottom row
        te[3] = 0;
        te[7] = 0;
        te[11] = 0;
        // last column
        te[12] = 0;
        te[13] = 0;
        te[14] = 0;
        te[15] = 1;
        return this;
    }
    /**
     * Sets the rotation component of this matrix to the rotation specified by {@link Quaternion| q},
     * as outlined {@link https://en.wikipedia.org/wiki/Rotation_matrix#Quaternion| here}.
     * The rest of the matrix is set to the identity. So, given {@link Quaternion| q} = w + xi + yj + zk, the resulting matrix will be:
     * <pre>
     * 1-2y²-2z²    2xy-2zw    2xz+2yw    0
     * 2xy+2zw      1-2x²-2z²  2yz-2xw    0
     * 2xz-2yw      2yz+2xw    1-2x²-2y²  0
     * 0            0          0          1
     * </pre>
     */
    makeRotationFromQuaternion(q: Quaternion): Matrix4 {
        if (tmpMinVec3 === undefined) {
            tmpMinVec3 = new Vector3();
        }
        if (tmpMaxVec3 === undefined) {
            tmpMaxVec3 = new Vector3(1, 1, 1);
        }
        return this.compose(tmpMinVec3, q, tmpMaxVec3);
    }
    /**
     * Constructs a rotation matrix, looking from {@link Vector3| eye} towards {@link Vector3| center} oriented by the {@link Vector3| up} vector.
     */
    lookAt(eye: Vector3, target: Vector3, up: Vector3): Matrix4 {
        const te = this._elements;
        if (tmp1Vec3 === undefined) {
            tmp1Vec3 = new Vector3();
        }
        if (tmp2Vec3 === undefined) {
            tmp2Vec3 = new Vector3();
        }
        if (tmp3Vec3 === undefined) {
            tmp3Vec3 = new Vector3();
        }

        tmp3Vec3.subVectors(eye, target);
        if (tmp3Vec3.lengthSq() === 0) {
            // eye and target are in the same position
            tmp3Vec3.z = 1;
        }
        tmp3Vec3.normalize();

        tmp1Vec3.crossVectors(up, tmp3Vec3);

        if (tmp1Vec3.lengthSq() === 0) {
            // up and z are parallel
            if (Math.abs(up.z) === 1) {
                tmp3Vec3.x += 0.0001;
            } else {
                tmp3Vec3.z += 0.0001;
            }
            tmp3Vec3.normalize();
            tmp1Vec3.crossVectors(up, tmp3Vec3);
        }
        tmp1Vec3.normalize();

        tmp2Vec3.crossVectors(tmp3Vec3, tmp1Vec3);

        te[0] = tmp1Vec3.x;
        te[4] = tmp2Vec3.x;
        te[8] = tmp3Vec3.x;
        te[1] = tmp1Vec3.y;
        te[5] = tmp2Vec3.y;
        te[9] = tmp3Vec3.y;
        te[2] = tmp1Vec3.z;
        te[6] = tmp2Vec3.z;
        te[10] = tmp3Vec3.z;
        return this;
    }
    /**
     * Post-multiplies this matrix by {@link Matrix4| m}.
     */
    multiply(m: Matrix4): Matrix4 {
        return this.multiplyMatrices(this, m);
    }
    /**
     * Pre-multiplies this matrix by {@link Matrix4| m}.
     */
    premultiply(m: Matrix4): Matrix4 {
        return this.multiplyMatrices(m, this);
    }
    /**
     * Sets this matrix to {@link Matrix4| a} x {@link Matrix4| b}.
     */
    multiplyMatrices(a: Matrix4, b: Matrix4): Matrix4 {
        const te = this._elements;
        const ae = a._elements;
        const be = b._elements;

        const a11 = ae[0],
            a12 = ae[4],
            a13 = ae[8],
            a14 = ae[12],
            a21 = ae[1],
            a22 = ae[5],
            a23 = ae[9],
            a24 = ae[13],
            a31 = ae[2],
            a32 = ae[6],
            a33 = ae[10],
            a34 = ae[14],
            a41 = ae[3],
            a42 = ae[7],
            a43 = ae[11],
            a44 = ae[15];

        const b11 = be[0],
            b12 = be[4],
            b13 = be[8],
            b14 = be[12],
            b21 = be[1],
            b22 = be[5],
            b23 = be[9],
            b24 = be[13],
            b31 = be[2],
            b32 = be[6],
            b33 = be[10],
            b34 = be[14],
            b41 = be[3],
            b42 = be[7],
            b43 = be[11],
            b44 = be[15];

        te[0] = a11 * b11 + a12 * b21 + a13 * b31 + a14 * b41;
        te[4] = a11 * b12 + a12 * b22 + a13 * b32 + a14 * b42;
        te[8] = a11 * b13 + a12 * b23 + a13 * b33 + a14 * b43;
        te[12] = a11 * b14 + a12 * b24 + a13 * b34 + a14 * b44;

        te[1] = a21 * b11 + a22 * b21 + a23 * b31 + a24 * b41;
        te[5] = a21 * b12 + a22 * b22 + a23 * b32 + a24 * b42;
        te[9] = a21 * b13 + a22 * b23 + a23 * b33 + a24 * b43;
        te[13] = a21 * b14 + a22 * b24 + a23 * b34 + a24 * b44;

        te[2] = a31 * b11 + a32 * b21 + a33 * b31 + a34 * b41;
        te[6] = a31 * b12 + a32 * b22 + a33 * b32 + a34 * b42;
        te[10] = a31 * b13 + a32 * b23 + a33 * b33 + a34 * b43;
        te[14] = a31 * b14 + a32 * b24 + a33 * b34 + a34 * b44;

        te[3] = a41 * b11 + a42 * b21 + a43 * b31 + a44 * b41;
        te[7] = a41 * b12 + a42 * b22 + a43 * b32 + a44 * b42;
        te[11] = a41 * b13 + a42 * b23 + a43 * b33 + a44 * b43;
        te[15] = a41 * b14 + a42 * b24 + a43 * b34 + a44 * b44;
        return this;
    }
    /**
     * Multiplies every component of the matrix by a scalar value s.
     */
    multiplyScalar(s: number): Matrix4 {
        const te = this._elements;
        te[0] *= s;
        te[4] *= s;
        te[8] *= s;
        te[12] *= s;
        te[1] *= s;
        te[5] *= s;
        te[9] *= s;
        te[13] *= s;
        te[2] *= s;
        te[6] *= s;
        te[10] *= s;
        te[14] *= s;
        te[3] *= s;
        te[7] *= s;
        te[11] *= s;
        te[15] *= s;
        return this;
    }
    /**
     * Apply this matrix to given {@link BufferAttribute| attribute buffer}.
     */
    applyToBufferAttribute(attribute: BufferAttribute, __forceJSImpl: boolean = false): BufferAttribute {
        if (tmp1Vec3 === undefined) {
            tmp1Vec3 = new Vector3();
        }
        const array = attribute.array;
        const itemSize = attribute.itemSize;
        for (let i = 0, l = attribute.count; i < l; i++) {
            tmp1Vec3.x = array[i * itemSize];
            tmp1Vec3.y = array[i * itemSize + 1];
            tmp1Vec3.z = array[i * itemSize + 2];
            tmp1Vec3.applyMatrix4(this);
            attribute.setXYZ(i, tmp1Vec3.x, tmp1Vec3.y, tmp1Vec3.z);
        }

        return attribute;
    }
    /**
     * Apply this matrix on given array.
     * Each vector item of array should hold three elements.
     */
    applyToArray(array: Float32Array) {
        if (tmp1Vec3 === undefined) {
            tmp1Vec3 = new Vector3();
        }
        for (let i = 0, l = array.length / 3; i < l; i++) {
            tmp1Vec3.x = array[i * 3];
            tmp1Vec3.y = array[i * 3 + 1];
            tmp1Vec3.z = array[i * 3 + 2];
            tmp1Vec3.applyMatrix4(this);
            array[i * 3] = tmp1Vec3.x;
            array[i * 3 + 1] = tmp1Vec3.y;
            array[i * 3 + 2] = tmp1Vec3.z;
        }
        return array;
    }
    /**
     * Computes and returns the {@link https://en.wikipedia.org/wiki/Determinant| determinant } of this matrix.
     * Based on the method outlined {@link http://www.euclideanspace.com/maths/algebra/matrix/functions/inverse/fourD/index.htm| here }.
     */
    determinant(): number {
        const te = this._elements;
        const n11 = te[0],
            n12 = te[4],
            n13 = te[8],
            n14 = te[12],
            n21 = te[1],
            n22 = te[5],
            n23 = te[9],
            n24 = te[13],
            n31 = te[2],
            n32 = te[6],
            n33 = te[10],
            n34 = te[14],
            n41 = te[3],
            n42 = te[7],
            n43 = te[11],
            n44 = te[15];

        // TODO: make this more efficient
        // ( based on http://www.euclideanspace.com/maths/algebra/matrix/functions/inverse/fourD/index.htm )
        return (
            n41 *
                (+n14 * n23 * n32 -
                    n13 * n24 * n32 -
                    n14 * n22 * n33 +
                    n12 * n24 * n33 +
                    n13 * n22 * n34 -
                    n12 * n23 * n34) +
            n42 *
                (+n11 * n23 * n34 -
                    n11 * n24 * n33 +
                    n14 * n21 * n33 -
                    n13 * n21 * n34 +
                    n13 * n24 * n31 -
                    n14 * n23 * n31) +
            n43 *
                (+n11 * n24 * n32 -
                    n11 * n22 * n34 -
                    n14 * n21 * n32 +
                    n12 * n21 * n34 +
                    n14 * n22 * n31 -
                    n12 * n24 * n31) +
            n44 *
                (-n13 * n22 * n31 -
                    n11 * n23 * n32 +
                    n11 * n22 * n33 +
                    n13 * n21 * n32 -
                    n12 * n21 * n33 +
                    n12 * n23 * n31)
        );
    }
    /**
     * {@link https://en.wikipedia.org/wiki/Transpose| Transposes } this matrix.
     */
    transpose(): Matrix4 {
        const te = this._elements;
        let tmp: number;
        tmp = te[1];
        te[1] = te[4];
        te[4] = tmp;
        tmp = te[2];
        te[2] = te[8];
        te[8] = tmp;
        tmp = te[6];
        te[6] = te[9];
        te[9] = tmp;
        tmp = te[3];
        te[3] = te[12];
        te[12] = tmp;
        tmp = te[7];
        te[7] = te[13];
        te[13] = tmp;
        tmp = te[11];
        te[11] = te[14];
        te[14] = tmp;
        return this;
    }
    /**
     * Sets the position component for this matrix from vector {@link Vector3| v}, without affecting the rest of the matrix - i.e. if the matrix is currently:
     * <pre>
     * a, b, c, d,
     * e, f, g, h,
     * i, j, k, l,
     * m, n, o, p
     * </pre>
     * This becomes:
     * <pre>
     * a, b, c, v.x,
     * e, f, g, v.y,
     * i, j, k, v.z,
     * m, n, o, p
     * </pre>
     */
    setPosition(v: Vector3): Matrix4 {
        const te = this._elements;
        te[12] = v.x;
        te[13] = v.y;
        te[14] = v.z;
        return this;
    }
    /**
     * Return the first three elements of last column.
     */
    getPosition(v: Vector3): Vector3 {
        v.x = this._elements[12];
        v.y = this._elements[13];
        v.z = this._elements[14];
        return v;
    }
    /**
     * Change this matrix to inverse.
     */
    getInverse(m: Matrix4, throwOnDegenerate?: boolean): Matrix4 {
        // based on http://www.euclideanspace.com/maths/algebra/matrix/functions/inverse/fourD/index.htm
        const te = this._elements;
        const me = m._elements;

        const n11 = me[0],
            n21 = me[1],
            n31 = me[2],
            n41 = me[3],
            n12 = me[4],
            n22 = me[5],
            n32 = me[6],
            n42 = me[7],
            n13 = me[8],
            n23 = me[9],
            n33 = me[10],
            n43 = me[11],
            n14 = me[12],
            n24 = me[13],
            n34 = me[14],
            n44 = me[15],
            t11 =
                n23 * n34 * n42 -
                n24 * n33 * n42 +
                n24 * n32 * n43 -
                n22 * n34 * n43 -
                n23 * n32 * n44 +
                n22 * n33 * n44,
            t12 =
                n14 * n33 * n42 -
                n13 * n34 * n42 -
                n14 * n32 * n43 +
                n12 * n34 * n43 +
                n13 * n32 * n44 -
                n12 * n33 * n44,
            t13 =
                n13 * n24 * n42 -
                n14 * n23 * n42 +
                n14 * n22 * n43 -
                n12 * n24 * n43 -
                n13 * n22 * n44 +
                n12 * n23 * n44,
            t14 =
                n14 * n23 * n32 -
                n13 * n24 * n32 -
                n14 * n22 * n33 +
                n12 * n24 * n33 +
                n13 * n22 * n34 -
                n12 * n23 * n34;

        const det = n11 * t11 + n21 * t12 + n31 * t13 + n41 * t14;
        if (det === 0) {
            const msg = "EGS.Matrix4: .getInverse() can't invert matrix, determinant is 0";
            if (throwOnDegenerate === true) {
                logger.invalidInput(msg);
            }
            return this.identity();
        }
        const detInv = 1 / det;
        te[0] = t11 * detInv;
        te[1] =
            (n24 * n33 * n41 -
                n23 * n34 * n41 -
                n24 * n31 * n43 +
                n21 * n34 * n43 +
                n23 * n31 * n44 -
                n21 * n33 * n44) *
            detInv;
        te[2] =
            (n22 * n34 * n41 -
                n24 * n32 * n41 +
                n24 * n31 * n42 -
                n21 * n34 * n42 -
                n22 * n31 * n44 +
                n21 * n32 * n44) *
            detInv;
        te[3] =
            (n23 * n32 * n41 -
                n22 * n33 * n41 -
                n23 * n31 * n42 +
                n21 * n33 * n42 +
                n22 * n31 * n43 -
                n21 * n32 * n43) *
            detInv;
        te[4] = t12 * detInv;
        te[5] =
            (n13 * n34 * n41 -
                n14 * n33 * n41 +
                n14 * n31 * n43 -
                n11 * n34 * n43 -
                n13 * n31 * n44 +
                n11 * n33 * n44) *
            detInv;
        te[6] =
            (n14 * n32 * n41 -
                n12 * n34 * n41 -
                n14 * n31 * n42 +
                n11 * n34 * n42 +
                n12 * n31 * n44 -
                n11 * n32 * n44) *
            detInv;
        te[7] =
            (n12 * n33 * n41 -
                n13 * n32 * n41 +
                n13 * n31 * n42 -
                n11 * n33 * n42 -
                n12 * n31 * n43 +
                n11 * n32 * n43) *
            detInv;
        te[8] = t13 * detInv;
        te[9] =
            (n14 * n23 * n41 -
                n13 * n24 * n41 -
                n14 * n21 * n43 +
                n11 * n24 * n43 +
                n13 * n21 * n44 -
                n11 * n23 * n44) *
            detInv;
        te[10] =
            (n12 * n24 * n41 -
                n14 * n22 * n41 +
                n14 * n21 * n42 -
                n11 * n24 * n42 -
                n12 * n21 * n44 +
                n11 * n22 * n44) *
            detInv;
        te[11] =
            (n13 * n22 * n41 -
                n12 * n23 * n41 -
                n13 * n21 * n42 +
                n11 * n23 * n42 +
                n12 * n21 * n43 -
                n11 * n22 * n43) *
            detInv;
        te[12] = t14 * detInv;
        te[13] =
            (n13 * n24 * n31 -
                n14 * n23 * n31 +
                n14 * n21 * n33 -
                n11 * n24 * n33 -
                n13 * n21 * n34 +
                n11 * n23 * n34) *
            detInv;
        te[14] =
            (n14 * n22 * n31 -
                n12 * n24 * n31 -
                n14 * n21 * n32 +
                n11 * n24 * n32 +
                n12 * n21 * n34 -
                n11 * n22 * n34) *
            detInv;
        te[15] =
            (n12 * n23 * n31 -
                n13 * n22 * n31 +
                n13 * n21 * n32 -
                n11 * n23 * n32 -
                n12 * n21 * n33 +
                n11 * n22 * n33) *
            detInv;
        return this;
    }
    /**
     * Multiplies the columns of this matrix by vector {@link Vector3| v}.
     */
    scale(v: Vector3): Matrix4 {
        const te = this._elements;
        const x = v.x;
        const y = v.y;
        const z = v.z;
        te[0] *= x;
        te[4] *= y;
        te[8] *= z;
        te[1] *= x;
        te[5] *= y;
        te[9] *= z;
        te[2] *= x;
        te[6] *= y;
        te[10] *= z;
        te[3] *= x;
        te[7] *= y;
        te[11] *= z;
        return this;
    }
    /**
     * Return the scales of three dimension.
     */
    getScale(v: Vector3): Vector3 {
        const te = this._elements;
        const sx = tmp1Vec3.set(te[0], te[1], te[2]).length();
        const sy = tmp1Vec3.set(te[4], te[5], te[6]).length();
        const sz = tmp1Vec3.set(te[8], te[9], te[10]).length();
        return v.set(sx, sy, sz);
    }
    /**
     * Apply a translation to this matrix.
     * @param tx translate first row by tx.
     * @param ty translate second row by ty.
     * @param ty translate third row by ty.
     */
    translate(tx: number, ty: number, tz: number): Matrix4 {
        const te = this._elements;
        te[0] += tx * te[3];
        te[4] += tx * te[7];
        te[8] += tx * te[11];
        te[12] += tx * te[15];
        te[1] += ty * te[3];
        te[5] += ty * te[7];
        te[9] += ty * te[11];
        te[13] += ty * te[15];
        te[2] += tz * te[3];
        te[6] += tz * te[7];
        te[10] += tz * te[11];
        te[14] += tz * te[15];
        return this;
    }
    /**
     * Gets the maximum scale value of the 3 axes.
     */
    getMaxScaleOnAxis(): number {
        const te = this._elements;
        const scaleXSq = te[0] * te[0] + te[1] * te[1] + te[2] * te[2];
        const scaleYSq = te[4] * te[4] + te[5] * te[5] + te[6] * te[6];
        const scaleZSq = te[8] * te[8] + te[9] * te[9] + te[10] * te[10];
        return Math.sqrt(Math.max(scaleXSq, scaleYSq, scaleZSq));
    }
    /**
     * Sets this matrix as a translation transform:
     * <pre>
     * 1, 0, 0, x,
     * 0, 1, 0, y,
     * 0, 0, 1, z,
     * 0, 0, 0, 1
     * </pre>
     * @param x the amount to translate in the X axis.
     * @param y the amount to translate in the Y axis.
     * @param z the amount to translate in the Z axis.
     */
    makeTranslation(x: number, y: number, z: number): Matrix4 {
        this.set(1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z, 0, 0, 0, 1);
        return this;
    }
    /**
     * Sets this matrix as a rotational transformation around the X axis by {@link Float| theta} (&theta;) radians.
     * The resulting matrix will be:
     * <pre>
     * 1      0             0        0
     * 0 cos(&theta;) -sin(&theta;)  0
     * 0 sin(&theta;) cos(&theta;)   0
     * 0      0             0        1
     * </pre>
     * @param theta Rotation angle in radians.
     */
    makeRotationX(theta: number): Matrix4 {
        const c = Math.cos(theta);
        const s = Math.sin(theta);
        this.set(1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0, 0, 0, 0, 1);
        return this;
    }
    /**
     * Sets this matrix as a rotational transformation around the Y axis by {@link Float| theta} (&theta;) radians.
     * The resulting matrix will be:
     * <pre>
     * cos(&theta;)  0 sin(&theta;) 0
     *      0        1      0       0
     * -sin(&theta;) 0 cos(&theta;) 0
     *      0        0      0       1
     * </pre>
     * @param theta Rotation angle in radians.
     */
    makeRotationY(theta: number): Matrix4 {
        const c = Math.cos(theta);
        const s = Math.sin(theta);
        this.set(c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, 0, 0, 0, 1);
        return this;
    }
    /**
     * Sets this matrix as a rotational transformation around the Z axis by {@link Float| theta} (&theta;) radians.
     * The resulting matrix will be:
     * <pre>
     * cos(&theta;) -sin(&theta;) 0 0
     * sin(&theta;) cos(&theta;)  0 0
     *       0            0       1 0
     *       0            0       0 1
     * </pre>
     * @param theta Rotation angle in radians.
     */
    makeRotationZ(theta: number): Matrix4 {
        const c = Math.cos(theta);
        const s = Math.sin(theta);
        this.set(c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
        return this;
    }
    /**
     * Sets this matrix as rotation transform around {@link Vector3| axis} by {@link Float| theta} radians.<br />
     * This is a somewhat controversial but mathematically sound alternative to rotating via {@link Quaternions| Quaternions}.
     * @remarks See the discussion {@link https://www.gamedev.net/articles/programming/math-and-physics/do-we-really-need-quaternions-r1199| here}.
     * @param axis Rotation axis, should be normalized.
     * @param theta Rotation angle in radians.
     */
    makeRotationAxis(axis: Vector3, angle: number): Matrix4 {
        // Based on http://www.gamedev.net/reference/articles/article1199.asp
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        const t = 1 - c;
        const x = axis.x;
        const y = axis.y;
        const z = axis.z;
        const tx = t * x;
        const ty = t * y;
        this.set(
            tx * x + c,
            tx * y - s * z,
            tx * z + s * y,
            0,
            tx * y + s * z,
            ty * y + c,
            ty * z - s * x,
            0,
            tx * z - s * y,
            ty * z + s * x,
            t * z * z + c,
            0,
            0,
            0,
            0,
            1,
        );
        return this;
    }
    /**
     * @param x the amount to scale in the X axis.
     * @param y the amount to scale in the Y axis.
     * @param z the amount to scale in the Z axis.
     * Sets this matrix as scale transform:
     * <pre>
     * x, 0, 0, 0,
     * 0, y, 0, 0,
     * 0, 0, z, 0,
     * 0, 0, 0, 1
     * </pre>
     */
    makeScale(x: number, y: number, z: number): Matrix4 {
        this.set(x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1);
        return this;
    }
    /**
     * @param x the amount to shear in the X axis.
     * @param y the amount to shear in the Y axis.
     * @param z the amount to shear in the Z axis.
     * Sets this matrix as a shear transform:
     * <pre>
     * 1, y, z, 0,
     * x, 1, z, 0,
     * x, y, 1, 0,
     * 0, 0, 0, 1
     * </pre>
     */
    makeShear(x: number, y: number, z: number): Matrix4 {
        this.set(1, y, z, 0, x, 1, z, 0, x, y, 1, 0, 0, 0, 0, 1);
        return this;
    }
    /**
     * Sets this matrix to the transformation composed of {@link Vector3| position}, {@link Quaternion| quaternion} and {@link Vector3| scale}.
     */
    compose(position: Vector3, quaternion: Quaternion, scale: Vector3): Matrix4 {
        const te = this._elements;
        const x = quaternion.x,
            y = quaternion.y,
            z = quaternion.z,
            w = quaternion.w,
            x2 = x + x,
            y2 = y + y,
            z2 = z + z,
            xx = x * x2,
            xy = x * y2,
            xz = x * z2,
            yy = y * y2,
            yz = y * z2,
            zz = z * z2,
            wx = w * x2,
            wy = w * y2,
            wz = w * z2,
            sx = scale.x,
            sy = scale.y,
            sz = scale.z;

        te[0] = (1 - (yy + zz)) * sx;
        te[1] = (xy + wz) * sx;
        te[2] = (xz - wy) * sx;
        te[3] = 0;

        te[4] = (xy - wz) * sy;
        te[5] = (1 - (xx + zz)) * sy;
        te[6] = (yz + wx) * sy;
        te[7] = 0;

        te[8] = (xz + wy) * sz;
        te[9] = (yz - wx) * sz;
        te[10] = (1 - (xx + yy)) * sz;
        te[11] = 0;

        te[12] = position.x;
        te[13] = position.y;
        te[14] = position.z;
        te[15] = 1;
        return this;
    }
    /**
     * Decomposes this matrix into it's {@link Vector3| position}, {@link Quaternion| quaternion} and {@link Vector3| scale} components.
     * @Note Not all matrices are decomposable in this way.
     * For example, if an object has a non-uniformly scaled parent, then the object's world matrix may not be decomposable, and this method may not be appropriate.
     */
    decompose(position: Vector3, quaternion: Quaternion, scale: Vector3): Matrix4 {
        const te = this._elements;
        if (tmp1Vec3 === undefined) {
            tmp1Vec3 = new Vector3();
        }
        let sx = tmp1Vec3.set(te[0], te[1], te[2]).length();
        const sy = tmp1Vec3.set(te[4], te[5], te[6]).length();
        const sz = tmp1Vec3.set(te[8], te[9], te[10]).length();

        // if determine is negative, we need to invert one scale
        const det = this.determinant();
        if (det < 0) {
            sx = -sx;
        }

        if (tmpMat4 === undefined) {
            tmpMat4 = new Matrix4();
        }
        tmpMat4.copy(this);

        position.set(te[12], te[13], te[14]);

        const invSX = 1 / sx;
        const invSY = 1 / sy;
        const invSZ = 1 / sz;

        tmpMat4._elements[0] *= invSX;
        tmpMat4._elements[1] *= invSX;
        tmpMat4._elements[2] *= invSX;

        tmpMat4._elements[4] *= invSY;
        tmpMat4._elements[5] *= invSY;
        tmpMat4._elements[6] *= invSY;

        tmpMat4._elements[8] *= invSZ;
        tmpMat4._elements[9] *= invSZ;
        tmpMat4._elements[10] *= invSZ;

        quaternion.setFromRotationMatrix(tmpMat4);

        scale.set(sx, sy, sz);
        return this;
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
    compose2D(
        x: number,
        y: number,
        pivotX: number,
        pivotY: number,
        scaleX: number,
        scaleY: number,
        rotation: number,
        skewX: number,
        skewY: number,
    ): this {
        const elements0 = Math.cos(rotation + skewY) * scaleX;
        const elements1 = Math.sin(rotation + skewY) * scaleX;
        const elements3 = -Math.sin(rotation - skewX) * scaleY;
        const elements4 = Math.cos(rotation - skewX) * scaleY;

        const elements6 = x - (pivotX * elements0 + pivotY * elements3);
        const elements7 = y - (pivotX * elements1 + pivotY * elements4);

        this._elements.set([
            elements0,
            elements1,
            0,
            0,
            elements3,
            elements4,
            0,
            0,
            0,
            0,
            1,
            0,
            elements6,
            elements7,
            0,
            1,
        ]);

        return this;
    }
    /**
     * Decomposes the matrix (x, y, scaleX, scaleY, and rotation) and sets the properties on to a transform.
     * @returns The transform with the newly applied properties.
     */
    decompose2D() {
        const transform: {
            x: number;
            y: number;
            scaleX: number;
            scaleY: number;
            rotation: number;
            skewX: number;
            skewY: number;
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
        transform.scaleX = Math.sqrt(a * a + b * b);
        transform.scaleY = Math.sqrt(c * c + d * d);

        // next set position
        transform.x = this._elements[6];
        transform.y = this._elements[7];

        return transform;
    }
    /**
     * Creates a {@link https://en.wikipedia.org/wiki/3D_projection#Perspective_projection| perspective projection} matrix.
     * This is used internally by {@link PerspectiveCamera.updateProjectionMatrix| PerspectiveCamera.updateProjectionMatrix}()
     */
    makePerspective(left: number, right: number, top: number, bottom: number, near: number, far: number): Matrix4 {
        const te = this._elements;
        const x = (2 * near) / (right - left);
        const y = (2 * near) / (top - bottom);

        const a = (right + left) / (right - left);
        const b = (top + bottom) / (top - bottom);
        const c = -(far + near) / (far - near);
        const d = (-2 * far * near) / (far - near);

        te[0] = x;
        te[4] = 0;
        te[8] = a;
        te[12] = 0;
        te[1] = 0;
        te[5] = y;
        te[9] = b;
        te[13] = 0;
        te[2] = 0;
        te[6] = 0;
        te[10] = c;
        te[14] = d;
        te[3] = 0;
        te[7] = 0;
        te[11] = -1;
        te[15] = 0;

        return this;
    }
    /**
     * Creates an {@link https://en.wikipedia.org/wiki/Orthographic_projection| orthographic projection} matrix.
     * This is used internally by {@link OrthographicCamera.updateProjectionMatrix| OrthographicCamera.updateProjectionMatrix}().
     */
    makeOrthographic(left: number, right: number, top: number, bottom: number, near: number, far: number): Matrix4 {
        const te = this._elements;
        const w = 1.0 / (right - left);
        const h = 1.0 / (top - bottom);
        const p = 1.0 / (far - near);

        const x = (right + left) * w;
        const y = (top + bottom) * h;
        const z = (far + near) * p;

        te[0] = 2 * w;
        te[4] = 0;
        te[8] = 0;
        te[12] = -x;
        te[1] = 0;
        te[5] = 2 * h;
        te[9] = 0;
        te[13] = -y;
        te[2] = 0;
        te[6] = 0;
        te[10] = -2 * p;
        te[14] = -z;
        te[3] = 0;
        te[7] = 0;
        te[11] = 0;
        te[15] = 1;
        return this;
    }
    /**
     * Apply this matrix to a 2D vector, z and w will set to 1 and 0.
     */
    transformVector2(vIn: { x: number; y: number }, vOut = new Vector2()): Vector2 {
        const x = vIn.x;
        const y = vIn.y;
        const z = 0;
        const w = 1;
        const e = this._elements;
        vOut.x = e[0] * x + e[4] * y + e[8] * z + e[12] * w;
        vOut.y = e[1] * x + e[5] * y + e[9] * z + e[13] * w;
        return vOut;
    }
    /**
     * Return true if this matrix and {@link Matrix4| matrix} are equal.
     */
    equals(matrix: Matrix4): boolean {
        const te = this._elements;
        const me = matrix._elements;
        for (let i = 0; i < 16; i++) {
            if (te[i] !== me[i]) {
                return false;
            }
        }
        return true;
    }
    /**
     * Sets the elements of this matrix based on an array in column-major format.
     * @param array the array to read the elements from.
     * @param offset ( optional ) offset into the array.
     * @defaultValue `0`.
     */
    fromArray(array: ArrayLike<number>, offset?: number): Matrix4 {
        if (offset === undefined) {
            offset = 0;
        }
        for (let i = 0; i < 16; i++) {
            this._elements[i] = array[i + offset];
        }
        return this;
    }
    /**
     * There are 16 elements in this matrix.
     */
    getNumberCount() {
        return 16;
    }
    /**
     * Writes the elements of this matrix to an array in column-major format.
     * @param array (optional) array to store the resulting vector in.
     * @param offset (optional) offset in the array at which to put the result.
     */
    toArray(array?: number[], offset?: number): number[] {
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
        array[offset + 9] = te[9];
        array[offset + 10] = te[10];
        array[offset + 11] = te[11];

        array[offset + 12] = te[12];
        array[offset + 13] = te[13];
        array[offset + 14] = te[14];
        array[offset + 15] = te[15];
        return array;
    }
}

/**
 * Readonly view of the public Matrix4 API.
 */
export type ReadonlyMatrix4 = PickReadonly<
    Matrix4,
    | 'elements'
    | 'equals'
    | 'applyToBufferAttribute'
    | 'determinant'
    | 'extractBasis'
    | 'applyToArray'
    | 'getPosition'
    | 'getMaxScaleOnAxis'
    | 'decompose'
    | 'decompose2D'
    | 'getNumberCount'
    | 'toArray'
>;
