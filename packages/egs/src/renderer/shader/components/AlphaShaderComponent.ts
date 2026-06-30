import { ShaderComponent } from '../Shader.js';
import type { Nullable } from '../../../utils/Utils.js';
import { type ShaderBuilder, ShaderInjectionTypes, ShaderVaryingTypes } from '../builders/ShaderBuilder.js';
import { WebGLShaderDataType } from '../../webgl/WGLConstants.js';
import type { WGLProgram } from '../../webgl/WGLProgram.js';
import type { Deserializer, Serializer } from '../../../utils/Serialization.js';
import type { Texture2D } from '../../../elements/textures/Texture2D.js';
import { materialProperty } from '../../../ContentAPI.js';
import type { TextureV2 } from '../../../elements/textures/TextureV2.js';

// AlphaShaderComponent controls the transparency of material, which influence opacity in shader.
export class AlphaShaderComponent<T extends Texture2D | TextureV2 = Texture2D> extends ShaderComponent {
    @materialProperty()
    opacity: number = 1;
    @materialProperty()
    texture: Nullable<T> = null;

    constructor() {
        super();
    }

    className() {
        return 'AlphaShaderComponent';
    }

    extendShaderShading(builder: ShaderBuilder): void {
        builder
            .addUniform('u_opacity', WebGLShaderDataType.Float)
            .inject(ShaderInjectionTypes.channel_alpha, 'opacity = u_opacity;');

        if (this.texture !== null) {
            builder
                .addVarying(ShaderVaryingTypes.fragUV)
                .addUniform('alphaMap', WebGLShaderDataType.Sampler2D)
                .inject(ShaderInjectionTypes.channel_alpha, 'opacity *= texture2D( alphaMap, vUv ).a;');
        }
    }

    updateShadingUniforms(program: WGLProgram) {
        program.setUniform('u_opacity', this.opacity);
        if (this.texture !== null) {
            program.setTexture2D('alphaMap', this.texture);
        }
    }

    copy(other: AlphaShaderComponent<T>) {
        this.opacity = other.opacity;
        this.texture = other.texture;
        return this;
    }

    clone() {
        return new AlphaShaderComponent<T>().copy(this);
    }

    deserialize(ctx: Deserializer) {
        ctx.reads<AlphaShaderComponent>(['opacity', 'texture']);
    }

    serialize(ctx: Serializer) {
        ctx.puts<AlphaShaderComponent>(['opacity', 'texture']);
    }
}
