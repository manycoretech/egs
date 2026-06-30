import { Vector3 } from './Vector3.js';
import type { Sphere } from './Sphere.js';
import type { Line3 } from './Line3.js';
import type { Box3 } from './Box3.js';
import type { Matrix4 } from './Matrix4.js';
import { Matrix3 } from './Matrix3.js';
import type { Nullable } from '../utils/Utils.js';
/**
 * A two dimensional surface that extends infinitely in 3d space,
 * represented in {@link http://mathworld.wolfram.com/HessianNormalForm.html| Hessian normal form} by a unit length normal vector and a constant.
 */
export class Plane {
    /**
     * (optional) a unit length vector3 defining the normal of the plane.
     * @defaultValue `(1, 0, 0)`.
     */
    normal: Vector3;
    /**
     * (optional) the signed distance from the origin to the plane.
     * @defaultValue `0`.
     */
    constant: number;

    constructor(normal?: Vector3, constant?: number) {
        this.normal = normal !== undefined ? normal : new Vector3(1, 0, 0);
        this.constant = constant !== undefined ? constant : 0;
    }
    /**
     * Sets this plane's {@link normal| normal} and {@link constant| constant} properties by copying the values from the given normal.
     * @param normal a unit length {@link Vector3| Vector3} defining the normal of the plane.
     * @param constant the signed distance from the origin to the plane.
     * @defaultValue `0`.
     */
    set(normal: Vector3, constant: number): Plane {
        this.normal.copy(normal);
        this.constant = constant;
        return this;
    }
    /**
     * Set the individual components that define the plane.
     * @param x x value of the unit length normal vector.
     * @param y y value of the unit length normal vector.
     * @param z z value of the unit length normal vector.
     * @param w the value of the plane's {@link constant| constant} property.
     */
    setComponents(x: number, y: number, z: number, w: number): Plane {
        this.normal.set(x, y, z);
        this.constant = w;
        return this;
    }
    /**
     * Sets the plane's properties as defined by a {@link Vector3| normal} and an arbitrary coplanar {@link Vector3| point}.
     * @param normal a unit length {@link Vector3| Vector3} defining the normal of the plane.
     * @param point {@link Vector3| Vector3}.
     */
    setFromNormalAndCoplanarPoint(normal: Vector3, point: Vector3): Plane {
        this.normal.copy(normal);
        this.constant = -point.dot(this.normal);
        return this;
    }
    /**
     * Defines the plane based on the 3 provided points.
     * The winding order is assumed to be counter-clockwise, and determines the direction of the {@link normal| normal}.
     * @param a first point on the plane.
     * @param b second point on the plane.
     * @param c third point on the plane.
     */
    setFromCoplanarPoints(a: Vector3, b: Vector3, c: Vector3): Plane {
        const normal = tmp1Vec3.subVectors(c, b).cross(tmp2Vec3.subVectors(a, b)).normalize();
        // Q: should an error be thrown if normal is zero (e.g. degenerate plane)?
        this.setFromNormalAndCoplanarPoint(normal, a);
        return this;
    }
    /**
     * Returns a new plane with the same {@link normal| normal} and {@link constant| constant} as this one.
     */
    clone(): Plane {
        return new Plane().copy(this);
    }
    /**
     * Copies the values of the passed plane's {@link normal| normal} and {@link constant| constant} properties to this plane.
     */
    copy(plane: Plane): Plane {
        this.normal.copy(plane.normal);
        this.constant = plane.constant;
        return this;
    }
    /**
     * Normalizes the {@link normal| normal} vector, and adjusts the {@link constant| constant} value accordingly.
     */
    normalize(): Plane {
        // Note: will lead to a divide by zero if the plane is invalid.
        const inverseNormalLength = 1.0 / this.normal.length();
        this.normal.multiplyScalar(inverseNormalLength);
        this.constant *= inverseNormalLength;
        return this;
    }
    /**
     * Negates both the normal vector and the constant.
     */
    negate(): Plane {
        this.constant *= -1;
        this.normal.negate();
        return this;
    }
    /**
     * Returns the signed distance from the {@link Vector3| point} to the plane.
     */
    distanceToPoint(point: Vector3): number {
        return this.normal.dot(point) + this.constant;
    }
    /**
     * Returns the signed distance from the {@link Sphere| sphere} to the plane.
     */
    distanceToSphere(sphere: Sphere): number {
        return this.distanceToPoint(sphere.center) - sphere.radius;
    }
    /**
     * Projects a {@link Vector3| point} onto the plane.
     * @param point the {@link Vector3| Vector3} to project onto the plane.
     * @param target the result will be copied into this Vector3.
     */
    projectPoint(point: Vector3, target: Vector3): Vector3 {
        return target.copy(this.normal).multiplyScalar(-this.distanceToPoint(point)).add(point);
    }
    /**
     * Returns the intersection point of the passed line and the plane. Returns null
     * if the line does not intersect. Returns the line's starting point if the line is coplanar with the plane.
     * @param line the {@link Line3| Line3} to check for intersection.
     * @param target the result will be copied into this Vector3.
     */
    intersectLine(line: Line3, target: Vector3): Nullable<Vector3> {
        const direction = line.delta(tmp1Vec3);
        const denominator = this.normal.dot(direction);
        if (denominator === 0) {
            // line is coplanar, return origin
            if (this.distanceToPoint(line.start) === 0) {
                return target.copy(line.start);
            }
            // Unsure if this is the correct method to handle this case.
            return null;
        }
        const t = -(line.start.dot(this.normal) + this.constant) / denominator;
        if (t < 0 || t > 1) {
            return null;
        }
        return target.copy(direction).multiplyScalar(t).add(line.start);
    }
    /**
     * Tests whether a line segment intersects with (passes through) the plane.
     * @param line the {@link Line3| Line3} to check for intersection.
     */
    intersectsLine(line: Line3): boolean {
        // Note: this tests if a line intersects the plane, not whether it (or its end-points) are coplanar with it.
        const startSign = this.distanceToPoint(line.start);
        const endSign = this.distanceToPoint(line.end);
        return (startSign < 0 && endSign > 0) || (endSign < 0 && startSign > 0);
    }
    /**
     * Determines whether or not this plane intersects {@link Box3| box}.
     * @param box the {@link Box3| Box3} to check for intersection.
     */
    intersectsBox(box: Box3): boolean {
        return box.intersectsPlane(this);
    }
    /**
     * Determines whether or not this plane intersects {@link Sphere| sphere}.
     * @param sphere the {@link Sphere| Sphere} to check for intersection.
     */
    intersectsSphere(sphere: Sphere): boolean {
        return sphere.intersectsPlane(this);
    }
    /**
     * By calculating the projection of the normal vector at the origin onto the plane.
     * @return a {@link Vector3| Vector3} coplanar to the plane,
     * @param target the result will be copied into this Vector3.
     */
    coplanarPoint(target: Vector3): Vector3 {
        return target.copy(this.normal).multiplyScalar(-this.constant);
    }
    /**
     * Apply a Matrix4 to the plane. The matrix must be an affine, homogeneous transform.
     * If supplying an {@link Matrix3| optionalNormalMatrix}, it can be created like so:
     * <code>
     * const optionalNormalMatrix = new THREE.Matrix3().getNormalMatrix( matrix );
     * </code>
     * @param matrix the Matrix4 to apply.
     * @param optionalNormalMatrix (optional) pre-computed normal [Page:Matrix3] of the Matrix4 being applied.
     */
    applyMatrix4(matrix: Matrix4, optionalNormalMatrix?: Matrix3): Plane {
        const normalMatrix = optionalNormalMatrix || tmpMat3.getNormalMatrix(matrix);
        const referencePoint = this.coplanarPoint(tmp1Vec3).applyMatrix4(matrix);
        const normal = this.normal.applyMatrix3(normalMatrix).normalize();
        this.constant = -referencePoint.dot(normal);
        return this;
    }
    /**
     * Translates the plane by the distance defined by the {@link Vector3| offset} vector.
     * @param offset the amount to move the plane by.
     * @tips that this only affects the plane constant and will not affect the normal vector.
     */
    translate(offset: Vector3): Plane {
        this.constant -= offset.dot(this.normal);
        return this;
    }
    /**
     * Checks to see if two planes are equal (their {@link normal| normal} and {@link .constant| constant} properties match).
     */
    equals(plane: Plane): boolean {
        return plane.normal.equals(this.normal) && plane.constant === this.constant;
    }
}

const tmp1Vec3 = new Vector3();
const tmp2Vec3 = new Vector3();
const tmpMat3 = new Matrix3();
