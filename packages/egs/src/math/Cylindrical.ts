import type { Vector3 } from './Vector3';
/**
 * A point's {@link https://en.wikipedia.org/wiki/Cylindrical_coordinate_system| cylindrical coordinates}.
 */
export class Cylindrical {
    /**
     * The radius of bottom cycle.
     */
    radius: number;
    /**
     * counterclockwise angle in the x-z plane measured in radians from the positive z-axis.
     * @defaultValue `0`.
     */
    theta: number;
    /**
     * height above the x-z plane.
     * @defaultValue `0`.
     */
    y: number;

    constructor(radius?: number, theta?: number, y?: number) {
        this.radius = radius !== undefined ? radius : 1.0; // distance from the origin to a point in the x-z plane
        this.theta = theta !== undefined ? theta : 0; // counterclockwise angle in the x-z plane measured in radians from the positive z-axis
        this.y = y !== undefined ? y : 0; // height above the x-z plane
        return this;
    }
    /**
     * Sets values of this cylinder's {@link radius| radius}, {@link theta| theta} and {@link y| y} properties.
     */
    set(radius: number, theta: number, y: number): Cylindrical {
        this.radius = radius;
        this.theta = theta;
        this.y = y;
        return this;
    }
    /**
     * Returns a new cylinder with the same {@link radius| radius}, {@link theta| theta} and {@link y| y} properties as this one.
     */
    clone(): Cylindrical {
        return new Cylindrical().copy(this);
    }
    /**
     * Copies the values of the passed cylinder's {@link radius| radius}, {@link theta| theta} and {@link y| y} properties to this cylinder.
     */
    copy(other: Cylindrical): Cylindrical {
        this.radius = other.radius;
        this.theta = other.theta;
        this.y = other.y;
        return this;
    }
    /**
     * Sets values of this cylinder's {@link radius| radius}, {@link theta| theta} and {@link y| y} properties from the {@link Vector3| Vector3}.
     */
    setFromVector3(v: Vector3): Cylindrical {
        return this.setFromCartesianCoords(v.x, v.y, v.z);
    }
    /**
     * Sets values of this cylinder's {@link radius| radius}, {@link theta| theta} and {@link y| y} properties from Cartesian coordinates.
     */
    setFromCartesianCoords(x: number, y: number, z: number): Cylindrical {
        this.radius = Math.sqrt(x * x + z * z);
        this.theta = Math.atan2(x, z);
        this.y = y;
        return this;
    }
}
