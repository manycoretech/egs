import { WGLProgram } from '../../../renderer/webgl/WGLProgram';
import { ShaderBuilder, ShaderVaryingTypes, ShaderInjectionTypes } from '../../../renderer/shader/builders/ShaderBuilder';
import { WebGLShaderDataType } from '../../../renderer/webgl/WGLConstants';
import { Material, MaterialParameters, ConvertMaterialParameters } from '../Material';
import { Serializer, Deserializer } from '../../../utils/Serialization';
import { BuiltInUniformTypes } from '../../../renderer/RenderState/BuiltInUniforms';
import { HashKeyBuilder } from '../../../utils/HashKeyBuilder';
import { Utils, Nullable } from '../../../utils/Utils';
import { Sprite } from '../../../scene/drawables/Sprite';
import { ShaderComponentRegistry } from '../../../scene/ShaderComponentRegistry';
import { readonlyMath } from '../../../math/Readonly';
import { materialProperty } from '../../../ContentAPI';
import { Texture2D } from '../../textures/Texture2D';
import { TextureV2 } from '../../textures/TextureV2';
import { Texture } from '../../textures/Texture';

export type SpriteMaterialParameters<T extends Texture2D | TextureV2 = Texture2D> = MaterialParameters
    & ConvertMaterialParameters<Pick<SpriteMaterial<T>, 'sizeAttenuation' | 'rotation' | 'texture' | 'opacity' | 'color'>>;

const keys = ['sizeAttenuation', 'rotation', 'texture', 'opacity', 'color'];
/**
 * A dedicated material of {@link Sprite| Sprite}.
 */
export class SpriteMaterial<T extends Texture2D | TextureV2 = Texture2D> extends Material {
    /**
     * Whether the size of the sprite is attenuated by the camera depth. (Perspective camera only.)
     * @defaultValue `false`
     */
    @materialProperty()
    public sizeAttenuation = false;
    /**
     * The rotation of the sprite in radians.
     * @defaultValue `0`
     */
    @materialProperty()
    public rotation = 0;
    /**
     * Color of the material, by default set to white (0xffffff).
     * The value of color multiply with the color of {@link texture| texture}.
     */
    @materialProperty()
    public color = readonlyMath.color();
    /**
     * A picture for sprite.
     * @defaultValue `null`
     */
    @materialProperty()
    public texture: Nullable<T> = null;
    /**
     * The Transparency of object.
     * @defaultValue `null`
     */
    @materialProperty()
    public opacity = 1;
    /**
     * The name of instance's class.
     */
    public className() {
        return 'SpriteMaterial';
    }

    constructor(p: SpriteMaterialParameters<T> = {}) {
        super();
        this.transparent = true;
        this.setValues(p);
    }
    /**
     * Change the corresponding attribute according to the values of given {@link SpriteMaterialParameters| parameters}.
     * @param {SpriteMaterialParameters} p a object of specified type contains parameters.
     */
    public setValues(p: SpriteMaterialParameters<T>) {
        if (p === undefined) {
            return;
        }
        super.setValues(p);
        Utils.copyProperties(keys, this, p);
    }

    public traverseTexture(visitor: (tex: Texture) => void) {
        super.traverseTexture(visitor);
        Utils.visitTexture([this.texture], visitor);
    }
    /**
     * @internal
     */
    public generateShaderKey(r: ShaderComponentRegistry) {
        return super.generateShaderKey(r) + HashKeyBuilder.getInstance()
            .bool(this.sizeAttenuation)
            .hasItem(this.texture)
            .getKey();
    }
    /**
     * Store the attributes of this class into string as serializing format.
     * @param {Serializer} ctx an instance used to store the data of scene objects.
     */
    public serialize(ctx: Serializer) {
        super.serialize(ctx);
        ctx.puts<SpriteMaterial>(['sizeAttenuation', 'rotation', 'texture', 'opacity', 'color']);
    }
    /**
     * Parse the data for this class from string according to serializing format.
     * @param {Deserializer} ctx an instance give the method to take the data for attribute.
     */
    public deserialize(ctx: Deserializer) {
        super.deserialize(ctx);
        ctx.reads<SpriteMaterial>(['sizeAttenuation', 'rotation', 'texture', 'opacity', 'color']);
    }
    /**
     * @internal
     */
    public extendShaderShape(builder: ShaderBuilder, _: ShaderComponentRegistry) {
        builder
            .addUniform('rotation', WebGLShaderDataType.Float)
            .addUniform('center', WebGLShaderDataType.Vec2)
            .addGlobalUniform(BuiltInUniformTypes.modelViewMatrix)
            .addGlobalUniform(BuiltInUniformTypes.projectionMatrix)
            .addGlobalUniform(BuiltInUniformTypes.modelMatrix)
            .inject(ShaderInjectionTypes.gl_Position, spriteVertex(this.sizeAttenuation));
    }
    /**
     * @internal
     */
    public computeShapeKey(_: ShaderComponentRegistry) {
        // SpriteMaterial
        return 'sp' + (this.sizeAttenuation ? '0' : '1');
    }
    /**
     * @internal
     */
    public updateShapeUniforms(p: WGLProgram, _: ShaderComponentRegistry) {
        p.setUniform('rotation', this.rotation);
        p.setUniform('center', (p.renderState.builtUniforms.currentDrawable as Sprite).center);
    }
    /**
     * @internal
     */
    public updateShadingUniforms(program: WGLProgram): void {
        program.setUniform('opacity', this.opacity);
        if (this.texture) {
            program.setTexture2D('map', this.texture);
        } else {
            program.setUniform('color', this.color);
        }
    }
    /**
     * @internal
     */
    public extendShaderShading(b: ShaderBuilder, _: ShaderComponentRegistry) {
        b
            .addVarying(ShaderVaryingTypes.fragUV)
            .addUniform('opacity', WebGLShaderDataType.Float);

        if (this.texture) {
            b.addUniform('map', WebGLShaderDataType.Sampler2D);
        } else {
            b.addUniform('color', WebGLShaderDataType.Vec3);
        }

        if (this.texture) {
            b.inject(ShaderInjectionTypes.gl_FragColor, 'gl_FragColor = texture2D(map, vUv);gl_FragColor.a *= opacity;');
        } else {
            b.inject(ShaderInjectionTypes.gl_FragColor, 'gl_FragColor = vec4(color * opacity, opacity);');
        }

    }
    /**
     * Copy the data to this instance from other instance.
     * @param {MeshBasicMaterial} other the source of copied data
     */
    public copy(other: SpriteMaterial<T>) {
        super.copyBase(other);
        this.texture = other.texture;
        this.opacity = other.opacity;
        this.rotation = other.rotation;
        this.sizeAttenuation = other.sizeAttenuation;
        return this;
    }
    /**
     * Return a cloned instance of this class.
     */
    public clone() {
        return new SpriteMaterial<T>().copy(this);
    }
}

function spriteVertex(sizeAttenuation: boolean) {
    const sizeAttenuationStr = sizeAttenuation ? `
bool isPerspective = (projectionMatrix[2][3] == - 1.0);
if (isPerspective) scale *= - mvPosition.z;
        ` : '';

    return `
mvPosition = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);

vec2 scale;
scale.x = length(vec3(modelMatrix[0].x, modelMatrix[0].y, modelMatrix[0].z));
scale.y = length(vec3(modelMatrix[1].x, modelMatrix[1].y, modelMatrix[1].z));

${sizeAttenuationStr}

vec2 alignedPosition = (position.xy - (center - vec2(0.5))) * scale;

vec2 rotatedPosition;
rotatedPosition.x = cos(rotation) * alignedPosition.x - sin(rotation) * alignedPosition.y;
rotatedPosition.y = sin(rotation) * alignedPosition.x + cos(rotation) * alignedPosition.y;

mvPosition.xy += rotatedPosition;

gl_Position = projectionMatrix * mvPosition;`;
}
