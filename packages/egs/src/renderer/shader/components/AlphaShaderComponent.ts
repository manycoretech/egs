import { ShaderComponent } from '../Shader';
import { Nullable } from '../../../utils/Utils';
import { ShaderBuilder, ShaderInjectionTypes, ShaderVaryingTypes } from '../builders/ShaderBuilder';
import { WebGLShaderDataType } from '../../webgl/WGLConstants';
import { WGLProgram } from '../../webgl/WGLProgram';
import { Deserializer, Serializer } from '../../../utils/Serialization';
import { Texture2D } from '../../../elements/textures/Texture2D';
import { materialProperty } from '../../../ContentAPI';
import { TextureV2 } from '../../../elements/textures/TextureV2';

// AlphaShaderComponent controls the transparency of material, which influence opacity in shader.
export class AlphaShaderComponent<T extends Texture2D | TextureV2 = Texture2D> extends ShaderComponent {
    @materialProperty()
    public opacity: number = 1;
    @materialProperty()
    public texture: Nullable<T> = null;

    constructor() {
        super();
    }

    public className() {
        return 'AlphaShaderComponent';
    }

    public extendShaderShading(builder: ShaderBuilder): void {
        builder
            .addUniform('u_opacity', WebGLShaderDataType.Float)
            .inject(ShaderInjectionTypes.channel_alpha, 'opacity = u_opacity;');

        if (this.texture !== null) {
            builder.addVarying(ShaderVaryingTypes.fragUV)
                .addUniform('alphaMap', WebGLShaderDataType.Sampler2D)
                .inject(ShaderInjectionTypes.channel_alpha, 'opacity *= texture2D( alphaMap, vUv ).a;');
        }
    }

    public updateShadingUniforms(program: WGLProgram) {
        program.setUniform('u_opacity', this.opacity);
        if (this.texture !== null) {
            program.setTexture2D('alphaMap', this.texture);
        }
    }

    public copy(other: AlphaShaderComponent<T>) {
        this.opacity = other.opacity;
        this.texture = other.texture;
        return this;
    }

    public clone() {
        return new AlphaShaderComponent<T>().copy(this);
    }

    public deserialize(ctx: Deserializer) {
        ctx.reads<AlphaShaderComponent>(['opacity', 'texture']);
    }

    public serialize(ctx: Serializer) {
        ctx.puts<AlphaShaderComponent>(['opacity', 'texture']);
    }
}
