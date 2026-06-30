import { WebGLPixelFormat, WebGLShaderDataType } from '../../../renderer/webgl/WGLConstants.js';
import { TextureDataType } from '../../../utils/Constants.js';
import { _Math } from '../../../math/Math.js';
import { Color, type ReadonlyColor } from '../../../math/Color.js';
import { logger } from '../../../utils/Logger.js';
import type { Vector3 } from '../../../math/Vector3.js';
import type { Vector2 } from '../../../math/Vector2.js';
import type { Material } from '../../../elements/materials/Material.js';
import { type ShaderBuilder, ShaderInjectionTypes } from '../../../renderer/shader/builders/ShaderBuilder.js';
import type { WGLProgram } from '../../../renderer/webgl/WGLProgram.js';
import { Texture2D, Texture2DCommonLayer } from '../../../elements/textures/Texture2D.js';
import type { TextureV2 } from '../../../elements/textures/TextureV2.js';

type DataTextureStorageAble = number | Color | Vector3 | Vector2 | ReadonlyColor;

export interface DataTextureSchema<M extends Material> {
    schema: Array<DataTextureSchemaOne<M>>;
    dataTextureShaderUniformName: string;
    materialIndexShaderAttributeName: string;
}

export class DataTextureSchemaInstance<M extends Material> {
    constructor(public info: DataTextureSchema<M>) {}

    updateUniform(dataTexture: TextureV2 | Texture2D, p: WGLProgram) {
        p.setUniform('dataTexture_width', dataTexture.width);
    }
}

export interface DataTextureSchemaOne<M extends Material> {
    shaderVaryName: string;
    shaderVaryingField?: string;
    materialPropertyGetter: (material: M) => DataTextureStorageAble;
}

const varyingCountMap = new Map<string, number>();

export function createShaderInjectionsForDataTextureSchema<M extends Material>(
    schema: DataTextureSchema<M>,
    b: ShaderBuilder,
) {
    const mapIndexAttributeName = schema.materialIndexShaderAttributeName;
    const textureWidthName = schema.dataTextureShaderUniformName + '_width';

    b.addUniform(schema.dataTextureShaderUniformName, WebGLShaderDataType.Sampler2D).addUniform(
        textureWidthName,
        WebGLShaderDataType.Float,
    );

    schema.schema.forEach((s, row) => {
        varyingCountMap.set(s.shaderVaryName, (varyingCountMap.get(s.shaderVaryName) ?? 0) + 1);
        const y = (row * 2 + 1) / (_Math.ceilPowerOfTwo(schema.schema.length) * 2);
        b.inject(
            ShaderInjectionTypes.vary_any,
            `${s.shaderVaryingField ? `${s.shaderVaryName}.${s.shaderVaryingField}` : s.shaderVaryName} = vec2( (${mapIndexAttributeName} + 0.5) / ${textureWidthName}, ${y} );`,
        );
    });

    varyingCountMap.forEach((v, k) => {
        if (v <= 2 && v > 0) {
            b.addVaryingCustom(k, v === 1 ? WebGLShaderDataType.Vec2 : WebGLShaderDataType.Vec4);
        }
    });

    varyingCountMap.clear();
}

/**
 * Creates a data texture from material schema values.
 */
export function createDataTexture<M extends Material>(schema: DataTextureSchema<M>, inputs: M[]): Texture2D {
    const imageWidth = _Math.ceilPowerOfTwo(inputs.length);
    const imageHeight = _Math.ceilPowerOfTwo(schema.schema.length);
    const dataLength = imageWidth * imageHeight * 4;
    const data = new Uint8Array(dataLength);

    inputs.forEach((material, colum) => {
        schema.schema.forEach((s, row) => {
            const property = s.materialPropertyGetter(material);
            const index = row * imageWidth * 4 + colum * 4;
            if (property instanceof Color) {
                data[index] = convertUint8(property.r);
                data[index + 1] = convertUint8(property.g);
                data[index + 2] = convertUint8(property.b);
            } else if (typeof property === 'number') {
                data[index] = convertUint8(property);
            } else {
                // todo vec2 vec3
                logger.unsupported('unknown property in mesh merge');
            }
        });
    });

    return Texture2D.createByMainLayer(
        Texture2DCommonLayer.create(data, imageWidth, imageHeight)
            .setFormat(WebGLPixelFormat.RGBA)
            .setType(TextureDataType.UnsignedByteType),
    ).configAsDataTexture();
}

function convertUint8(value: number): number {
    return Math.ceil(_Math.clamp(value, 0, 1) * 255);
}
