import { BufferAttribute } from './BufferAttribute';
import { TypedArray } from '../../utils/Utils';
/**
 * An instanced version of {@link BufferAttribute | BufferAttribute }.
 */
export class InstancedBufferAttribute<T extends TypedArray = TypedArray> extends BufferAttribute<T> {
    /**
     * Defines how often a value of this buffer attribute should be repeated.
     * A value of one means that each value of the instanced attribute is used for a single instance.
     * A value of two means that each value is used for two consecutive instances (and so on).
     * Default is *1*.
     */
    public meshPerAttribute: number;
    /**
     * Used to check type of this or extended instance.
     * This value should not be changed by user.
     */
    public isInstancedBufferAttribute = true;

    constructor(data: T, itemSize: number, meshPerAttribute?: number) {
        super(data, itemSize);
        this.meshPerAttribute = meshPerAttribute || 1;
    }
    /**
     * Copy the data to this object from source.
     * @param { InstancedBufferAttribute } source the data source.
     */
    public copy(source: InstancedBufferAttribute) {
        super.copy(source);
        this.meshPerAttribute = source.meshPerAttribute;
        return this;
    }
}
