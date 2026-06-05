import type { WGLProgram } from '../../../renderer/webgl/WGLProgram';
import { WebGLShaderDataType } from '../../../renderer/webgl/WGLConstants';
import { type ShaderBuilder, ShaderInjectionTypes } from '../../../renderer/shader/builders/ShaderBuilder';
import { SceneMaterial } from '../base';

export class PlanarShadowMaterial extends SceneMaterial {
    intensity = 0;

    className() {
        return 'PlanarShadowMaterial';
    }

    updateShadingUniforms(program: WGLProgram): void {
        program.setUniform('intensity', this.intensity);
    }

    extendShaderShading(b: ShaderBuilder) {
        b.addUniform('intensity', WebGLShaderDataType.Float).inject(
            ShaderInjectionTypes.gl_FragColor,
            'gl_FragColor = vec4(vec3(1.0 - intensity), 1.0);',
        );
    }

    copy(other: PlanarShadowMaterial) {
        super.copyBase(other);
        this.intensity = other.intensity;
        return this;
    }

    clone() {
        return new PlanarShadowMaterial().copy(this);
    }
}
