import { PassQuadMaterialBase } from './PassMaterialBase.js';
import { WebGLShaderDataType } from '../../../renderer/webgl/WGLConstants.js';
import {
    ShaderInjectionTypes,
    type ShaderBuilder,
    ShaderVaryingTypes,
} from '../../../renderer/shader/builders/ShaderBuilder.js';
import type { WGLProgram } from '../../../renderer/webgl/WGLProgram.js';
import { materialProperty } from '../../../ContentAPI.js';
import type { Texture } from '../../textures/Texture.js';
import { Blending, BlendingFactor } from '../../../utils/Constants.js';

export class MixOITMaterial extends PassQuadMaterialBase {
    @materialProperty()
    accumColor: Texture;
    @materialProperty()
    accumAlpha: Texture;

    constructor() {
        super({
            blending: Blending.CustomBlending,
            blendSrc: BlendingFactor.One,
            blendDst: BlendingFactor.OneMinusSrcAlpha,
        });
    }

    className() {
        return 'MixOITMaterial';
    }

    extendShaderShading(b: ShaderBuilder) {
        b.addVarying(ShaderVaryingTypes.fragUV)
            .addUniform('tAccumColor', WebGLShaderDataType.Sampler2D)
            .addUniform('tAccumAlpha', WebGLShaderDataType.Sampler2D)
            .inject(
                ShaderInjectionTypes.gl_FragColor,
                `
                vec4 color = vec4(0.0);
                ivec2 texelCoord = ivec2(vUv * vec2(textureSize(tAccumColor, 0)));
                vec4 accum = texelFetch(tAccumColor, texelCoord, 0);
                float a = 1.0 - accum.a;
                accum.a = texelFetch(tAccumAlpha, texelCoord, 0).r;
                gl_FragColor = vec4(a * accum.rgb / clamp(accum.a, 0.001, 50000.0), a);
            `,
            );
    }

    updateShadingUniforms(p: WGLProgram) {
        p.setTexture2D('tAccumColor', this.accumColor);
        p.setTexture2D('tAccumAlpha', this.accumAlpha);
    }
}
