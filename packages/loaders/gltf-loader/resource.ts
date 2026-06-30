import {
    type Texture,
    type Texture2D,
    SamplerFilter,
    SamplerWrap,
    type Material,
    Side,
    MeshPhongMaterial,
    Color,
    BufferAttribute,
    BufferGeometry,
    EnvMapIBLShaderComponent,
} from '@qunhe/egs';
import {
    type IMaterial,
    type ISampler,
    type ITexture,
    type IImage,
    type IBuffer,
    type IBufferView,
    type IPrimitive,
    type IAccessor,
    type GLTF,
    AccessorComponentType,
    ALPHA_MODES,
} from './type.js';
import { MaterialsUnlitExtension, TextureTransformExtension } from './extensions/index.js';
import { DEFAULT_MATERIAL, WEBGL_COMPONENT_TYPES, ACCESSOR_TYPE_SIZES, EMPTY_TEXTURE, ATTRIBUTE_MAP } from './const.js';
import type { TransformExtensionData } from './extensions/texture_transform_extension.js';

interface ResourceManagerConfig {
    binaryBuffer?: ArrayBuffer;
    extensions: Record<string, any>;
    textureLoader: (url: string) => Promise<Texture>;
}

export class ResourceManager {
    private textureLoader: (url: string) => Promise<Texture>;

    private buffers: IBuffer[];
    private bufferViews: IBufferView[];
    private materials: IMaterial[];
    private textures: ITexture[];
    private samplers: ISampler[];
    private images: IImage[];
    private accessors: IAccessor[];
    private extensions: Record<string, any>;
    private binaryBuffer?: ArrayBuffer;

    private bufferMap = new Map<number, Promise<ArrayBuffer>>();
    private bufferViewMap = new Map<number, Promise<ArrayBuffer>>();
    private textureMap = new Map<number, Promise<Texture>>();
    private materialMap = new Map<number, Promise<Material>>();
    private attributeMap = new Map<number, Promise<BufferAttribute>>();
    private geometryMap = new Map<string, Promise<BufferGeometry>>();

    constructor(data: GLTF, config: ResourceManagerConfig) {
        this.buffers = data.buffers || [];
        this.bufferViews = data.bufferViews || [];
        this.materials = data.materials || [];
        this.textures = data.textures || [];
        this.samplers = data.samplers || [];
        this.images = data.images || [];
        this.accessors = data.accessors || [];
        this.extensions = config.extensions;
        this.binaryBuffer = config.binaryBuffer;
        this.textureLoader = config.textureLoader;
    }

    getBuffer(index: number): Promise<ArrayBuffer> {
        const meta = this.buffers[index];

        // If present, GLB container is required to be the first buffer.
        if (this.binaryBuffer && meta.uri === undefined && index === 0) {
            return Promise.resolve(this.binaryBuffer);
        }

        if (meta.uri === undefined || !meta.uri.match(/^data:application\/(octet-stream|gltf-buffer);/)) {
            throw new Error('EGS.GLTFLoader: unsupported buffer type.');
        }

        let result = this.bufferMap.get(index);
        if (!result) {
            result = fetch(meta.uri).then(res => res.arrayBuffer());
            this.bufferMap.set(index, result);
        }

        return result;
    }

    getBufferView(index: number): Promise<ArrayBuffer> {
        let result = this.bufferViewMap.get(index);
        if (result) {
            return result;
        }

        const meta = this.bufferViews[index];
        const byteLength = meta.byteLength || 0;
        const byteOffset = meta.byteOffset || 0;
        result = this.getBuffer(meta.buffer).then(source => source.slice(byteOffset, byteOffset + byteLength));
        this.bufferViewMap.set(index, result);
        return result;
    }

    /**
     * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#textures
     */
    getTexture(index: number): Promise<Texture> {
        let result = this.textureMap.get(index);
        if (result) {
            return result;
        }

        const textureMeta = this.textures[index];
        if (textureMeta?.source !== undefined) {
            const sourceMeta = this.images[textureMeta.source];
            let sourceURI: Promise<string> = Promise.resolve(sourceMeta.uri || '');
            if (sourceMeta.bufferView !== undefined) {
                // Load binary image data from bufferView, if provided.
                sourceURI = this.getBufferView(sourceMeta.bufferView).then(function (bufferView) {
                    const blob = new Blob([bufferView], { type: sourceMeta.mimeType });
                    return URL.createObjectURL(blob);
                });
            } else if (sourceMeta.uri === undefined) {
                throw new Error('EGS.GLTFLoader: Image ' + index + ' is missing URI and bufferView');
            }

            result = sourceURI.then(url => this.textureLoader(url));
        }

        if (!result) {
            result = Promise.resolve(EMPTY_TEXTURE); // not singleton ?
        }

        result = result.then(texture => {
            if (textureMeta.name) {
                texture.name = textureMeta.name;
            }

            const sampler = {
                wrapS: SamplerWrap.Repeat,
                wrapT: SamplerWrap.Repeat,
                minFilter: SamplerFilter.LinearMipmapLinear,
                magFilter: SamplerFilter.Linear,
            };
            if (textureMeta.sampler !== undefined) {
                const sampleMeta = this.samplers[textureMeta.sampler];
                if (sampleMeta) {
                    if (sampleMeta.wrapS !== undefined) {
                        sampler.wrapS = sampleMeta.wrapS;
                    }
                    if (sampleMeta.wrapT !== undefined) {
                        sampler.wrapT = sampleMeta.wrapT;
                    }
                    if (sampleMeta.minFilter !== undefined) {
                        sampler.minFilter = sampleMeta.minFilter;
                    }
                    if (sampleMeta.magFilter !== undefined) {
                        sampler.magFilter = sampleMeta.magFilter;
                    }
                }
            }
            texture.configStorage(s => (s.flipY = false));
            texture.configSampler(s => {
                s.magFilter = sampler.magFilter;
                s.minFilter = sampler.minFilter;
                s.wrapS = sampler.wrapS;
                s.wrapT = sampler.wrapT;
            });

            return texture;
        });

        this.textureMap.set(index, result);

        return result;
    }

    /**
     * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#materials
     */
    getMaterial(index: number): Promise<Material> {
        let result = this.materialMap.get(index);
        if (result) {
            return result;
        }

        const meta = this.materials[index];
        if (!meta) {
            result = Promise.resolve(DEFAULT_MATERIAL);
        }

        if (!result) {
            const materialExtensions = meta.extensions || {};
            if (materialExtensions[MaterialsUnlitExtension.EXTENSION_NAME]) {
                const kmuExtension = this.extensions[MaterialsUnlitExtension.EXTENSION_NAME] as MaterialsUnlitExtension;
                result = kmuExtension.create(meta, this);
            }
        }

        if (!result) {
            // Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#metallic-roughness-material
            const material = new MeshPhongMaterial();
            const { baseColorFactor, baseColorTexture, metallicFactor = 1 } = meta.pbrMetallicRoughness || {};
            if (baseColorFactor !== undefined) {
                material.setValues({
                    color: new Color(baseColorFactor[0], baseColorFactor[1], baseColorFactor[2]).cloneReadonly(),
                    opacity: baseColorFactor[3],
                    transparent: baseColorFactor[3] < 1,
                });
            }
            if (metallicFactor === 1) {
                const env = new EnvMapIBLShaderComponent();
                material.addComponent(env);
            }
            result = Promise.resolve(material);
            if (baseColorTexture !== undefined) {
                result = Promise.all([Promise.resolve(material), this.getTexture(baseColorTexture.index)]).then(
                    ([material, texture]) => {
                        material.setValues({ texture: texture as Texture2D });
                        return material;
                    },
                );
            }
        }

        result = result.then(material => {
            if (this.extensions[TextureTransformExtension.EXTENSION_NAME]) {
                const transform: TransformExtensionData | undefined =
                    meta.pbrMetallicRoughness?.baseColorTexture?.extensions?.[TextureTransformExtension.EXTENSION_NAME];
                if (transform) {
                    const extension = this.extensions[
                        TextureTransformExtension.EXTENSION_NAME
                    ] as TextureTransformExtension;
                    extension.update(material, transform);
                }
            }

            if (meta.name) {
                material.name = meta.name;
            }

            if (meta.doubleSided) {
                material.side = Side.DoubleSide;
            }

            const alphaMode = meta.alphaMode || ALPHA_MODES.OPAQUE;
            if (alphaMode === ALPHA_MODES.BLEND) {
                material.transparent = true;
                material.depthWrite = false; // See: https://github.com/mrdoob/three.js/issues/17706
            } else if (alphaMode === ALPHA_MODES.MASK) {
                console.warn('EGS.GLTFLoader: Alpha mode MASK not supported.');
            }

            return material;
        });

        this.materialMap.set(index, result);

        return result;
    }

    /**
     * Specification: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#reference-accessor
     */
    getAccessor(index: number, forceType?: AccessorComponentType): Promise<BufferAttribute> {
        let result = this.attributeMap.get(index);
        if (result) {
            return result;
        }

        const meta = this.accessors[index];
        if (!meta) {
            throw new Error(`EGS.GLTFLoader: accessor ${index} not found.`);
        }

        if (meta.sparse !== undefined) {
            console.warn('EGS.GLTFLoader: Unsupported sparse BufferAttribute.');
        }

        const count = meta.count;
        const itemSize = ACCESSOR_TYPE_SIZES[meta.type];
        if (meta.bufferView !== undefined && meta.sparse === undefined) {
            result = this.getBufferView(meta.bufferView!).then(buffer => {
                const TypedArray = WEBGL_COMPONENT_TYPES[meta.componentType];
                const elementBytes = TypedArray.BYTES_PER_ELEMENT;
                const itemBytes = elementBytes * itemSize;
                const byteOffset = meta.byteOffset || 0;
                const byteStride =
                    meta.bufferView !== undefined ? this.bufferViews[meta.bufferView].byteStride : undefined;

                // The buffer is not interleaved if the stride is the item size in bytes.
                if (byteStride && byteStride !== itemBytes) {
                    console.warn('EGS.GLTFLoader: Using interleaved buffer which is not recommended.');
                    const array = new Uint8Array(count * itemBytes);
                    const view = new Uint8Array(buffer);
                    for (let i = 0; i < count; i++) {
                        const start = byteOffset + i * byteStride;
                        for (let j = 0; j < itemBytes; j++) {
                            array[i * itemBytes + j] = view[start + j];
                        }
                    }
                    const attribute = new BufferAttribute(new TypedArray(array.buffer), itemSize);
                    attribute.normalized = meta.normalized === true;
                    return attribute;
                } else {
                    let array = new TypedArray(buffer, byteOffset, meta.count * itemSize);
                    // transform array type
                    {
                        if (forceType && forceType !== meta.componentType) {
                            const transformArr = new WEBGL_COMPONENT_TYPES[forceType](array.length);
                            for (let i = 0; i < array.length; i++) {
                                transformArr[i] = array[i];
                            }
                            array = transformArr;
                        }
                    }
                    const attribute = new BufferAttribute(array, itemSize);
                    attribute.normalized = meta.normalized === true;
                    return attribute;
                }
            });
        }
        if (!result) {
            const TypedArray = WEBGL_COMPONENT_TYPES[forceType ?? meta.componentType];
            const array = new TypedArray(count * itemSize);
            const attribute = new BufferAttribute(array, itemSize);
            result = Promise.resolve(attribute);
        }

        this.attributeMap.set(index, result);

        return result;
    }

    /**
     * Specification: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#reference-mesh-primitive
     */
    getGeometry(meta: IPrimitive): Promise<BufferGeometry> {
        const cacheKey = createPrimitiveKey(meta);

        let result = this.geometryMap.get(cacheKey);
        if (result) {
            return result;
        }

        const geometry = new BufferGeometry();

        const attributePromises: Array<Promise<void>> = [];
        const attributes = meta.attributes;
        for (const attr in attributes) {
            const name = ATTRIBUTE_MAP[attr];
            if (!name) {
                console.warn(`GLTFLoader: unsupported attribute name ${attr}.`);
                continue;
            }
            // transform weights and joints attribute buffer type
            const type =
                name === 'weights'
                    ? AccessorComponentType.FLOAT
                    : name === 'joints'
                      ? AccessorComponentType.UNSIGNED_SHORT
                      : undefined;
            const attribute = this.getAccessor(attributes[attr], type).then(attr => {
                geometry.setAttribute(name, attr);
            });
            attributePromises.push(attribute);
        }
        if (meta.indices !== undefined) {
            const indices = this.getAccessor(meta.indices).then(attr => {
                geometry.index = attr as BufferAttribute<Uint32Array>;
            });
            attributePromises.push(indices);
        }

        if (meta.targets !== undefined) {
            console.warn('GLTFLoader: morph target unsupported.');
        }

        result = Promise.all(attributePromises).then(() => geometry);

        this.geometryMap.set(cacheKey, result);

        return result;
    }
}

function createPrimitiveKey(meta: IPrimitive) {
    let attributesKey = '';
    const keys = Object.keys(meta.attributes).sort();
    for (let i = 0; i < keys.length; i++) {
        attributesKey += keys[i] + '-' + meta.attributes[keys[i]] + ';';
    }
    return meta.indices + ';' + attributesKey + ';' + meta.mode;
}
