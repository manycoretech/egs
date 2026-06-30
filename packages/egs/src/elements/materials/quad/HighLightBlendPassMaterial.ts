import { PassQuadMaterialBase } from './PassMaterialBase.js';
import { WebGLShaderDataType } from '../../../renderer/webgl/WGLConstants.js';
import type { WGLProgram } from '../../../renderer/webgl/WGLProgram.js';
import { ShaderInjectionTypes, type ShaderBuilder } from '../../../renderer/shader/builders/ShaderBuilder.js';
import type { Texture } from '../../textures/Texture.js';
import { readonlyMath } from '../../../math/Readonly.js';
import { materialProperty } from '../../../ContentAPI.js';

export class HighLightBlendPassMaterial extends PassQuadMaterialBase {
    @materialProperty()
    map: Texture;
    @materialProperty()
    texelSize = readonlyMath.vec2(1, 1);
    @materialProperty()
    width = 5;
    @materialProperty()
    borderColor = readonlyMath.color();
    @materialProperty()
    borderOpacity = 1.0;
    @materialProperty()
    innerColor = readonlyMath.color();
    @materialProperty()
    innerOpacity = 0.0;
    @materialProperty()
    hightQuality = true;

    className() {
        return 'HighLightBlendPassMaterial';
    }

    setTexelSize(width: number, height: number) {
        this.texelSize = readonlyMath.vec2(1 / width, 1 / height);
    }

    extendShaderShading(builder: ShaderBuilder) {
        builder
            .addUniform('map', WebGLShaderDataType.Sampler2D)
            .addUniform('texelSize', WebGLShaderDataType.Vec2)
            .addUniform('width', WebGLShaderDataType.Float)
            .addUniform('innerColor', WebGLShaderDataType.Vec3)
            .addUniform('innerOpacity', WebGLShaderDataType.Float)
            .addUniform('borderColor', WebGLShaderDataType.Vec3)
            .addUniform('borderOpacity', WebGLShaderDataType.Float)
            .inject(ShaderInjectionTypes.gl_FragColor, createFragment(this.hightQuality));
    }

    updateShadingUniforms(program: WGLProgram) {
        program.setTexture2D('map', this.map);
        program.setUniform('texelSize', this.texelSize);
        program.setUniform('width', this.width);
        program.setUniform('innerColor', this.innerColor);
        program.setUniform('innerOpacity', this.innerOpacity);
        program.setUniform('borderColor', this.borderColor);
        program.setUniform('borderOpacity', this.borderOpacity);
    }
}

function createFragment(hightQuality: boolean) {
    return `
        float alpha = 0.0;
        vec2 offset = width * texelSize;

        ${
            hightQuality
                ? `
            float sum = 0.0;
            // sample near the border and give them higher weight
            sum += 8.0 * texture2D(map, vUv + vec2(texelSize.x, 0.0)).r;               // sample around the frag
            sum += 8.0 * texture2D(map, vUv + vec2(-texelSize.x, 0.0)).r;              //   *
            sum += 8.0 * texture2D(map, vUv + vec2(0.0, texelSize.y)).r;               // * O *
            sum += 8.0 * texture2D(map, vUv + vec2(0.0, -texelSize.y)).r;              //   *
            // make the width of the border give them lower weight, because we want when you see it far away ,it also have some border
            #define CIRCLE_SAMPLES 32
            for (int i = 0; i < CIRCLE_SAMPLES; i++) {
                float angle = PI2 * float(i) / float(CIRCLE_SAMPLES);
                vec2 p = vUv + vec2(offset.x * cos(angle), offset.y * sin(angle));
                sum += texture2D(map, p).r * 0.5;
            }
            // mix the sample result by weight
            float MAX_SAMPLER_NUM = 32.0 + float(CIRCLE_SAMPLES) * 0.5;  // max sample num
            float weight = 1.0 - clamp(sum / MAX_SAMPLER_NUM, 0.0, 1.0);
            // smooth the result to make AA
            alpha = -sin(PI2 * weight);
        `
                : `
            float sum = 0.0;
            // sample around the frag, if any sample is not zero, this texel is on the line.
            sum += texture2D(map, vUv + vec2(offset.x, 0)).r;
            sum += texture2D(map, vUv + vec2(-offset.x, 0)).r;
            sum += texture2D(map, vUv + vec2(0, -offset.y)).r;
            sum += texture2D(map, vUv + vec2(0, -offset.y)).r;
            offset = offset * 0.7071; // sin(PI * 0.25)
            sum += texture2D(map, vUv + vec2(offset.x, offset.y)).r;
            sum += texture2D(map, vUv + vec2(-offset.x, offset.y)).r;
            sum += texture2D(map, vUv + vec2(offset.x, -offset.y)).r;
            sum += texture2D(map, vUv + vec2(-offset.x, -offset.y)).r;
            alpha = 1.0 - step(sum, 0.1);
        `
        }

        float edge = step(0.5, texture2D(map, vUv).r);
        gl_FragColor = (1.0 - edge) * vec4(borderColor, alpha * borderOpacity) + edge * vec4(innerColor, innerOpacity);
    `;
}
