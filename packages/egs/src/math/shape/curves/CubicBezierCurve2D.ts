import { Vector2 } from '../../../math/Vector2';
import { _Math } from '../../Math';
import { Curve2D } from './Curve2D';
import { Serializer, Deserializer } from '../../../utils/Serialization';
/**
 * The cubic-bezier curve object is used to help drawing curves for {@link Path | path }.
 */
export class CubicBezierCurve2D extends Curve2D {
    public CubicBezierCurve2D = true;
    public v0: Vector2;
    public v1: Vector2;
    public v2: Vector2;
    public v3: Vector2;

    constructor(v0?: Vector2, v1?: Vector2, v2?: Vector2, v3?: Vector2) {
        super();
        this.type = 'CubicBezierCurve2D';

        this.v0 = v0 || new Vector2();
        this.v1 = v1 || new Vector2();
        this.v2 = v2 || new Vector2();
        this.v3 = v3 || new Vector2();
    }
    /**
     * @internal
     */
    public serialize(ctx: Serializer) {
        ctx.puts<CubicBezierCurve2D>(['v0', 'v1', 'v2', 'v3']);
    }
    /**
     * @internal
     */
    public deserialize(ctx: Deserializer) {
        ctx.reads<CubicBezierCurve2D>(['v0', 'v1', 'v2', 'v3']);
    }

    public className(): string {
        return 'CubicBezierCurve2D';
    }

    public getPoint(t: number, optionalTarget?: Vector2): Vector2 {
        const point = optionalTarget || new Vector2();
        const v0 = this.v0;
        const v1 = this.v1;
        const v2 = this.v2;
        const v3 = this.v3;

        point.set(
            _Math.CubicBezier(t, v0.x, v1.x, v2.x, v3.x),
            _Math.CubicBezier(t, v0.y, v1.y, v2.y, v3.y)
        );
        return point;
    }

    public clone() {
        return new CubicBezierCurve2D().copy(this);
    }

    public copy(source: CubicBezierCurve2D) {
        super.copy(source);
        this.v0.copy(source.v0);
        this.v1.copy(source.v1);
        this.v2.copy(source.v2);
        this.v3.copy(source.v3);
        return this;
    }

    public toJSON(): any {
        const data = super.toJSON();
        data.v0 = this.v0.toArray();
        data.v1 = this.v1.toArray();
        data.v2 = this.v2.toArray();
        data.v3 = this.v3.toArray();
        return data;
    }

    public fromJSON(json: any) {
        super.fromJSON(json);
        this.v0.fromArray(json.v0);
        this.v1.fromArray(json.v1);
        this.v2.fromArray(json.v2);
        this.v3.fromArray(json.v3);
        return this;
    }
}
