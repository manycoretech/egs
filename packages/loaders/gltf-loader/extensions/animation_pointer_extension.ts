import type { IAnimationChannelTarget } from '../type';

interface AnimationPointerExtensionData {
    pointer: string;
}

export type AnimationPointerSupportPath = 'uvScale' | 'uvOffset' | 'uvRotation';

export interface AnimationPointer {
    index: number;
    path: AnimationPointerSupportPath;
}

/**
 * Animation Pointer Extension
 *
 * Draft Specification: https://github.com/ux3d/glTF/tree/extensions/KHR_animation_pointer/extensions/2.0/Khronos/KHR_animation_pointer
 */
export class AnimationPointerExtension {
    static readonly EXTENSION_NAME = 'KHR_animation_pointer';

    parse(target: IAnimationChannelTarget): AnimationPointer | undefined {
        if (target.node !== undefined || target.path !== 'pointer') {
            return undefined;
        }
        const pointerExtensionData = target.extensions?.[AnimationPointerExtension.EXTENSION_NAME] as AnimationPointerExtensionData | undefined;
        if (!pointerExtensionData) {
            return undefined;
        }
        const pointer = pointerExtensionData.pointer;
        const reg = pointer.match(/^\/materials\/(\d+)\/(.+)$/);
        if (!reg) {
            return undefined;
        }

        let path: AnimationPointerSupportPath | undefined;
        switch (reg[2]) {
            case 'pbrMetallicRoughness/baseColorTexture/extensions/KHR_texture_transform/scale':
                path = 'uvScale';
                break;
            case 'pbrMetallicRoughness/baseColorTexture/extensions/KHR_texture_transform/offset':
                path = 'uvOffset';
                break;
            case 'pbrMetallicRoughness/baseColorTexture/extensions/KHR_texture_transform/rotation':
                path = 'uvRotation';
                break;
        }
        if (!path) {
            console.warn('EGS.GLTFLoader: AnimationPointerExtension unsupported pointer.', pointer);
            return undefined;
        }

        return {
            index: parseInt(reg[1], 10),
            path,
        };
    }
}
