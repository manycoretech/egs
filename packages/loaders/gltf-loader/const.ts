import { MeshPhongMaterial, Texture2D, WebGLPixelFormat, TextureDataType } from '@qunhe/egs';
import { type IAccessorType, AccessorComponentType } from './type';

export const WEBGL_COMPONENT_TYPES: Record<AccessorComponentType, any> = {
    5120: Int8Array,
    5121: Uint8Array,
    5122: Int16Array,
    5123: Uint16Array,
    5125: Uint32Array,
    5126: Float32Array,
};

export const ACCESSOR_TYPE_SIZES: Record<IAccessorType, number> = {
    SCALAR: 1,
    VEC2: 2,
    VEC3: 3,
    VEC4: 4,
    MAT2: 4,
    MAT3: 9,
    MAT4: 16,
};

type AttributeKey = 'position' | 'normal' | 'uv' | 'color' | 'weights' | 'joints';
export const ATTRIBUTE_MAP: Record<string, AttributeKey | undefined> = {
    POSITION: 'position',
    NORMAL: 'normal',
    TEXCOORD_0: 'uv',
    COLOR_0: 'color',
    WEIGHTS_0: 'weights',
    JOINTS_0: 'joints',
};

export const INTERPOLATION = {
    LINEAR: 2301,
    STEP: 2300,
    CUBICSPLINE: undefined, // unsupported
};

export const textDecoder = new TextDecoder();

export const DEFAULT_MATERIAL = new MeshPhongMaterial();

export const EMPTY_TEXTURE = Texture2D.createByMainLayerSource(
    new Uint8Array([233, 233, 233, 255]),
    WebGLPixelFormat.RGBA,
    TextureDataType.UnsignedByteType, 1, 1
);
