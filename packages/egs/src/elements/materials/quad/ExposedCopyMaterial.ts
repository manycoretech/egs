import { PassPointsMaterialBase, PassQuadMaterialBase } from './PassMaterialBase';
import { WebGLShaderDataType } from '../../../renderer/webgl/WGLConstants';
import type { WGLProgram } from '../../../renderer/webgl/WGLProgram';
import { ShaderInjectionTypes, type ShaderBuilder } from '../../../renderer/shader/builders/ShaderBuilder';
import { Blending, BlendingFactor, BlendingEquation } from '../../../utils/Constants';
import { createShaderBlock } from '../../../renderer/shader/builders/ShaderBlock';
import { ShaderBlockPool } from '../../../renderer/shader/builders/ShaderBlockPool';
import { Texture2D } from '../../textures/Texture2D';
import { Matrix3 } from '../../../math/Matrix3';
import { materialProperty } from '../../../ContentAPI';
import type { Texture } from '../../textures/Texture';

const DialuxLuminanceShader = createShaderBlock(`
const float minLumCorrect = 2.03; // 5.0-0.01

float Luminance(vec3 color, float minLuminance)
{
    float lum = dot(color, vec3(0.2126560, 0.7151580, 0.0721856));
    return max(lum, minLuminance);
}
`);

export class DialuxLuminanceMaterial extends PassPointsMaterialBase {
    @materialProperty()
    private textureResolutionX = 128;
    @materialProperty()
    hdr: Texture = Texture2D.default;

    className() {
        return 'DialuxLuminanceMaterial';
    }

    extendShaderShading(b: ShaderBuilder) {
        b.addUniform('hdr', WebGLShaderDataType.Sampler2D)
            .addUniform('textureResolutionX', WebGLShaderDataType.Float)
            .addVertex(DialuxLuminanceShader)
            .addVaryingCustom('vR', WebGLShaderDataType.Float)
            .addVaryingCustom('vG', WebGLShaderDataType.Float)
            .inject(ShaderInjectionTypes.gl_Position, `
                gl_PointSize = .5;
                float y = floor(position.x / textureResolutionX);
                float x = position.x - y * textureResolutionX;
                vec2 uv = vec2(x, y) / textureResolutionX;
                vec4 luminanceValue = texture2D(hdr, uv).rgba;
                vR = 0.0;
                vG = 0.0;
                if (luminanceValue.a > 0.1) {
                    vR = log2(Luminance(luminanceValue.rgb * 378.0, minLumCorrect));
                    vG = 1.0;
                }
                gl_Position = vec4(0., 0., 0., 1.);
            `)
            .inject(ShaderInjectionTypes.gl_FragColor, `
                gl_FragColor = vec4(vR, vG, 0., vG);
            `);
    }

    updateShadingUniforms(program: WGLProgram) {
        program.setTexture2D('hdr', this.hdr);
        program.setUniform('textureResolutionX', this.textureResolutionX);
    }

    configBlend() {
        this.blending = Blending.CustomBlending;
        this.blendSrc = BlendingFactor.One;
        this.blendDst = BlendingFactor.One;
        this.blendEquation = BlendingEquation.Add;
        this.blendSrcAlpha = BlendingFactor.One;
        this.blendDstAlpha = BlendingFactor.One;
        this.blendEquationAlpha = BlendingEquation.Add;
        return this;
    }
}

const DialuxWhiteBalanceExposureShader = createShaderBlock(`
float linearTosRGB(const in float color) {
    return  color < 0.0031308 ? color * 12.92 : 1.055 * pow(color, 1.0 / 2.4) - 0.055;
}

vec3 linearTosRGB(const in vec3 color) {
    return vec3(
        linearTosRGB(color.r),
        linearTosRGB(color.g),
        linearTosRGB(color.b)
    );
}


const mat3 sRGBtoXYZ = mat3(0.412423998, 0.2126560060, 0.0193323996,
    0.357578993, 0.7151579860, 0.1191930030,
    0.180464000, 0.0721855983, 0.9504439830);
const mat3 inv_sRGBtoXYZ = mat3(3.2407081100, -0.9692569970, 0.0556350015,
        -1.537258980, 1.875995040, -0.203996003,
        -0.4985699950, 0.0415560007, 1.0570700200);
const float oneDivPi = 0.3183098861;
const float keyMinuend = 1.03;
const float miniBrightness = 0.93; // 0.1-1.5
const float minLumCorrect = 2.03; // 5.0-0.01

float log10(float x) {
    float y = 10.0;
    return log2(x) / log2(y);
}

float Luminance(vec3 color, float minLuminance) {
    float lum = dot(color, vec3(0.2126560, 0.7151580, 0.0721856));
    return max(lum, minLuminance);
}

vec3 ACESToneMapping(vec3 color) {
    float A = 2.51;
    float B = 0.03;
    float C = 2.43;
    float D = 0.59;
    float E = 0.14;
    return (color * (A * color + B)) / (color * (C * color + D) + E);
}

vec3 WhiteBalance(vec3 illuminanceValue) {
    illuminanceValue = sRGBtoXYZ * illuminanceValue;

    mat3 whitePointDescriptor = dialuxWhiteBalance_uMatrix;
    illuminanceValue = whitePointDescriptor * illuminanceValue;
    illuminanceValue = max(illuminanceValue, vec3(0.0));

    illuminanceValue = inv_sRGBtoXYZ * illuminanceValue;

    return illuminanceValue;
}

vec3 IlluminateWithWhiteBalance(vec3 luminanceValue) {
    float albedo = 1.0;
    luminanceValue = luminanceValue * 378.0;
    float minLuminanceValue = miniBrightness * albedo * oneDivPi;

    vec3 temp = minLuminanceValue + WhiteBalance(luminanceValue);

    temp = temp / 378.0 * 3.5;

    return ACESToneMapping(temp);
}
`);

const dialux_table: Matrix3[] = [
    new Matrix3().fromArray([0.80349, -0.2411, 0.26817, -0.25619, 1.26161, -0.46149, 1.25842, 0.40191, 8.32277]),
    new Matrix3().fromArray([0.82329, -0.17298, 0.12309, -0.15645, 1.14836, -0.20949, 0.59639, 0.19335, 4.37624]),
    new Matrix3().fromArray([0.85349, -0.12467, 0.06819, -0.10608, 1.09093, -0.11487, 0.33975, 0.11153, 2.87236]),
    new Matrix3().fromArray([0.8824, -0.09181, 0.04139, -0.07525, 1.0586, -0.06907, 0.21147, 0.07018, 2.13621]),
    new Matrix3().fromArray([0.90787, -0.06807, 0.02608, -0.0543, 1.03923, -0.04311, 0.13658, 0.04579, 1.71593]),
    new Matrix3().fromArray([0.92983, -0.05022, 0.01637, -0.03912, 1.02717, -0.02676, 0.08817, 0.0299, 1.45025]),
    new Matrix3().fromArray([0.94865, -0.03639, 0.00974, -0.02766, 1.01951, -0.01566, 0.05459, 0.01879, 1.26981]),
    new Matrix3().fromArray([0.9648, -0.02543, 0.00497, -0.01873, 1.01461, -0.0077, 0.03006, 0.01064, 1.14062]),
    new Matrix3().fromArray([0.97872, -0.01659, 0.00138, -0.01161, 1.01149, -0.00175, 0.01145, 0.00442, 1.04433]),
    new Matrix3().fromArray([0.99078, -0.00934, -0.0014, -0.00583, 1.00956, 0.00284, -0.00311, -0.00046, 0.97024]),
    new Matrix3().fromArray([1.00128, -0.00332, -0.00361, -0.00106, 1.00843, 0.00649, -0.01478, -0.00439, 0.91176]),
    new Matrix3().fromArray([1.01047, 0.00174, -0.00541, 0.00293, 1.00785, 0.00945, -0.02431, -0.0076, 0.86462]),
    new Matrix3().fromArray([1.01857, 0.00603, -0.0069, 0.0063, 1.00764, 0.01189, -0.03223, -0.01027, 0.82593]),
    new Matrix3().fromArray([1.02573, 0.0097, -0.00814, 0.00918, 1.00768, 0.01393, -0.03889, -0.01252, 0.79372]),
    new Matrix3().fromArray([1.03209, 0.01288, -0.0092, 0.01166, 1.0079, 0.01567, -0.04458, -0.01445, 0.76653]),
    new Matrix3().fromArray([1.03778, 0.01564, -0.01012, 0.01382, 1.00823, 0.01716, -0.04947, -0.01611, 0.74333]),
    new Matrix3().fromArray([1.04289, 0.01806, -0.0109, 0.0157, 1.00865, 0.01845, -0.05372, -0.01755, 0.72333]),
];

export class DialuxWhiteBalanceExposureMaterial extends PassQuadMaterialBase {
    @materialProperty()
    hdr: Texture = Texture2D.default;
    @materialProperty()
    private dialuxWhiteBalanceMatrix = new Matrix3();
    _temperature = 5000;
    get temperature() {
        return this._temperature;
    }
    set temperature(v) {
        this._temperature = v;
        this.updateMatrix();
    }

    constructor() {
        super();
        this.temperature = 2000;
    }

    private updateMatrix() {
        const index = (Math.min(Math.max(this.temperature, 2000), 10000) - 2000) / 500;
        if (index === 16) {
            this.dialuxWhiteBalanceMatrix = dialux_table[16];
            return;
        }
        const left = Math.floor(index);
        const ratio = index - left;

        const a = new Matrix3().copy(dialux_table[left]).multiplyScalar(1 - ratio);
        const b = new Matrix3().copy(dialux_table[left + 1]).multiplyScalar(ratio);
        this.dialuxWhiteBalanceMatrix = new Matrix3().addMatrices(a, b);
    }

    className() {
        return 'DialuxWhiteBalanceExposureMaterial';
    }

    extendShaderShading(b: ShaderBuilder) {
        b.addUniform('hdr', WebGLShaderDataType.Sampler2D)
            .addUniform('dialuxWhiteBalance_uMatrix', WebGLShaderDataType.Mat3)
            .addFragment(DialuxWhiteBalanceExposureShader)
            .inject(ShaderInjectionTypes.gl_FragColor, `
                vec4 base = texture2D(hdr, vUv).rgba;
                gl_FragColor = vec4(linearTosRGB(IlluminateWithWhiteBalance(base.rgb)), base.a);
            `);
    }

    updateShadingUniforms(program: WGLProgram) {
        program.setTexture2D('hdr', this.hdr);
        program.setUniform('dialuxWhiteBalance_uMatrix', this.dialuxWhiteBalanceMatrix);
    }
}

const luminanceThreshold = 1024 * 4;
export class ExposedCopyMaterial extends PassQuadMaterialBase {
    @materialProperty()
    tDiffuse: Texture = Texture2D.default;

    className() {
        return 'ExposedCopyMaterial';
    }

    extendShaderShading(b: ShaderBuilder) {
        b.addUniform('tDiffuse', WebGLShaderDataType.Sampler2D)
            .addFragment(ShaderBlockPool.Encode24)
            .addFragment(Luminance)
            .inject(ShaderInjectionTypes.gl_FragColor, `
                vec4 diffuseResult = texture2D(tDiffuse, vUv);
                gl_FragColor = vec4(encode24(Luminance( diffuseResult.rgb, 0.)), 1.);
            `);
    }

    updateShadingUniforms(program: WGLProgram) {
        program.setTexture2D('tDiffuse', this.tDiffuse);
    }
}

export class HistogramComputeMaterial extends PassPointsMaterialBase {
    @materialProperty()
    tDiffuse: Texture = Texture2D.default;
    @materialProperty()
    sampleResolution = 128;
    @materialProperty()
    clampedLuminanceThreshold = luminanceThreshold;
    @materialProperty()
    textureResolutionX = 128;

    className() {
        return 'HistogramComputeMaterial';
    }

    extendShaderShading(b: ShaderBuilder) {
        b.addUniform('tDiffuse', WebGLShaderDataType.Sampler2D)
            .addUniform('uClampedLuminanceThreshold', WebGLShaderDataType.Float)
            .addUniform('sampleResolution', WebGLShaderDataType.Float)
            .addUniform('textureResolutionX', WebGLShaderDataType.Float)
            .addVertex(ShaderBlockPool.Decode24)
            .addVaryingCustom('vCountG', WebGLShaderDataType.Float)
            .addVaryingCustom('vCountR', WebGLShaderDataType.Float)
            .inject(ShaderInjectionTypes.gl_Position, `
                gl_PointSize = 0.5;
                vec2 uvCoord;
                uvCoord.x = floor(position.x / textureResolutionX);
                uvCoord.y = position.x - uvCoord.x * textureResolutionX;
                uvCoord /= textureResolutionX;
                float luminance = decode24(texture2D(tDiffuse, uvCoord).rgb);
                float index;
                if (luminance > 1.0) {
                    float maxIndex = floor(log2(uClampedLuminanceThreshold));
                    vCountR = 0.0;
                    vCountG = 1.0;
                    index = clamp(log2(luminance), 0.0, maxIndex) / maxIndex * (sampleResolution - 1.0);
                } else if (luminance > 0.0) {
                    vCountR = 1.0;
                    vCountG = 0.0;
                    index = pow(luminance, 0.4545) * (sampleResolution - 1.0);
                }
                index = floor(index) / sampleResolution;
                // luminance will be clamped when > 65025.0, which can almost be impossible
                gl_Position = vec4(index * 2.0 - 1.0 + 1.0 / sampleResolution, 0.0, 0.0, 1.0);
            `)
            .inject(ShaderInjectionTypes.gl_FragColor, `
                gl_FragColor = vec4(vCountR, vCountG, 0.0, 0.0);
            `);
    }

    updateShadingUniforms(program: WGLProgram) {
        program.setTexture2D('tDiffuse', this.tDiffuse);
        program.setUniform('uClampedLuminanceThreshold', this.clampedLuminanceThreshold);
        program.setUniform('sampleResolution', this.sampleResolution);
        program.setUniform('textureResolutionX', this.textureResolutionX);
    }

    configBlend() {
        this.blending = Blending.CustomBlending;
        this.blendSrc = BlendingFactor.One;
        this.blendDst = BlendingFactor.One;
        this.blendEquation = BlendingEquation.Add;
        this.blendSrcAlpha = BlendingFactor.One;
        this.blendDstAlpha = BlendingFactor.One;
        this.blendEquationAlpha = BlendingEquation.Add;
        return this;
    }
}

export class AvgLuminanceMaterial extends PassQuadMaterialBase {
    @materialProperty()
    tDiffuse: Texture = Texture2D.default;
    @materialProperty()
    clampedLuminanceThreshold = luminanceThreshold;

    className() {
        return 'AvgLuminanceMaterial';
    }

    extendShaderShading(b: ShaderBuilder) {
        b.addUniform('tDiffuse', WebGLShaderDataType.Sampler2D)
            .addUniform('uClampedLuminanceThreshold', WebGLShaderDataType.Float)
            .inject(ShaderInjectionTypes.gl_FragColor, `
                float maxIndex = floor(log2(uClampedLuminanceThreshold));
                float averageLuma = 0.0;
                vec2 sampleUV;
                float coordX;
                vec2 lumaForThisBin;
                vec2 countForThisBin;
                int count = 128;
                float samplers = 0.;
                float numSamplers = float(count);
                float weight = 1.0 / 128.0 / 128.0;
                for (int i = 0; i < count; i++) {
                    coordX = float(i)/ numSamplers;
                    sampleUV = vec2(coordX + 0.5 / numSamplers, 0.5);
                    countForThisBin = texture2D(tDiffuse, sampleUV).rg;
                    lumaForThisBin.x = pow(coordX, 2.2);
                    lumaForThisBin.y = exp2(coordX * maxIndex);
                    averageLuma += dot(lumaForThisBin, countForThisBin);
                    samplers += countForThisBin.r + countForThisBin.g;
                }
                gl_FragColor.rgb = vec3(averageLuma / uClampedLuminanceThreshold / samplers, 0., 0.);
                gl_FragColor.a = 1.0;
            `);
    }

    updateShadingUniforms(program: WGLProgram) {
        program.setTexture2D('tDiffuse', this.tDiffuse);
        program.setUniform('uClampedLuminanceThreshold', this.clampedLuminanceThreshold);
    }

    configBlend() {
        this.blending = Blending.NoBlending;
    }
}

export class ExposedToneMappingMaterial extends PassQuadMaterialBase {
    @materialProperty()
    tDiffuse: Texture = Texture2D.default;
    @materialProperty()
    clampedLuminanceThreshold = luminanceThreshold;
    @materialProperty()
    luminanceTexture: Texture = Texture2D.default;
    @materialProperty()
    keyMinuend = 1.3;
    @materialProperty()
    gamma = 2.2;
    @materialProperty()
    multiplier = 1;
    @materialProperty()
    burnValue = 0.8;
    @materialProperty()
    contrast = 0;
    @materialProperty()
    private _enableAutoExposure = 0;

    set enableAutoExposure(value: boolean) {
        this._enableAutoExposure = value ? 1 : 0;
    }

    get enableAutoExposure() {
        return !!this.enableAutoExposure;
    }

    className() {
        return 'ExposedToneMappingMaterial';
    }

    extendShaderShading(b: ShaderBuilder) {
        b.addUniform('tDiffuse', WebGLShaderDataType.Sampler2D)
            .addUniform('uClampedLuminanceThreshold', WebGLShaderDataType.Float)
            .addUniform('keyMinuend', WebGLShaderDataType.Float)
            .addUniform('luminanceTexture', WebGLShaderDataType.Sampler2D)
            .addUniform('enableAutoExposure', WebGLShaderDataType.Float)
            .addUniform('gamma', WebGLShaderDataType.Float)
            .addUniform('multiplier', WebGLShaderDataType.Float)
            .addUniform('burnValue', WebGLShaderDataType.Float)
            .addUniform('contrast', WebGLShaderDataType.Float)
            .addFragment(Luminance)
            .addFragment(ExposedTone)
            .inject(ShaderInjectionTypes.gl_FragColor, fragmentShader);
    }

    updateShadingUniforms(program: WGLProgram) {
        program.setTexture2D('tDiffuse', this.tDiffuse);
        program.setUniform('keyMinuend', this.keyMinuend);
        program.setUniform('enableAutoExposure', this._enableAutoExposure);
        program.setUniform('gamma', this.gamma);
        program.setUniform('multiplier', this.multiplier);
        program.setUniform('burnValue', this.burnValue);
        program.setUniform('contrast', this.contrast);
        program.setTexture2D('luminanceTexture', this.luminanceTexture);
        program.setUniform('uClampedLuminanceThreshold', this.clampedLuminanceThreshold);
    }
}

const Luminance = createShaderBlock(`
float Luminance(vec3 color, float minLuminance)
{
    float lum = dot(color, vec3(0.2126560, 0.7151580, 0.0721856));
    return max(lum, minLuminance);
}
`);

const ExposedTone = createShaderBlock(`
float log10(float x)
{
    float y = 10.0;
    return log2(x) / log2(y);
}
vec3 calcExposedColor(vec3 color, float avglum)
{
    float keyValue = keyMinuend - (2.0 / (2.0 + log10(avglum + 1.0)));
    float linearExposure = (keyValue / avglum);
    float exposure = log2(max(linearExposure, 0.0001));

    return exp2(exposure) * color;
}

vec3 toneMapReinhard(vec3 x){
    float highlights = burnValue * burnValue;
    return x * (1.0 + x * highlights) / (vec3(1.0) + x);
}

float Fnts(float x, float k){
    return (x - x * k) / (k - abs(x) * 2.0 * k + 1.0);
}
float Fc(float x){
    return x * 0.5 + 0.5;
}
float Fd(float x){
    return 2.0 * x - 1.0;
}

float Fnts3(float x, float k1, float k2, float k3){
    return Fd(Fnts(Fc(Fnts(Fd(Fnts(Fc(x), k1)), k2)), k3));
}

float adjustContrast(float x){
    if (contrast == 0.0)
        return x;

    float k = clamp(-contrast, -0.999, 0.999);
    float xp = Fd(clamp(x, 0.0, 1.0));
    float yp = Fnts3(xp, -0.55, k, 0.34);
    return Fc(yp);
}

float gammaCorrect(float x){
    return pow(clamp(x, 0.0, 1.0), gamma);
}

vec3 convertLDR(vec3 color) {
    color *= multiplier;
    color = toneMapReinhard(color);
    color.x = gammaCorrect(color.x);
    color.y = gammaCorrect(color.y);
    color.z = gammaCorrect(color.z);
    color.x = adjustContrast(color.x);
    color.y = adjustContrast(color.y);
    color.z = adjustContrast(color.z);
    return color;
}

`);

const fragmentShader = `

vec4 fragInput = texture2D(tDiffuse, vUv);
vec3 color = fragInput.rgb;
float a = fragInput.a;
if(enableAutoExposure > 0.) {
    float avglum = texture2D(luminanceTexture, vec2(0.5, 0.5)).r * uClampedLuminanceThreshold;
    color = calcExposedColor(color, avglum);
}
gl_FragColor = vec4(convertLDR(color), a);
`;
