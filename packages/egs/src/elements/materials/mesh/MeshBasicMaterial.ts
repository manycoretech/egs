
import { WGLProgram } from '../../../renderer/webgl/WGLProgram';
import { Utils, Nullable } from '../../../utils/Utils';
import { ShaderBuilder, ShaderInjectionTypes, ShaderVaryingTypes } from '../../../renderer/shader/builders/ShaderBuilder';
import { MaterialParameters } from '../Material';
import { ColorShaderComponent } from '../../../renderer/shader/components/ColorShaderComponent';
import { AlphaShaderComponent } from '../../../renderer/shader/components/AlphaShaderComponent';
import { Serializer, Deserializer } from '../../../utils/Serialization';
import { HashKeyBuilder } from '../../../utils/HashKeyBuilder';
import { ShaderComponentRegistry } from '../../../scene/ShaderComponentRegistry';
import { Color } from '../../../math/Color';
import { shaderComponentInMaterial, materialProperty } from '../../../ContentAPI';
import { ReadonlyMatrix3 } from '../../../math/Matrix3';
import { readonlyMath } from '../../../math/Readonly';
import { WebGLShaderDataType } from '../../../renderer/webgl/WGLConstants';
import { SceneClipMaterial } from '../base';
import { Texture2D } from '../../textures/Texture2D';
import { TextureV2 } from '../../textures/TextureV2';
import { Texture } from '../../textures/Texture';

export type MeshBasicMaterialParameters<T extends Texture2D | TextureV2 = Texture2D> = MaterialParameters & {
    color?: number | string | Color,
    opacity?: number,
    texture?: Nullable<T>,
    uvTransform?: ReadonlyMatrix3,
    enableVertexColor?: boolean,
};
/**
 * A material for drawing geometries in a simple shaded way.
 * This material is not affected by lights.
 */
export class MeshBasicMaterial<T extends Texture2D | TextureV2 = Texture2D> extends SceneClipMaterial {
    isMeshBasicMaterial: boolean = true;
    /**
     * The basic color of object. User can set texture by this.
     * @tips change the color by {@link setValues| setValues()} that is a better way.
     */
    @shaderComponentInMaterial()
    readonly color: ColorShaderComponent<T> = new ColorShaderComponent();
    /**
     * The Transparency of object.
     * @tips change the alpha by {@link setValues| setValues()} that is a better way.
     */
    @shaderComponentInMaterial()
    readonly alpha: AlphaShaderComponent<T> = new AlphaShaderComponent();
    /**
     * Change the uv data by this matrix.
     */
    @materialProperty()
    uvTransform = readonlyMath.mat3();
    @materialProperty()
    enableVertexColor: boolean = false;

    /**
     * The name of instance's class.
     */
    className() {
        return 'MeshBasicMaterial';
    }

    constructor(p?: MeshBasicMaterialParameters<T>) {
        super();
        this.setValues(p);
    }
    /**
     * Change the corresponding attribute according to the values of given {@link MeshBasicMaterialParameters| parameters}.
     * @param {MeshBasicMaterialParameters} values a object of specified type contains parameters.
     */
    setValues(values?: MeshBasicMaterialParameters<T>) {
        if (values === undefined) {
            return;
        }
        super.setValues(values);
        Utils.copyProperty('color', 'color', this.color, values);
        Utils.copyProperty('opacity', 'opacity', this.alpha, values);
        if (Utils.isShaderMayChanged(this.color.texture, values.texture)) {
            this.notifyRecompileShader();
        }
        Utils.copyProperty('texture', 'texture', this.color, values);
        Utils.copyProperty('uvTransform', 'uvTransform', this, values);
        Utils.copyProperty('enableVertexColor', 'enableVertexColor', this, values);
    }
    /**
     * @internal
     */
    extendShaderShading(builder: ShaderBuilder) {
        if (this.enableVertexColor) {
            builder
                .addVarying(ShaderVaryingTypes.vertexColor)
                .inject(ShaderInjectionTypes.channel_color, 'color.rgb *= vColor;')
                .inject(ShaderInjectionTypes.gl_FragColor, 'gl_FragColor = vec4(color, 1.0);');
            return;
        }
        builder
            .extend(this.color)
            .extend(this.alpha)
            .addUniform('uvTransform', WebGLShaderDataType.Mat3)
            .addVarying(ShaderVaryingTypes.fragUV)
            .inject(ShaderInjectionTypes.vary_uv, `vUv = (uvTransform * vec3(uv, 1.0)).xy;`)
            .inject(ShaderInjectionTypes.gl_FragColor, 'gl_FragColor = vec4(color, opacity);');
    }

    traverseTexture(visitor: (tex: Texture) => void) {
        super.traverseTexture(visitor);
        Utils.visitTexture([this.color.texture, this.alpha.texture], visitor);
    }
    /**
     * Generate a key for texture of material, and engine will refresh texture if it is changed.
     * This method may override in extended class.
     * @internal
     */
    generateShaderKey(r: ShaderComponentRegistry) {
        return super.generateShaderKey(r) + HashKeyBuilder.getInstance()
            .hasItem(this.color.texture)
            .hasItem(this.alpha.texture)
            .bool(this.enableVertexColor)
            .getKey();
    }
    /**
     * @internal
     */
    updateShadingUniforms(program: WGLProgram) {
        if (this.enableVertexColor) {
            return;
        }
        this.color.updateShadingUniforms(program);
        this.alpha.updateShadingUniforms(program);
        program.setUniform('uvTransform', this.uvTransform, true);
    }
    /**
     * Copy the data to this instance from other instance.
     * @param {MeshBasicMaterial} other the source of copied data
     */
    copy(other: MeshBasicMaterial<T>) {
        super.copyBase(other);
        this.color.copy(other.color);
        this.alpha.copy(other.alpha);
        return this;
    }
    /**
     * Return a cloned instance of this class.
     */
    clone(): MeshBasicMaterial<T> {
        return new MeshBasicMaterial<T>().copy(this);
    }
    /**
     * Store the attributes of this class into string as serializing format.
     * @param {Serializer} ctx an instance used to store the data of scene objects.
     */
    serialize(ctx: Serializer) {
        super.serialize(ctx);
        ctx.puts<MeshBasicMaterial>(['color', 'alpha', 'uvTransform', 'enableVertexColor']);
    }
    /**
     * Parse the data for this class from string according to serializing format.
     * @param {Deserializer} ctx an instance give the method to take the data for attribute.
     */
    deserialize(ctx: Deserializer) {
        super.deserialize(ctx);
        ctx.reads<MeshBasicMaterial>(['color', 'alpha', 'uvTransform', 'enableVertexColor']);
    }
}
