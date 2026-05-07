import { PassQuadMaterialBase } from './PassMaterialBase';
import { WebGLShaderDataType } from '../../../renderer/webgl/WGLConstants';
import { ShaderInjectionTypes, ShaderBuilder } from '../../../renderer/shader/builders/ShaderBuilder';
import { WGLProgram } from '../../../renderer/webgl/WGLProgram';
import { materialProperty } from '../../../ContentAPI';
import { Texture } from '../../textures/Texture';

export class MixPlanarShadowMaterial extends PassQuadMaterialBase {
    @materialProperty()
    public tDiffuse: Texture;
    @materialProperty()
    public occlusionMap: Texture;

    public className() {
        return 'MixPlanarShadowMaterial';
    }

    public extendShaderShading(b: ShaderBuilder) {
        b
            .addUniform('tDiffuse', WebGLShaderDataType.Sampler2D)
            .addUniform('occlusionMap', WebGLShaderDataType.Sampler2D)
            .inject(ShaderInjectionTypes.gl_FragColor, `
                float a = texture2D(tDiffuse, vUv).r;
                float s = texture2D(occlusionMap, vUv).r;
                gl_FragColor = vec4(0., 0., 0., (1. - a) * (1. - s));
            `);
    }

    public updateShadingUniforms(p: WGLProgram) {
        p.setTexture2D('tDiffuse', this.tDiffuse);
        p.setTexture2D('occlusionMap', this.occlusionMap);
    }
}
