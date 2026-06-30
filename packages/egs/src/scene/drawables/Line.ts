import { Vector3 } from '../../math/Vector3.js';
import { Matrix4 } from '../../math/Matrix4.js';
import { Ray } from '../../math/Ray.js';
import { Sphere } from '../../math/Sphere.js';
import { Drawable } from './Drawable.js';
import { BufferGeometry, type LineStrip } from '../../elements/geometries/containers/BufferGeometry.js';
import type { Material } from '../../elements/materials/Material.js';
import { LineBasicMaterial } from '../../elements/materials/mesh/LineMaterial.js';
import type { Raycaster, Intersection } from '../tools/Raycaster.js';
import { DrawMode } from '../../utils/Constants.js';

const inverseMatrix = new Matrix4();
const ray = new Ray();
const sphere = new Sphere();
const realScaleTemp = new Vector3();

/**
 * This class is used to link points as one by one and draw a continuous line between them.
 * It supports any type of geometry, but only line material is supported.
 * The segment and loop line also need to extend this class.
 */
export class Line<M extends Material = Material> extends Drawable<M, BufferGeometry<LineStrip>> {
    /**
     * Check the type whether it belongs to Line.
     * This value should not be changed by user.
     */
    isLine = true;
    /**
     * Decisive attribute to draw this object as continuous line.
     */
    drawMode = DrawMode.LineStrip;
    /**
     * The name of instance's class.
     */
    className() {
        return 'Line';
    }

    constructor(geometry?: BufferGeometry<LineStrip>, material?: M | M[]) {
        super(
            geometry !== undefined ? geometry : (new BufferGeometry() as any),
            material !== undefined ? material : (new LineBasicMaterial() as any),
        );
    }

    /**
     * Get intersections between a casted {@link Ray| ray} and this Line.
     * The method {@link Raycaster.intersectObject| intersectObject()} will call this method, but the results are not ordered.
     * @param {Raycaster} raycaster the instance of Raycaster is used to get the data for calculation.
     * @param {Intersection} intersects the result will be stored here.
     */
    raycastJsImpl(raycaster: Raycaster, intersects: Intersection[]) {
        raycastLine(raycaster, intersects, this, false);
    }

    /**
     * Return a clone of this object.
     */
    clone(recursive?: boolean): Line<M> {
        return new Line(this.geometry, this._material).copy(this, recursive);
    }
}

export function raycastLine(
    raycaster: Raycaster,
    intersects: Intersection[],
    object: Drawable,
    isLineSegments: boolean,
) {
    let precision = raycaster.linePrecision;
    const geometry = object.geometry;
    const matrixWorld = object.matrixWorld;
    object.matrixWorld.getScale(realScaleTemp);
    // Checking boundingSphere distance to ray
    sphere.copy(geometry.getBoundingSphere());
    sphere.applyMatrix4(matrixWorld);
    if (raycaster.enableScreenSpaceTolerance) {
        precision = Math.sqrt(raycaster.getScreenLineToleranceSq(raycaster.ray.directionDistance(sphere.center)));
    }

    sphere.radius += precision;
    if (raycaster.ray.intersectsSphere(sphere) === false) {
        return;
    }

    //
    inverseMatrix.getInverse(matrixWorld);
    ray.copy(raycaster.ray).applyMatrix4(inverseMatrix);
    const localPrecision = precision / ((realScaleTemp.x + realScaleTemp.y + realScaleTemp.z) / 3);
    const localPrecisionSq = localPrecision * localPrecision;

    let screenPrecisionMaxSq;
    if (raycaster.enableScreenSpaceTolerance) {
        screenPrecisionMaxSq = raycaster.getScreenLineToleranceSq(raycaster.ray.intersectSphereMaxDistance(sphere));
    }

    const step = isLineSegments ? 2 : 1;

    const vStart = new Vector3();
    const vEnd = new Vector3();
    const index = geometry.index;
    const positions = geometry.position.array;
    if (index !== null) {
        const indices = index.array;
        for (let i = 0, l = indices.length - 1; i < l; i += step) {
            const a = indices[i];
            const b = indices[i + 1];
            vStart.fromArray(positions as any, a * 3);
            vEnd.fromArray(positions as any, b * 3);
            const result = checkIntersectionLine(
                vStart,
                vEnd,
                i / step,
                i,
                object,
                raycaster,
                ray,
                realScaleTemp,
                localPrecisionSq,
                screenPrecisionMaxSq,
            );
            if (result !== undefined) {
                intersects.push(result);
            }
        }
    } else {
        for (let i = 0, l = positions.length / 3 - 1; i < l; i += step) {
            vStart.fromArray(positions as any, 3 * i);
            vEnd.fromArray(positions as any, 3 * i + 3);

            const result = checkIntersectionLine(
                vStart,
                vEnd,
                i / step,
                i,
                object,
                raycaster,
                ray,
                realScaleTemp,
                localPrecisionSq,
                screenPrecisionMaxSq,
            );
            if (result !== undefined) {
                intersects.push(result);
            }
        }
    }
}

const interSegment = new Vector3();
const interRay = new Vector3();
const diff = new Vector3();
export function checkIntersectionLine(
    start: Vector3,
    end: Vector3,
    primitiveIndex: number,
    index: number,
    object: Drawable,
    raycaster: Raycaster,
    rayLocal: Ray,
    realScale: Vector3,
    localPrecisionSq: number,
    screenPrecisionMaxSq?: number,
): Intersection | undefined {
    let worldDistSq: number | undefined;
    const distSq = rayLocal.distanceSqToSegment(start, end, interRay, interSegment);

    if (raycaster.enableScreenSpaceTolerance) {
        worldDistSq = diff.subVectors(interRay, interSegment).multiply(realScale).lengthSq();
        if (worldDistSq > screenPrecisionMaxSq!) {
            return;
        }
    } else {
        if (distSq > localPrecisionSq) {
            return;
        }
    }

    interRay.applyMatrix4(object.matrixWorld); // Move back to world space for distance calculation
    const distance = raycaster.ray.origin.distanceTo(interRay);
    if (distance < raycaster.near || distance > raycaster.far) {
        return;
    }

    if (raycaster.enableScreenSpaceTolerance) {
        const screenSq = raycaster.getScreenLineToleranceSq(distance);
        if (worldDistSq! > screenSq) {
            return;
        }
    }

    return {
        distance,
        point: interSegment.clone().applyMatrix4(object.matrixWorld),
        primitiveIndex,
        index,
        face: undefined,
        faceIndex: undefined,
        object,
    };
}
