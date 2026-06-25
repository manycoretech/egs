import { PassQuadMaterialBase } from './PassMaterialBase';
import { WebGLShaderDataType } from '../../../renderer/webgl/WGLConstants';
import { type ShaderBuilder, FragOutType, ShaderInjectionTypes } from '../../../renderer/shader/builders/ShaderBuilder';
import type { WGLProgram } from '../../../renderer/webgl/WGLProgram';
import { materialProperty } from '../../../ContentAPI';
import { HashKeyBuilder } from '../../../utils/HashKeyBuilder';
import type { SourceTexture } from '../../textures/SourceTexture';

export class SplatReorderMaterial extends PassQuadMaterialBase {
    transparent = false;

    @materialProperty()
    orderTex: SourceTexture;
    count: number = 0;
    rangeArr: number[] = new Array(128 * 4).fill(0); // start, end, offset, reserved

    className() {
        return 'SplatReorderMaterial';
    }

    generateShaderKey() {
        return HashKeyBuilder.getInstance().raw(this.className()).raw(this.rangeArr.length).getKey();
    }

    extendShaderShading(builder: ShaderBuilder) {
        const { rangeArr } = this;

        builder.addDefaultFragColor = false;
        builder
            .setFragOutputChannel([{ name: 'pc_fragColor_0', type: FragOutType.UVec4 }])
            .addUniform('orderTex', WebGLShaderDataType.USampler2D)
            .addUniform('count', WebGLShaderDataType.Int)
            .addUniformArray('rangeArr', WebGLShaderDataType.IntVec4, (rangeArr.length * 0.25) | 0)
            .inject(
                ShaderInjectionTypes.gl_FragColor,
                `
                ivec2 fragCoord = ivec2(gl_FragCoord.xy);
                int order = int(texelFetch(orderTex, fragCoord, 0).r);
                for (int i = 0; i < count; i++) {
                    ivec4 range = rangeArr[i];
                    int cond = int(order >= range.x) * int(order < range.y);
                    order += cond * range.z;
                }
                pc_fragColor_0 = uvec4(order, 0u, 0u, 0u);
            `,
            );
    }

    updateShadingUniforms(program: WGLProgram) {
        program.setTexture2D('orderTex', this.orderTex);
        program.setUniform('count', this.count);
        program.setUniform('rangeArr[0]', this.rangeArr);
    }
}
