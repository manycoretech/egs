import { PassQuadMaterialBase } from './PassMaterialBase';
import { _Math } from '../../../math/Math';
import { WebGLShaderDataType } from '../../../renderer/webgl/WGLConstants';
import { WGLProgram } from '../../../renderer/webgl/WGLProgram';
import { ShaderInjectionTypes, ShaderBuilder } from '../../../renderer/shader/builders/ShaderBuilder';
import { createShaderBlock } from '../../../renderer/shader/builders/ShaderBlock';
import { readonlyMath } from '../../../math/Readonly';
import { ShaderComponentRegistry } from '../../../scene/ShaderComponentRegistry';
import { materialProperty } from '../../../ContentAPI';
import { Texture } from '../../textures/Texture';

export class BlurPassMaterial extends PassQuadMaterialBase {
    @materialProperty()
    public tDiffuse: Texture;
    @materialProperty()
    public weights = _Math.ComputeGaussianWeights(4);
    @materialProperty()
    public texelSize = readonlyMath.vec2();
    @materialProperty()
    public direction = readonlyMath.vec2(1, 0);
    public kernelSize = 9;
    private kernelRadius = 4;

    public className() {
        return 'BlurPassMaterial';
    }

    get blurKernelRadius() {
        return this.kernelRadius;
    }

    public generateShaderKey(r: ShaderComponentRegistry) {
        return super.generateShaderKey(r) + this.kernelRadius;
    }

    set blurKernelRadius(value: number) {
        this.kernelRadius = value;
        const kernelSize = 2 * value + 1;
        this.kernelRadius = value;
        this.kernelSize = kernelSize;
        this.weights = _Math.ComputeGaussianWeights(value);
        this.notifyRecompileShader();
    }

    public setTexelSize(width: number, height: number) {
        this.texelSize = readonlyMath.vec2(1 / width, 1 / height);
    }
    public extendShaderShading(b: ShaderBuilder) {
        b.addUniform('tDiffuse', WebGLShaderDataType.Sampler2D)
            .addUniformArray('weights', WebGLShaderDataType.Float, this.weights.length)
            .addUniform('texelSize', WebGLShaderDataType.Vec2)
            .addUniform('direction', WebGLShaderDataType.Vec2)
            .addFragment(BlurPassFrag)
            .inject(ShaderInjectionTypes.gl_FragColor, `
                vec2 sampleOffset = texelSize * direction;
                vec2 offset = 0.5 * float(${this.kernelSize} - 1) * sampleOffset;
                vec2 uv = vUv - offset;
                vec4 sample0 = getSample(uv);
                vec4 sample1 = getSample(uv + sampleOffset);
                vec4 sum = lin_space(weights[0], sample0, weights[1], sample1);
                for (int i = 2; i < ${this.kernelSize}; ++i) {
                    vec4 samples = getSample(uv + float(i) * sampleOffset);
                    sum = lin_space(1.0, sum, weights[i], samples);
                }
                gl_FragColor = sum;
            `);

    }

    public updateShadingUniforms(p: WGLProgram) {
        p.setTexture2D('tDiffuse', this.tDiffuse);
        p.setUniform('weights[0]', this.weights);
        p.setUniform('texelSize', this.texelSize);
        p.setUniform('direction', this.direction);
    }
}

const BlurPassFrag = createShaderBlock(`
vec4 lin_space(float w0, vec4 d0, float w1, vec4 d1) {
    return (w0 * d0 + w1 * d1);
}
vec4 getSample(vec2 uv) {
    return texture2D(tDiffuse, uv);
}`);
