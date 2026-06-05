import { PassQuadMaterialBase } from './PassMaterialBase';
import { WebGLShaderDataType } from '../../../renderer/webgl/WGLConstants';
import { ShaderInjectionTypes, type ShaderBuilder } from '../../../renderer/shader/builders/ShaderBuilder';
import type { WGLProgram } from '../../../renderer/webgl/WGLProgram';
import { readonlyMath } from '../../../math/Readonly';
import { materialProperty } from '../../../ContentAPI';
import type { ShaderComponentRegistry } from '../../../scene/ShaderComponentRegistry';
import type { Texture } from '../../textures/Texture';

export class DownsampleMaterial extends PassQuadMaterialBase {
    @materialProperty()
    texelSize = readonlyMath.vec2(1, 1);
    @materialProperty()
    tDiffuse: Texture;
    @materialProperty()
    correctColor = false;

    className() {
        return 'DownsampleMaterial';
    }

    setTexelSize(width: number, height: number) {
        this.texelSize = readonlyMath.vec2(1 / width, 1 / height);
    }

    setTexelZero() {
        this.texelSize = readonlyMath.vec2(0, 0);
    }

    generateShaderKey(registry: ShaderComponentRegistry): string {
        return super.generateShaderKey(registry) + this.correctColor;
    }

    extendShaderShading(b: ShaderBuilder) {
        if (this.correctColor) {
            b.addFragDefine('#define CORRECT_COLOR');
        }
        b.addUniform('texelSize', WebGLShaderDataType.Vec2)
            .addUniform('tDiffuse', WebGLShaderDataType.Sampler2D)
            .inject(
                ShaderInjectionTypes.gl_FragColor,
                `
            vec4 color = vec4(0.0);

            color += texture2D(tDiffuse, vUv + texelSize * vec2(0.0, 0.0)).rgba;
            color += texture2D(tDiffuse, vUv + texelSize * vec2(1.0, 0.0)).rgba;
            color += texture2D(tDiffuse, vUv + texelSize * vec2(0.0, 1.0)).rgba;
            color += texture2D(tDiffuse, vUv + texelSize * vec2(1.0, 1.0)).rgba;
            color *= 0.25;
            #ifdef CORRECT_COLOR
                if(color.a > 0.0)
                {
                  color.rgb /= color.a;
                }
            #endif
            gl_FragColor = color;
            `,
            );
    }

    updateShadingUniforms(p: WGLProgram) {
        p.setUniform('texelSize', this.texelSize);
        p.setTexture2D('tDiffuse', this.tDiffuse);
    }
}
