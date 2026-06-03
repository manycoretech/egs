import { Sphere } from '../../math/Sphere';
import { Drawable } from './Drawable';
import type { Raycaster, Intersection } from '../tools/Raycaster';
import { Vector3 } from '../../math/Vector3';
import { BufferGeometry, type PointList } from '../../elements/geometries/containers/BufferGeometry';
import type { Material } from '../../elements/materials/Material';
import { PointsMaterial } from '../../elements/materials/mesh/PointsMaterial';
import { DrawMode } from '../../utils/Constants';

const sphere = new Sphere();
const position = new Vector3();
const intersectPoint = new Vector3();
/**
 * This class is used to draw all vertexes of geometry as a series of independent points.
 * It supports any type of geometry, but only PointsMaterial is supported.
 */
export class Points<M extends Material = Material> extends Drawable<M, BufferGeometry<PointList>> {
    className() {
        return 'Points';
    }

    type = 'Points';
    /**
     * Check the type whether it belongs to Points.
     */
    isPoints = true;
    /**
     * Decisive attribute to draw this object as continuous line.
     */
    drawMode = DrawMode.Points;

    constructor(geometry?: BufferGeometry<PointList>, material?: M | M[]) {
        super(
            geometry !== undefined ? geometry : new BufferGeometry(),
            material !== undefined ? material : new PointsMaterial() as any
        );
    }
    /**
     * Get intersections between a casted {@link Ray| ray} and this point,
     * all points whose distance from ray less than {@link Raycaster.pointThreshold| threshold} will be push into intersects.<br />
     * The method {@link Raycaster.intersectObject| intersectObject()} will call this method.
     * @param {Raycaster} raycaster the instance of Raycaster is used to get the data for calculation.
     * @param {Intersection} intersects the result will be stored here.
     */
    raycastJsImpl(raycaster: Raycaster, intersects: Intersection[]) {
        const object = this;
        const geometry = this.geometry;
        const matrixWorld = this.matrixWorld;
        const ray = raycaster.ray;

        // Checking boundingSphere distance to ray
        sphere.copy(geometry.getBoundingSphere());
        sphere.applyMatrix4(matrixWorld);
        const sphereThreshold = raycaster.getPointTolerance(raycaster.ray.directionDistance(sphere.center));
        sphere.radius += sphereThreshold;
        if (!raycaster.ray.intersectsSphere(sphere)) {
            return;
        }

        function intersectionPoint(point: Vector3, index: number) {
            point.applyMatrix4(matrixWorld);
            ray.closestPointToPoint(point, intersectPoint);
            const dist = intersectPoint.distanceTo(point);
            const distance = raycaster.ray.origin.distanceTo(intersectPoint);
            const threshold = raycaster.getPointTolerance(distance);
            if (dist > threshold || distance < raycaster.near || distance > raycaster.far) {
                return;
            }

            intersects.push({
                distance,
                distanceToRay: dist,
                point: intersectPoint.clone(),
                primitiveIndex: index,
                index,
                face: undefined,
                object
            });
        }

        const index = geometry.index;
        const positions = geometry.position.array;
        if (index !== null) {
            const indices = index.array;
            for (let i = 0, il = indices.length; i < il; i++) {
                position.fromArray(positions, indices[i] * 3);
                intersectionPoint(position, i);
            }
        } else {
            for (let i = 0, l = positions.length / 3; i < l; i++) {
                position.fromArray(positions, i * 3);
                intersectionPoint(position, i);
            }
        }
    }

    /**
     * Return a clone of this object.
     */
    clone(recursive?: boolean): Points<M> {
        return new Points(this.geometry, this._material).copy(this, recursive);
    }
}
