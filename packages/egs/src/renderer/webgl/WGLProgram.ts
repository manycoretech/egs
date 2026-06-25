import { WGLUniform, type UniformGeneralTypes } from './WGLUniform';
import type { Texture } from '../../elements/textures/Texture';
import type { ShaderInfo } from '../shader/Shader';
import { WGLShader } from './WGLShader';
import { WebGLShaderDataType } from './WGLConstants';
import { WGLUniformBlock } from './WGLUniformBlock';
import type { UniformBlockObject } from '../shader/components/UniformBlockObject';
import type { RenderState } from '../RenderState/RenderState';
import type { BuiltInUniforms } from '../RenderState/BuiltInUniforms';
import { WGLCapabilities } from './WGLCapabilities';
import type { Material } from '../../elements/materials/Material';
import { logger } from '../../utils/Logger';
import type { Nullable } from '../../utils/Utils';
import type { TextureCube } from '../../elements/textures/TextureCube';

const arrayCacheF32: Float32Array[] = [];
let globalProgramId = 0;

// WGLProgram is a wrapper class for real WebGLProgram, which is able to create, destroy a shader program.
// This class also tracks uniforms, attributes and has a set for all materials to record log,
// which allows control of memory become better.
export class WGLProgram {
    readonly id: number;
    readonly version: number;
    readonly key: string;
    readonly shaderInfo: ShaderInfo;
    readonly globalUniforms: BuiltInUniforms;
    readonly gl: WebGLRenderingContext | WebGL2RenderingContext;
    readonly renderState: RenderState;

    _disposed = false;
    uniformSkipTag = new Map<string, number>();

    readonly attributeKey = '';
    readonly program!: WebGLProgram;
    private attributes: { [index: string]: number } = {}; // why not use map??
    private uniforms: { [index: string]: WGLUniform } = {};
    private uniformBlocks: Map<string, WGLUniformBlock> = new Map();
    private referenceSet: Set<Material>;

    constructor(renderState: RenderState, info: ShaderInfo, material: Nullable<Material>, key: string) {
        this.renderState = renderState;
        this.globalUniforms = renderState.builtUniforms;
        this.gl = renderState.gl;
        this.key = key;
        this.shaderInfo = info;
        this.id = globalProgramId++;
        this.referenceSet = new Set();
        if (material) {
            this.referenceSet.add(material);
        }
        this.createWebGLProgram(info);
        this.fetchUniformsInfo();
        this.createUniformBlocks();
        this.fetchAttributesInfo();
        for (const name in this.attributes) {
            this.attributeKey += name + '_' + this.attributes[name];
        }
    }

    // set up caching for attribute locations
    getAttributesInfo() {
        return this.attributes;
    }

    private createWebGLProgram(shaderInfo: ShaderInfo): void {
        const vertexShader = WGLShader.createWebGLShader(this.gl, this.gl.VERTEX_SHADER, shaderInfo.vertex);
        const fragmentShader = WGLShader.createWebGLShader(this.gl, this.gl.FRAGMENT_SHADER, shaderInfo.frag);

        (this as any).program = this.gl.createProgram();
        if (this.program === null) {
            logger.webglError('Webgl program create failed');
        }
        this.gl.attachShader(this.program, vertexShader);
        this.gl.attachShader(this.program, fragmentShader);
        this.gl.linkProgram(this.program);
        if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
            const info = this.gl.getProgramInfoLog(this.program);
            logger.webglError('Could not compile WebGL program. \n\n' + info);
        }
    }

    private createUniformBlocks() {
        if (!WGLCapabilities.IS_WEBGL2) {
            return;
        }
        this.shaderInfo.uniformsBlocks.forEach(u => {
            const index = (this.gl as WebGL2RenderingContext).getUniformBlockIndex(this.program, u.name);
            if (index === -1) {
                logger.warn(`Uniform blocks <${u.name}> not really used in shader: `);
                return;
            }
            this.uniformBlocks.set(
                u.name,
                new WGLUniformBlock(this, u, index, this.renderState.resourceManager.uboManager!),
            );
        });
    }

    private fetchUniformsInfo() {
        const program = this.program;
        const n = this.gl.getProgramParameter(program, this.gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < n; ++i) {
            const info = this.gl.getActiveUniform(program, i)!;
            const addr = this.gl.getUniformLocation(program, info.name);
            if (addr === null || addr === undefined) {
                // UBO uniform
                continue;
            }
            const isArrayFloat = info.type === WebGLShaderDataType.Float && info.size > 1;
            const isArrayInt = info.type === WebGLShaderDataType.Int && info.size > 1;
            const isArrayUint = info.type === WebGLShaderDataType.UInt && info.size > 1;
            const isArrayIVec4 = info.type === WebGLShaderDataType.IntVec4 && info.size > 1;
            const isArraySampler2D = info.type === WebGLShaderDataType.Sampler2D && info.size > 1;
            const isArraySamplerCube = info.type === WebGLShaderDataType.SamplerCube && info.size > 1;
            let type: WebGLShaderDataType;
            if (isArrayFloat) {
                type = WebGLShaderDataType.FloatV;
            } else if (isArrayInt) {
                type = WebGLShaderDataType.IntV;
            } else if (isArrayUint) {
                type = WebGLShaderDataType.UintV;
            } else if (isArrayIVec4) {
                type = WebGLShaderDataType.IVec4V;
            } else if (isArraySampler2D) {
                type = WebGLShaderDataType.ArraySampler2D;
            } else if (isArraySamplerCube) {
                type = WebGLShaderDataType.ArraySamplerCube;
            } else {
                type = info.type;
            }
            this.uniforms[info.name] = new WGLUniform(this.gl, info.name, type, addr);
        }
    }

    private fetchAttributesInfo(): void {
        const n = this.gl.getProgramParameter(this.program, this.gl.ACTIVE_ATTRIBUTES);
        for (let i = 0; i < n; i++) {
            const info = this.gl.getActiveAttrib(this.program, i)!;
            const name = info.name;
            this.attributes[name] = this.gl.getAttribLocation(this.program, name);
        }
    }

    setUniform(name: string, data: UniformGeneralTypes, silent: boolean = false) {
        let uploadValue;
        if ((data as any)._elements !== undefined) {
            uploadValue = (data as any)._elements;
        } else if ((data as any).getNumberCount) {
            const n = (data as any).getNumberCount();
            let r = arrayCacheF32[n];
            if (r === undefined) {
                r = new Float32Array(n);
                arrayCacheF32[n] = r;
            }
            uploadValue = (data as any).toArray(r, 0);
        } else {
            uploadValue = data;
        }

        const uni = this.uniforms[name];
        if (uni !== undefined) {
            uni.upload(uploadValue);
        } else if (!silent) {
            logger.warn(`Uniform <${name}> not actually used in shader`);
        }
    }

    setUniformBlock(name: string, data: UniformBlockObject) {
        const ubo = this.renderState.resourceManager.setupWGLUBOBuffer(data);
        const u = this.uniformBlocks.get(name);
        if (u !== undefined) {
            u.use(ubo);
        } else {
            logger.warn(`UBO <${name}> not actually used in shader`);
        }
    }

    queryUBOLayout(name: string) {
        const u = this.uniformBlocks.get(name);
        if (u !== undefined) {
            return u.queryLayout();
        } else {
            logger.warn(`UBO <${name}> not actually used in shader`);
            return undefined;
        }
    }

    setTexture(name: string, texture: Texture, silent: boolean = false) {
        const uni = this.uniforms[name];
        if (uni !== undefined) {
            const unit = this.renderState.setTexture(texture);
            uni.upload(unit);
        } else if (!silent) {
            logger.warn(`Uniform <${name}> not actually used in shader`);
        }
    }

    setTextures(name: string, textures: Texture[], silent: boolean = false) {
        const uni = this.uniforms[name];
        if (uni !== undefined) {
            const textureUnits = textures.map(t => this.renderState.setTexture(t));
            uni.upload(textureUnits);
        } else if (!silent) {
            logger.warn(`Uniform <${name}> not actually used in shader`);
        }
    }

    setTexture2D(name: string, texture: Texture, silent: boolean = false) {
        this.setTexture(name, texture, silent);
    }

    setArrayTexture2D(name: string, textures: Texture[]) {
        this.setTextures(name, textures);
    }

    setTexture3D(name: string, texture: Texture) {
        this.setTexture(name, texture);
    }

    setArrayTextureCube(name: string, textures: TextureCube[]) {
        this.setTextures(name, textures);
    }

    setTextureCube(name: string, texture: TextureCube) {
        this.setTexture(name, texture);
    }

    attach(material: Material) {
        if (this.referenceSet.has(material)) {
            logger.unreachable('material already in the program set!');
        }
        this.referenceSet.add(material);
    }

    detach(material: Material): boolean {
        if (!this.referenceSet.has(material)) {
            logger.unreachable('material not in the program set!');
            return true;
        }
        this.referenceSet.delete(material);
        return this.referenceSet.size === 0;
    }

    destroy() {
        this.gl.deleteProgram(this.program);
        this.referenceSet.clear();
        this._disposed = true;
    }
}
