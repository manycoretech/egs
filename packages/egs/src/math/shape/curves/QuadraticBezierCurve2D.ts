import { Vector2 } from '../../Vector2';
import { _Math } from '../../Math';
import { Curve2D } from './Curve2D';
import type { Serializer, Deserializer } from '../../../utils/Serialization';
/**
 * Build a Quadratic-Bezier curve by {@link v0 | v0 }, {@link v1 | v1 } and {@link v2 | v2 } in 3D {@link Path | Path }.
 */
export class QuadraticBezierCurve2D extends Curve2D {
    isQuadraticBezierCurve3D = true;
    v0: Vector2;
    v1: Vector2;
    v2: Vector2;

    constructor(v0?: Vector2, v1?: Vector2, v2?: Vector2) {
        super();
        this.type = 'QuadraticBezierCurve2D';
        this.v0 = v0 || new Vector2();
        this.v1 = v1 || new Vector2();
        this.v2 = v2 || new Vector2();
    }

    serialize(ctx: Serializer) {
        ctx.puts<QuadraticBezierCurve2D>(['v0', 'v1', 'v2']);
    }

    deserialize(ctx: Deserializer) {
        ctx.reads<QuadraticBezierCurve2D>(['v0', 'v1', 'v2']);
    }

    className(): string {
        return 'QuadraticBezierCurve2D';
    }

    getPoint(t: number, optionalTarget?: Vector2): Vector2 {
        const point = optionalTarget || new Vector2();
        const v0 = this.v0;
        const v1 = this.v1;
        const v2 = this.v2;

        point.set(
            _Math.QuadraticBezier(t, v0.x, v1.x, v2.x),
            _Math.QuadraticBezier(t, v0.y, v1.y, v2.y)
        );

        return point;
    }

    clone() {
        return new QuadraticBezierCurve2D().copy(this);
    }

    copy(source: QuadraticBezierCurve2D) {
        super.copy(source);
        this.v0.copy(source.v0);
        this.v1.copy(source.v1);
        this.v2.copy(source.v2);

        return this;
    }

    toJSON(): any {
        const data = super.toJSON();
        data.v0 = this.v0.toArray();
        data.v1 = this.v1.toArray();
        data.v2 = this.v2.toArray();

        return data;
    }

    fromJSON(json: any) {
        super.fromJSON(json);
        this.v0.fromArray(json.v0);
        this.v1.fromArray(json.v1);
        this.v2.fromArray(json.v2);

        return this;
    }
}
