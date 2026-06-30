import { PassQuadMaterialBase } from './PassMaterialBase.js';
import { ShaderBuilder, ShaderInjectionTypes, FragOutType } from '../../../renderer/shader/builders/ShaderBuilder.js';
import { WGLProgram } from '../../../renderer/webgl/WGLProgram.js';
import { WebGLShaderDataType } from '../../../renderer/webgl/WGLConstants.js';
import { HashKeyBuilder } from '../../../utils/HashKeyBuilder.js';
import { Vector2 } from '../../../math/Vector2.js';
import { TextureV2 } from '../../textures/TextureV2.js';

export class SplatPackSortedLayoutMaterial extends PassQuadMaterialBase {
    transparent = false;

    highPrecisionEnabled: boolean = false;

    resolution: Vector2 = new Vector2(0, 0);
    count: number = 0;
    centerTex: TextureV2;
    covTex: TextureV2;
    covExtTex: TextureV2;
    orderTex: TextureV2;

    className() {
        return 'SplatPackSortedLayoutMaterial';
    }

    generateShaderKey() {
        return HashKeyBuilder.getInstance().raw(this.className()).bool(this.highPrecisionEnabled).getKey();
    }

    extendShaderShading(builder: ShaderBuilder) {
        const { highPrecisionEnabled } = this;
        builder.addDefaultFragColor = false;
        builder
            .setFragOutputChannel([
                { name: 'pc_fragColor_0', type: FragOutType.Vec4 },
                { name: 'pc_fragColor_1', type: FragOutType.UVec4 },
            ])
            .when(highPrecisionEnabled, builder =>
                builder
                    .addNewFragOutputChannel('pc_fragColor_2', FragOutType.UVec4)
                    .addUniform('covExtTex', WebGLShaderDataType.USampler2D),
            )
            .addUniform('resolution', WebGLShaderDataType.IntVec2)
            .addUniform('count', WebGLShaderDataType.UInt)
            .addUniform('covTex', WebGLShaderDataType.USampler2D)
            .addUniform('centerTex', WebGLShaderDataType.Sampler2D)
            .addUniform('packedTexWidth', WebGLShaderDataType.UInt)
            .addUniform('orderTex', WebGLShaderDataType.USampler2D)
            .addUniform('orderTexWidth', WebGLShaderDataType.UInt)
            .inject(
                ShaderInjectionTypes.gl_FragColor,
                `
                    ivec2 fragCoord = ivec2(gl_FragCoord.xy);
                    uint orderIndex = uint(fragCoord.y * resolution.x + fragCoord.x);
                    if (orderIndex >= count) {
                        discard;
                    }
                    uint splatIndex = texelFetch(orderTex, ivec2(orderIndex % orderTexWidth, orderIndex / orderTexWidth), 0).r;
                    ivec2 texCoord = ivec2(splatIndex % packedTexWidth, splatIndex / packedTexWidth);
                    pc_fragColor_0 = texelFetch(centerTex, texCoord, 0);
                    pc_fragColor_1 = texelFetch(covTex, texCoord, 0);
                    ${highPrecisionEnabled ? `pc_fragColor_2 = texelFetch(covExtTex, texCoord, 0);` : ''}
                `,
            );
    }

    updateShadingUniforms(program: WGLProgram) {
        program.setUniform('resolution', this.resolution);
        program.setUniform('count', this.count);
        program.setTexture2D('centerTex', this.centerTex);
        program.setTexture2D('covTex', this.covTex);
        if (this.highPrecisionEnabled) {
            program.setTexture2D('covExtTex', this.covExtTex);
        }
        program.setUniform('packedTexWidth', this.centerTex.width);
        program.setTexture2D('orderTex', this.orderTex);
        program.setUniform('orderTexWidth', this.orderTex.width);
    }
}
