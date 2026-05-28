import { Vector3 } from '../../../math/Vector3';
import { Deserializer, Serializer } from '../../../utils/Serialization';
import { BufferAttribute } from '../../attributes/BufferAttribute';
import { BufferGeometry } from './BufferGeometry';
import { ContentBridge, hasManagedContentAPI } from '../../../ContentAPI';
import { IPopbufferInfo, IMetaBlock, IPopbufferAttributes } from './IPopBufferInfo';

export interface Metadata {
    boxMin: Readonly<Vector3>;
    boxSizeMagnitude: number;
    vertexGridSize: number;
    vertexConstant: Readonly<Vector3>;
}

class WrappedPopbufferInfo implements IPopbufferInfo {
    version: number;
    indices: Uint16Array | Uint32Array;
    vertices: Float32Array;
    normals: Float32Array;
    textures: Float32Array;
    blocks: IMetaBlock[];
    currentVertexCount: number;
    currentBlockFaceCounts: number[];
    levelPrecisions: number[];
    maxPrecision: number;
    attributes: IPopbufferAttributes;
    verticeDataLengthForEachLevel: any[];

    private bufferAttributes: {
        indices: BufferAttribute<Uint16Array | Uint32Array>,
        position: BufferAttribute<Float32Array>,
        uv: BufferAttribute<Float32Array>,
        normal: BufferAttribute<Float32Array>
    };

    constructor(source: IPopbufferInfo, bufferAttributes: {
        indices: BufferAttribute<Uint16Array | Uint32Array>,
        position: BufferAttribute<Float32Array>,
        uv: BufferAttribute<Float32Array>,
        normal: BufferAttribute<Float32Array>
    }) {
        this.version = source.version;
        this.blocks = source.blocks;
        this.currentVertexCount = source.currentVertexCount;
        this.currentBlockFaceCounts = source.currentBlockFaceCounts;
        this.levelPrecisions = source.levelPrecisions;
        this.maxPrecision = source.maxPrecision;
        this.attributes = source.attributes;
        this.verticeDataLengthForEachLevel = source.verticeDataLengthForEachLevel;
        Object.defineProperties(this, {
            bufferAttributes: {
                value: bufferAttributes,
                enumerable: false,
                configurable: false
            },
            indices: {
                get(this: WrappedPopbufferInfo) {
                    return this.bufferAttributes.indices.array;
                },
                set(this: WrappedPopbufferInfo, data: Uint16Array | Uint32Array) {
                    this.bufferAttributes.indices.array = data;
                },
                enumerable: true,
                configurable: true
            },
            vertices: {
                get(this: WrappedPopbufferInfo) {
                    return this.bufferAttributes.position.array;
                },
                set(this: WrappedPopbufferInfo, data: Float32Array) {
                    this.bufferAttributes.position.array = data;
                },
                enumerable: true,
                configurable: true
            },
            textures: {
                get(this: WrappedPopbufferInfo) {
                    return this.bufferAttributes.uv.array;
                },
                set(this: WrappedPopbufferInfo, data: Float32Array) {
                    this.bufferAttributes.uv.array = data;
                },
                enumerable: true,
                configurable: true
            },
            normals: {
                get(this: WrappedPopbufferInfo) {
                    return this.bufferAttributes.normal.array;
                },
                set(this: WrappedPopbufferInfo, data: Float32Array) {
                    this.bufferAttributes.normal.array = data;
                },
                enumerable: true,
                configurable: true
            },
        });
    }
}

const HALF_GRID = 0.5;
/**
 * This is a dedicated geometry for {@link PopMesh| PopMesh }.
 */
export class PopBufferGeometry extends BufferGeometry {
    /**
     * Used to check type of this or extended instance.
     * This value should not be changed by user.
     */
    public isPopBufferGeometry = true;
    /**
     * The attributes data which are stored into an object.
     * It is better to change this by {@link setModel| setModel }.
     */
    public model!: IPopbufferInfo;
    /**
     * An item of vertex array.
     */
    public metadata!: Metadata;
    /**
     * The name of instance's class.
     */
    public className() {
        return 'PopBufferGeometry';
    }

    constructor(model?: IPopbufferInfo) {
        super();
        this.setModel(model);
    }
    /**
     * Return the name of specific group.
     * @param groupIndex the index of model.blocks.
     */
    public getGroupNameByGroupIndex(groupIndex: number): string | undefined {
        const block = this.model.blocks[groupIndex];
        if (block) {
            return block.name;
        }

        return undefined;
    }
    /**
     * Return the name of the group which the specific vertex belongs to.
     * @param index the index of checked vertex.
     */
    public getGroupNameByVertexIndex(index: number): string | undefined {
        const result = this.getGroupByVertexIndex(index);
        if (result) {
            return this.getGroupNameByGroupIndex(result.groupIndex);
        }

        return undefined;
    }
    /**
     * Change the attribute data and {@link model| model }.
     * @param model the given model data.
     */
    public setModel(model?: IPopbufferInfo): void {
        if (!model) { return; }
        let indicesData = model.indices;
        let uvData = model.textures;
        let normalData = model.normals;
        let verticesData = model.vertices;

        if (model instanceof WrappedPopbufferInfo) {
            // move back to js
            indicesData = indicesData.slice();
            uvData = uvData.slice();
            normalData = normalData.slice();
            verticesData = verticesData.slice();
        }

        const indices = new BufferAttribute(indicesData, 1);
        const uv = new BufferAttribute(uvData, 2);
        const normal = new BufferAttribute(normalData, 3);
        const position = new BufferAttribute(verticesData, 3);

        this.setIndex(indices);
        this.addAttribute('uv', uv);
        this.addAttribute('normal', normal);
        this.addAttribute('position', position);
        this.setGroups([]);
        model.blocks.forEach(block => this.addGroup(block.start, block.count, block.index));

        if (hasManagedContentAPI() || window.EGS_WASM_PREPARED) {
            // create a wrapper for popbuffer, override buffers with getter/setter
            this.model = new WrappedPopbufferInfo(model, {
                indices,
                uv,
                normal,
                position
            });
            this.computeBoundingBox();
            this.computeMetadata();
            ContentBridge.popBufferGeometrySetModel(this, this.model);
        } else {
            this.model = model;
            this.computeBoundingBox();
            this.computeMetadata();
        }
    }
    /**
     * As the name shown.
     */
    public updateBufferAttributeFromModelData(): void {
        if (hasManagedContentAPI()) {
            return; // do not need, auto updated by getter/setter
        }
        const attributes = this.getAttributes();
        this.index.setArray(this.model.indices);
        this.index.needsUpdate = true;
        attributes.position.setArray(this.model.vertices);
        attributes.position.needsUpdate = true;
        attributes.normal.setArray(this.model.normals);
        attributes.normal.needsUpdate = true;
        attributes.uv.setArray(this.model.textures);
        attributes.uv.needsUpdate = true;
    }

    private computeMetadata(): void {
        const attributes = this.model.attributes;
        const boxMin = new Vector3().copy(attributes.boxMin as any);
        const boxSizeMagnitude = this.boundingBox!.getSize().length();
        const vertexGridSize = attributes.vertexGridSize;
        const vertexConstant = boxMin.clone().addScalar(HALF_GRID * vertexGridSize);
        this.metadata = {
            boxMin,
            boxSizeMagnitude,
            vertexGridSize,
            vertexConstant
        };
    }
    /**
     * Copy the data to this object from source.
     * @param { PopBufferGeometry } source the data source.
     */
    public copy(source: this): PopBufferGeometry {
        super.copy(source);
        this.setModel(source.model);
        this.metadata = source.metadata;
        return this;
    }
    /**
     * Return a clone of this object.
     */
    public clone(): PopBufferGeometry {
        return new PopBufferGeometry().copy(this) as PopBufferGeometry;
    }
    /**
     * @internal
     */
    public serialize(ctx: Serializer) {
        super.serialize(ctx);

        ctx.putRaw('model', {
            version: this.model.version,
            attributes: this.model.attributes,
            blocks: this.model.blocks,
            levelPrecisions: this.model.levelPrecisions,
            currentVertexCount: this.model.currentVertexCount,
            currentBlockFaceCounts: this.model.currentBlockFaceCounts,
            verticeDataLengthForEachLevel: this.model.verticeDataLengthForEachLevel,
        });
    }
    /**
     * @internal
     */
    public deserialize(ctx: Deserializer) {
        super.deserialize(ctx);
        const data = ctx.readRaw('model');
        const { boxMax, boxMin } = data.attributes as IPopbufferAttributes;

        const attributes = this.getAttributes();
        const model: IPopbufferInfo = {
            version: data.version,
            attributes: data.attributes,
            indices: this.index.array.slice() as Uint32Array,
            vertices: attributes.position.array.slice() as Float32Array,
            textures: attributes.uv.array.slice() as Float32Array,
            normals: attributes.normal.array.slice() as Float32Array,
            blocks: data.blocks as IMetaBlock[],
            maxPrecision: Math.ceil(Math.log2(Math.max(
                Math.floor(boxMax.x - boxMin.x),
                Math.floor(boxMax.y - boxMin.y),
                Math.floor(boxMax.z - boxMin.z),
            ))),
            levelPrecisions: data.levelPrecisions,
            currentVertexCount: data.currentVertexCount,
            currentBlockFaceCounts: data.currentBlockFaceCounts,
            verticeDataLengthForEachLevel: data.verticeDataLengthForEachLevel,
        };

        this.index.destroy();
        this.removeAndDestroyAttribute('uv');
        this.removeAndDestroyAttribute('normal');
        this.removeAndDestroyAttribute('position');
        this.setModel(model);
    }
}
