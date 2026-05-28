import { Vector2 } from '../../Vector2';
import { Shape } from './Shape';

import { Serializer, Deserializer } from '../../../utils/Serialization';
/**
 * Rectangle object is an area defined by its position, as indicated by its top-left corner point (x, y) and by its width and its height.
 */
export class Rectangle extends Shape {
    /**
     * The X coordinate of the upper-left corner of the rectangle.
     */
    public x: number;
    /**
     * The Y coordinate of the upper-left corner of the rectangle.
     */
    public y: number;
    /**
     * Width component.
     */
    public width: number;
    /**
     * Height component.
     */
    public height: number;
    /**
     * The type of the object, mainly used to avoid 'instanceof' checks.
     */
    public readonly type = 'Rectangle';
    /**
     * @internal
     */
    public serialize(ctx: Serializer) {
        super.serialize(ctx);
        ctx.puts<Rectangle>(['x', 'y', 'width', 'height']);
    }
    /**
     * @internal
     */
    public deserialize(ctx: Deserializer) {
        super.deserialize(ctx);
        ctx.reads<Rectangle>(['x', 'y', 'width', 'height']);
    }
    /**
     * The name of instance's class.
     */
    public className(): string {
        return 'Rectangle';
    }
    /**
     * @param x The X coordinate of the upper-left corner of the rounded rectangle.
     * @param y The Y coordinate of the upper-left corner of the rounded rectangle.
     * @param width The overall width of this rounded rectangle.
     * @param height The overall height of this rounded rectangle.
     */
    constructor(x = 0, y = 0, width = 0, height = 0) {
        super();
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this._isInvalid = true;
    }
    /**
     * Creates a clone of this Rectangle.
     * @return a copy of the rectangle.
     */
    public clone(): Rectangle {
        return new Rectangle(this.x, this.y, this.width, this.height);
    }
    /**
     * Checks whether the x and y coordinates given are contained within this Rectangle.
     * @param x The X coordinate of the point to test.
     * @param y The Y coordinate of the point to test.
     * @return Whether the x/y coordinates are within this Rectangle.
     */
    public contains(x: number, y: number): boolean {
        if (this.width <= 0 || this.height <= 0) {
            return false;
        }

        if (x >= this.x && x < this.x + this.width) {
            if (y >= this.y && y < this.y + this.height) {
                return true;
            }
        }

        return false;
    }
    /**
     * Add this rectangle to drawing.
     */
    public draw() {
        const x = this.x;
        const y = this.y;
        const width = this.width;
        const height = this.height;
        const points: Vector2[] = [
            new Vector2(x, y),
            new Vector2(x + width, y),
            new Vector2(x + width, y + height),
            new Vector2(x, y + height),
        ];
        this.setFromPoints(points);
        this.autoClose = true;
    }
}
