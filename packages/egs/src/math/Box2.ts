import { Vector2 } from './Vector2';
import type { Matrix3 } from './Matrix3';
import type { Matrix4 } from './Matrix4';

let tmpVec2: Vector2;
/**
 * A 2D box represents by {@link min| min} and {@link max| max}.
 */
export class Box2 {
    /**
     * {@link Vector2| Vector2} representing the lower (x, y) boundary of the box.<br />
     * @defaultValue is ( + Infinity, + Infinity ).
     */
    min: Vector2;
    /**
     * {@link Vector2| Vector2} representing the upper (x, y) boundary of the box.<br />
     * @defaultValue is ( - Infinity, - Infinity ).
     */
    max: Vector2;

    constructor(min?: Vector2, max?: Vector2) {
        this.min = (min !== undefined) ? min : new Vector2(+ Infinity, + Infinity);
        this.max = (max !== undefined) ? max : new Vector2(- Infinity, - Infinity);
    }
    /**
     * Sets the lower and upper (x, y) boundaries of this box.<br>
     * Please note that this method only copies the values from the given objects.
     * @param min {@link Vector2| Vector2} representing the lower (x, y) boundary of the box. <br>
     * @param max {@link Vector2| Vector2} representing the upper (x, y) boundary of the box. <br /><br />
     */
    set(min: Vector2, max: Vector2): Box2 {
        this.min.copy(min);
        this.max.copy(max);
        return this;
    }
    /**
     * Sets the upper and lower bounds of this box to include all of the points in {@link Array| points}.
     * @param points Array of {@link Vector2| Vector2s} that the resulting box will contain.<br /><br />
     */
    setFromPoints(points: Vector2[]): Box2 {
        this.makeEmpty();
        for (let i = 0, il = points.length; i < il; i++) {
            this.expandByPoint(points[i]);
        }
        return this;
    }
    /**
     * Centers this box on {@link Vector2| center} and sets this box's width and height to the values specified in {@link Vector2| size}.
     * @param center Desired center position of the box ({@link Vector2| Vector2}).<br>
     * @param size Desired x and y dimensions of the box ({@link Vector2| Vector2}).<br /><br />
     */
    setFromCenterAndSize(center: Vector2, size: Vector2): Box2 {
        if (tmpVec2 === undefined) {
            tmpVec2 = new Vector2();
        }
        const halfSize = tmpVec2.copy(size).multiplyScalar(0.5);
        this.min.copy(center).sub(halfSize);
        this.max.copy(center).add(halfSize);
        return this;
    }
    /**
     * Return a new {@link Box2| Box2} with the same {@link .min| min} and {@link .max| max} as this clone
     */
    clone(): Box2 {
        return new Box2().copy(this);
    }
    /**
     * Copies the {@link min| min} and {@link max| max} from {@link Box2| box} to this box.
     */
    copy(box: Box2): Box2 {
        this.min.copy(box.min);
        this.max.copy(box.max);
        return this;
    }
    /**
     * Makes this box empty.
     */
    makeEmpty(): Box2 {
        this.min.x = this.min.y = + Infinity;
        this.max.x = this.max.y = - Infinity;
        return this;
    }
    /**
     * Return true if this box includes zero points within its bounds.<br>
     * @tips that a box with equal lower and upper bounds still includes one point, the one both bounds share.
     */
    isEmpty(): boolean {
        // this is a more robust check for empty than ( volume <= 0 ) because volume can get positive with two negative axes
        return (this.max.x < this.min.x) || (this.max.y < this.min.y);
    }
    /**
     * Return the center point of the box as a {@link Vector2| Vector2}.
     * @param target the result will be copied into this Vector2.
     */
    getCenter(target: Vector2): Vector2 {
        return this.isEmpty() ? target.set(0, 0) : target.addVectors(this.min, this.max).multiplyScalar(0.5);
    }
    /**
     * Return the width and height of this box.
     * @param target the result will be copied into this Vector2.
     */
    getSize(target = new Vector2()): Vector2 {
        return this.isEmpty() ? target.set(0, 0) : target.subVectors(this.max, this.min);
    }
    /**
     * Expands the boundaries of this box to include {@link Vector2| point}.
     * @param point {@link Vector2| Vector2} that should be included in the box.
     */
    expandByPoint(point: Vector2): Box2 {
        this.min.min(point);
        this.max.max(point);
        return this;
    }
    /**
     * Expands this box equilaterally by {@link Vector2| vector}. The width of this box will be
     * expanded by the x component of {@link Vector2| vector} in both directions. The height of
     * this box will be expanded by the y component of {@link Vector2| vector} in both directions.
     * @param vector {@link Vector2| Vector2} to expand the box by.
     */
    expandByVector(vector: Vector2): Box2 {
        this.min.sub(vector);
        this.max.add(vector);
        return this;
    }
    /**
     * Expands each dimension of the box by scalar. If negative, the dimensions of the box will be contracted.
     * @param scalar Distance to expand the box by.
     */
    expandByScalar(scalar: number): Box2 {
        this.min.addScalar(-scalar);
        this.max.addScalar(scalar);
        return this;
    }
    /**
     * Return true if the specified {@link Vector2| point} lies within or on the boundaries of this box.
     * @param point {@link Vector2| Vector2} to check for inclusion.
     */
    containsPoint(point: Vector2): boolean {
        return point.x < this.min.x || point.x > this.max.x || point.y < this.min.y || point.y > this.max.y ? false : true;
    }
    /**
     * Return true if this box includes the entirety of {@link Box2| box}.
     * If this and {@link Box2| box} are identical, this function also returns true.
     * @param box {@link Box2| Box2} to test for inclusion.
     */
    containsBox(box: Box2): boolean {
        return this.min.x <= box.min.x && box.max.x <= this.max.x && this.min.y <= box.min.y && box.max.y <= this.max.y;
    }
    /**
     * Return a point as a proportion of this box's width and height.
     * @param target the result will be copied into this Vector2.
     */
    getParameter(point: Vector2, target: Vector2): Vector2 {
        return target.set((point.x - this.min.x) / (this.max.x - this.min.x), (point.y - this.min.y) / (this.max.y - this.min.y));
    }
    /**
     * Determines whether or not this box intersects {@link Box2| box}.
     * @param box Box to check for intersection against.
     */
    intersectsBox(box: Box2): boolean {
        // using 4 splitting planes to rule out intersections
        return box.max.x < this.min.x || box.min.x > this.max.x ||
            box.max.y < this.min.y || box.min.y > this.max.y ? false : true;
    }
    /**
     * {@link https://en.wikipedia.org/wiki/Clamping_(graphics)| Clamps} the {@link Vector2| point} within the bounds of this box.<br />
     * @param point {@link Vector2| Vector2} to clamp.
     * @param target the result will be copied into this Vector2.
     */
    clampPoint(point: Vector2, target: Vector2): Vector2 {
        return target.copy(point).clamp(this.min, this.max);
    }
    /**
     * Return the distance from any edge of this box to the specified point.
     * If the {@link Vector2| point} lies inside of this box, the distance will be 0.
     * @param point {@link Vector2| Vector2} to measure distance to.
     */
    distanceToPoint(point: Vector2): number {
        if (tmpVec2 === undefined) {
            tmpVec2 = new Vector2();
        }
        const clampedPoint = tmpVec2.copy(point).clamp(this.min, this.max);
        return clampedPoint.sub(point).length();
    }
    /**
     * Return the intersection of this and {@link Box2| box}, setting the upper bound of this box to the lesser
     * of the two boxes' upper bounds and the lower bound of this box to the greater of the two boxes' lower bounds.
     * @param box Box to intersect with.
     */
    intersect(box: Box2): Box2 {
        this.min.max(box.min);
        this.max.min(box.max);
        return this;
    }
    /**
     * Unions this box with {@link Box2| box}, setting the upper bound of this box to the greater of the
     * two boxes' upper bounds and the lower bound of this box to the lesser of the two boxes' lower bounds.
     * @param box Box that will be unioned with this box.
     */
    union(box: Box2): Box2 {
        this.min.min(box.min);
        this.max.max(box.max);
        return this;
    }
    /**
     * Adds {@link Vector2| offset} to both the upper and lower bounds of this box, effectively moving this box {@link Vector2| offset} units in 2D space.
     * @param offset Direction and distance of offset.
     */
    translate(offset: Vector2): Box2 {
        this.min.add(offset);
        this.max.add(offset);
        return this;
    }
    /**
     * Return true if this box and {@link Box2| box} share the same lower and upper bounds.
     * @param box Box to compare with this one.
     */
    equals(box: Box2): boolean {
        return box.min.equals(this.min) && box.max.equals(this.max);
    }
    /**
     * Apply the transform matrix on four vertexes.
     */
    applyMatrix3(matrix: Matrix3): Box2 {
        // transform of empty box is an empty box.
        if (this.isEmpty()) {
            return this;
        }
        // NOTE: Using a binary pattern to specify all 2^3 combinations below
        points[0].set(this.min.x, this.min.y).applyMatrix3(matrix); // 000
        points[1].set(this.min.x, this.max.y).applyMatrix3(matrix); // 001
        points[2].set(this.max.x, this.min.y).applyMatrix3(matrix); // 010
        points[3].set(this.max.x, this.max.y).applyMatrix3(matrix); // 011
        this.setFromPoints(points);
        return this;
    }
    /**
     * Apply the four left-top elements of matrix on four vertexes.
     */
    applyMatrix4(matrix: Matrix4) {

        // transform of empty box is an empty box.
        if (this.isEmpty()) {
            return this;
        }
        // NOTE: Using a binary pattern to specify all 2^3 combinations below
        points[0].set(this.min.x, this.min.y).applyMatrix4(matrix); // 000
        points[1].set(this.min.x, this.max.y).applyMatrix4(matrix); // 001
        points[2].set(this.max.x, this.min.y).applyMatrix4(matrix); // 010
        points[3].set(this.max.x, this.max.y).applyMatrix4(matrix); // 011
        this.setFromPoints(points);
        return this;
    }
    /**
     * Enlarges box2 that way its corners lie on grid.
     * Get max box based on resolution which is small than this box.
     */
    ceil(resolution = 1, eps = 0.001): this {

        this.min.x = Math.floor((this.min.x + eps) * resolution) / resolution;
        this.min.y = Math.floor((this.min.y + eps) * resolution) / resolution;

        this.max.x = Math.floor((this.max.x - eps) * resolution) / resolution;
        this.max.y = Math.floor((this.max.y - eps) * resolution) / resolution;

        return this;
    }
}

const points = [new Vector2(), new Vector2(), new Vector2(), new Vector2()];
