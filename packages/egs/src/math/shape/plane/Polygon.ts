import { _Math } from '../../Math';
import { Vector2 } from '../../Vector2';
import { Shape } from './Shape';

import { Serializer, Deserializer } from '../../../utils/Serialization';
/**
 * A class to define a shape via user defined co-ordinates.
 */
export class Polygon extends Shape {
    /**
     * The type of the object, mainly used to avoid 'instanceof' checks.
     */
    public type = 'Polygon';
    /**
     * @param points This can be an array of Points.
     */
    public points: number[] = [];

    constructor(points: number[] = []) {

        super();
        this.points = points;
        this._isInvalid = true;
    }
    /**
     * @internal
     */
    public serialize(ctx: Serializer) {
        super.serialize(ctx);
        ctx.puts<Polygon>(['points']);
    }
    /**
     * @internal
     */
    public deserialize(ctx: Deserializer) {
        super.deserialize(ctx);
        ctx.reads<Polygon>(['points']);
    }
    /**
     * The name of instance's class.
     */
    public className(): string {
        return 'Polygon';
    }
    /**
     * Add this polygon to drawing.
     */
    public draw() {
        const points = this.points;
        if (points.length === 0) {
            return;
        }
        const ps: Vector2[] = [];
        for (let i = 0; i < points.length; i += 2) {
            ps.push(new Vector2(points[i], points[i + 1]));
        }
        this.setFromPoints(ps);
        this.autoClose = true;
    }
    /**
     * Creates a clone of this polygon.
     * @return a copy of the polygon
     */
    public clone(): Polygon {
        const points = this.points.slice();
        const polygon = new Polygon(points);

        return polygon;
    }
    /**
     * Checks whether the x and y coordinates passed to this function are contained within this polygon.
     * @param x The X coordinate of the point to test.
     * @param y The Y coordinate of the point to test.
     * @return Whether the x/y coordinates are within this polygon.
     */
    public contains(x: number, y: number): boolean {
        let inside = false;

        // https://github.com/substack/point-in-polygon/blob/master/index.js
        const length = this.points.length / 2;

        for (let i = 0, j = length - 1; i < length; j = i++) {
            const xi = this.points[i * 2];
            const yi = this.points[(i * 2) + 1];
            const xj = this.points[j * 2];
            const yj = this.points[(j * 2) + 1];
            const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * ((y - yi) / (yj - yi))) + xi);

            if (intersect) {
                inside = !inside;
            }
        }

        return inside;
    }
}
