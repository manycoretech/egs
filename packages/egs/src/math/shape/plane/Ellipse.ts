import { Shape } from './Shape';
import { Box2 } from '../../Box2';

import { Serializer, Deserializer } from '../../../utils/Serialization';

/**
 * The Ellipse object is used to help draw graphics.
 */
export class Ellipse extends Shape {
    /**
     * The X coordinate of the center of this ellipse.
     */
    public x: number;
    /**
     * The Y coordinate of the center of this ellipse.
     */
    public y: number;
    /**
    * The half width of this ellipse.
    */
    public halfWidth: number;
    /**
     * The half height of this ellipse.
     */
    public halfHeight: number;
    /**
     * @param divisions The number of segments in the ellipse.
     */
    public divisions?: number;
    /**
     * The type of the object, mainly used to avoid 'instanceof' checks.
     */
    public readonly type = 'Ellipse';
    /**
     * The type of the object, mainly used to avoid 'instanceof' checks.
     * @param x The X coordinate of the center of this ellipse.
     * @param y The Y coordinate of the center of this ellipse.
     * @param halfWidth The half width of this ellipse.
     * @param halfHeight The half height of this ellipse.
     * @param divisions The number of segments in the ellipse.
     */
    constructor(x = 0, y = 0, halfWidth = 0, halfHeight = 0, divisions?: number) {
        super();
        this.x = x;
        this.y = y;
        this.halfWidth = halfWidth;
        this.halfHeight = halfHeight;
        this.divisions = divisions;
        this._isInvalid = true;
    }
    /**
     * @internal
     */
    public serialize(ctx: Serializer) {
        super.serialize(ctx);
        ctx.puts<Ellipse>(['x', 'y', 'halfWidth', 'halfHeight']);
    }
    /**
     * @internal
     */
    public deserialize(ctx: Deserializer) {
        super.deserialize(ctx);
        ctx.reads<Ellipse>(['x', 'y', 'halfWidth', 'halfHeight']);
    }
    /**
     * The name of instance's class.
     */
    public className(): string {
        return 'Ellipse';
    }
    /**
     * Creates a clone of this Ellipse instance.
     */
    public clone(): Ellipse {
        return new Ellipse(this.x, this.y, this.halfWidth, this.halfHeight);
    }
    /**
     * Add this ellipse to drawing.
     */
    public draw() {
        this.absEllipse(this.x, this.y, this.halfWidth, this.halfHeight, undefined, undefined, undefined, undefined, this.divisions);
        this.autoClose = true;
    }
    /**
     * Checks whether the x and y coordinates given are contained within this ellipse.
     * @param x The X coordinate of the point to test.
     * @param y The Y coordinate of the point to test.
     * @return Whether the x/y coords are within this ellipse.
     */
    public contains(x: number, y: number): boolean {
        if (this.halfWidth <= 0 || this.halfHeight <= 0) {
            return false;
        }

        // normalize the coords to an ellipse with center 0,0
        let normX = ((x - this.x) / this.halfWidth);
        let normY = ((y - this.y) / this.halfHeight);

        normX *= normX;
        normY *= normY;

        return (normX + normY <= 1);
    }
    /**
     * Returns the framing rectangle of the ellipse as a Rectangle object.
     */
    public getBounds(bounds = new Box2()) {
        bounds.min.set(this.x - this.halfWidth, this.y - this.halfHeight);
        bounds.max.set(this.x + this.halfWidth, this.y + this.halfHeight);
        return bounds;
    }
}
