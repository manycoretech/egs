import { EventType, ElementEventDispatcher } from '../../../utils/EventDispatcher.js';
import type { Nullable } from '../../../utils/Utils.js';
import type { Box3 } from '../../../math/Box3.js';
import type { Sphere } from '../../../math/Sphere.js';
import type { SerializerableDelegatedAsReference, Serializer, Deserializer } from '../../../utils/Serialization.js';
import type { ElementsWithGPUResource } from '../../../utils/ElementBase.js';

export const GeometryShapeChanged = new EventType<GeometryBase>();
export const GeometryContentChanged = new EventType<GeometryBase>();

let geometryId = 0; // Geometry uses even numbers as Id
/**
 * This class is a base class of every Geometry and BufferGeometry.
 * All of Geometry and BufferGeometry must implement the abstract function for engine in order to correctly accelerate render.
 */
export abstract class GeometryBase
    extends ElementEventDispatcher
    implements SerializerableDelegatedAsReference, ElementsWithGPUResource
{
    id = (geometryId += 2);

    protected boundingBox: Nullable<Box3> = null;
    protected boundingSphere: Nullable<Sphere> = null;

    getUUID() {
        return this.uuid;
    }
    abstract computeBoundingBox(): void;
    abstract computeBoundingSphere(): void;

    abstract className(): string;
    abstract serialize(serialize: Serializer): void;
    abstract deserialize(ctx: Deserializer): void;

    abstract freeGPU(): void;

    abstract clone(): GeometryBase;

    getBoundingBox() {
        if (this.boundingBox === null) {
            this.computeBoundingBox();
        }
        return this.boundingBox!;
    }

    getBoundingSphere() {
        if (this.boundingSphere === null) {
            this.computeBoundingSphere();
        }
        return this.boundingSphere!;
    }

    notifyShapeChanged() {
        this.boundingBox = null;
        this.boundingSphere = null;
        this.emit(GeometryShapeChanged, this);
        this.emit(GeometryContentChanged, this);
    }

    notifyGeometryContentChange() {
        this.freeGPU();
        this.emit(GeometryContentChanged, this);
    }
}
