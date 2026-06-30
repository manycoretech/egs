import { PassQuadMaterialBase } from '../../../elements/materials/quad/PassMaterialBase.js';
import type { WGLProgram } from '../../../renderer/webgl/WGLProgram.js';
import { type ShaderBuilder, ShaderInjectionTypes } from '../../../renderer/shader/builders/ShaderBuilder.js';
import { materialProperty } from '../../../ContentAPI.js';
import type { ShaderComponentRegistry } from '../../../scene/ShaderComponentRegistry.js';
import { HashKeyBuilder } from '../../../utils/HashKeyBuilder.js';
import { Texture2D } from '../../textures/Texture2D.js';
import type { Texture } from '../../textures/Texture.js';
import { WebGLShaderDataType } from '../../../renderer/webgl/WGLConstants.js';

export class PseudoColorMaterial extends PassQuadMaterialBase {
    @materialProperty()
    hdr: Texture = Texture2D.default;
    version: number = 0;
    @materialProperty()
    colors: number[] = [0];
    @materialProperty()
    gradations: number[] = [0];

    className() {
        return `PseudoColorMaterial`;
    }

    generateShaderKey(r: ShaderComponentRegistry) {
        return super.generateShaderKey(r) + HashKeyBuilder.getInstance().raw(this.version).getKey();
    }

    updateShadingUniforms(program: WGLProgram) {
        if (!this.colors.length || !this.gradations.length) {
            return;
        }

        program.setTexture2D('hdr', this.hdr);
        program.setUniform('counts', this.colors.length);
        program.setUniform('colors[0]', this.colors);
        program.setUniform('gradations[0]', this.gradations);
    }

    extendShaderShading(b: ShaderBuilder) {
        if (!this.colors.length || !this.gradations.length) {
            return;
        }

        b.addUniform('hdr', WebGLShaderDataType.Sampler2D)
            .addUniform('counts', WebGLShaderDataType.Int)
            .addUniformArray('colors', WebGLShaderDataType.Float, this.colors.length)
            .addUniformArray('gradations', WebGLShaderDataType.Float, this.gradations.length)
            .inject(
                ShaderInjectionTypes.gl_FragColor,
                `
                vec4 luminance = texture2D(hdr, vUv).rgba;
                float grey = dot(luminance.rgb, vec3(0.2126, 0.7152, 0.0722)) * 378.0;
                int hex = 0;
                for (int i = 0; i < counts; i++) {
                    float l = gradations[i];
                    float r;
                    if ((i + 1) == counts) {
                        r = 9999999999.0; // magic infinity number
                    } else {
                        r = gradations[i + 1];
                    }

                    if (grey >= l && grey < r) {
                        hex = int(colors[i]);
                        break;
                    }
                }

                int r = hex >> 16;
                int g = (hex >> 8) - (r << 8);
                int b = hex - (r << 16) - (g << 8);

                gl_FragColor = vec4(float(r) / 256.0, float(g) / 256.0, float(b) / 256.0, luminance.a);
            `,
            );
    }
}
