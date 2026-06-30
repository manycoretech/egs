import { PassQuadMaterialBase } from './PassMaterialBase.js';
import { WebGLShaderDataType } from '../../../renderer/webgl/WGLConstants.js';
import { ShaderInjectionTypes, type ShaderBuilder } from '../../../renderer/shader/builders/ShaderBuilder.js';
import type { WGLProgram } from '../../../renderer/webgl/WGLProgram.js';
import type { Texture } from '../../textures/Texture.js';
import { materialProperty } from '../../../ContentAPI.js';

export class TAAMaterial extends PassQuadMaterialBase {
    @materialProperty()
    sampleCount = 0;
    @materialProperty()
    current: Texture;
    @materialProperty()
    history: Texture;

    className() {
        return 'TAAMaterial';
    }

    extendShaderShading(b: ShaderBuilder) {
        b.addUniform('sampleCount', WebGLShaderDataType.Float)
            .addUniform('history', WebGLShaderDataType.Sampler2D)
            .addUniform('current', WebGLShaderDataType.Sampler2D)
            .inject(
                ShaderInjectionTypes.gl_FragColor,
                `
            vec4 color = texture2D(current, vUv);
            vec4 oldColor = texture2D(history, vUv);
            gl_FragColor = (oldColor * sampleCount + color) / (sampleCount + 1.0);`,
            );
    }

    updateShadingUniforms(program: WGLProgram) {
        program.setTexture2D('history', this.history);
        program.setTexture2D('current', this.current);
        program.setUniform('sampleCount', this.sampleCount);
    }
}
