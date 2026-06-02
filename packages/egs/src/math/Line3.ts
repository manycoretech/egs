import { Vector3 } from './Vector3';
import { _Math } from './Math';
import { Matrix4 } from './Matrix4';
/**
 * {@link Vector3| Vector3} representing the start point of the line.
 * A geometric line segment represented by a start and end point.
 */
export class Line3 {
    /**
     * {@link Vector3| Vector3} representing the start point of the line.
     */
    start: Vector3;
    /**
     * {@link Vector3| Vector3} representing the end point of the line.
     */
    end: Vector3;

    constructor(start?: Vector3, end?: Vector3) {
        this.start = (start !== undefined) ? start : new Vector3();
        this.end = (end !== undefined) ? end : new Vector3();
    }
    /**
     * Sets the start and end values by copying the provided vectors.
     * @param start set the {@link start | start} of the line.
     * @param end set the {@link end | end} of the line.
     */
    set(start: Vector3, end: Vector3): Line3 {
        this.start.copy(start);
        this.end.copy(end);
        return this;
    }
    /**
     * Returns a new {@link Line3 | Line3} with the same {@link start | start} and {@link end | end} vectors as this one.
     */
    clone(): Line3 {
        return new Line3().copy(this);
    }
    /**
     * Copies the passed line's {@link start | start} and {@link end | end} vectors to this line.
     */
    copy(line: Line3): Line3 {
        this.start.copy(line.start);
        this.end.copy(line.end);
        return this;
    }
    /**
     * Returns the center of the line segment.
     * @param target the result will be copied into this Vector3.
     */
    getCenter(target: Vector3): Vector3 {
        return target.addVectors(this.start, this.end).multiplyScalar(0.5);
    }
    /**
     * Returns the delta vector of the line segment ({@link end | end} vector minus the {@link start | start} vector).
     * @param target the result will be copied into this Vector3.
     */
    delta(target: Vector3): Vector3 {
        return target.subVectors(this.end, this.start);
    }
    /**
     * Returns the square of the {@link https://en.wikipedia.org/wiki/Euclidean_distance | Euclidean distance}
     * (straight-line distance) between the line's {@link start | start} and {@link end | end} vectors.
     */
    distanceSq(): number {
        return this.start.distanceToSquared(this.end);
    }
    /**
     * Returns the {@link https://en.wikipedia.org/wiki/Euclidean_distance | Euclidean distance}
     * (straight-line distance) between the line's {@link start | start} and {@link end | end} points.
     */
    distance(): number {
        return this.start.distanceTo(this.end);
    }
    /**
     * Returns a vector at a certain position along the line. When {@link Float| t} = 0, it returns the start vector,
     * and when {@link Float| t} = 1 it returns the end vector.
     * @param t Use values 0-1 to return a position along the line segment.
     * @param target the result will be copied into this Vector3.
     */
    at(t: number, target: Vector3): Vector3 {
        return this.delta(target).multiplyScalar(t).add(this.start);
    }
    /**
     * Returns a point parameter based on the closest point as projected on the line segment.
     * If {@link Boolean| clampToLine} is true, then the returned value will be between 0 and 1.
     * @param point the point for which to return a point parameter.
     * @param clampToLine Whether to clamp the result to the range [0, 1].
     */
    closestPointToPointParameter(point: Vector3, clampToLine?: boolean): number {
        tmp1Vec3.subVectors(point, this.start);
        tmp2Vec3.subVectors(this.end, this.start);
        const startEnd2 = tmp2Vec3.dot(tmp2Vec3);
        const startEnd_startP = tmp2Vec3.dot(tmp1Vec3);
        let t = startEnd_startP / startEnd2;
        if (clampToLine) {
            t = _Math.clamp(t, 0, 1);
        }
        return t;
    }
    /**
     * Returns the closets point on the line. If {@link Boolean| clampToLine} is true, then the returned value will be clamped to the line segment.
     * @param point return the closest point on the line to this point.
     * @param clampToLine whether to clamp the returned value to the line segment.
     * @param target the result will be copied into this Vector3.
     */
    closestPointToPoint(point: Vector3, clampToLine: boolean, target: Vector3): Vector3 {
        const t = this.closestPointToPointParameter(point, clampToLine);
        return this.delta(target).multiplyScalar(t).add(this.start);
    }
    /**
     * Applies a matrix transform to the line segment.
     */
    applyMatrix4(matrix: Matrix4): Line3 {
        this.start.applyMatrix4(matrix);
        this.end.applyMatrix4(matrix);
        return this;
    }
    /**
     * Returns true if both line's {@link start| start} and {@link end| end} points are equal.
     * @param line {@link Line3| Line3} to compare with this one.
     */
    equals(line: Line3): boolean {
        return line.start.equals(this.start) && line.end.equals(this.end);
    }
}

const tmp1Vec3 = new Vector3();
const tmp2Vec3 = new Vector3();
