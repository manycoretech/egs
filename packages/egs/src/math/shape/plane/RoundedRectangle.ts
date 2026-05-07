import { Shape } from './Shape';

import { Serializer, Deserializer } from '../../../utils/Serialization';
/**
 * The Rounded Rectangle object is an area that has nice rounded corners, as indicated by its
 * top-left corner point (x, y) and by its width and its height and its radius.
 */
export class RoundedRectangle extends Shape {
    /**
     * The X coordinate of the upper-left corner of the rounded rectangle.
     */
    public x: number;
    /**
     * The Y coordinate of the upper-left corner of the rounded rectangle.
     */
    public y: number;
    /**
     * The overall width of this rounded rectangle.
     */
    public width: number;
    /**
     * The overall height of this rounded rectangle.
     */
    public height: number;
    /**
     * Controls the radius of the rounded corners.
     */
    public radius: number;
    /**
     * The type of the object, mainly used to avoid 'instanceof' checks.
     */
    public type = 'RoundedRectangle';
    /**
     * @param x The X coordinate of the upper-left corner of the rounded rectangle
     * @param y The Y coordinate of the upper-left corner of the rounded rectangle
     * @param width The overall width of this rounded rectangle
     * @param height The overall height of this rounded rectangle
     * @param radius Controls the radius of the rounded corners
     */
    constructor(x = 0, y = 0, width = 0, height = 0, radius = 20) {
        super();
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.radius = radius;
        this._isInvalid = true;
    }
    /**
     * @ignore
     */
    public serialize(ctx: Serializer) {
        super.serialize(ctx);
        ctx.puts<RoundedRectangle>(['x', 'y', 'width', 'height', 'radius']);
    }
    /**
     * @ignore
     */
    public deserialize(ctx: Deserializer) {
        super.deserialize(ctx);
        ctx.reads<RoundedRectangle>(['x', 'y', 'width', 'height', 'radius']);
    }
    /**
     * The name of instance's class.
     */
    public className(): string {
        return 'RoundedRectangle';
    }
    /**
     * Creates a clone of this Rounded Rectangle.
     * @return a copy of the rounded rectangle
     */
    public clone(): RoundedRectangle {
        return new RoundedRectangle(this.x, this.y, this.width, this.height, this.radius);
    }
    /**
     * Add this roundedRectangle to drawing.
     */
    public draw() {
        const x = this.x;
        const y = this.y;
        const width = this.width;
        const height = this.height;

        const radius = Math.max(0, Math.min(this.radius, Math.min(width, height) / 2));

        this.moveTo(x, y + radius);
        this.quadraticCurveTo(x, y, x + radius, y);
        this.lineTo(x + width - radius, y);
        this.quadraticCurveTo(x + width, y, x + width, y + radius);
        this.lineTo(x + width, y + height - radius);
        this.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        this.lineTo(x + radius, y + height);
        this.quadraticCurveTo(x, y + height, x, y + height - radius);

        this.autoClose = true;
    }
    /**
     * Checks whether the x and y coordinates given are contained within this Rounded Rectangle.
     * @param x The X coordinate of the point to test.
     * @param y The Y coordinate of the point to test.
     * @return Whether the x/y coordinates are within this Rounded Rectangle.
     */
    public contains(x: number, y: number): boolean {
        if (this.width <= 0 || this.height <= 0) {
            return false;
        }
        if (x >= this.x && x <= this.x + this.width) {
            if (y >= this.y && y <= this.y + this.height) {
                if ((y >= this.y + this.radius && y <= this.y + this.height - this.radius)
                    || (x >= this.x + this.radius && x <= this.x + this.width - this.radius)) {
                    return true;
                }
                let dx = x - (this.x + this.radius);
                let dy = y - (this.y + this.radius);
                const radius2 = this.radius * this.radius;

                if ((dx * dx) + (dy * dy) <= radius2) {
                    return true;
                }
                dx = x - (this.x + this.width - this.radius);
                if ((dx * dx) + (dy * dy) <= radius2) {
                    return true;
                }
                dy = y - (this.y + this.height - this.radius);
                if ((dx * dx) + (dy * dy) <= radius2) {
                    return true;
                }
                dx = x - (this.x + this.radius);
                if ((dx * dx) + (dy * dy) <= radius2) {
                    return true;
                }
            }
        }

        return false;
    }
}
