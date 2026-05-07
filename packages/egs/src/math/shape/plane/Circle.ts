import { Shape } from './Shape';
import { Box2 } from '../../Box2';

import { Serializer, Deserializer } from '../../../utils/Serialization';
/**
 * The Circle object is used to help draw graphics.
 */
export class Circle extends Shape {
    /**
     * The X coordinate of the center of this circle.
     */
    public x: number;
    /**
     * The Y coordinate of the center of this circle.
     */
    public y: number;
    /**
     * The radius of the circle.
     */
    public radius: number;
    /**
     * The type of the object, mainly used to avoid 'instanceof' checks.
     */
    public readonly type = 'Circle';
    /**
     * The number of segments in the circle.
     */
    public divisions?: number;
    /**
     * @param x The X coordinate of the center of this circle.
     * @param y The Y coordinate of the center of this circle.
     * @param radius Radius The radius of the circle.
     * @param divisions The number of segments in the circle.
     */
    constructor(x = 0, y = 0, radius = 0, divisions?: number) {
        super();
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.divisions = divisions;
        this._isInvalid = true;
    }
    /**
     * @ignore
     */
    public serialize(ctx: Serializer) {
        super.serialize(ctx);
        ctx.puts<Circle>(['x', 'y', 'radius']);
    }
    /**
     * @ignore
     */
    public deserialize(ctx: Deserializer) {
        super.deserialize(ctx);
        ctx.reads<Circle>(['x', 'y', 'radius']);
    }
    /**
     * The name of instance's class.
     */
    public className(): string {
        return 'Circle';
    }
    /**
     * Creates a clone of this Circle instance.
     */
    public clone(): Circle {
        return new Circle(this.x, this.y, this.radius);
    }
    /**
     * Add this circle to drawing.
     */
    public draw() {
        this.arc(this.x, this.y, this.radius, undefined, undefined, undefined, this.divisions);
        this.autoClose = true;
    }
    /**
     * Checks whether the x and y coordinates given are contained within this circle.
     * @param x The X coordinate of the point to test.
     * @param y The Y coordinate of the point to test.
     * @return Whether the x/y coordinates are within this circle.
     */
    public contains(x: number, y: number): boolean {
        if (this.radius <= 0) {
            return false;
        }

        const r2 = this.radius * this.radius;
        let dx = (this.x - x);
        let dy = (this.y - y);

        dx *= dx;
        dy *= dy;

        return (dx + dy <= r2);
    }
    /**
     * Returns the framing rectangle of the circle as a Rectangle object.
     */
    public getBounds(bounds = new Box2()) {
        bounds.min.set(this.x - this.radius, this.y - this.radius);
        bounds.max.set(this.x + this.radius, this.y + this.radius);
        return bounds;
    }
}
