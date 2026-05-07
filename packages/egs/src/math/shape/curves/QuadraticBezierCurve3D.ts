import { Vector3 } from '../../Vector3';
import { Curve } from './Curve';
import { _Math } from '../../Math';
/**
 * Build a Quadratic-Bezier curve by {@link v0 | v0 }, {@link v1 | v1 } and {@link v2 | v2 } in 3D {@link Path | Path }.
 */
export class QuadraticBezierCurve3D extends Curve<Vector3> {
    public isQuadraticBezierCurve3D = true;
    public v0: Vector3;
    public v1: Vector3;
    public v2: Vector3;

    constructor(v0?: Vector3, v1?: Vector3, v2?: Vector3) {
        super();
        this.type = 'QuadraticBezierCurve3';
        this.v0 = v0 || new Vector3();
        this.v1 = v1 || new Vector3();
        this.v2 = v2 || new Vector3();
    }

    public getPoint(t: number, optionalTarget?: Vector3): Vector3 {
        const point = optionalTarget || new Vector3();
        const v0 = this.v0;
        const v1 = this.v1;
        const v2 = this.v2;

        point.set(
            _Math.QuadraticBezier(t, v0.x, v1.x, v2.x),
            _Math.QuadraticBezier(t, v0.y, v1.y, v2.y),
            _Math.QuadraticBezier(t, v0.z, v1.z, v2.z)
        );

        return point;
    }

    public clone() {
        return new QuadraticBezierCurve3D().copy(this);
    }

    public copy(source: QuadraticBezierCurve3D) {
        super.copy(source);
        this.v0.copy(source.v0);
        this.v1.copy(source.v1);
        this.v2.copy(source.v2);

        return this;
    }

    public toJSON(): any {
        const data = super.toJSON();
        data.v0 = this.v0.toArray();
        data.v1 = this.v1.toArray();
        data.v2 = this.v2.toArray();

        return data;
    }

    public fromJSON(json: any) {
        super.fromJSON(json);
        this.v0.fromArray(json.v0);
        this.v1.fromArray(json.v1);
        this.v2.fromArray(json.v2);

        return this;
    }
}
