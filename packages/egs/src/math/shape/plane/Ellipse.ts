import { Shape } from './Shape.js';
import { Box2 } from '../../Box2.js';

import type { Serializer, Deserializer } from '../../../utils/Serialization.js';

/**
 * The Ellipse object is used to help draw graphics.
 */
export class Ellipse extends Shape {
    /**
     * The X coordinate of the center of this ellipse.
     */
    x: number;
    /**
     * The Y coordinate of the center of this ellipse.
     */
    y: number;
    /**
     * The half width of this ellipse.
     */
    halfWidth: number;
    /**
     * The half height of this ellipse.
     */
    halfHeight: number;
    /**
     * @param divisions The number of segments in the ellipse.
     */
    divisions?: number;
    /**
     * The type of the object, mainly used to avoid 'instanceof' checks.
     */
    readonly type = 'Ellipse';
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
    serialize(ctx: Serializer) {
        super.serialize(ctx);
        ctx.puts<Ellipse>(['x', 'y', 'halfWidth', 'halfHeight']);
    }
    /**
     * @internal
     */
    deserialize(ctx: Deserializer) {
        super.deserialize(ctx);
        ctx.reads<Ellipse>(['x', 'y', 'halfWidth', 'halfHeight']);
    }
    /**
     * The name of instance's class.
     */
    className(): string {
        return 'Ellipse';
    }
    /**
     * Creates a clone of this Ellipse instance.
     */
    clone(): Ellipse {
        return new Ellipse(this.x, this.y, this.halfWidth, this.halfHeight);
    }
    /**
     * Add this ellipse to drawing.
     */
    draw() {
        this.absEllipse(
            this.x,
            this.y,
            this.halfWidth,
            this.halfHeight,
            undefined,
            undefined,
            undefined,
            undefined,
            this.divisions,
        );
        this.autoClose = true;
    }
    /**
     * Checks whether the x and y coordinates given are contained within this ellipse.
     * @param x The X coordinate of the point to test.
     * @param y The Y coordinate of the point to test.
     * @return Whether the x/y coords are within this ellipse.
     */
    contains(x: number, y: number): boolean {
        if (this.halfWidth <= 0 || this.halfHeight <= 0) {
            return false;
        }

        // normalize the coords to an ellipse with center 0,0
        let normX = (x - this.x) / this.halfWidth;
        let normY = (y - this.y) / this.halfHeight;

        normX *= normX;
        normY *= normY;

        return normX + normY <= 1;
    }
    /**
     * Returns the framing rectangle of the ellipse as a Rectangle object.
     */
    getBounds(bounds = new Box2()) {
        bounds.min.set(this.x - this.halfWidth, this.y - this.halfHeight);
        bounds.max.set(this.x + this.halfWidth, this.y + this.halfHeight);
        return bounds;
    }
}
