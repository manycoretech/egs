import { WebGLShaderDataType } from './WGLConstants.js';
import type { Vector4, ReadonlyVector4 } from '../../math/Vector4.js';
import type { Color, ReadonlyColor } from '../../math/Color.js';
import type { Matrix3, ReadonlyMatrix3 } from '../../math/Matrix3.js';
import type { Matrix4, ReadonlyMatrix4 } from '../../math/Matrix4.js';
import type { Vector2, ReadonlyVector2 } from '../../math/Vector2.js';
import type { Vector3, ReadonlyVector3 } from '../../math/Vector3.js';
import { logger } from '../../utils/Logger.js';

export type UniformUploadTypes = boolean | number | Float32Array | Int32Array | number[];
type ArrayLikedUniform = Exclude<UniformUploadTypes, number | boolean>;
export type UniformGeneralTypes =
    | UniformUploadTypes
    | Color
    | Matrix3
    | Matrix4
    | Vector2
    | Vector3
    | Vector4
    | ReadonlyMatrix4
    | ReadonlyMatrix3
    | ReadonlyColor
    | ReadonlyVector2
    | ReadonlyVector3
    | ReadonlyVector4;

function setValue1f(gl: WebGLRenderingContext, location: any, v: number) {
    gl.uniform1f(location, v);
}
function setValue1fv(gl: WebGLRenderingContext, location: any, v: Float32Array) {
    gl.uniform1fv(location, v);
}
function setValue2fv(gl: WebGLRenderingContext, location: any, v: Float32Array) {
    gl.uniform2fv(location, v);
}
function setValue3fv(gl: WebGLRenderingContext, location: any, v: Float32Array) {
    gl.uniform3fv(location, v);
}
function setValue4fv(gl: WebGLRenderingContext, location: any, v: Float32Array) {
    gl.uniform4fv(location, v);
}

function setValue1i(gl: WebGLRenderingContext, location: any, v: number) {
    gl.uniform1i(location, v);
}
function setValue1iv(gl: WebGLRenderingContext, location: any, v: number[]) {
    gl.uniform1iv(location, v);
}
function setValue2iv(gl: WebGLRenderingContext, location: any, v: number[]) {
    gl.uniform2iv(location, v);
}
function setValue4iv(gl: WebGLRenderingContext, location: any, v: number[]) {
    gl.uniform4iv(location, v);
}

function setValue1ui(gl: WebGL2RenderingContext, location: any, v: number) {
    gl.uniform1ui(location, v);
}
function setValue1uiv(gl: WebGL2RenderingContext, location: any, v: number[]) {
    gl.uniform1uiv(location, v);
}
function setValue2uiv(gl: WebGL2RenderingContext, location: any, v: number[]) {
    gl.uniform2uiv(location, v);
}

function setValue2m(gl: WebGLRenderingContext, location: any, v: Float32Array) {
    gl.uniformMatrix2fv(location, false, v);
}
function setValue3m(gl: WebGLRenderingContext, location: any, v: Float32Array) {
    gl.uniformMatrix3fv(location, false, v);
}
function setValue4m(gl: WebGLRenderingContext, location: any, v: Float32Array) {
    gl.uniformMatrix4fv(location, false, v);
}

function getCorrectUpload(type: WebGLShaderDataType): any {
    switch (type) {
        case WebGLShaderDataType.Float:
            return setValue1f;
        case WebGLShaderDataType.FloatV:
            return setValue1fv;
        case WebGLShaderDataType.Vec2:
            return setValue2fv;
        case WebGLShaderDataType.Vec3:
            return setValue3fv;
        case WebGLShaderDataType.Vec4:
            return setValue4fv;

        case WebGLShaderDataType.Mat2:
            return setValue2m;
        case WebGLShaderDataType.Mat3:
            return setValue3m;
        case WebGLShaderDataType.Mat4:
            return setValue4m;

        case WebGLShaderDataType.Int:
        case WebGLShaderDataType.Bool:
        case WebGLShaderDataType.Sampler2D:
        case WebGLShaderDataType.Sampler2DArray:
        case WebGLShaderDataType.Sampler3D:
        case WebGLShaderDataType.SamplerCube:
        case WebGLShaderDataType.USampler2D:
        case WebGLShaderDataType.USampler2DArray:
        case WebGLShaderDataType.USampler3D:
            return setValue1i;

        case WebGLShaderDataType.IntV:
            return setValue1iv;
        case WebGLShaderDataType.UintV:
            return setValue1uiv;
        case WebGLShaderDataType.IVec4V:
            return setValue4iv;

        case WebGLShaderDataType.IntVec2:
            return setValue2iv;
        case WebGLShaderDataType.UInt:
            return setValue1ui;
        case WebGLShaderDataType.UIntVec2:
            return setValue2uiv;

        case WebGLShaderDataType.ArraySampler2D:
            return setValue1iv;
        case WebGLShaderDataType.ArraySamplerCube:
            return setValue1iv;
    }
    logger.unreachable('uniform setter not found');
}

function diffVal(newVal: number, oldVal: number): boolean {
    return newVal !== oldVal;
}

function diffArrayLikedUniform(newVal: ArrayLikedUniform, oldVal: ArrayLikedUniform): boolean {
    if (newVal === oldVal) {
        return false;
    }
    const nl = newVal.length;
    const ol = oldVal.length;
    if (nl !== ol) {
        return true;
    }
    for (let i = 0; i < nl; i++) {
        if (newVal[i] !== oldVal[i]) {
            return true;
        }
    }
    return false;
}

function copyVal(newVal: number, _target: number) {
    return newVal;
}

function isTypedArrayUniform(value: ArrayLikedUniform): value is Exclude<ArrayLikedUniform, number[]> {
    const ctor = value.constructor;
    return ctor === Float32Array;
}

function copyArrayLikedUniform(newVal: ArrayLikedUniform, target: ArrayLikedUniform) {
    if (target === undefined || newVal.length !== target.length) {
        return newVal.slice();
    }
    const isTypedArray = isTypedArrayUniform(newVal);
    if (isTypedArray) {
        (target as Float32Array | Int32Array).set(newVal);
    } else {
        for (let i = 0, l = newVal.length; i < l; i++) {
            target[i] = newVal[i];
        }
    }
    return target;
}

function getCorrectDiff(type: WebGLShaderDataType) {
    if (
        type === WebGLShaderDataType.Float ||
        type === WebGLShaderDataType.Int ||
        type === WebGLShaderDataType.UInt ||
        type === WebGLShaderDataType.Bool
    ) {
        return diffVal;
    } else {
        return diffArrayLikedUniform;
    }
}

function getCorrectCopy(type: WebGLShaderDataType) {
    if (
        type === WebGLShaderDataType.Float ||
        type === WebGLShaderDataType.Int ||
        type === WebGLShaderDataType.UInt ||
        type === WebGLShaderDataType.Bool
    ) {
        return copyVal;
    } else {
        return copyArrayLikedUniform;
    }
}

// WGLUniform is used to automatically transfer data to uniform according to data type.
// It will also compare the cached data and uploaded data to check if it's same.
export class WGLUniform {
    readonly name: string;
    readonly gl: WebGLRenderingContext | WebGL2RenderingContext;

    private location!: WebGLUniformLocation;
    private currentData?: UniformUploadTypes;
    private set: Function;
    private diff: Function;
    private copy: Function;

    static isCheckingDiff = true;
    constructor(
        gl: WebGLRenderingContext | WebGL2RenderingContext,
        name: string,
        type: WebGLShaderDataType,
        location: WebGLUniformLocation,
    ) {
        this.name = name;
        this.gl = gl;
        this.location = location!;
        this.set = getCorrectUpload(type);
        this.diff = getCorrectDiff(type);
        this.copy = getCorrectCopy(type);
    }

    upload(value: UniformUploadTypes): void {
        if (this.currentData === undefined) {
            if (typeof value === 'number' || typeof value === 'boolean') {
                this.currentData = value;
            } else {
                this.currentData = value.slice();
            }
            this.set(this.gl, this.location, value);
            return;
        }

        if (WGLUniform.isCheckingDiff) {
            if (this.diff(value, this.currentData)) {
                this.set(this.gl, this.location, value);
                this.currentData = this.copy(value, this.currentData);
            }
        } else {
            this.set(this.gl, this.location, value);
        }
    }
}
