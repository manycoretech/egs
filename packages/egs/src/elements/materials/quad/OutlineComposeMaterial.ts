import { PassQuadMaterialBase } from './PassMaterialBase.js';
import { WebGLShaderDataType } from '../../../renderer/webgl/WGLConstants.js';
import { ShaderInjectionTypes, type ShaderBuilder } from '../../../renderer/shader/builders/ShaderBuilder.js';
import type { WGLProgram } from '../../../renderer/webgl/WGLProgram.js';
import { readonlyMath } from '../../../math/Readonly.js';
import { materialProperty } from '../../../ContentAPI.js';
import type { Texture } from '../../textures/Texture.js';
import { HashKeyBuilder } from '../../../utils/HashKeyBuilder.js';

export class OutlineComposeMaterial extends PassQuadMaterialBase {
    @materialProperty()
    tDiffuse: Texture;
    @materialProperty()
    texelSize = readonlyMath.vec2(1, 1);
    @materialProperty()
    color = readonlyMath.color(0);
    @materialProperty()
    highQuality = true;

    className() {
        return 'OutlineComposeMaterial';
    }

    setTexelSize(width: number, height: number) {
        this.texelSize = readonlyMath.vec2(1 / width, 1 / height);
    }

    generateShaderKey() {
        return HashKeyBuilder.getInstance().raw(this.className()).bool(this.highQuality).getKey();
    }

    extendShaderShading(builder: ShaderBuilder) {
        builder.addUniform('color', WebGLShaderDataType.Vec3).addUniform('tDiffuse', WebGLShaderDataType.Sampler2D);
        if (this.highQuality) {
            builder.addUniform('texelSize', WebGLShaderDataType.Vec2).inject(
                ShaderInjectionTypes.gl_FragColor,
                `
                    float edge = 0.0;
                    edge += texture2D(tDiffuse, vUv + texelSize * vec2(0.0, 0.0)).r;
                    edge += texture2D(tDiffuse, vUv + texelSize * vec2(1.0, 0.0)).r;
                    edge += texture2D(tDiffuse, vUv + texelSize * vec2(0.0, 1.0)).r;
                    edge += texture2D(tDiffuse, vUv + texelSize * vec2(1.0, 1.0)).r;
                    edge *= 0.25;
                    gl_FragColor = vec4(color, edge);
                `,
            );
        } else {
            builder.inject(
                ShaderInjectionTypes.gl_FragColor,
                `
                    float edge = texture2D(tDiffuse, vUv).r;
                    gl_FragColor = vec4(color, edge);
                `,
            );
        }
    }

    updateShadingUniforms(p: WGLProgram) {
        p.setUniform('color', this.color);
        p.setTexture2D('tDiffuse', this.tDiffuse);
        if (this.highQuality) {
            p.setUniform('texelSize', this.texelSize);
        }
    }
}
