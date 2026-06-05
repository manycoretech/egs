import { Box3 } from './Box3';
import { Vector3 } from './Vector3';
import type { Plane } from './Plane';
import type { Matrix4 } from './Matrix4';
/**
 * A two dimensional surface that extends infinitely in 3d space,
 * represented in {@link http://mathworld.wolfram.com/HessianNormalForm.html| Hessian normal form} by a unit length normal vector and a constant.
 */
export class Sphere {
    /**
     * A {@link Vector3| Vector3} defining the center of the sphere.
     * @defaultValue `(0, 0, 0)`.
     */
    center: Vector3;
    /**
     * The radius of the sphere.
     * @defaultValue `0`.
     */
    radius: number;

    constructor(center?: Vector3, radius?: number) {
        this.center = center !== undefined ? center : new Vector3();
        this.radius = radius !== undefined ? radius : 0;
    }
    /**
     * Sets the {@link center| center} and {@link radius| radius} properties of this sphere.<br />
     * Please note that this method only copies the values from the given center.
     * @param center center of the sphere.
     * @param radius radius of the sphere.
     */
    set(center: Vector3, radius: number): Sphere {
        this.center.copy(center);
        this.radius = radius;
        return this;
    }
    /**
     * Computes the minimum bounding sphere for an array of {@link Array| points}.
     * If {@link Vector3| optionalCenter} is given, it is used as the sphere's center.
     * Otherwise, the center of the axis-aligned bounding box encompassing {@link Array| points} is calculated.
     * @param points an array of {@link Vector3| Vector3} positions.
     * @param optionalCenter Optional {@link Vector3| Vector3} position for the sphere's center.
     */
    setFromPoints(points: Vector3[], optionalCenter?: Vector3): Sphere {
        const center = this.center;
        if (optionalCenter !== undefined) {
            center.copy(optionalCenter);
        } else {
            tmpBox.setFromPoints(points).getCenter(center);
        }

        let maxRadiusSq = 0;
        for (let i = 0, il = points.length; i < il; i++) {
            maxRadiusSq = Math.max(maxRadiusSq, center.distanceToSquared(points[i]));
        }
        this.radius = Math.sqrt(maxRadiusSq);
        return this;
    }
    /**
     * Returns a new sphere with the same {@link center| center} and {@link radius| radius} as this one.
     */
    clone(): Sphere {
        return new Sphere().copy(this);
    }
    /**
     * Copies the values of the passed sphere's {@link center| center} and {@link radius| radius} properties to this sphere.
     */
    copy(sphere: Sphere): Sphere {
        this.center.copy(sphere.center);
        this.radius = sphere.radius;
        return this;
    }
    /**
     * If the radius smaller than zero, this will return false, otherwise return true.
     */
    empty(): boolean {
        return this.radius <= 0;
    }
    /**
     * Checks to see if the sphere contains the provided {@link Vector3| point} inclusive of the surface of the sphere.
     * @param point the {@link Vector3| Vector3} to be checked.
     */
    containsPoint(point: Vector3): boolean {
        return point.distanceToSquared(this.center) <= this.radius * this.radius;
    }
    /**
     * Returns the closest distance from the boundary of the sphere to the {@link Vector3| point}.
     * If the sphere contains the point, the distance will be negative.
     */
    distanceToPoint(point: Vector3): number {
        return point.distanceTo(this.center) - this.radius;
    }
    /**
     * Checks to see if two spheres intersect.
     * @param sphere Sphere to check for intersection against.
     */
    intersectsSphere(sphere: Sphere): boolean {
        const radiusSum = this.radius + sphere.radius;
        return sphere.center.distanceToSquared(this.center) <= radiusSum * radiusSum;
    }
    /**
     * Determines whether or not this sphere intersects a given {@link Box3| box}.
     * @param box {@link Box3| Box3} to check for intersection against.
     */
    intersectsBox(box: Box3): boolean {
        return box.intersectsSphere(this);
    }
    /**
     * Determines whether or not this sphere intersects a given {@link Plane| plane}.
     * @param plane Plane to check for intersection against.
     */
    intersectsPlane(plane: Plane): boolean {
        return Math.abs(plane.distanceToPoint(this.center)) <= this.radius;
    }
    /**
     * Clamps a point within the sphere. If the point is outside the sphere, it will clamp it to the closest point on the edge of the sphere.
     * Points already inside the sphere will not be affected.
     * @param point {@link Vector3| Vector3} The point to clamp.
     * @param target the result will be copied into this Vector3.
     */
    clampPoint(point: Vector3, target: Vector3): Vector3 {
        const deltaLengthSq = this.center.distanceToSquared(point);
        target.copy(point);
        if (deltaLengthSq > this.radius * this.radius) {
            target.sub(this.center).normalize();
            target.multiplyScalar(this.radius).add(this.center);
        }
        return target;
    }
    /**
     * Returns a {@link https://en.wikipedia.org/wiki/Minimum_bounding_box| Minimum Bounding Box} for the sphere.
     * @param target the result will be copied into this Box3.
     */
    getBoundingBox(target: Box3): Box3 {
        target.set(this.center, this.center);
        target.expandByScalar(this.radius);
        return target;
    }
    /**
     * Transforms this sphere with the provided {@link Matrix4| Matrix4}.
     * @param matrix the {@link Matrix4| Matrix4} to apply
     */
    applyMatrix4(matrix: Matrix4): Sphere {
        this.center.applyMatrix4(matrix);
        this.radius = this.radius * matrix.getMaxScaleOnAxis();
        return this;
    }
    /**
     * Translate the sphere's center by the provided offset {@link Vector3| Vector3}.
     */
    translate(offset: Vector3): Sphere {
        this.center.add(offset);
        return this;
    }
    /**
     * Checks to see if the two spheres' centers and radii are equal.
     */
    equals(sphere: Sphere): boolean {
        return sphere.center.equals(this.center) && sphere.radius === this.radius;
    }
}

const tmpBox = new Box3();
