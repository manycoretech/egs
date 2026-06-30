import { BufferGeometry } from './BufferGeometry.js';
import { ContentBridge } from '../../../ContentAPI.js';

export class InstancedBufferGeometry extends BufferGeometry {
    /**
     * Used to check type of this or extended instance.
     * This value should not be changed by user.
     */
    isInstancedBufferGeometry = true;
    /**
     * The type of this instance.
     */
    type = 'InstancedBufferGeometry';
    /**
     * The number of instanced object.
     */
    private _instancedCount: number = 0;
    get instancedCount() {
        return this._instancedCount;
    }
    set instancedCount(v: number) {
        this._instancedCount = v;
        ContentBridge.bufferGeometrySetInstanceCount(this, v);
    }
    /**
     * Copy the data to this object from source.
     * This method need override in derived classes to copy extended data.
     * @param {InstancedBufferGeometry} source the data source.
     */
    copy(source: InstancedBufferGeometry) {
        super.copy(source);
        this.instancedCount = source.instancedCount;
        return this;
    }
    /**
     * Create a clone of this instance.
     */
    clone() {
        return new InstancedBufferGeometry().copy(this);
    }
}
