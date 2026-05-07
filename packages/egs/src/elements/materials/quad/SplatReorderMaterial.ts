import { PassQuadMaterialBase } from './PassMaterialBase';
import { WebGLShaderDataType } from '../../../renderer/webgl/WGLConstants';
import { ShaderBuilder, FragOutType, ShaderInjectionTypes } from '../../../renderer/shader/builders/ShaderBuilder';
import { WGLProgram } from '../../../renderer/webgl/WGLProgram';
import { materialProperty } from '../../../ContentAPI';
import { HashKeyBuilder } from '../../../utils/HashKeyBuilder';
import { SourceTexture } from '../../textures/SourceTexture';

export class SplatReorderMaterial extends PassQuadMaterialBase {
    transparent = false;

    @materialProperty()
    orderTex: SourceTexture;
    counts: number = 0;
    startArr: number[] = new Array(256).fill(0);
    endArr: number[] = new Array(256).fill(0);
    offsetArr: number[] = new Array(256).fill(0);

    className() {
        return 'SplatReorderMaterial';
    }

    generateShaderKey() {
        return HashKeyBuilder.getInstance()
            .raw(this.className())
            .raw(this.startArr.length)
            .getKey();
    }

    extendShaderShading(builder: ShaderBuilder) {
        const { startArr, endArr, offsetArr } = this;

        builder.addDefaultFragColor = false;
        builder
            .setFragOutputChannel([
                { name: 'pc_fragColor_0', type: FragOutType.UVec4 },
            ])
            .addUniform('orderTex', WebGLShaderDataType.USampler2D)
            .addUniform('counts', WebGLShaderDataType.Int)
            .addUniformArray('startArr', WebGLShaderDataType.Int, startArr.length)
            .addUniformArray('endArr', WebGLShaderDataType.Int, endArr.length)
            .addUniformArray('offsetArr', WebGLShaderDataType.Int, offsetArr.length)
            .inject(ShaderInjectionTypes.gl_FragColor, `
                ivec2 fragCoord = ivec2(gl_FragCoord.xy);
                int order = int(texelFetch(orderTex, fragCoord, 0).r);
                for (int i = 0; i < counts; i++) {
                    int cond = int(order >= startArr[i]) * int(order < endArr[i]);
                    order += cond * offsetArr[i];
                }
                pc_fragColor_0 = uvec4(order, 0u, 0u, 0u);
            `);
    }

    updateShadingUniforms(program: WGLProgram) {
        program.setTexture2D('orderTex', this.orderTex);
        program.setUniform('counts', this.counts);
        program.setUniform('startArr[0]', this.startArr);
        program.setUniform('endArr[0]', this.endArr);
        program.setUniform('offsetArr[0]', this.offsetArr);
    }
}
