import { logger } from '../../../utils/Logger';
import { Box3 } from '../../../math/Box3';
import { Sphere } from '../../../math/Sphere';
import { Vector3 } from '../../../math/Vector3';
import { EventType } from '../../../utils/EventDispatcher';
import { Deserializer, Serializer } from '../../../utils/Serialization';
import { Nullable, TypedArray, Utils } from '../../../utils/Utils';
import { BufferAttribute } from '../../attributes/BufferAttribute';
import { Geometry } from './Geometry';
import { GeometryBase } from './GeometryBase';
import { ContentBridge, hasManagedContentAPI, ManagedContentBridge } from '../../../ContentAPI';
import { updateByGeometry } from '../operators/FromGeometry';
import { MeshBVH } from '../../../BVH';

/**
 * Event emitted when a buffer geometry is disposed.
 */
export const GeometryDisposeEvent = new EventType<BufferGeometryBase>();
/**
 * Event emitted when a buffer geometry attribute is added, removed, or replaced.
 */
export const GeometryAttributeChangedEvent = new EventType<{ geometry: BufferGeometryBase, attributeName: string, newValue: Nullable<BufferAttribute>, oldValue: Nullable<BufferAttribute>, update: boolean }>();

const vector = new Vector3();
const box = new Box3();

/**
 * used to describe draw range
 */
export interface BufferRange {
    /**
     * start offset of index or position
     */
    start: number;
    /**
     * index or position element count
     */
    count: number;
}

// split a whole buffer geometry into different group to different materials
/**
 * Draw range within a buffer geometry together with its material index.
 */
export interface BufferGroup extends BufferRange {
    materialIndex: number;
}

/**
 * Buffer attribute type used to store geometry indices.
 */
export type IndexBufferAttribute = BufferAttribute<Uint16Array | Uint32Array>;

let bufferGeometryId = 1; // BufferGeometry uses odd numbers as Id
/**
 * An efficient representation of mesh, line, or point geometry, which includes vertex positions, face indices, normals, colors, UVs,
 * and custom attributes within buffers, reducing the cost of passing all this data to the GPU.
 * To read and edit data in BufferGeometry attributes, see {@link BufferAttribute| BufferAttribute } documentation.
 * For a less efficient but easier-to-use representation of geometry, see {@link Geometry| Geometry }.<br />
 */
export abstract class BufferGeometryBase extends GeometryBase {
    /**
     * The name of viewer, which could be empty.
     */
    name = '';
    /**
     * The type of this instance.
     * This will be give in extended class.
     */
    type = 'BufferGeometry';
    /**
     * Flag to indicate the type of this class.
     * This value should not be changed by user.
     */
    isBufferGeometry = true;
    /**
     * This object is used to record all parameters which are set when instance is initialized.
     * But, change the value of this object may not change the geometry directly.
     */
    parameters = {};
    /**
     * Use BVH to accelerate rendering.
     * This value usually dose not need you to change it, it is built by the engine automatically.
     */
    meshBVH?: MeshBVH;
    /**
     * @internal
     */
    meshBVHVersion: number = 0;
    /**
     * Allows for vertices to be re-used across multiple triangles; this is called using "indexed triangles". <br />
     * and works much the same as it does in Geometry: each triangle is associated with the indices of three vertices. <br />
     * This attribute therefore stores the index of each vertex for each triangular face. <br />
     * If this attribute is not set, the renderer assumes that each three contiguous positions represent a single triangle. <br />
     * This should be set by {@link setIndex| setIndex()} to avoid error.
     * @defaultValue `null`
     */
    _index: Nullable<IndexBufferAttribute> = null;

    get index(): IndexBufferAttribute { // TODO: null type
        return this._index!;
    }
    set index(v) {
        const oldValue = this._index;
        ContentBridge.bufferGeometrySetIndexAttribute(this, v);
        this._index = v;
        if (oldValue !== v) {
            this.emit(GeometryAttributeChangedEvent, { geometry: this, attributeName: 'index', newValue: v, oldValue, update: false });
        }
    }
    /**
     * Core data of Geometry such as vertex positions, normals, UVs and color.
     * @tips It's better to use {@link addAttribute| addAttribute() } or {@link setAttribute| setAttribute() } to change this.
     * @remarks See {@link BufferAttribute| BufferAttribute} for more details.
     */
    attributes: { [index: string]: BufferAttribute } = {};
    /**
     * @internal
     * */
    getAttributes(): Readonly<{ [index: string]: BufferAttribute }> {
        return this.attributes;
    }
    /**
     * @internal
     */
    _attributeBindMap: Record<string, string> = {};
    get position() {
        return this.attributes.position;
    }
    get uv() {
        return this.attributes.uv;
    }
    /**
     * Split the geometry into groups, they still are rendered in different WebGL drawcalls. <br />
     * This allows an array of materials to be used with the bufferGeometry.
     * Each group is an object of the form: `{ start: Integer, count: Integer, materialIndex: Integer, instances?: Integer }`<br />
     * Start specifies the first element in this draw call – the first vertex for non-indexed geometry, otherwise the first triangle index.<br />
     * Count specifies how many vertices (or indices) are included.<br />
     * MaterialIndex specifies the material array index to use.<br />
     * Instances(optional) specifies the number of instanced object, this value do not manually set.
     */
    protected groups: BufferGroup[] = [];

    /**
     * @internal
     */
    getGroups(): ReadonlyArray<Readonly<BufferGroup>> {
        return this.groups;
    }

    /**
     * get group at index
     */
    getGroup(index: number): BufferGroup | undefined {
        return this.groups[index];
    }

    /**
     * Split the data into different groups.
     */
    setGroup(group: BufferGroup, index: number): void {
        this.groups[index] = group;
        ContentBridge.bufferGeometrySetGroup(this, index, group);
    }
    /**
     * set entire groups
     */
    setGroups(groups: BufferGroup[]) {
        this.groups = groups;
        ContentBridge.bufferGeometryClearGroups(this);
        this.groups.forEach((g, index) => {
            this.setGroup(g, index);
        });
        return this;
    }
    /**
     * push a group
     */
    pushGroup(group: BufferGroup) {
        this.groups.push(group);
        ContentBridge.bufferGeometrySetGroup(this, this.groups.length - 1, group);
        return this;
    }
    /**
     * Split geometry data to a new group.
     * @remarks See {@link groups| groups} for more details.
     */
    addGroup(start: number, count: number, materialIndex?: number): void {
        this.pushGroup({
            start,
            count,
            materialIndex: materialIndex !== undefined ? materialIndex : 0
        });
    }
    /**
     * Clean all objects in the {@link groups| groups}.
     */
    clearGroups(): void {
        this.groups = [];
        ContentBridge.bufferGeometryClearGroups(this);

    }

    /**
     * Determines which part of buffer will be rendered.
     * @deprecated
     * @defaultValue `{ start: 0, count: Infinity }` All data will be uploaded.
     */
    drawRange: BufferRange = { start: 0, count: Infinity };

    protected boundingBox: Nullable<Box3> = null;
    protected boundingSphere: Nullable<Sphere> = null;
    /**
     * If {@link boundingBox| boundingBox} is null, it will be {@link computeBoundingBox| calculated} a new one.
     */
    getBoundingBox() {
        if (this.boundingBox === null) {
            this.computeBoundingBox();
        }
        return this.boundingBox!;
    }
    /**
     * If {@link boundingSphere| boundingSphere} is null, it will be {@link computeBoundingSphere| calculated} a new one.
     */
    getBoundingSphere() {
        if (this.boundingSphere === null) {
            this.computeBoundingSphere();
        }
        return this.boundingSphere!;
    }
    /**
     * Clear the bounding box and sphere and recalculate them later.
     */
    notifyShapeChanged() {
        super.notifyShapeChanged();
        this.boundingBox = null;
        this.boundingSphere = null;
        if (this.meshBVH) {
            this.meshBVH.destroy();
            this.meshBVH = undefined;
        }
        this.meshBVHVersion++;
    }
    /**
     * Generate a hash key according to {@link index| index} and all {@link attributes| attributes}.
     */
    getAttributeLayoutKey(): string {
        let result = '';
        if (this.index) {
            result += this.index.getLayoutKey();
        }
        result += Object.keys(this.attributes).map(key => this.attributes[key].getLayoutKey()).join('');
        return result;
    }

    constructor() {
        super();
        this.id = bufferGeometryId += 2;
        ContentBridge.bufferGeometryCreate(this);
    }
    /**
     * The name of instance's class.
     */
    className() {
        return 'BufferGeometry';
    }
    /**
     * Clean old data of engine and load new data in next update.
     */
    attributeChanged() {
        this.freeGPU();
    }
    /**
     * Return current instance of this class.
     */
    getBufferGeometry() {
        return this;
    }
    /**
     * Return current instance of this class.
     */
    getLineBufferGeometry() {
        return this;
    }
    /**
     * Return the instance of {@link index| index}.
     */
    getIndex(): IndexBufferAttribute {
        return this.index!;
    }
    /**
     * Call this method to let engine refresh data of {@link meshBVH| meshBVH}.
     */
    onAttributeUpdate(): void {
        this.notifyShapeChanged();
    }
    /**
     * Use this method to set new {@link index| index} for geometry.
     * @param {IndexBufferAttribute | number[]} index source data of the index.
     */
    setIndex(index: IndexBufferAttribute | number[] | TypedArray) {
        if (index instanceof BufferAttribute) {
            this.index = index;
        } else {
            this.index = new BufferAttribute(Utils.arrayMax(index) > 65535 ? new Uint32Array(index) : new Uint16Array(index), 1);
        }
        this.index.onUpdateCallback = this.onAttributeUpdate.bind(this);
        return this;
    }

    addAttribute(name: string, attribute: BufferAttribute) {
        const oldValue = this.attributes[name];
        ContentBridge.bufferGeometrySetAttribute(this, name, attribute);
        this.attributes[name] = attribute;
        attribute.onUpdateCallback = this.onAttributeUpdate.bind(this);
        if (oldValue !== attribute) {
            this.emit(GeometryAttributeChangedEvent, { geometry: this, attributeName: name, newValue: attribute, oldValue, update: false });
        }
        return this;
    }
    /**
     * Change the given {@link attributes| attributes} for geometry.
     * @param {string} name the name of data such as position, uv and normal.
     * @param {BufferAttribute} attribute source data. see {@link BufferAttribute| BufferAttribute} for more details.
     */
    setAttribute(name: string, attribute: BufferAttribute) {
        return this.addAttribute(name, attribute);
    }
    /**
     * Get specified {@link attributes| attributes} from geometry.
     * @param {string} name the name of target attributes.
     */
    addOrSetAttribute(name: string, array: TypedArray, itemSize: number) {
        const attribute = this.getAttribute(name);
        if (attribute) {
            attribute.setArray(array);
            attribute.needsUpdate = true;
            this.emit(GeometryAttributeChangedEvent, { geometry: this, attributeName: name, update: true, newValue: attribute, oldValue: null });
        } else {
            this.addAttribute(name, new BufferAttribute(array, itemSize));
        }
    }

    getAttribute(name: string): BufferAttribute | undefined {
        return this.attributes[name];
    }
    /**
     * Remove specified {@link attributes| attributes} from geometry.
     * @param {string} name the name of target attributes.
     */
    removeAttribute(name: string) {
        delete this.attributes[name];
        return this;
    }

    removeAndDestroyAttribute(name: string) {
        if (this.attributes[name]) {
            this.attributes[name].destroy();
        }
        this.removeAttribute(name);
        return this;
    }
    /**
     * Find the group which the vertex belong to.
     * @param {number} index Queried vertex index.
     */
    getGroupByVertexIndex(index: number): {
        group: BufferGroup;
        groupIndex: number;
    } {
        for (let i = 0; i < this.groups.length; i++) {
            const group = this.groups[i];
            if (group.start <= index && index < group.start + group.count) {
                return {
                    group,
                    groupIndex: i
                };
            }
        }
        return undefined!; // TODO: null type
    }

    /**
     * Change the value of {@link drawRange| drawRange}.
     * @deprecated
     */
    setDrawRange(start: number, count: number): void {
        this.drawRange.start = start;
        this.drawRange.count = count;
    }

    protected checkRefreshBoundingSphereFast() {
        if (hasManagedContentAPI() && ManagedContentBridge.isContentOwnGeometricData()) {
            this.boundingSphere = ManagedContentBridge.bufferGeometryGetLocalBBall(this);
            return true;
        }
        return false;
    }

    protected checkRefreshBoundingBoxFast() {
        if (hasManagedContentAPI() && ManagedContentBridge.isContentOwnGeometricData()) {
            this.boundingBox = ManagedContentBridge.bufferGeometryGetLocalBBox(this);
            return true;
        }
        return false;
    }
    /**
     * Computes bounding box according to vertexes, updating boundingBox attribute.
     * Bounding boxes aren't computed by default. They need to be explicitly computed, otherwise they are null.
     */
    computeBoundingBox(): void {
        if (this.checkRefreshBoundingBoxFast()) {
            return;
        }

        if (this.boundingBox === null) {
            this.boundingBox = new Box3();
        }

        const position = this.attributes.position;
        if (position !== undefined) {
            this.boundingBox.setFromBufferAttribute(position);
        } else {
            this.boundingBox.makeEmpty();
        }

        if (isNaN(this.boundingBox.min.x) || isNaN(this.boundingBox.min.y) || isNaN(this.boundingBox.min.z)) {
            logger.warn('EGS.BufferGeometry.computeBoundingBox: Computed min/max have NaN values. The "position" attribute is likely to have NaN values.', this);
        }

    }
    /**
     * Computes bounding sphere according to vertexes, updating boundingSphere attribute.
     * Bounding spheres aren't computed by default. They need to be explicitly computed, otherwise they are null.
     */
    computeBoundingSphere(): void {
        if (this.checkRefreshBoundingSphereFast()) {
            return;
        }

        if (this.boundingSphere === null) {
            this.boundingSphere = new Sphere();
        }

        const position = this.attributes.position;
        if (position) {
            const center = this.boundingSphere.center;
            box.setFromBufferAttribute(position);
            box.getCenter(center);

            // hoping to find a boundingSphere with a radius smaller than the
            // boundingSphere of the boundingBox: sqrt(3) smaller in the best case
            let maxRadiusSq = 0;

            for (let i = 0, il = position.count; i < il; i++) {
                vector.x = position.getX(i);
                vector.y = position.getY(i);
                vector.z = position.getZ(i);
                maxRadiusSq = Math.max(maxRadiusSq, center.distanceToSquared(vector));
            }

            this.boundingSphere.radius = Math.sqrt(maxRadiusSq);

            if (isNaN(this.boundingSphere.radius)) {
                logger.warn('EGS.BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.', this);
            }
        }
    }

    /**
     * Copy the data to this object from source.
     * This method need override in derived classes to copy extended data.
     * @param {Object3D} source the data source.
     */
    copy(source: BufferGeometryBase): BufferGeometryBase {
        let name, i, l;

        // reset
        this.index = null!;
        this.attributes = {};
        this.groups = [];
        this.boundingBox = null;
        this.boundingSphere = null;

        // name
        this.name = source.name;

        // index
        const index = source.index;

        if (index !== null) {
            this.setIndex(index);
        }

        // attributes
        const attributes = source.attributes;
        for (name in attributes) {
            const attribute = attributes[name];
            this.addAttribute(name, attribute);
        }

        // groups
        const groups = source.groups;
        for (i = 0, l = groups.length; i < l; i++) {
            const group = groups[i];
            this.addGroup(group.start, group.count, group.materialIndex);
        }

        // bounding box
        const boundingBox = source.boundingBox;
        if (boundingBox !== null) {
            this.boundingBox = boundingBox.clone();
        }

        // bounding sphere
        const boundingSphere = source.boundingSphere;
        if (boundingSphere !== null) {
            this.boundingSphere = boundingSphere.clone();
        }

        // draw range
        this.drawRange.start = source.drawRange.start;
        this.drawRange.count = source.drawRange.count;

        return this;
    }

    _computeGroups(geometry: Geometry): void {
        let group: BufferGroup | undefined = undefined;
        const groups: BufferGroup[] = [];
        let materialIndex = 0;
        const faces = geometry.faces;
        for (let i = 0; i < faces.length; i++) {
            const face = faces[i];
            // materials
            if (face.materialIndex !== materialIndex) {
                materialIndex = face.materialIndex;
                if (group !== undefined) {
                    group.count = (i * 3) - group.start;
                    groups.push(group);
                }

                group = {
                    start: i * 3,
                    count: 0, // count will get later
                    materialIndex
                };
            }
        }
        this.groups = groups;
    }
    /**
     * UUID of this BufferGeometries instance. This gets automatically assigned, so this shouldn't be edited.
     */
    getUUID() {
        return this.uuid;
    }
    /**
     * Store the attributes of this class into string as serializing format.
     * @param {Serializer} ctx this parameter has not supported external Serializer yet.
     * It may cause that this method can not be used directly.
     */
    serialize(ctx: Serializer) {
        ctx.puts<BufferGeometry>(['name', 'index']);
        ctx.putRaw('groups', ctx.deepClone(this.groups));
        ctx.putRaw('parameters', ctx.deepClone(this.parameters));

        const attributes = this.attributes;
        const attributeSer: any = {};
        for (const key in attributes) {
            const attribute = attributes[key];
            attributeSer[key] = ctx.serialize(attribute);
        }
        ctx.putRaw('attribute', attributeSer);
    }
    /**
     * Parse the data for this class from string according to serializing format.
     * @param {Deserializer} ctx this parameter has not supported external Deserializer yet.
     * It may cause that this method can not be used directly.
     */
    deserialize(ctx: Deserializer) {
        const data = ctx.readRaw('data');
        // support old data(convert geometry to buffer geometry)
        if (data && data.faces !== undefined) {
            const geo = new Geometry();
            geo.deserialize(ctx);
            const bufferGeometry = new BufferGeometry();
            updateByGeometry(bufferGeometry, geo);
            for (const key in bufferGeometry.attributes) {
                const attribute = bufferGeometry.attributes[key];
                this.setAttribute(key, attribute);
            }
            this.attributes = bufferGeometry.attributes;
            this.index = bufferGeometry.index;
            this.setGroups(bufferGeometry.groups);
            return;
        }

        ctx.reads<BufferGeometry>(['name']);

        const index = ctx.readRaw('index');
        if (index !== null) {
            this.index = ctx.deserialize(index, new BufferAttribute(undefined as any, 0)) as BufferAttribute<Uint32Array>;
        } else {
            this.index = null!;
        }

        this.setGroups(ctx.readRaw('groups'));
        this.parameters = ctx.readRaw('parameters');

        const attributes: any = {};
        const attributesSer = ctx.readRaw('attribute');
        for (const key in attributesSer) {
            const attribute = attributesSer[key];
            const target = new BufferAttribute(undefined as any, 1);
            attributes[key] = target;
            this.setAttribute(key, ctx.deserialize(attribute, target) as BufferAttribute);
        }

        this.attributes = attributes;
    }
    /**
     * Clear the current geometry's data in memory.
     */
    freeGPU() {
        this.emit(GeometryDisposeEvent, this);
        ContentBridge.bufferGeometryFreeGPU(this);
    }

    destroy() {
        super.destroy();
        ContentBridge.bufferGeometryDestroy(this as any);
    }

    destroyAttributes() {
        const attributes = Object.values(this.attributes);
        for (let i = 0; i < attributes.length; i++) {
            attributes[i].destroy();
        }
        if (this.index) {
            this.index.destroy();
        }
    }

    freeAttributesGpuResource() {
        const attributes = Object.values(this.attributes);
        for (let i = 0; i < attributes.length; i++) {
            attributes[i].freeGPU();
        }
        if (this.index) {
            this.index.freeGPU();
        }
    }

    destroyAllResourcesOwned() {
        this.destroyAttributes();
        this.destroy();
    }

    freeAllGpuResourceOwned() {
        this.freeAttributesGpuResource();
        this.freeGPU();
    }

    forceCastTopology<R extends Topology>(): BufferGeometry<R> {
        return this as any as BufferGeometry<R>;
    }
}

enum PrimitiveTopology {
    Point = 0,
    Line = 1,
    LineStrip = 2,
    Triangle = 3,
    TriangleStrip = 4,
}

interface Topology { __topologyTypeMark: PrimitiveTopology }
/**
 * Topology marker for triangle-list buffer geometry.
 */
export class TriangleList implements Topology { __topologyTypeMark: PrimitiveTopology.Triangle; __tl: boolean; }
/**
 * Topology marker for line-list buffer geometry.
 */
export class LineList implements Topology { __topologyTypeMark: PrimitiveTopology.Line; __ll: boolean; }
/**
 * Topology marker for line-strip buffer geometry.
 */
export class LineStrip implements Topology { __topologyTypeMark: PrimitiveTopology.LineStrip; __ls: boolean; }
/**
 * Topology marker for point-list buffer geometry.
 */
export class PointList implements Topology { __topologyTypeMark: PrimitiveTopology.Point; __pl: boolean; }

/**
 * GPU-friendly geometry container backed by buffer attributes.
 */
export class BufferGeometry<T extends Topology = TriangleList> extends BufferGeometryBase {
    __topologyMark: T;

    /**
    * Create a clone of this instance.
    */
    clone(): BufferGeometry<T> {
        return new BufferGeometry().copy(this) as BufferGeometry<T>;
    }
}
