import { PassQuadMaterialBase } from './PassMaterialBase.js';
import { WebGLShaderDataType } from '../../../renderer/webgl/WGLConstants.js';
import {
    ShaderInjectionTypes,
    FragOutType,
    type ShaderBuilder,
} from '../../../renderer/shader/builders/ShaderBuilder.js';
import type { WGLProgram } from '../../../renderer/webgl/WGLProgram.js';
import type { TextureV2 } from '../../textures/TextureV2.js';
import { HashKeyBuilder } from '../../../utils/HashKeyBuilder.js';

export class SplatRepackMaterial extends PassQuadMaterialBase {
    transparent = false;
    count: number = 0;
    sourceTex: TextureV2;
    orderTex: TextureV2;

    constructor(private readonly integerEnabled: boolean = false) {
        super();
    }

    className() {
        return 'SplatRepackMaterial';
    }

    generateShaderKey() {
        return HashKeyBuilder.getInstance().raw(this.className()).bool(this.integerEnabled).getKey();
    }

    extendShaderShading(builder: ShaderBuilder) {
        builder.addDefaultFragColor = false;
        builder
            .setFragOutputChannel([
                { name: 'pc_fragColor', type: this.integerEnabled ? FragOutType.UVec4 : FragOutType.Vec4 },
            ])
            .addUniform(
                'sourceTex',
                this.integerEnabled ? WebGLShaderDataType.USampler2D : WebGLShaderDataType.Sampler2D,
            )
            .addUniform('orderTex', WebGLShaderDataType.USampler2D)
            .addUniform('count', WebGLShaderDataType.Int)
            .addUniform('sourceWidthShift', WebGLShaderDataType.UInt)
            .addUniform('orderWidthShift', WebGLShaderDataType.UInt)
            .inject(
                ShaderInjectionTypes.gl_FragColor,
                `
                ivec2 pixel = ivec2(gl_FragCoord.xy);
                uint rank = (uint(pixel.y) << orderWidthShift) + uint(pixel.x);
                if (rank >= uint(count)) discard;
                uint index = texelFetch(orderTex, pixel, 0).r;
                pc_fragColor = texelFetch(sourceTex, ivec2(index & ((1u << sourceWidthShift) - 1u), index >> sourceWidthShift), 0);
                `,
            );
    }

    updateShadingUniforms(program: WGLProgram) {
        program.setTexture2D('sourceTex', this.sourceTex);
        program.setTexture2D('orderTex', this.orderTex);
        program.setUniform('count', this.count);
        program.setUniform('sourceWidthShift', Math.log2(this.sourceTex.width));
        program.setUniform('orderWidthShift', Math.log2(this.orderTex.width));
    }
}
