import { PassQuadMaterialBase } from './PassMaterialBase';
import { MaterialParameters, ColorTransfer } from '../../materials/Material';
import { ShaderComponentRegistry } from '../../../scene/ShaderComponentRegistry';
import { ShaderBuilder, ShaderInjectionTypes } from '../../../renderer/shader/builders/ShaderBuilder';
import { WGLProgram } from '../../../renderer/webgl/WGLProgram';
import { createShaderBlock } from '../../../renderer/shader/builders/ShaderBlock';
import { HashKeyBuilder } from '../../../utils/HashKeyBuilder';
import { WebGLShaderDataType } from '../../../renderer/webgl/WGLConstants';
import { Texture } from '../../textures/Texture';
import { materialProperty } from '../../../ContentAPI';
import { ShaderBlockPool } from '../../../renderer/shader/builders/ShaderBlockPool';

export enum ToneMapping {
    Linear,
    Reinhard,
    ACES,
    ACESFilmic,
    Neutral
}

const toneMappingFunctions = createShaderBlock(`
vec3 linearToneMapping(in vec3 color) {
    return color * exposure;
}
vec4 linearToneMapping(in vec4 color) {
    return vec4(linearToneMapping(color.rgb), color.a);
}
vec3 reinhardToneMapping(in vec3 color) {
    color *= exposure;
    return color / (color + 1.0);
}
vec4 reinhardToneMapping(in vec4 color) {
    return vec4(reinhardToneMapping(color.rgb), color.a);
}
vec3 ACESToneMapping(in vec3 color) {
    float A = 2.51;
    float B = 0.03;
    float C = 2.43;
    float D = 0.59;
    float E = 0.14;
    color *= exposure;
    return (color * (A * color + B)) / (color * (C * color + D) + E);
}

vec4 ACESToneMapping(in vec4 color) {
    return vec4(ACESToneMapping(color.rgb), color.a);
}

vec3 RRTAndODTFit(in vec3 v) {
    vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
    vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
    return a / b;
}

vec3 ACESFilmicToneMapping(in vec3 color) {

    // sRGB => XYZ => D65_2_D60 => AP1 => RRT_SAT
    const mat3 ACESInputMat = mat3(
        vec3( 0.59719, 0.07600, 0.02840 ), // transposed from source
        vec3( 0.35458, 0.90834, 0.13383 ),
        vec3( 0.04823, 0.01566, 0.83777 )
    );

    // ODT_SAT => XYZ => D60_2_D65 => sRGB
    const mat3 ACESOutputMat = mat3(
        vec3(  1.60475, -0.10208, -0.00327 ), // transposed from source
        vec3( -0.53108,  1.10813, -0.07276 ),
        vec3( -0.07367, -0.00605,  1.07602 )
    );

    color = color * exposure / 0.6;

    color = ACESInputMat * color;

    // Apply RRT and ODT
    color = RRTAndODTFit(color);

    color = ACESOutputMat * color;

    // Clamp to [0, 1]
    return saturate(color);
}

vec4 ACESFilmicToneMapping(in vec4 color) {
    return vec4(ACESFilmicToneMapping(color.rgb), color.a);
}

vec3 neutralToneMapping(in vec3 color) {
    const float startCompression = 0.8 - 0.04;
    const float desaturation = 0.15;

    color *= exposure;

    float x = min(color.r, min(color.g, color.b));
    float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
    color -= offset;

    float peak = max(color.r, max(color.g, color.b));
    if (peak < startCompression) return color;

    float d = 1. - startCompression;
    float newPeak = 1. - d * d / (peak + d - startCompression);
    color *= newPeak / peak;

    float g = 1. - 1. / (desaturation * (peak - newPeak) + 1.);
    return mix(color, newPeak * vec3(1, 1, 1), g);
}

vec4 neutralToneMapping(in vec4 color) {
    return vec4(neutralToneMapping(color.rgb), color.a);
}
`);

export class ToneMappingMaterial extends PassQuadMaterialBase {
    @materialProperty()
    inputTransfer: ColorTransfer = ColorTransfer.Linear;
    @materialProperty()
    outputTransfer: ColorTransfer = ColorTransfer.LinearToSrgb;
    @materialProperty()
    toneMapping: ToneMapping = ToneMapping.Linear;
    @materialProperty()
    exposure: number = 1.0;
    @materialProperty()
    tDiffuse: Texture;

    extendShaderShading(shaderBuilder: ShaderBuilder): void {
        let inputTransfer = '';
        let outputTransfer = '';
        let toneMapping = '';
        switch (this.inputTransfer) {
            case ColorTransfer.LinearToSrgb:
                inputTransfer = 'linearToSrgb';
                break;
            case ColorTransfer.SrgbToLinear:
                inputTransfer = 'srgbToLinear';
                break;
        }
        switch (this.outputTransfer) {
            case ColorTransfer.LinearToSrgb:
                outputTransfer = 'linearToSrgb';
                break;
            case ColorTransfer.SrgbToLinear:
                outputTransfer = 'srgbToLinear';
                break;
        }
        switch (this.toneMapping) {
            case ToneMapping.Linear:
                toneMapping = 'linearToneMapping';
                break;
            case ToneMapping.Reinhard:
                toneMapping = 'reinhardToneMapping';
                break;
            case ToneMapping.ACES:
                toneMapping = 'ACESToneMapping';
                break;
            case ToneMapping.ACESFilmic:
                toneMapping = 'ACESFilmicToneMapping';
                break;
            case ToneMapping.Neutral:
                toneMapping = 'neutralToneMapping';
                break;
        }

        shaderBuilder
            .addFragment(ShaderBlockPool.ColorTransferFunctions)
            .addFragment(toneMappingFunctions)
            .addUniform('tDiffuse', WebGLShaderDataType.Sampler2D)
            .addUniform('exposure', WebGLShaderDataType.Float)
            .inject(ShaderInjectionTypes.gl_FragColor, `
                vec4 color = texture2D(tDiffuse, vUv);
                gl_FragColor = ${outputTransfer}(${toneMapping}(${inputTransfer}(color)));
            `);
    }
    public updateShadingUniforms(program: WGLProgram) {
        program.setTexture2D('tDiffuse', this.tDiffuse);
        program.setUniform('exposure', this.exposure);
    }
    constructor(params?: MaterialParameters) {
        super(params);
        this.transparent = false;
    }
    public generateShaderKey(r: ShaderComponentRegistry) {
        return super.generateShaderKey(r) +
            new HashKeyBuilder()
                .raw(this.outputTransfer)
                .raw(this.inputTransfer)
                .raw(this.toneMapping)
                .getKey();
    }

    className(): string {
        return 'ToneMappingMaterial';
    }
}
