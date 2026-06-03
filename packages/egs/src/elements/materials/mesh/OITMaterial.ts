import type { WGLProgram } from '../../../renderer/webgl/WGLProgram';
import { FragOutType, type ShaderBuilder, ShaderInjectionTypes } from '../../../renderer/shader/builders/ShaderBuilder';
import { createShaderBlock } from '../../../renderer/shader/builders/ShaderBlock';
import { Blending, BlendingFactor, BlendingEquation } from '../../../utils/Constants';
import { SceneMaterial } from '../base';

export class OITMaterial extends SceneMaterial {
    constructor() {
        super({
            blending: Blending.CustomBlending,
            blendSrc: BlendingFactor.One,
            blendDst: BlendingFactor.One,
            blendEquation: BlendingEquation.Add,
            blendSrcAlpha: BlendingFactor.Zero,
            blendDstAlpha: BlendingFactor.OneMinusSrcAlpha,
            blendEquationAlpha: BlendingEquation.Add,
            transparent: true,
            depthWrite: false,
        });
    }

    className() {
        return 'OITMaterial';
    }

    extendShaderShading(builder: ShaderBuilder) {
        builder
            .addFragDefine('#define accumColor gl_FragColor')
            .addNewFragOutputChannel('accumAlpha', FragOutType.Float)
            .addFragment(createShaderBlock(`
                float weight(float z, float a) {
                    return clamp(pow(min(1.0, a * 10.0) + 0.01, 3.0) * 1e5 * pow(1.0 - z * 0.9, 3.0), 1e-2, 3e3);
                }
            `))
            .inject(ShaderInjectionTypes.frag_any, `
                float wCi = weight(gl_FragCoord.z, gl_FragColor.a);
                accumColor = vec4(gl_FragColor.rgb * gl_FragColor.a * wCi, gl_FragColor.a);
            `)
            .inject(ShaderInjectionTypes.frag_any, 'accumAlpha = gl_FragColor.a * wCi;');
    }

    updateShadingUniforms(_p: WGLProgram) { }

    copy(other: OITMaterial) {
        super.copyBase(other);
        return this;
    }

    clone() {
        return new OITMaterial().copy(this);
    }
}
