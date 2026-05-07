import { TypedArray } from '../../utils/Utils';
import { Color } from '../../math/Color';
import { Vector2 } from '../../math/Vector2';
import { Vector3 } from '../../math/Vector3';
import { Vector4 } from '../../math/Vector4';
import { Serializer, Deserializer } from '../../utils/Serialization';
import { ElementEventDispatcher } from '../../utils/EventDispatcher';
import { ContentBridge, ManagedContentBridge, hasManagedContentAPI } from '../../ContentAPI';
/**
 * This class stores data for an attribute (such as vertex positions, face indices, normals,
 * colors, UVs, and any custom attributes ) associated with a {@link BufferGeometry | BufferGeometry },
 * which allows for more efficient passing of data to the GPU. See that page for details and a usage example.<br /><br />
 * Data is stored as vectors of any length (defined by {@link itemSize | itemSize }),
 * and in general in the methods outlined below if passing in an index, this is automatically multiplied by the vector length.
 */
export class BufferAttribute<T extends TypedArray = TypedArray> extends ElementEventDispatcher {
    /**
     * @internal
     */
    dataVersion = 0;
    private lastSyncedVersion = -1;

    /**
     * The geometry attribute data store as TypedArray.
     */
    public _array: T; // todo we should move this array's ownership into content api
    /**
     * The geometry attribute data store as TypedArray.
     */
    get array(): T {
        if (hasManagedContentAPI() && (this._array.byteLength === 0 ||
            this.dataVersion !== this.lastSyncedVersion)) { // avoid invoke proxy
            ManagedContentBridge.bufferAttributeGetRefreshDataView(this);
            this.lastSyncedVersion = this.dataVersion;
        }
        return this._array;
    }

    set array(v: T) {
        this.setArray(v);
    }

    // this should be called after any write through array view
    notifyContentChange() {
        ContentBridge.bufferAttributeNotifyContentChange(this);
    }
    /**
     * If the buffer is storing a 3-component vector (such as a position, normal, or color),
     * then this will count the number of such vectors stored.
     */
    public itemSize: number;
    /**
     * If attribute data is normalized.
     */
    public normalized: boolean = false;
    /**
     * Stores the {@link array | array's } length divided by the {@link itemSize | itemSize }.<br /><br />
     * If the buffer is storing a 3-component vector (such as a position, normal, or color),
     * then this will count the number of such vectors stored.
     */
    public count: number;
    /**
     * The data of this buffer always need update.
     * @deprecated will not take effect, update `attribute.array` if need to reupload
     */
    public dynamic = false;
    /**
     * Object containing:<br />
     * offset:Integer - Default is *0*. Position at which to start update.<br />
     * count:Integer - Default is *-1*, which means don't use update ranges. <br /><br />
     * This can be used to only update some components of stored vectors (for example, just the component related to color).
     * @deprecated will not take effect, update `attribute.array` instead
     */
    public updateRange = { offset: 0, count: - 1 };
    /**
     * Used to check type of this or extended instance.
     * This value should not be changed by user.
     */
    public isBufferAttribute = true;
    /**
     * When the data is cleared from memory, this mark will be set true.
     * @deprecated never updated, always `false`.
     */
    public isDataDropped = false;
    /**
     * Remove the data after it is uploaded to GPU memory.
     * @deprecated will not take effect
     */
    public removeDataAfterUpload = false;
    /**
     * A version number, incremented every time the {@link needsUpdate | needsUpdate } property is set to true.
     */
    public version = 0;

    constructor(array: T, itemSize: number) {
        super();
        ContentBridge.bufferAttributeCreate(this);
        this.itemSize = itemSize;
        this.count = array !== undefined ? array.length / this.itemSize : 0;
        this.array = array;
    }
    /**
     * @ignore
     */
    public getLayoutKey(): string {
        return this.array.constructor.name + this.itemSize;
    }
    /**
     * A callback function for updating. It will be called after {@link needsUpdate | needsUpdate }.
     */
    public onUpdateCallback = function () { };
    /**
     * A callback function for uploading. It will be called after the data uploaded to WebGL.
     */
    public onUploadCallback = function () { };
    /**
     * When this attribute is set to true, the {@link version | version } will be change.
     */
    set needsUpdate(value: boolean) {
        if (value === true) {
            this.version++;
            this.onUpdateCallback();
        }
    }
    /**
     * Change the data of {@link array | array }.
     */
    public setArray(array: T) {
        this.dataVersion++;
        this.count = array !== undefined ? array.length / this.itemSize : 0;
        ContentBridge.bufferAttributeSetData(this, array, this.itemSize, this.count);
        if (!hasManagedContentAPI()) {
            this._array = array;
        } else {
            // make sure old array view not reference old wasm memory buffer
            // crucial to wasm rebuild the world
            ManagedContentBridge.bufferAttributeGetRefreshDataView(this);
            this.lastSyncedVersion = this.dataVersion;
        }
        return this;
    }
    /**
     * Change the state of {@link dynamic | dynamic }.
     */
    public setDynamic(value: boolean) {
        this.dynamic = value;
        return this;
    }
    /**
     * Copy the data to this object from source.
     * @param { BufferAttribute } source the data source.
     */
    public copy(source: BufferAttribute) {
        this.array = source.array.slice() as T;
        this.itemSize = source.itemSize;
        this.count = source.count;
        this.normalized = source.normalized;
        this.dynamic = source.dynamic;
        return this;
    }
    /**
     * Copy the data at specified position. The given index is items' index, do not need to multiply with item' size.
     * @param { number } index1 the start position of this array.
     * @param { BufferAttribute } attribute the start position of this array.
     * @param { number } index2 the start position of source array.
     */
    public copyAt(index1: number, attribute: BufferAttribute, index2: number) {
        index1 *= this.itemSize;
        index2 *= attribute.itemSize;
        for (let i = 0, l = this.itemSize; i < l; i++) {
            this.array[index1 + i] = attribute.array[index2 + i];
        }
        return this;
    }
    /**
     * Copy the data from given array to this {@link array | array }.
     * @param { TypedArray } array the start position of this array.
     */
    public copyArray(array: TypedArray | number[]) {
        this.array.set(array);
        return this;
    }
    /**
     * Copy the data from given array to this {@link array | array }.
     * @param { Color[] } colors the start position of this array.
     */
    public copyColorArray(colors: Color[]) {
        const array = this.array;
        let offset = 0;
        for (let i = 0, l = colors.length; i < l; i++) {
            const color = colors[i];
            array[offset++] = color.r;
            array[offset++] = color.g;
            array[offset++] = color.b;
        }
        return this;
    }
    /**
     * Copy the data which is type of Vector2 from given array to this {@link array | array }.
     * @param { Vector2[] } vectors the start position of this array.
     */
    public copyVector2Array(vectors: Vector2[]) {
        const array = this.array;
        let offset = 0;
        for (let i = 0, l = vectors.length; i < l; i++) {
            const vector = vectors[i];
            array[offset++] = vector.x;
            array[offset++] = vector.y;
        }
        return this;
    }
    /**
     * Copy the data which is type of Vector3 from given array to this {@link array | array }.
     * @param { Vector3[] } vectors the start position of this array.
     */
    public copyVector3Array(vectors: Vector3[]) {
        const array = this.array;
        let offset = 0;
        for (let i = 0, l = vectors.length; i < l; i++) {
            const vector = vectors[i];
            array[offset++] = vector.x;
            array[offset++] = vector.y;
            array[offset++] = vector.z;
        }
        return this;
    }
    /**
     * Copy the data which is type of Vector4 from given array to this {@link array | array }.
     * @param { Vector4[] } vectors the start position of this array.
     */
    public copyVector4Array(vectors: Vector4[]) {
        const array = this.array;
        let offset = 0;
        for (let i = 0, l = vectors.length; i < l; i++) {
            const vector = vectors[i];
            array[offset++] = vector.x;
            array[offset++] = vector.y;
            array[offset++] = vector.z;
            array[offset++] = vector.w;
        }
        return this;
    }
    /**
     * Copy the data from given Array or typedArray.
     * @param { ArrayLike<number> } value an Array or TypedArray from which to copy values.
     * @param { number } offset (optional) index of the {@link array | array } at which to start copying.
     */
    public set(value: ArrayLike<number>, offset?: number) {
        if (offset === undefined) {
            offset = 0;
        }
        this.array.set(value, offset);
        return this;
    }
    /**
     * Return the x component of all items.
     */
    public getX(index: number) {
        return this.array[index * this.itemSize];
    }
    /**
     * Set the x component of the vector at the given index.
     */
    public setX(index: number, x: number) {
        this.array[index * this.itemSize] = x;
        return this;
    }
    /**
     * Return the y component of all vectors.
     */
    public getY(index: number) {
        return this.array[index * this.itemSize + 1];
    }
    /**
     * Set the y component of the vector at the given index.
     */
    public setY(index: number, y: number) {
        this.array[index * this.itemSize + 1] = y;
        return this;
    }
    /**
     * Return the z component of all vectors.
     */
    public getZ(index: number) {
        return this.array[index * this.itemSize + 2];
    }
    /**
     * Set the z component of the vector at the given index.
     */
    public setZ(index: number, z: number) {
        this.array[index * this.itemSize + 2] = z;
        return this;
    }
    /**
     * Return the w component of all vectors.
     */
    public getW(index: number) {
        return this.array[index * this.itemSize + 3];
    }
    /**
     * Set the w component of the vector at the given index.
     */
    public setW(index: number, w: number) {
        this.array[index * this.itemSize + 3] = w;
        return this;
    }
    /**
     * Set the x and y component of the vector at the given index.
     */
    public setXY(index: number, x: number, y: number) {
        const array = this.array;
        index *= this.itemSize;
        array[index + 0] = x;
        array[index + 1] = y;
        return this;
    }
    /**
     * Set the x , y and z component of the vector at the given index.
     */
    public setXYZ(index: number, x: number, y: number, z: number) {
        const array = this.array;
        index *= this.itemSize;
        array[index + 0] = x;
        array[index + 1] = y;
        array[index + 2] = z;
        return this;
    }
    /**
     * Set all component of the vector at the given index.
     */
    public setXYZW(index: number, x: number, y: number, z: number, w: number) {
        const array = this.array;
        index *= this.itemSize;
        array[index + 0] = x;
        array[index + 1] = y;
        array[index + 2] = z;
        array[index + 3] = w;
        return this;
    }
    /**
     * Return the vector2 at specific position.
     */
    public getVector2(index: number, out = new Vector2()) {
        const array = this.array;
        const i = index * this.itemSize;
        out.x = array[i];
        out.y = array[i + 1];
        return out;
    }
    /**
     * @ignore
     */
    public onUpload(callback: () => void) {
        this.onUploadCallback = callback;
        return this;
    }
    /**
     * Return a clone of this object.
     */
    public clone(): BufferAttribute<T> {
        return new BufferAttribute(this.array, this.itemSize).copy(this);
    }
    /**
     * @ignore
     */
    public serialize(ctx: Serializer) {
        ctx.puts<BufferAttribute>(['itemSize', 'normalized', 'count', 'dynamic']);
        ctx.putRaw('array', ctx.collectBuffer(this.array));
        ctx.putRaw('updateRange', ctx.deepClone(this.updateRange));
    }
    /**
     * @ignore
     */
    public deserialize(ctx: Deserializer) {
        ctx.reads<BufferAttribute>(['itemSize', 'normalized', 'count', 'dynamic']);
        this.array = ctx.getBuffer(ctx.readRaw('array')) as T;
        this.updateRange = ctx.readRaw('updateRange');
    }
    /**
     * Release the memory which is occupied by this instance from CPU and GPU.
     */
    public destroy() {
        super.destroy();
        ContentBridge.bufferAttributeDestroy(this);
        // we must set this empty, because the detached arraybuffer still reference data
        // not use null because it's too dangerous
        this._array = new Float32Array() as T;
    }

    public freeGPU() {
        ContentBridge.bufferAttributeFreeGPU(this);
    }
}
