import { PassQuadMaterialBase } from './PassMaterialBase.js';
import { WebGLShaderDataType } from '../../../renderer/webgl/WGLConstants.js';
import { ShaderInjectionTypes, type ShaderBuilder } from '../../../renderer/shader/builders/ShaderBuilder.js';
import type { WGLProgram } from '../../../renderer/webgl/WGLProgram.js';
import { materialProperty } from '../../../ContentAPI.js';
import type { Texture } from '../../textures/Texture.js';

export class MixPlanarShadowMaterial extends PassQuadMaterialBase {
    @materialProperty()
    tDiffuse: Texture;
    @materialProperty()
    occlusionMap: Texture;

    className() {
        return 'MixPlanarShadowMaterial';
    }

    extendShaderShading(b: ShaderBuilder) {
        b.addUniform('tDiffuse', WebGLShaderDataType.Sampler2D)
            .addUniform('occlusionMap', WebGLShaderDataType.Sampler2D)
            .inject(
                ShaderInjectionTypes.gl_FragColor,
                `
                float a = texture2D(tDiffuse, vUv).r;
                float s = texture2D(occlusionMap, vUv).r;
                gl_FragColor = vec4(0., 0., 0., (1. - a) * (1. - s));
            `,
            );
    }

    updateShadingUniforms(p: WGLProgram) {
        p.setTexture2D('tDiffuse', this.tDiffuse);
        p.setTexture2D('occlusionMap', this.occlusionMap);
    }
}
