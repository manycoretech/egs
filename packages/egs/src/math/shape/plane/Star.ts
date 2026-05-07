import { _Math } from '../../Math';
import { Polygon } from './Polygon';

import { Serializer, Deserializer } from '../../../utils/Serialization';
/**
 * Draw a star shape with an arbitrary number of points.
 */
export class Star extends Polygon {
    public type = 'Star';
    public x: number;
    public y: number;
    public pointNum: number;
    public radius: number;
    public innerRadius: number;
    public rotation: number;
    /**
     * @param x Center X position of the star.
     * @param y Center Y position of the star.
     * @param points The number of points of the star, must be > 1.
     * @param radius The outer radius of the star.
     * @param innerRadius The inner radius between points, default half `radius`.
     * @param rotation The rotation of the star in radians, where 0 is vertical.
     * @return This Graphics object. Good for chaining method calls.
     */
    constructor(x = 0, y = 0, pointNum = 5, radius = 1, innerRadius?: number, rotation = 0) {
        super();
        this.x = x;
        this.y = y;
        this.pointNum = pointNum;
        this.radius = radius;
        this.innerRadius = innerRadius || radius / 2;
        this.rotation = rotation;
        this._isInvalid = true;
    }
    /**
     * @ignore
     */
    public serialize(ctx: Serializer) {
        super.serialize(ctx);
        ctx.puts<Star>(['x', 'y', 'rotation', 'pointNum', 'innerRadius', 'radius']);
    }
    /**
     * @ignore
     */
    public deserialize(ctx: Deserializer) {
        super.deserialize(ctx);
        ctx.reads<Star>(['x', 'y', 'rotation', 'pointNum', 'innerRadius', 'radius']);
    }
    /**
     * The name of instance's class.
     */
    public className(): string {
        return 'Star';
    }
    /**
     * Add this star to drawing.
     */
    public draw() {
        const { x, y, rotation, pointNum, innerRadius, radius } = this;

        const startAngle = (-1 * Math.PI / 2) + rotation;
        const len = pointNum * 2;
        const delta = _Math.PI_2 / len;
        const polygon: number[] = [];

        for (let i = 0; i < len; i++) {
            const r = i % 2 ? innerRadius : radius;
            const angle = (i * delta) + startAngle;

            polygon.push(
                x + (r * Math.cos(angle)),
                y + (r * Math.sin(angle))
            );
        }
        this.points = polygon;
        super.draw();
    }
}
