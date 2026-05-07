import { Vector2 } from '../../Vector2';
import { Curve2D } from './Curve2D';
import { Serializer, Deserializer } from '../../../utils/Serialization';
/**
 * Build a line from {@link v1 | v1 } to {@link v2 | v2 } in 2D space.
 */
export class LineCurve2D extends Curve2D {
    public isLineCurve2D = true;
    public v1: Vector2;
    public v2: Vector2;

    constructor(v1?: Vector2, v2?: Vector2) {
        super();
        this.type = 'LineCurve2D';

        this.v1 = v1 || new Vector2();
        this.v2 = v2 || new Vector2();
    }

    public serialize(ctx: Serializer) {
        ctx.puts<LineCurve2D>(['v1', 'v2']);
    }

    public deserialize(ctx: Deserializer) {
        ctx.reads<LineCurve2D>(['v1', 'v2']);
    }

    public className(): string {
        return 'LineCurve2D';
    }

    public getPoint(t: number, optionalTarget?: Vector2): Vector2 {
        const point = optionalTarget || new Vector2();
        if (t === 1) {
            point.copy(this.v2);
        } else {
            point.copy(this.v2).sub(this.v1);
            point.multiplyScalar(t).add(this.v1);
        }
        return point;
    }

    public getPointAt(u: number, optionalTarget?: Vector2): Vector2 {
        return this.getPoint(u, optionalTarget);
    }

    public getPoints(divisions?: number) {
        if (divisions === undefined) {
            divisions = 1;
        }
        return super.getPoints(divisions);
    }

    public clone() {
        return new LineCurve2D().copy(this);
    }

    public copy(source: LineCurve2D) {
        super.copy(source);
        this.v1.copy(source.v1);
        this.v2.copy(source.v2);
        return this;
    }

    public toJSON(): any {
        const data = super.toJSON();
        data.v1 = this.v1.toArray();
        data.v2 = this.v2.toArray();
        return data;
    }

    public fromJSON(json: any) {
        super.fromJSON(json);
        this.v1.fromArray(json.v1);
        this.v2.fromArray(json.v2);
        return this;
    }
}
