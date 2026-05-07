import { ShaderComponent } from '../Shader';
import { Nullable } from '../../../utils/Utils';
import { ShaderBuilder, ShaderInjectionTypes, ShaderVaryingTypes } from '../builders/ShaderBuilder';
import { WebGLShaderDataType } from '../../webgl/WGLConstants';
import { WGLProgram } from '../../webgl/WGLProgram';
import { Serializer, Deserializer } from '../../../utils/Serialization';
import { Texture2D } from '../../../elements/textures/Texture2D';
import { readonlyMath } from '../../../math/Readonly';
import { ReadonlyColor } from '../../../math/Color';
import { materialProperty } from '../../../ContentAPI';
import { TextureV2 } from '../../../elements/textures/TextureV2';

// ColorShaderComponent controls the use of common 2D texture,
// which takes sample from texture with the UV coordinates data.
export class ColorShaderComponent<T extends Texture2D | TextureV2 = Texture2D> extends ShaderComponent {
    @materialProperty()
    public color: ReadonlyColor = readonlyMath.color(0xffffff);
    @materialProperty()
    public texture: Nullable<T> = null;

    constructor() {
        super();
    }

    public className() {
        return 'ColorShaderComponent';
    }

    public extendShaderShading(builder: ShaderBuilder): void {
        builder.addUniform('u_color', WebGLShaderDataType.Vec3)
            .inject(ShaderInjectionTypes.channel_color, 'color = u_color;');

        if (this.texture !== null) {
            builder.addVarying(ShaderVaryingTypes.fragUV)
                .addUniform('map', WebGLShaderDataType.Sampler2D)
                .inject(ShaderInjectionTypes.channel_color, 'color *= texture2D( map, vUv ).xyz;'); // TODO mapTexelToLinear
        }
    }

    public updateShadingUniforms(program: WGLProgram) {
        program.setUniform('u_color', this.color);
        if (this.texture !== null) {
            program.setTexture2D('map', this.texture);
        }
    }

    public copy(other: ColorShaderComponent<T>) {
        this.color = other.color;
        this.texture = other.texture;
        return this;
    }

    public clone() {
        return new ColorShaderComponent<T>().copy(this);
    }

    public serialize(ctx: Serializer) {
        ctx.puts<ColorShaderComponent>(['texture', 'color']);
    }

    public deserialize(ctx: Deserializer) {
        ctx.reads<ColorShaderComponent>(['texture', 'color']);
    }
}
