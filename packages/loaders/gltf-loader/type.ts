import type { Object3D, Matrix4 } from '@qunhe/egs';

type TypedArray =
    | Float32Array
    | Float64Array
    | Int8Array
    | Uint8Array
    | Uint8ClampedArray
    | Int16Array
    | Uint16Array
    | Int32Array
    | Uint32Array;

//#region gltf format type
interface IBase {
    extensions?: Record<string, any>;
    extras?: any;
}

export interface IAsset extends IBase {
    copyright?: string;
    generator?: string;
    version: string;
    minVersion?: string;
}

export interface IScene extends IBase {
    nodes?: number[];
    name?: string;
}

export interface INode extends IBase {
    name?: string;
    children?: number[];
    matrix?: number[];
    translation?: [number, number, number];
    rotation?: [number, number, number, number];
    scale?: [number, number, number];
    mesh?: number;
    skin?: number;
    weights?: number[];
    camera?: number;
}

export interface IMesh extends IBase {
    name?: string;
    primitives: IPrimitive[];
    weights?: number[];
}

export interface IPrimitive extends IBase {
    attributes: Record<string, number>; // attribute semantic -> accessor index
    indices?: number; // accessor index
    material?: number; // material index
    targets?: Array<{ [semantic: string]: number }>;
    mode?: PrimitiveMode; // GL primitive type (default: 4/TRIANGLES)
}

export enum PrimitiveMode {
    POINTS = 0,
    LINES = 1,
    LINE_LOOP = 2,
    LINE_STRIP = 3,
    TRIANGLES = 4,
    TRIANGLE_STRIP = 5,
    TRIANGLE_FAN = 6,
}

export enum ALPHA_MODES {
    OPAQUE = 'OPAQUE',
    MASK = 'MASK',
    BLEND = 'BLEND',
}

export interface IMaterial extends IBase {
    name?: string;
    pbrMetallicRoughness?: PBRMetallicRoughness;
    normalTexture?: INormalTextureInfo;
    occlusionTexture?: IOcclusionTextureInfo;
    emissiveTexture?: ITextureInfo;
    emissiveFactor?: [number, number, number];
    alphaMode?: ALPHA_MODES;
    alphaCutoff?: number;
    doubleSided?: boolean;
}

interface PBRMetallicRoughness extends IBase {
    baseColorFactor?: [number, number, number, number];
    baseColorTexture?: ITextureInfo;
    metallicFactor?: number;
    roughnessFactor?: number;
    metallicRoughnessTexture?: ITextureInfo;
}

interface ITextureInfo extends IBase {
    index: number; // texture index
    texCoord?: number; // uv set index (default: 0)
}

interface INormalTextureInfo extends ITextureInfo {
    scale?: number;
}

interface IOcclusionTextureInfo extends ITextureInfo {
    strength?: number;
}

export interface ITexture extends IBase {
    name?: string;
    source?: number; // image index
    sampler?: number; // sampler index
}

export interface ISampler extends IBase {
    name?: string;
    magFilter?: GLTFTextureMagFilter; // GL constants
    minFilter?: GLTFTextureMinFilter;
    wrapS?: GLTFWrapMode; // GL wrap constant (default: 10497/REPEAT)
    wrapT?: GLTFWrapMode;
}

type GLTFWrapMode =
    | 33071 // CLAMP_TO_EDGE
    | 33648 // MIRRORED_REPEAT
    | 10497; // REPEAT
type GLTFTextureMagFilter =
    | 9728 // NEAREST
    | 9729; // LINEAR

type GLTFTextureMinFilter =
    | 9728 // NEAREST
    | 9729 // LINEAR
    | 9984 // NEAREST_MIPMAP_NEAREST
    | 9985 // LINEAR_MIPMAP_NEAREST
    | 9986 // NEAREST_MIPMAP_LINEAR
    | 9987; // LINEAR_MIPMAP_LINEAR

export interface IImage extends IBase {
    name?: string;
    uri?: string;
    mimeType?: 'image/jpeg' | 'image/png';
    bufferView?: number;
}

export type IAccessorType = 'SCALAR' | 'VEC2' | 'VEC3' | 'VEC4' | 'MAT2' | 'MAT3' | 'MAT4';

export enum AccessorComponentType {
    BYTE = 5120,
    UNSIGNED_BYTE = 5121,
    SHORT = 5122,
    UNSIGNED_SHORT = 5123,
    UNSIGNED_INT = 5125,
    FLOAT = 5126,
}

export interface IAccessor extends IBase {
    bufferView?: number;
    byteOffset?: number;
    componentType: AccessorComponentType;
    normalized?: boolean;
    count: number;
    type: IAccessorType;
    max?: number[];
    min?: number[];
    sparse?: any; // not support now
}

export interface IBufferView extends IBase {
    buffer: number;
    byteOffset?: number;
    byteLength: number;
    byteStride?: number;
    target?: IBufferViewTarget;
}

enum IBufferViewTarget {
    ARRAY_BUFFER = 34962,
    ELEMENT_ARRAY_BUFFER = 34963,
}

export interface IBuffer extends IBase {
    uri?: string;
    byteLength: number;
}

export interface IAnimation extends IBase {
    name?: string;
    channels: IAnimationChannel[];
    samplers: IAnimationSampler[];
}

interface IAnimationChannel extends IBase {
    sampler: number;
    target: IAnimationChannelTarget;
}

export interface IAnimationChannelTarget extends IBase {
    node?: number;
    path: 'translation' | 'rotation' | 'scale' | 'weights' | 'pointer';
}

interface IAnimationSampler extends IBase {
    input: number; // accessor index (time values)
    output: number; // accessor index (animated values)
    interpolation?: 'LINEAR' | 'STEP' | 'CUBICSPLINE';
}

export interface ISkin extends IBase {
    name?: string;
    inverseBindMatrices?: number; // accessor index
    skeleton?: number; // root node index
    joints: number[]; // node indices
}

interface ICamera extends IBase {
    name?: string;
    type: 'perspective' | 'orthographic';
    perspective?: IPerspectiveCamera;
    orthographic?: IOrthographicCamera;
}

interface IPerspectiveCamera extends IBase {
    aspectRatio?: number;
    yfov: number;
    zfar?: number;
    znear: number;
}

interface IOrthographicCamera extends IBase {
    xmag: number;
    ymag: number;
    zfar: number;
    znear: number;
}

export interface GLTF extends IBase {
    asset: IAsset;
    scene?: number;
    scenes?: IScene[];
    nodes?: INode[];
    meshes?: IMesh[];
    accessors?: IAccessor[];
    bufferViews?: IBufferView[];
    buffers?: IBuffer[];
    materials?: IMaterial[];
    textures?: ITexture[];
    images?: IImage[];
    samplers?: ISampler[];
    animations?: IAnimation[];
    skins?: ISkin[];
    cameras?: ICamera[];
    extensionsUsed?: string[];
    extensionsRequired?: string[];
}
//#endregion

//#region parse result type
export interface ISkeleton {
    bones: Object3D[];
    inverseBindMatrices: Matrix4[];
}

export interface AnimationTrack {
    path: string;
    times: TypedArray;
    values: TypedArray;
    interpolation: number;
}

export interface Animation {
    name: string;
    tracks: AnimationTrack[];
}
//#endregion
