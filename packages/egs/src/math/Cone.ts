import type { Sphere } from './Sphere';
import { Vector3 } from './Vector3';

const V = new Vector3();
/**
 * Make a cone volume for calculating intersection.
 */
export class Cone {
    /**
     * The position of peak.
     */
    tip: Vector3;
    /**
     * The angle of cone in vertical field.
     */
    fov: number;
    /**
     * The scale modification for fov.
     */
    aspect: number;
    /**
     * The bottom plane will be vertical to this vector.
     */
    direction: Vector3;

    private _theta: number;
    private _tanTheta: number;
    sinTheta: number;
    cosTheta: number;
    constructor(tip?: Vector3, fov?: number, direction?: Vector3, aspect?: number) {
        this.update(
            tip !== undefined ? tip : new Vector3(0, 0, 0),
            fov !== undefined ? fov : Math.PI / 6,
            direction !== undefined ? direction : new Vector3(0, 0, 0),
            aspect !== undefined ? aspect : 1,
        );
        return this;
    }
    /**
     * Update the cone's corresponding attributes by given parameters.
     */
    update(tip?: Vector3, fov?: number, direction?: Vector3, aspect?: number) {
        this.direction = direction || this.direction;
        this.direction.normalize();
        this.tip = tip || this.tip;
        this.fov = fov || this.fov;
        this.aspect = aspect || this.aspect;
        this._theta = this.fov * 0.5;
        this._tanTheta = Math.tan(this._theta);
        this._tanTheta *= Math.sqrt(1 + this.aspect * this.aspect);
        const cosThetaSquared = 1.0 / (this._tanTheta * this._tanTheta + 1.0);
        this.cosTheta = Math.sqrt(cosThetaSquared);
        const sinThetaSquared = 1.0 - cosThetaSquared;
        this.sinTheta = Math.sqrt(sinThetaSquared);
        return this;
    }
    /**
     * Check the intersection of this cone and given sphere.
     */
    // https://www.gamedev.net/forums/topic/555628-sphere-cone-test-with-no-sqrt-for-frustum-culling/4570679/
    isSphereOutsideCone(sphere: Sphere): boolean {
        V.copy(sphere.center).sub(this.tip);
        const a = -V.dot(this.direction); // because of shadowmap, direction reversed
        const x = this.cosTheta * Math.sqrt(V.dot(V) - a * a) - a * this.sinTheta;
        if (Math.abs(x) > sphere.radius && x > 0) {
            return true;
        } else {
            return false;
        }
    }
    /**
     * Creates a new clone of the Cone.
     */
    clone(): Cone {
        return new Cone().copy(this);
    }
    /**
     * Copy the data to this object from source.
     * This method need override in derived classes to copy extended data.
     * @param {Geometry} source the data source.
     */
    copy(other: Cone): Cone {
        this.tip = other.tip;
        this.fov = other.fov;
        this.direction = other.direction;
        this.aspect = other.aspect;
        this.update();
        return this;
    }
}
