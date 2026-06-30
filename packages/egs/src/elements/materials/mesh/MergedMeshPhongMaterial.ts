import { WebGLShaderDataType } from '../../../renderer/webgl/WGLConstants.js';
import type { WGLProgram } from '../../../renderer/webgl/WGLProgram.js';
import {
    ShaderVaryingTypes,
    ShaderInjectionTypes,
    type ShaderBuilder,
} from '../../../renderer/shader/builders/ShaderBuilder.js';
import { MeshPhongMaterial } from './MeshPhongMaterial.js';
import {
    createShaderInjectionsForDataTextureSchema,
    DataTextureSchemaInstance,
} from '../../../scene/tools/mesh-merge/DataTextureCreator.js';
import { Utils } from '../../../utils/Utils.js';
import { materialProperty } from '../../../ContentAPI.js';
import type { ShaderComponentRegistry } from '../../../scene/ShaderComponentRegistry.js';
import { Texture2D } from '../../textures/Texture2D.js';
import type { TextureV2 } from '../../textures/TextureV2.js';
import type { Texture } from '../../textures/Texture.js';

const textureNames = new Array(32).fill(0).map((_, i) => `map${i}`); // this to avoid runtime string build

export const MergedMeshPhongMaterialDataTextureSchema = new DataTextureSchemaInstance<MeshPhongMaterial>({
    schema: [
        {
            shaderVaryName: 'vColorAlphaCoord',
            shaderVaryingField: 'xy',
            materialPropertyGetter: m => m.color,
        },
        {
            shaderVaryName: 'vColorAlphaCoord',
            shaderVaryingField: 'zw',
            materialPropertyGetter: m => m.opacity,
        },
        {
            shaderVaryName: 'vSpecularCoord',
            materialPropertyGetter: m => m.specular,
        },
        {
            shaderVaryName: 'vSpecularParametersCoord',
            shaderVaryingField: 'xy',
            materialPropertyGetter: m => m.shininess / 128.0,
        },
        {
            shaderVaryName: 'vSpecularParametersCoord',
            shaderVaryingField: 'zw',
            materialPropertyGetter: m => m.specularStrength,
        },
    ],
    dataTextureShaderUniformName: 'dataTexture',
    materialIndexShaderAttributeName: 'map_index.y',
});

/**
 * This is the material specifically for the mesh which contains different groups of sub-meshes and combine them into one single drawcall
 * The shader inside this material will have may if cases for different textures or colors
 */
export class MergedMeshPhongMaterial<T extends Texture2D | TextureV2 = Texture2D> extends MeshPhongMaterial<T> {
    readonly isMergedMeshPhongMaterial = true;

    className() {
        return 'MergedMeshPhongMaterial';
    }

    generateShaderKey(r: ShaderComponentRegistry) {
        return super.generateShaderKey(r) + this.textures.length;
    }

    @materialProperty()
    dataTexture: T = Texture2D.default as any;
    @materialProperty()
    textures: T[] = [];

    traverseTexture(visitor: (tex: Texture) => void) {
        super.traverseTexture(visitor);
        Utils.visitTexture([...this.textures, this.dataTexture], visitor);
    }
    setTextureUnit(texture: T, unit: number): void {
        this.textures[unit] = texture;
    }

    private updateShadingUniformsSelf(program: WGLProgram) {
        program.setTexture2D('dataTexture', this.dataTexture);

        for (let i = 0; i < this.textures.length; i++) {
            if (this.textures[i] !== undefined) {
                program.setTexture2D(textureNames[i], this.textures[i]);
            } else {
                program.setTexture2D(textureNames[i], Texture2D.default);
            }
        }
        MergedMeshPhongMaterialDataTextureSchema.updateUniform(this.dataTexture, program);
    }
    updateShadingUniforms(program: WGLProgram, r: ShaderComponentRegistry): void {
        super.updateShadingUniforms(program, r);
        this.updateShadingUniformsSelf(program);
    }
    updateDeferredUniform(program: WGLProgram) {
        super.updateDeferredUniform(program);
        this.updateShadingUniformsSelf(program);
    }

    private extendShadingSelf(b: ShaderBuilder) {
        declareMaps(b, this.textures.length);
        createShaderInjectionsForDataTextureSchema(MergedMeshPhongMaterialDataTextureSchema.info, b);

        b.addVarying(ShaderVaryingTypes.fragUV) // yes uv always need now
            .addCustomAttribute('map_index', WebGLShaderDataType.Vec2)
            .addVaryingCustom('vMapIndex', WebGLShaderDataType.Vec2)
            .inject(ShaderInjectionTypes.vary_any, 'vMapIndex = map_index;')

            .inject(
                ShaderInjectionTypes.channel_alpha,
                `
            vec4 texture_result =  fetch_indexed_map(-vMapIndex.x - 1.0);
            opacity = texture2D( dataTexture, vColorAlphaCoord.zw ).r;
            if(vMapIndex.x < 0.0) {
                opacity *= texture_result.a;
            }
        `,
            )
            .inject(
                ShaderInjectionTypes.channel_color,
                `
            color = texture2D( dataTexture, vColorAlphaCoord.xy ).rgb;
            if(vMapIndex.x < 0.0) {
                color *= texture_result.rgb;
            }
        `,
            )
            .inject(
                ShaderInjectionTypes.channel_specular,
                `
            specular = texture2D( dataTexture, vSpecularCoord.xy ).rgb;
        `,
            )
            .inject(
                ShaderInjectionTypes.channel_shininess,
                `
                shininess = texture2D( dataTexture, vSpecularParametersCoord.xy ).r * 128.0;
            `,
            )
            .inject(
                ShaderInjectionTypes.channel_specularStrength,
                `
            specularStrength = texture2D( dataTexture, vSpecularParametersCoord.zw ).r;
        `,
            );
    }
    extendShaderShading(b: ShaderBuilder, r: ShaderComponentRegistry) {
        super.extendShaderShading(b, r);
        this.extendShadingSelf(b);
    }
    extendEncodeDeferred(b: ShaderBuilder) {
        super.extendEncodeDeferred(b);
        this.extendShadingSelf(b);
    }
}

function declareMaps(b: ShaderBuilder, count: number) {
    for (let i = 0; i < count; i++) {
        b.addUniform(`map${i}`, WebGLShaderDataType.Sampler2D);
    }
    b.addFragmentCustom(buildIndexMapFetch(count));
}

function buildIndexMapFetch(count: number) {
    let s = '';
    for (let i = 0; i <= count - 1; i++) {
        if (i === 0) {
            s += `

    if (mapIndex < 0.5) {
        color = texture2D(map${i}, vUv).rgba;
            `;
        } else if (i === count - 1) {
            s += `
        } else {
            color = texture2D(map${i}, vUv).rgba;
        }
            `;
        } else {
            s += `
        } else if (mapIndex < ${i + 0.5}) {
            color = texture2D(map${i}, vUv).rgba;
            `;
        }
    }

    if (count === 1) {
        s += `\n}`;
    }

    return `
    vec4 fetch_indexed_map(float mapIndex){
        vec4 color = vec4(1.0);
        ${s}
        return color;
    }
    `;
}
