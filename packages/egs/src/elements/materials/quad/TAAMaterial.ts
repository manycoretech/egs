import { PassQuadMaterialBase } from './PassMaterialBase';
import { WebGLShaderDataType } from '../../../renderer/webgl/WGLConstants';
import { ShaderInjectionTypes, ShaderBuilder } from '../../../renderer/shader/builders/ShaderBuilder';
import { WGLProgram } from '../../../renderer/webgl/WGLProgram';
import { Texture } from '../../textures/Texture';
import { materialProperty } from '../../../ContentAPI';

export class TAAMaterial extends PassQuadMaterialBase {
    @materialProperty()
    public sampleCount = 0;
    @materialProperty()
    public current: Texture;
    @materialProperty()
    public history: Texture;

    public className() {
        return 'TAAMaterial';
    }

    public extendShaderShading(b: ShaderBuilder) {
        b.addUniform('sampleCount', WebGLShaderDataType.Float)
            .addUniform('history', WebGLShaderDataType.Sampler2D)
            .addUniform('current', WebGLShaderDataType.Sampler2D)
            .inject(ShaderInjectionTypes.gl_FragColor, `
            vec4 color = texture2D(current, vUv);
            vec4 oldColor = texture2D(history, vUv);
            gl_FragColor = (oldColor * sampleCount + color) / (sampleCount + 1.0);`);
    }

    public updateShadingUniforms(program: WGLProgram) {
        program.setTexture2D('history', this.history);
        program.setTexture2D('current', this.current);
        program.setUniform('sampleCount', this.sampleCount);
    }
}
