import { MeshBasicMaterial, Color, Texture2D } from '@qunhe/egs';
import { IMaterial } from '../type';
import type { ResourceManager } from '../resource';

/**
 * Unlit Materials Extension
 *
 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_unlit
 */
export class MaterialsUnlitExtension {
    static readonly EXTENSION_NAME = 'KHR_materials_unlit';

    async create(meta: IMaterial, resourceManager: ResourceManager) {
        const material = new MeshBasicMaterial();

        const metallicRoughness = meta.pbrMetallicRoughness;
        if (metallicRoughness) {
            const { baseColorFactor, baseColorTexture } = metallicRoughness;
            if (baseColorFactor !== undefined) {
                material.setValues({
                    color: new Color(baseColorFactor[0], baseColorFactor[1], baseColorFactor[2]),
                    opacity: baseColorFactor[3],
                    transparent: baseColorFactor[3] < 1,
                });
            }
            if (baseColorTexture !== undefined) {
                const texture = await resourceManager.getTexture(baseColorTexture.index);
                material.setValues({ texture: texture as Texture2D });
            }
        }
        return material;
    }
}
