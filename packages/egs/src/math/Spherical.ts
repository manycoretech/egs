import type { Vector3 } from './Vector3';
import { _Math } from './Math';
/**
 * A point's {@link https://en.wikipedia.org/wiki/Spherical_coordinate_system| spherical coordinates}.
 */
export class Spherical {
    /**
     * the radius, or the {@link https://en.wikipedia.org/wiki/Euclidean_distance| Euclidean distance}.
     */
    radius: number;
    /**
     * polar angle in radians from the y (up) axis.
     * @defaultValue `0`.
     */
    phi: number;
    /**
     * equator angle in radians around the y (up) axis.
     * @defaultValue `0`.
     */
    theta: number;

    constructor(radius?: number, phi?: number, theta?: number) {
        this.radius = (radius !== undefined) ? radius : 1.0;
        this.phi = (phi !== undefined) ? phi : 0; // polar angle
        this.theta = (theta !== undefined) ? theta : 0; // azimuthal angle
    }
    /**
     * Sets values of this spherical's {@link radius| radius}, {@link phi| phi} and {@link theta| theta} properties.
     */
    set(radius: number, phi: number, theta: number): Spherical {
        this.radius = radius;
        this.phi = phi;
        this.theta = theta;
        return this;
    }
    /**
     * Returns a new spherical with the same {@link radius| radius}, {@link phi| phi} and {@link theta| theta} properties as this one.
     */
    clone(): Spherical {
        return new Spherical().copy(this);
    }
    /**
     * Copies the values of the passed Spherical's {@link radius| radius}, {@link phi| phi} and {@link theta| theta} properties to this spherical.
     */
    copy(other: Spherical): Spherical {
        this.radius = other.radius;
        this.phi = other.phi;
        this.theta = other.theta;
        return this;
    }
    /**
     * Restricts the polar angle {@link phi| phi} to be between 0.000001 and pi - 0.000001.
     */
    makeSafe(): Spherical {
        const EPS = 0.000001;
        this.phi = Math.max(EPS, Math.min(Math.PI - EPS, this.phi));
        return this;
    }
    /**
     * Sets values of this spherical's {@link radius| radius}, {@link phi| phi} and {@link theta| theta} properties from the {@link Vector3| Vector3}.
     */
    setFromVector3(v: Vector3): Spherical {
        return this.setFromCartesianCoords(v.x, v.y, v.z);
    }
    /**
     * Sets values of this spherical's {@link radius| radius}, {@link phi| phi} and {@link theta| theta} properties from Cartesian coordinates.
     */
    setFromCartesianCoords(x: number, y: number, z: number): Spherical {
        this.radius = Math.sqrt(x * x + y * y + z * z);
        if (this.radius === 0) {
            this.theta = 0;
            this.phi = 0;
        } else {
            this.theta = Math.atan2(x, z);
            this.phi = Math.acos(_Math.clamp(y / this.radius, - 1, 1));
        }
        return this;
    }
}
