import { Vector2 } from '../../Vector2.js';
import { _Math } from '../../Math.js';
import { Curve2D } from './Curve2D.js';
import type { Serializer, Deserializer } from '../../../utils/Serialization.js';
/**
 * Build spline curve by an array of controlling points.
 */
export class SplineCurve2D extends Curve2D {
    points: Vector2[];
    isSplineCurve2D = true;

    constructor(points?: Vector2[]) {
        super();
        this.type = 'SplineCurve';
        this.points = points || [];
    }

    serialize(ctx: Serializer) {
        ctx.puts<SplineCurve2D>(['points']);
    }

    deserialize(ctx: Deserializer) {
        ctx.reads<SplineCurve2D>(['points']);
    }

    className(): string {
        return 'SplineCurve2D';
    }

    getPointAt(t: number, optionalTarget?: Vector2): Vector2 {
        const point = optionalTarget || new Vector2();
        const points = this.points;
        const p = (points.length - 1) * t;
        const intPoint = Math.floor(p);
        const weight = p - intPoint;

        const p0 = points[intPoint === 0 ? intPoint : intPoint - 1];
        const p1 = points[intPoint];
        const p2 = points[intPoint > points.length - 2 ? points.length - 1 : intPoint + 1];
        const p3 = points[intPoint > points.length - 3 ? points.length - 1 : intPoint + 2];

        point.set(_Math.CatmullRom(weight, p0.x, p1.x, p2.x, p3.x), _Math.CatmullRom(weight, p0.y, p1.y, p2.y, p3.y));

        return point;
    }

    copy(source: SplineCurve2D) {
        this.arcLengthDivisions = source.arcLengthDivisions;
        this.points = [];
        for (let i = 0, l = source.points.length; i < l; i++) {
            const point = source.points[i];
            this.points.push(point.clone());
        }
        return this;
    }

    clone() {
        return new SplineCurve2D().copy(this);
    }

    toJSON(): any {
        const data = super.toJSON();
        data.points = [];
        for (let i = 0, l = this.points.length; i < l; i++) {
            const point = this.points[i];
            data.points.push(point.toArray());
        }

        return data;
    }

    fromJSON(json: any) {
        super.fromJSON(json);
        this.points = [];
        for (let i = 0, l = json.points.length; i < l; i++) {
            const point = json.points[i];
            this.points.push(new Vector2().fromArray(point));
        }
        return this;
    }
}
