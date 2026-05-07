import { Vector3 } from './Vector3';
import { Sphere } from './Sphere';
import { Plane } from './Plane';
import { Box3 } from './Box3';
import { Matrix4 } from './Matrix4';
import { Nullable } from '../utils/Utils';
/**
 * A ray that emits from an origin in a certain direction. This is used by the
 * {@link Raycaster| Raycaster} to assist with {@link https://en.wikipedia.org/wiki/Ray_casting| ray casting}.
 * Raycaster is used for mouse picking (working out what objects in the 3D space the mouse is over) amongst other things.
 */
export class Ray {
    /**
     * The origin of the {@link Ray| Ray}.
     * @defaultValue is a {@link Vector3| Vector3} at `(0, 0, 0)`.
     */
    public origin: Vector3;
    /**
     * The direction of the {@link Ray| Ray}.
     * This must be normalized (with {@link Vector3.normalize| Vector3.normalize}) for the methods to operate properly.
     * @defaultValue is a {@link Vector3| Vector3} at `(0, 0, -1)`.
     */
    public direction: Vector3;

    constructor(origin?: Vector3, direction?: Vector3) {
        this.origin = (origin !== undefined) ? origin : new Vector3();
        this.direction = (direction !== undefined) ? direction : new Vector3();
    }
    /**
     * This must be normalized (with {@link Vector3.normalize| Vector3.normalize}) for the methods to operate properly.
     * Sets this ray's {@link .origin| origin} and {@link .direction| direction} properties by copying the values from the given objects.
     * @param origin the {@link origin| origin} of the {@link Ray| Ray}.
     * @param origin the {@link direction| direction} of the {@link Ray| Ray}.
     */
    public set(origin: Vector3, direction: Vector3): Ray {
        this.origin.copy(origin);
        this.direction.copy(direction);
        return this;
    }
    /**
     * Creates a new Ray with identical {@link origin| origin} and {@link direction| direction} to this one.
     */
    public clone(): Ray {
        return new Ray().copy(this);
    }
    /**
     * Copies the {@link origin| origin} and {@link direction| direction} properties of {@link Ray| ray} into this ray.
     */
    public copy(ray: Ray): Ray {
        this.origin.copy(ray.origin);
        this.direction.copy(ray.direction);
        return this;
    }
    /**
     * Get a {@link Vector3| Vector3} that is a given distance along this {@link Ray| Ray}.
     * @param t the distance along the {@link Ray| Ray} to retrieve a position for.
     * @param target the result will be copied into this Vector3.
     */
    public at(t: number, target: Vector3): Vector3 {
        return target.copy(this.direction).multiplyScalar(t).add(this.origin);
    }
    /**
     * Adjusts the direction of the ray to point at the vector in world coordinates.
     * @param v The {@link Vector3| Vector3} to look at.
     */
    public lookAt(v: Vector3): Ray {
        this.direction.copy(v).sub(this.origin).normalize();
        return this;
    }
    /**
     * Shift the origin of this {@link Ray| Ray} along its direction by the distance given.
     * @param t The distance along the {@link Ray| Ray} to interpolate.
     */
    public recast(t: number): Ray {
        this.origin.copy(this.at(t, tmp1Vec3));
        return this;
    }
    /**
     * Get the point along this {@link Ray| Ray} that is closest to the {@link Vector3| Vector3} provided.
     * @param point the point to get the closest approach to.
     * @param target the result will be copied into this Vector3.
     */
    public closestPointToPoint(point: Vector3, target: Vector3): Vector3 {
        target.subVectors(point, this.origin);
        const directionDistance = target.dot(this.direction);
        if (directionDistance < 0) {
            return target.copy(this.origin);
        }
        return target.copy(this.direction).multiplyScalar(directionDistance).add(this.origin);
    }
    /**
     * Get the distance of the closest approach between the {@link Ray| Ray} and the {@link Vector3| point}.
     * @param point {@link Vector3| Vector3} The {@link Vector3| Vector3} to compute a distance to.
     */
    public distanceToPoint(point: Vector3): number {
        return Math.sqrt(this.distanceSqToPoint(point));
    }
    /**
     * Get the squared distance of the closest approach between the {@link Ray| Ray} and the {@link Vector3| Vector3}.
     * @param point the {@link Vector3| Vector3} to compute a distance to.
     */
    public distanceSqToPoint(point: Vector3): number {
        const directionDistance = tmp1Vec3.subVectors(point, this.origin).dot(this.direction);
        // point behind the ray
        if (directionDistance < 0) {
            return this.origin.distanceToSquared(point);
        }
        tmp1Vec3.copy(this.direction).multiplyScalar(directionDistance).add(this.origin);
        return tmp1Vec3.distanceToSquared(point);
    }
    /**
     * Get the squared distance between this {@link Ray| Ray} and a line segment.
     * @param v0 the start of the line segment.
     * @param v1 the end of the line segment.
     * @param optionalPointOnRay (optional) if this is provided, it receives the point on this {@link Ray| Ray} that is closest to the segment.
     * @param optionalPointOnSegment - (optional) if this is provided, it receives the point on the line segment that is closest to this {@link Ray| Ray}.
     */
    public distanceSqToSegment(v0: Vector3, v1: Vector3, optionalPointOnRay?: Vector3, optionalPointOnSegment?: Vector3): number {
        // from http://www.geometrictools.com/GTEngine/Include/Mathematics/GteDistRaySegment.h
        // It returns the min distance between the ray and the segment
        // defined by v0 and v1
        // It can also set two optional targets :
        // - The closest point on the ray
        // - The closest point on the segment
        tmp1Vec3.copy(v0).add(v1).multiplyScalar(0.5);
        tmp2Vec3.copy(v1).sub(v0).normalize();
        tmp3Vec3.copy(this.origin).sub(tmp1Vec3);
        const segExtent = v0.distanceTo(v1) * 0.5;
        const a01 = -this.direction.dot(tmp2Vec3);
        const b0 = tmp3Vec3.dot(this.direction);
        const b1 = -tmp3Vec3.dot(tmp2Vec3);
        const c = tmp3Vec3.lengthSq();
        const det = Math.abs(1 - a01 * a01);
        let s0, s1, sqrDist, extDet;
        if (det > 0) {
            // The ray and segment are not parallel.
            s0 = a01 * b1 - b0;
            s1 = a01 * b0 - b1;
            extDet = segExtent * det;
            if (s0 >= 0) {
                if (s1 >= -extDet) {
                    if (s1 <= extDet) {
                        // region 0
                        // Minimum at interior points of ray and segment.
                        const invDet = 1 / det;
                        s0 *= invDet;
                        s1 *= invDet;
                        sqrDist = s0 * (s0 + a01 * s1 + 2 * b0) + s1 * (a01 * s0 + s1 + 2 * b1) + c;
                    } else {
                        // region 1
                        s1 = segExtent;
                        s0 = Math.max(0, - (a01 * s1 + b0));
                        sqrDist = - s0 * s0 + s1 * (s1 + 2 * b1) + c;
                    }
                } else {
                    // region 5
                    s1 = - segExtent;
                    s0 = Math.max(0, - (a01 * s1 + b0));
                    sqrDist = - s0 * s0 + s1 * (s1 + 2 * b1) + c;
                }
            } else {
                if (s1 <= - extDet) {
                    // region 4
                    s0 = Math.max(0, - (- a01 * segExtent + b0));
                    s1 = (s0 > 0) ? - segExtent : Math.min(Math.max(- segExtent, - b1), segExtent);
                    sqrDist = - s0 * s0 + s1 * (s1 + 2 * b1) + c;
                } else if (s1 <= extDet) {
                    // region 3
                    s0 = 0;
                    s1 = Math.min(Math.max(- segExtent, - b1), segExtent);
                    sqrDist = s1 * (s1 + 2 * b1) + c;
                } else {
                    // region 2
                    s0 = Math.max(0, - (a01 * segExtent + b0));
                    s1 = (s0 > 0) ? segExtent : Math.min(Math.max(- segExtent, - b1), segExtent);
                    sqrDist = - s0 * s0 + s1 * (s1 + 2 * b1) + c;
                }
            }
        } else {
            // Ray and segment are parallel.
            s1 = (a01 > 0) ? - segExtent : segExtent;
            s0 = Math.max(0, - (a01 * s1 + b0));
            sqrDist = - s0 * s0 + s1 * (s1 + 2 * b1) + c;
        }
        if (optionalPointOnRay) {
            optionalPointOnRay.copy(this.direction).multiplyScalar(s0).add(this.origin);
        }
        if (optionalPointOnSegment) {
            optionalPointOnSegment.copy(tmp2Vec3).multiplyScalar(s1).add(tmp1Vec3);
        }
        return sqrDist;
    }
    /**
     * Intersect this {@link Ray| Ray} with a {@link Sphere| Sphere}, returning the intersection point or `null` if there is no intersection.
     * @param sphere the {@link Sphere| Sphere} to intersect with.
     * @param target the result will be copied into this Vector3.
     */
    public intersectSphere(sphere: Sphere, target: Vector3): Nullable<Vector3> {
        tmp1Vec3.subVectors(sphere.center, this.origin);
        const tca = tmp1Vec3.dot(this.direction);
        const d2 = tmp1Vec3.dot(tmp1Vec3) - tca * tca;
        const radius2 = sphere.radius * sphere.radius;

        if (d2 > radius2) {
            return null;
        }

        const thc = Math.sqrt(radius2 - d2);

        // t0 = first intersect point - entrance on front of sphere
        const t0 = tca - thc;

        // t1 = second intersect point - exit point on back of sphere
        const t1 = tca + thc;

        // test to see if both t0 and t1 are behind the ray - if so, return null
        if (t0 < 0 && t1 < 0) {
            return null;
        }

        // test to see if t0 is behind the ray:
        // if it is, the ray is inside the sphere, so return the second exit point scaled by t1,
        // in order to always return an intersect point that is in front of the ray.
        if (t0 < 0) {
            return this.at(t1, target);
        }

        // else t0 is in front of the ray, so return the first collision point scaled by t0
        return this.at(t0, target);
    }
    /**
     * Calculate the maximum distance between origin and one or two intersections if this ray through the sphere.
     */
    public intersectSphereMaxDistance(sphere: Sphere): number {
        tmp1Vec3.subVectors(sphere.center, this.origin);
        const tca = tmp1Vec3.dot(this.direction);
        const d2 = tmp1Vec3.dot(tmp1Vec3) - tca * tca;
        const radius2 = sphere.radius * sphere.radius;

        if (d2 > radius2) {
            return 0;
        }

        const thc = Math.sqrt(radius2 - d2);

        // t1 = second intersect point - exit point on back of sphere
        const t1 = tca + thc;

        return t1;
    }
    /**
     * Calculate the length, which is the distance projected on the ray from given point to origin.
     */
    public directionDistance(point: Vector3) {
        return tmp1Vec3.subVectors(point, this.origin).dot(this.direction);
    }
    /**
     * Return true if this {@link Ray| Ray} intersects with the {@link Sphere| Sphere}.
     * @param sphere the {@link Sphere| Sphere} to intersect with
     */
    public intersectsSphere(sphere: Sphere): boolean {
        return this.distanceSqToPoint(sphere.center) <= (sphere.radius * sphere.radius);
    }
    /**
     * Get the distance from {@link origin| origin} to the {@link Plane| Plane}, or *null* if the {@link Ray| Ray} doesn't intersect the {@link Plane| Plane}.
     * @param plane the {@link Plane| Plane} to get the distance to.
     */
    public distanceToPlane(plane: Plane): Nullable<number> {
        const denominator = plane.normal.dot(this.direction);
        if (denominator === 0) {
            // line is coplanar, return origin
            if (plane.distanceToPoint(this.origin) === 0) {
                return 0;
            }
            // Null is preferable to undefined since undefined means.... it is undefined
            return null;
        }
        const t = - (this.origin.dot(plane.normal) + plane.constant) / denominator;
        // Return if the ray never intersects the plane
        return t >= 0 ? t : null;
    }
    /**
     * Intersect this {@link Ray| Ray} with a {@link Plane| Plane}, returning the intersection point or `null` if there is no intersection.
     * @param plane the {@link Plane| Plane} to intersect with.
     * @param target the result will be copied into this Vector3.
     */
    public intersectPlane(plane: Plane, target: Vector3): Nullable<Vector3> {
        const t = this.distanceToPlane(plane);
        if (t === null) {
            return null;
        }
        return this.at(t, target);
    }
    /**
     * Return true if this {@link Ray| Ray} intersects with the {@link Plane| Plane}.
     * @param plane the {@link Plane| Plane} to intersect with.
     */
    public intersectsPlane(plane: Plane): boolean {
        // check if the ray lies on the plane first
        const distToPoint = plane.distanceToPoint(this.origin);
        if (distToPoint === 0) {
            return true;
        }
        const denominator = plane.normal.dot(this.direction);
        if (denominator * distToPoint < 0) {
            return true;
        }
        // ray origin is behind the plane (and is pointing behind it)
        return false;
    }
    /**
     * Intersect this {@link Ray| Ray} with a {@link Box3| Box3}, returning the intersection point or `null` if there is no intersection.
     * @param box the {@link Box3| Box3} to intersect with.
     * @param target the result will be copied into this Vector3.
     */
    public intersectBox(box: Box3, target?: Vector3): Nullable<Vector3> {
        if (target === undefined) {
            target = new Vector3();
        }
        let tmin, tmax, tymin, tymax, tzmin, tzmax;
        const invdirx = 1 / this.direction.x;
        const invdiry = 1 / this.direction.y;
        const invdirz = 1 / this.direction.z;
        const origin = this.origin;

        if (invdirx >= 0) {
            tmin = (box.min.x - origin.x) * invdirx;
            tmax = (box.max.x - origin.x) * invdirx;
        } else {
            tmin = (box.max.x - origin.x) * invdirx;
            tmax = (box.min.x - origin.x) * invdirx;
        }

        if (invdiry >= 0) {
            tymin = (box.min.y - origin.y) * invdiry;
            tymax = (box.max.y - origin.y) * invdiry;
        } else {
            tymin = (box.max.y - origin.y) * invdiry;
            tymax = (box.min.y - origin.y) * invdiry;
        }
        if ((tmin > tymax) || (tymin > tmax)) {
            return null;
        }
        // These lines also handle the case where tmin or tmax is NaN
        // (result of 0 * Infinity). x !== x returns true if x is NaN
        if (tymin > tmin || tmin !== tmin) {
            tmin = tymin;
        }
        if (tymax < tmax || tmax !== tmax) {
            tmax = tymax;
        }
        if (invdirz >= 0) {
            tzmin = (box.min.z - origin.z) * invdirz;
            tzmax = (box.max.z - origin.z) * invdirz;
        } else {
            tzmin = (box.max.z - origin.z) * invdirz;
            tzmax = (box.min.z - origin.z) * invdirz;
        }
        if ((tmin > tzmax) || (tzmin > tmax)) {
            return null;
        }
        if (tzmin > tmin || tmin !== tmin) {
            tmin = tzmin;
        }
        if (tzmax < tmax || tmax !== tmax) {
            tmax = tzmax;
        }
        // return point closest to the ray (positive side)
        if (tmax < 0) {
            return null;
        }
        return this.at(tmin >= 0 ? tmin : tmax, target);
    }
    /**
     * Return true if this {@link Ray| Ray} intersects with the {@link Box3| Box3}.
     * @param box the {@link Box3| Box3} to intersect with.
     */
    public intersectsBox(box: Box3): boolean {
        return this.intersectBox(box, tmp1Vec3) !== null;
    }
    /**
     * Transform this {@link Ray| Ray} by the {@link Matrix4| Matrix4}.
     * @param matrix4 the {@link Matrix4| Matrix4} to apply to this {@link Ray| Ray}.
     */
    public applyMatrix4(matrix4: Matrix4): Ray {
        this.origin.applyMatrix4(matrix4);
        this.direction.transformDirection(matrix4);
        return this;
    }
    /**
     * Returns true if this and the other {@link Ray| ray} have equal {@link origin| origin} and {@link direction| direction}.
     * @param ray the {@link Ray| Ray} to compare to.
     */
    public equals(ray: Ray): boolean {
        return ray.origin.equals(this.origin) && ray.direction.equals(this.direction);
    }
    /**
     * Intersect this {@link Ray| Ray} with a triangle, returning the intersection point or `null` if there is no intersection.
     * @param abc The {@link Vector3| Vector3} points making up the triangle.
     * @param backfaceCulling whether to use backface culling
     * @param target the result will be copied into this Vector3.
     */
    public intersectTriangle(a: Vector3, b: Vector3, c: Vector3, backfaceCulling: boolean, target: Vector3): Nullable<Vector3> {
        // Compute the offset origin, edges, and normal.
        // let diff = new Vector3();
        // let edge1 = new Vector3();
        // let edge2 = new Vector3();
        // let normal = new Vector3();
        // from http://www.geometrictools.com/GTEngine/Include/Mathematics/GteIntrRay3Triangle3.h
        tmp2Vec3.subVectors(b, a);
        tmp3Vec3.subVectors(c, a);
        tmp4Vec3.crossVectors(tmp2Vec3, tmp3Vec3);
        // Solve Q + t*D = b1*E1 + b2*E2 (Q = kDiff, D = ray direction,
        // E1 = kEdge1, E2 = kEdge2, N = Cross(E1,E2)) by
        //   |Dot(D,N)|*b1 = sign(Dot(D,N))*Dot(D,Cross(Q,E2))
        //   |Dot(D,N)|*b2 = sign(Dot(D,N))*Dot(D,Cross(E1,Q))
        //   |Dot(D,N)|*t = -sign(Dot(D,N))*Dot(Q,N)
        let DdN = this.direction.dot(tmp4Vec3);
        let sign;

        if (DdN > 0) {
            if (backfaceCulling) {
                return null;
            }
            sign = 1;
        } else if (DdN < 0) {
            sign = - 1;
            DdN = - DdN;
        } else {
            return null;
        }

        tmp1Vec3.subVectors(this.origin, a);
        const DdQxE2 = sign * this.direction.dot(tmp3Vec3.crossVectors(tmp1Vec3, tmp3Vec3));
        // b1 < 0, no intersection
        if (DdQxE2 < 0) {
            return null;
        }
        const DdE1xQ = sign * this.direction.dot(tmp2Vec3.cross(tmp1Vec3));
        // b2 < 0, no intersection
        if (DdE1xQ < 0) {
            return null;
        }

        // b1+b2 > 1, no intersection
        if (DdQxE2 + DdE1xQ > DdN) {
            return null;
        }

        // Line intersects triangle, check if ray does.
        const QdN = - sign * tmp1Vec3.dot(tmp4Vec3);
        // t < 0, no intersection
        if (QdN < 0) {
            return null;
        }

        // Ray intersects triangle.
        return this.at(QdN / DdN, target);
    }
}
const tmp1Vec3 = new Vector3();
const tmp2Vec3 = new Vector3();
const tmp3Vec3 = new Vector3();
const tmp4Vec3 = new Vector3();
