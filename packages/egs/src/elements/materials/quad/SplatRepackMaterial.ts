import { PassQuadMaterialBase } from './PassMaterialBase';
import { ShaderBuilder, ShaderInjectionTypes, FragOutType } from '../../../renderer/shader/builders/ShaderBuilder';
import { WGLProgram } from '../../../renderer/webgl/WGLProgram';
import { WebGLShaderDataType } from '../../../renderer/webgl/WGLConstants';
import { HashKeyBuilder } from '../../../utils/HashKeyBuilder';
import { Vector2 } from '../../../math/Vector2';
import { TextureV2 } from '../../textures/TextureV2';

export class SplatRepackMaterial extends PassQuadMaterialBase {
    transparent = false;

    resolution: Vector2 = new Vector2(0, 0);
    activeSplats: number = 0;
    covTex: TextureV2;
    centerTex: TextureV2;
    orderTex: TextureV2;

    className() {
        return 'SplatRepackMaterial';
    }

    generateShaderKey() {
        return HashKeyBuilder.getInstance()
            .raw(this.className())
            .getKey();
    }

    extendShaderShading(builder: ShaderBuilder) {
        builder.addDefaultFragColor = false;
        builder
            .setFragOutputChannel([
                { name: 'pc_fragColor_0', type: FragOutType.UVec4 },
                { name: 'pc_fragColor_1', type: FragOutType.Vec4 },
            ])
            .addUniform('resolution', WebGLShaderDataType.IntVec2)
            .addUniform('activeSplats', WebGLShaderDataType.UInt)
            .addUniform('covTex', WebGLShaderDataType.USampler2D)
            .addUniform('centerTex', WebGLShaderDataType.Sampler2D)
            .addUniform('packedTexWidth', WebGLShaderDataType.UInt)
            .addUniform('orderTex', WebGLShaderDataType.USampler2D)
            .addUniform('orderTexWidth', WebGLShaderDataType.UInt)
            .inject(ShaderInjectionTypes.gl_FragColor, `
                ivec2 fragCoord = ivec2(gl_FragCoord.xy);
                uint orderIndex = uint(fragCoord.y * resolution.x + fragCoord.x);
                if (orderIndex >= activeSplats) {
                    discard;
                }
                uint splatIndex = texelFetch(orderTex, ivec2(orderIndex % orderTexWidth, orderIndex / orderTexWidth), 0).r;
                ivec2 texCoord = ivec2(splatIndex % packedTexWidth, splatIndex / packedTexWidth);
                pc_fragColor_0 = texelFetch(covTex, texCoord, 0);
                pc_fragColor_1 = texelFetch(centerTex, texCoord, 0);
            `);
    }

    updateShadingUniforms(program: WGLProgram) {
        program.setUniform('resolution', this.resolution);
        program.setUniform('activeSplats', this.activeSplats);
        program.setTexture2D('covTex', this.covTex);
        program.setTexture2D('centerTex', this.centerTex);
        program.setUniform('packedTexWidth', this.centerTex.width);
        program.setTexture2D('orderTex', this.orderTex);
        program.setUniform('orderTexWidth', this.orderTex.width);
    }
}
