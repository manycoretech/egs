import { Material, TypeAssert, Matrix3 } from '@qunhe/egs';

export interface TransformExtensionData {
    offset?: [number, number];
    rotation?: number;
    scale?: [number, number];
    texCoord?: number;
}

/**
 * Texture Transform Extension
 *
 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_texture_transform
 */
export class TextureTransformExtension {
    static readonly EXTENSION_NAME = 'KHR_texture_transform';

    update(material: Material, transform: TransformExtensionData) {
        if (!TypeAssert.isMeshBasicMaterial(material) && !TypeAssert.isMeshPhongMaterial(material)) {
            console.warn('EGS.GLTFLoader: TextureTransformExtension is only supported for MeshBasicMaterial and MeshPhongMaterial.');
            return;
        }

        const matrix = new Matrix3();
        if (transform.scale !== undefined) {
            matrix.scale(transform.scale[0], transform.scale[1]);
        }
        if (transform.rotation !== undefined) {
            matrix.rotate(transform.rotation);
        }
        if (transform.offset !== undefined) {
            matrix.translate(transform.offset[0], transform.offset[1]);
        }
        material.uvTransform = matrix.cloneReadonly();
    }
}
