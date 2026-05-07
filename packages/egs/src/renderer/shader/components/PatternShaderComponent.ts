import { ShaderComponent } from '../Shader';
import { ShaderBuilder, ShaderInjectionTypes, ShaderVaryingTypes } from '../builders/ShaderBuilder';
import { WGLProgram } from '../../webgl/WGLProgram';
import { WebGLShaderDataType } from '../../webgl/WGLConstants';
import { Serializer, Deserializer } from '../../../utils/Serialization';
import { ConvertMaterialParameters } from '../../../elements/materials/Material';
import { Utils } from '../../../utils/Utils';
import { Texture2D } from '../../../elements/textures/Texture2D';
import { readonlyMath } from '../../../math/Readonly';
import { ContentBridge, materialProperty } from '../../../ContentAPI';
import { Color } from '../../../math/Color';
import { BlendingFactor, BlendingEquation } from '../../../utils/Constants';
import { TextureV2 } from '../../../elements/textures/TextureV2';

export type PatternShaderComponentParameter<T extends TextureV2 | Texture2D = Texture2D> = ConvertMaterialParameters<Pick<PatternShaderComponent<T>,
    'pattern' | 'scale' | 'offset' | 'textureSize' | 'screenSpaceEnabled' | 'overrideSrcColor'>> & ShaderBlendParameter;

const keys = ['pattern', 'scale', 'offset', 'textureSize', 'screenSpaceEnabled', 'overrideSrcColor'];

// SpottedShaderComponent controls the use of spotted effect.
// This is coming from outside frontend team.
export class PatternShaderComponent<T extends TextureV2 | Texture2D = Texture2D> extends ShaderComponent {
    constructor() {
        super();
        ContentBridge.shaderComponentCreateAttachable(this);
    }

    @materialProperty()
    pattern: T;
    @materialProperty()
    textureSize = readonlyMath.vec2(1, 1); // sadly webgl1 not support textureSize() in glsl;
    @materialProperty()
    scale = readonlyMath.vec2(1, 1);
    @materialProperty()
    offset = readonlyMath.vec2(0, 0);
    @materialProperty()
    screenSpaceEnabled: boolean = true;
    @materialProperty()
    overrideSrcColor?: Color;

    readonly blendConfig = new ShaderBlend<T>(this); // "readonly" - breaking change

    className() {
        return 'PatternShaderComponent';
    }

    setValues(values: PatternShaderComponentParameter<T>) {
        Utils.copyProperties(keys, this, values);
        this.blendConfig.setValues(values);
    }

    serialize(ctx: Serializer) {
        ctx.puts<PatternShaderComponent>(['pattern', 'scale', 'offset', 'textureSize', 'screenSpaceEnabled', 'overrideSrcColor']);
    }

    deserialize(ctx: Deserializer) {
        ctx.reads<PatternShaderComponent>(['pattern', 'scale', 'offset', 'textureSize', 'screenSpaceEnabled', 'overrideSrcColor']);
    }

    copy(other: PatternShaderComponent<T>) {
        this.pattern = other.pattern;
        this.scale = other.scale;
        this.offset = other.offset;
        this.textureSize = other.textureSize;
        this.blendConfig.copy(other.blendConfig);
        return this;
    }

    clone() {
        return new PatternShaderComponent<T>().copy(this);
    }

    extendShaderShading(builder: ShaderBuilder) {
        builder
            .addUniform('pattern', WebGLShaderDataType.Sampler2D)
            .addUniform('scale', WebGLShaderDataType.Vec2)
            .addUniform('offset', WebGLShaderDataType.Vec2)
            .addUniform('texture_size', WebGLShaderDataType.Vec2)
            .inject(ShaderInjectionTypes.gl_FragColorModify, this.blendConfig.generateShader('pattern_tex', 'gl_FragColor', 'gl_FragColor'));
        if (this.overrideSrcColor) {
            builder.addUniform('overrideSrcColor', WebGLShaderDataType.Vec3);
        }
        if (this.screenSpaceEnabled) {
            builder
                .inject(ShaderInjectionTypes.gl_FragColor, `
                    vec2 pattern_uv = (gl_FragCoord.xy + offset) / texture_size / scale;
                    vec4 pattern_tex = texture2D(pattern, pattern_uv);
                    ${this.overrideSrcColor ? 'pattern_tex.rgb = overrideSrcColor;' : ''}
                `);
        } else {
            builder
                .addVarying(ShaderVaryingTypes.fragUV)
                .inject(ShaderInjectionTypes.gl_FragColor, `
                    vec2 pattern_uv = (vUv + offset) / texture_size / scale;
                    vec4 pattern_tex = texture2D(pattern, pattern_uv);
                    ${this.overrideSrcColor ? 'pattern_tex.rgb = overrideSrcColor;' : ''}
                `);
        }
    }

    updateShadingUniforms(program: WGLProgram) {
        program.setTexture2D('pattern', this.pattern);
        program.setUniform('scale', this.scale);
        program.setUniform('offset', this.offset);
        program.setUniform('texture_size', this.textureSize);
        if (this.overrideSrcColor) {
            program.setUniform('overrideSrcColor', this.overrideSrcColor);
        }
    }

    generateShaderKey() {
        return (this.screenSpaceEnabled ? '1' : '0') +
            (this.overrideSrcColor ? '1' : '0') +
            this.blendConfig.generateShaderKey();
    }
}

export type ShaderBlendParameter<T extends TextureV2 | Texture2D = Texture2D> = ConvertMaterialParameters<Pick<ShaderBlend<T>,
    'shaderBlendSrc' | 'shaderBlendDst' | 'shaderBlendEquation' | 'shaderBlendSrcAlpha' | 'shaderBlendDstAlpha' | 'shaderBlendEquationAlpha'>>;

export const shaderBlendKeys = ['shaderBlendSrc', 'shaderBlendDst', 'shaderBlendEquation', 'shaderBlendSrcAlpha', 'shaderBlendDstAlpha', 'shaderBlendEquationAlpha'];

class ShaderBlend<T extends TextureV2 | Texture2D = Texture2D> {
    private readonly parent: PatternShaderComponent<T>;
    constructor(parent: PatternShaderComponent<T>) {
        this.parent = parent;
    }

    setValues(values: ShaderBlendParameter) {
        Utils.copyProperties(shaderBlendKeys, this, values);
    }

    private _shaderBlendSrc: BlendingFactor = BlendingFactor.SrcAlphaFactor;
    private _shaderBlendDst: BlendingFactor = BlendingFactor.OneMinusSrcAlpha;
    private _shaderBlendEquation: BlendingEquation = BlendingEquation.Add;
    private _shaderBlendSrcAlpha: BlendingFactor = BlendingFactor.One;
    private _shaderBlendDstAlpha: BlendingFactor = BlendingFactor.One;
    private _shaderBlendEquationAlpha: BlendingEquation = BlendingEquation.Add;

    get shaderBlendSrc(): BlendingFactor {
        return this._shaderBlendSrc;
    }
    set shaderBlendSrc(value: BlendingFactor) {
        this._shaderBlendSrc = value;
        ContentBridge.materialSetProperty(this.parent, 'shaderBlendSrc', this._shaderBlendSrc);
    }
    get shaderBlendDst(): BlendingFactor {
        return this._shaderBlendDst;
    }
    set shaderBlendDst(value: BlendingFactor) {
        this._shaderBlendDst = value;
        ContentBridge.materialSetProperty(this.parent, 'shaderBlendDst', this._shaderBlendDst);
    }
    get shaderBlendEquation(): BlendingEquation {
        return this._shaderBlendEquation;
    }
    set shaderBlendEquation(value: BlendingEquation) {
        this._shaderBlendEquation = value;
        ContentBridge.materialSetProperty(this.parent, 'shaderBlendEquation', this._shaderBlendEquation);
    }
    get shaderBlendSrcAlpha(): BlendingFactor {
        return this._shaderBlendSrcAlpha;
    }
    set shaderBlendSrcAlpha(value: BlendingFactor) {
        this._shaderBlendSrcAlpha = value;
        ContentBridge.materialSetProperty(this.parent, 'shaderBlendSrcAlpha', this._shaderBlendSrcAlpha);
    }
    get shaderBlendDstAlpha(): BlendingFactor {
        return this._shaderBlendDstAlpha;
    }
    set shaderBlendDstAlpha(value: BlendingFactor) {
        this._shaderBlendDstAlpha = value;
        ContentBridge.materialSetProperty(this.parent, 'shaderBlendDstAlpha', this._shaderBlendDstAlpha);
    }
    get shaderBlendEquationAlpha(): BlendingEquation {
        return this._shaderBlendEquationAlpha;
    }
    set shaderBlendEquationAlpha(value: BlendingEquation) {
        this._shaderBlendEquationAlpha = value;
        ContentBridge.materialSetProperty(this.parent, 'shaderBlendEquationAlpha', this._shaderBlendEquationAlpha);
    }

    generateShaderKey() {
        return this._shaderBlendSrc.toString() + this._shaderBlendDst.toString() + this._shaderBlendEquation.toString() +
            this._shaderBlendSrcAlpha.toString() + this._shaderBlendDstAlpha.toString() + this._shaderBlendEquationAlpha.toString();
    }

    generateShader(blendSrc: string, blendDst: string, result: string): string {
        const colorSrcFac = ShaderBlend.factor(blendSrc, blendDst, this._shaderBlendSrc);
        const colorDstFac = ShaderBlend.factor(blendSrc, blendDst, this._shaderBlendDst);
        const alphaSrcFac = ShaderBlend.factor(blendSrc, blendDst, this._shaderBlendSrcAlpha);
        const alphaDstFac = ShaderBlend.factor(blendSrc, blendDst, this._shaderBlendDstAlpha);
        let colorShader = '';
        switch (this._shaderBlendEquation) {
            case BlendingEquation.Add: colorShader = `
            ${result}.rgb = ${blendSrc}.rgb * ${colorSrcFac} + ${blendDst}.rgb * ${colorDstFac};
            `; break;
            case BlendingEquation.Subtract: colorShader = `
            ${result}.rgb = ${blendSrc}.rgb * ${colorSrcFac} - ${blendDst}.rgb * ${colorDstFac};
            `; break;
            case BlendingEquation.ReverseSubtract: colorShader = `
            ${result}.rgb = ${blendDst}.rgb * ${colorDstFac} - ${blendSrc}.rgb * ${colorSrcFac};
            `; break;
            case BlendingEquation.Min: colorShader = `
            ${result}.rgb = min(${blendDst}.rgb, ${blendSrc}.rgb);
            `; break;
            case BlendingEquation.Max: colorShader = `
            ${result}.rgb = max(${blendDst}.rgb, ${blendSrc}.rgb);
            `; break;
        }
        let alphaShader = '';
        switch (this._shaderBlendEquationAlpha) {
            case BlendingEquation.Add: alphaShader = `
            ${result}.a = ${blendSrc}.a * ${alphaSrcFac} + ${blendDst}.a * ${alphaDstFac};
            `; break;
            case BlendingEquation.Subtract: alphaShader = `
            ${result}.a = ${blendSrc}.a * ${alphaSrcFac} - ${blendDst}.a * ${alphaDstFac};
            `; break;
            case BlendingEquation.ReverseSubtract: alphaShader = `
            ${result}.a = ${blendDst}.a * ${alphaDstFac} - ${blendSrc}.a * ${alphaSrcFac};
            `; break;
            case BlendingEquation.Min: alphaShader = `
            ${result}.a = min(${blendDst}.a, ${blendSrc}.a);
            `; break;
            case BlendingEquation.Max: alphaShader = `
            ${result}.a = max(${blendDst}.a, ${blendSrc}.a);
            `; break;
        }
        return alphaShader + colorShader;
    }

    copy(other: ShaderBlend<T>) {
        this.shaderBlendSrc = other._shaderBlendSrc;
        this.shaderBlendDst = other._shaderBlendDst;
        this.shaderBlendSrcAlpha = other._shaderBlendSrcAlpha;
        this.shaderBlendDstAlpha = other._shaderBlendDstAlpha;
        this.shaderBlendEquation = other._shaderBlendEquation;
        this.shaderBlendEquationAlpha = other._shaderBlendEquationAlpha;
    }
    private static factor(src: string, dst: string, type: BlendingFactor) {
        switch (type) {
            case BlendingFactor.Zero: return '0.0';
            case BlendingFactor.One: return '1.0';
            case BlendingFactor.SrcColor: return `${src}.rgb`;
            case BlendingFactor.OneMinusSrcColor: return `(vec3(1.0, 1.0, 1.0) - ${src}.rgb)`;
            case BlendingFactor.DstColor: return `${dst}.rgb`;
            case BlendingFactor.OneMinusDstColor: return `(vec3(1.0, 1.0, 1.0) - ${dst}.rgb)`;
            case BlendingFactor.SrcAlphaFactor: return `${src}.a`;
            case BlendingFactor.OneMinusSrcAlpha: return `(1.0 - ${src}.a)`;
            case BlendingFactor.DstAlpha: return `${dst}.a`;
            case BlendingFactor.OneMinusDstAlpha: return `(1.0 - ${dst}.a)`;
        }
    }
}
