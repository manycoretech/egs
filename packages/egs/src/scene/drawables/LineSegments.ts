import { BufferGeometry, LineList } from '../../elements/geometries/containers/BufferGeometry';
import { Material } from '../../elements/materials/Material';
import { Drawable } from '../../scene/drawables/Drawable';
import { raycastLine } from './Line';
import { LineBasicMaterial } from '../../elements/materials/mesh/LineMaterial';
import { Intersection, Raycaster } from '../../scene/tools/Raycaster';
import { DrawMode } from '../../utils/Constants';

/**
 * This class is used to link points as pair and draw a segmented line between them.
 * It supports any type of geometry, but only line material is supported.
 */
export class LineSegments<M extends Material = Material> extends Drawable<M, BufferGeometry<LineList>> {
    /**
     * Used to check type of this or extended instance.
     * This value should not be changed by user.
     */
    public isLineSegments = true;
    /**
     * Decisive attribute to draw this object as separate line.
     */
    public drawMode = DrawMode.Lines;

    /**
     * The name of instance's class.
     */
    public className() {
        return 'LineSegments';
    }

    constructor(geometry?: BufferGeometry<LineList>, material?: M | M[]) {
        super(
            geometry !== undefined ? geometry : new BufferGeometry() as any,
            material !== undefined ? material : new LineBasicMaterial() as any
        );
    }

    /**
     * Get intersections between a casted {@link Ray| ray} and this Line.
     * The method {@link Raycaster.intersectObject| intersectObject()} will call this method, but the results are not ordered.
     * @param {Raycaster} raycaster the instance of Raycaster is used to get the data for calculation.
     * @param {Intersection} intersects the result will be stored here.
     */
    public raycastJsImpl(raycaster: Raycaster, intersects: Intersection[]) {
        raycastLine(raycaster, intersects, this, true);
    }
    /**
     * Return a clone of this object.
     */
    public clone(): LineSegments<M> {
        return new LineSegments(this.geometry, this._material).copy(this);
    }
}
