import { WebGLShaderDataType } from '../../webgl/WGLConstants.js';
import type { ShaderInputDescriptor, UniformArrayDescriptor, VaryArrayDescriptor } from '../Shader.js';
import type { UniformBlockObject } from '../components/UniformBlockObject.js';
import { BuiltInUniformTypes } from '../../RenderState/BuiltInUniforms.js';

export enum ShaderAttributeTypes {
    position,
    normal,
    uv,
    lineDistance,
    color,
    joints,
    weights,
}

export enum ShaderVaryingTypes {
    fragUV,
    fragNormal,
    viewPosition,
    worldPosition,
    vertexColor,
}

// all extension point can dep on ones before(in one shader stage and need pre require);
export enum ShaderInjectionTypes {
    // -vertex
    position,
    gl_Position,
    gl_PointSize,
    vary_any,
    vary_normal,
    vary_viewPosition,
    vary_worldPosition,
    vary_uv,
    // -fragment
    frag_normal,
    discard,
    channel_color,
    channel_alpha,
    channel_ao,
    channel_lightMap,
    channel_specular,
    channel_metalness,
    channel_roughness,
    channel_specularStrength,
    channel_shininess,
    gl_FragColor,
    gl_FragColorModify,
    gl_FragDepthEXT,
    frag_any,
}

export enum ShaderExtensionTypes {
    derivatives,
    GL_EXT_shader_texture_lod,
    GL_EXT_frag_depth,
    // TODO more webgl extension support
}

export function expandShaderExtension(ss: Set<ShaderExtensionTypes>, useWebGL2: boolean) {
    if (useWebGL2) {
        return '';
    }

    const map = (s: ShaderExtensionTypes) => {
        switch (s) {
            case ShaderExtensionTypes.derivatives:
                return '#extension GL_OES_standard_derivatives : enable';
            case ShaderExtensionTypes.GL_EXT_shader_texture_lod:
                return '#extension GL_EXT_shader_texture_lod : enable';
            case ShaderExtensionTypes.GL_EXT_frag_depth:
                return '#extension GL_EXT_frag_depth : enable';
            default:
                return '';
        }
    };

    return Array.from(ss).map(map).join('\n');
}

export function mapAttributeType(a: ShaderAttributeTypes) {
    switch (a) {
        case ShaderAttributeTypes.position:
            return { name: 'position', type: WebGLShaderDataType.Vec3 };
        case ShaderAttributeTypes.normal:
            return { name: 'normal', type: WebGLShaderDataType.Vec3 };
        case ShaderAttributeTypes.uv:
            return { name: 'uv', type: WebGLShaderDataType.Vec2 };
        case ShaderAttributeTypes.lineDistance:
            return { name: 'lineDistance', type: WebGLShaderDataType.Float };
        case ShaderAttributeTypes.color:
            return { name: 'color', type: WebGLShaderDataType.Vec3 };
        case ShaderAttributeTypes.joints:
            return { name: 'joints', type: WebGLShaderDataType.UIntVec4 };
        case ShaderAttributeTypes.weights:
            return { name: 'weights', type: WebGLShaderDataType.Vec4 };
    }
}

export function mapInnerGlobalUniform(u: BuiltInUniformTypes): ShaderInputDescriptor | UniformArrayDescriptor {
    switch (u) {
        case BuiltInUniformTypes.cameraPosition:
            return { name: 'cameraPosition', type: WebGLShaderDataType.Vec3 };
        case BuiltInUniformTypes.modelViewMatrix:
            return { name: 'modelViewMatrix', type: WebGLShaderDataType.Mat4 };
        case BuiltInUniformTypes.modelMatrix:
            return { name: 'modelMatrix', type: WebGLShaderDataType.Mat4 };
        case BuiltInUniformTypes.normalMatrix:
            return { name: 'normalMatrix', type: WebGLShaderDataType.Mat3 };
        case BuiltInUniformTypes.projectionMatrix:
            return { name: 'projectionMatrix', type: WebGLShaderDataType.Mat4 };
        case BuiltInUniformTypes.resolution:
            return { name: 'resolution', type: WebGLShaderDataType.Vec2 };
        case BuiltInUniformTypes.viewMatrix:
            return { name: 'viewMatrix', type: WebGLShaderDataType.Mat4 };
        case BuiltInUniformTypes.lodInfo:
            return { des: { name: 'popLODInfo', type: WebGLShaderDataType.Float }, length: 5 };
        case BuiltInUniformTypes.boneTexture:
            return { name: 'boneTexture', type: WebGLShaderDataType.Sampler2D };
        case BuiltInUniformTypes.boneTextureSize:
            return { name: 'boneTextureSize', type: WebGLShaderDataType.Float };
    }
}

function mapGLDataToStr(d: WebGLShaderDataType) {
    switch (d) {
        case WebGLShaderDataType.Bool:
            return 'bool';
        case WebGLShaderDataType.BoolVec2:
            return 'bvec2';
        case WebGLShaderDataType.BoolVec3:
            return 'bvec3';
        case WebGLShaderDataType.BoolVec4:
            return 'bvec4';
        case WebGLShaderDataType.Int:
            return 'int';
        case WebGLShaderDataType.IntVec2:
            return 'ivec2';
        case WebGLShaderDataType.IntVec3:
            return 'ivec3';
        case WebGLShaderDataType.IntVec4:
            return 'ivec4';
        case WebGLShaderDataType.Float:
            return 'float';
        case WebGLShaderDataType.Vec2:
            return 'vec2';
        case WebGLShaderDataType.Vec3:
            return 'vec3';
        case WebGLShaderDataType.Vec4:
            return 'vec4';
        case WebGLShaderDataType.UInt:
            return 'uint';
        case WebGLShaderDataType.UIntVec2:
            return 'uvec2';
        case WebGLShaderDataType.UIntVec3:
            return 'uvec3';
        case WebGLShaderDataType.UIntVec4:
            return 'uvec4';
        case WebGLShaderDataType.Mat2:
            return 'mat2';
        case WebGLShaderDataType.Mat3:
            return 'mat3';
        case WebGLShaderDataType.Mat4:
            return 'mat4';
        case WebGLShaderDataType.Sampler2D:
            return 'sampler2D';
        case WebGLShaderDataType.Sampler2DArray:
            return 'sampler2DArray';
        case WebGLShaderDataType.Sampler3D:
            return 'sampler3D';
        case WebGLShaderDataType.SamplerCube:
            return 'samplerCube';
        case WebGLShaderDataType.USampler2D:
            return 'usampler2D';
        case WebGLShaderDataType.USampler2DArray:
            return 'usampler2DArray';
        case WebGLShaderDataType.USampler3D:
            return 'usampler3D';
        default:
            return '';
    }
}

function createUniform(des: ShaderInputDescriptor) {
    return `uniform ${mapGLDataToStr(des.type)} ${des.name};`;
}

export function createUniforms(des: ShaderInputDescriptor[]) {
    return des.map(d => createUniform(d)).join('\n');
}

function createUniformArray(des: UniformArrayDescriptor) {
    return `\nuniform ${mapGLDataToStr(des.des.type)} ${des.des.name}[${des.length}];`;
}

export function createUniformArrays(des: UniformArrayDescriptor[]) {
    return des.map(d => createUniformArray(d)).join('\n');
}

export function createUBOs(ubos: UniformBlockObject[], supportUBO: boolean) {
    return ubos.map(ubo => ubo.createShaderHeader(supportUBO)).join('\n');
}

function createAttribute(des: ShaderInputDescriptor, useWebGL2: boolean) {
    return `${useWebGL2 ? 'in' : 'attribute'} ${mapGLDataToStr(des.type)} ${des.name};`;
}

export function createAttributes(des: ShaderInputDescriptor[], useWebGL2: boolean) {
    return des.map(d => createAttribute(d, useWebGL2)).join('\n');
}

function createVertVarying(des: ShaderInputDescriptor, useWebGL2: boolean) {
    return `${useWebGL2 ? 'out' : 'varying'} ${mapGLDataToStr(des.type)} ${des.name};`;
}

function createVertVaryingArray(des: VaryArrayDescriptor, useWebGL2: boolean) {
    return `${useWebGL2 ? 'out' : 'varying'} ${mapGLDataToStr(des.des.type)} ${des.des.name}[${des.length}];`;
}

function createFragVarying(des: ShaderInputDescriptor, useWebGL2: boolean) {
    return `${useWebGL2 ? 'in' : 'varying'} ${mapGLDataToStr(des.type)} ${des.name};`;
}

function createFragVaryingArray(des: VaryArrayDescriptor, useWebGL2: boolean) {
    return `${useWebGL2 ? 'in' : 'varying'} ${mapGLDataToStr(des.des.type)} ${des.des.name}[${des.length}];`;
}

export function createVertVaryings(des: ShaderInputDescriptor[], arrayDes: VaryArrayDescriptor[], useWebGL2: boolean) {
    return (
        des.map(d => createVertVarying(d, useWebGL2)).join('\n') +
        arrayDes.map(d => createVertVaryingArray(d, useWebGL2)).join('\n')
    );
}

export function createFragVaryings(des: ShaderInputDescriptor[], arrayDes: VaryArrayDescriptor[], useWebGL2: boolean) {
    return (
        des.map(d => createFragVarying(d, useWebGL2)).join('\n') +
        arrayDes.map(d => createFragVaryingArray(d, useWebGL2)).join('\n')
    );
}

export function createHeader(isWebGL2: boolean) {
    if (!isWebGL2) {
        return '';
    }

    return `#version 300 es
        precision highp sampler3D;
        precision highp usampler2D;
        precision highp usampler3D;
        #define gl_FragDepthEXT gl_FragDepth
        #define texture2D texture
        #define textureCube texture
        #define texture2DProj textureProj
        #define texture2DLodEXT textureLod
        #define texture2DProjLodEXT textureProjLod
        #define textureCubeLodEXT textureLod
        #define texture2DGradEXT textureGrad
        #define texture2DProjGradEXT textureProjGrad
        #define textureCubeGradEXT textureGrad
    `;
}

export function setUpPrecision() {
    return `
precision highp float;
precision highp int;
    `;
}

const unrollLoopPattern =
    /#pragma unroll_loop_start[\s]+?for\s*\(\s*int i = (\d+); i < (\d+); i\s*\+\+\s*\)\s*{([\s\S]+?)(?=\})\}[\s]+?#pragma unroll_loop_end/g;

function loopReplacer(_match: string, start: string, end: string, snippet: string) {
    let string = '';
    for (let i = parseInt(start, 10); i < parseInt(end, 10); i++) {
        string += snippet.replace(/\[ i \]/g, '[ ' + i + ' ]').replace(/UNROLLED_LOOP_INDEX/g, i.toString());
    }
    return string;
}

export function unrollLoops(shader: string): string {
    return shader.replace(unrollLoopPattern, loopReplacer);
}
