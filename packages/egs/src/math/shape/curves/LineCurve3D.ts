import { Curve } from './Curve';
import { Vector3 } from '../../Vector3';
/**
 * Build a line from {@link v1 | v1 } to {@link v2 | v2 } in 3D space.
 */
export class LineCurve3D extends Curve<Vector3> {
    isLineCurve3D = true;
    v1: Vector3;
    v2: Vector3;

    constructor(v1?: Vector3, v2?: Vector3) {
        super();
        this.type = 'LineCurve3D';

        this.v1 = v1 || new Vector3();
        this.v2 = v2 || new Vector3();
    }

    getPoint(t: number, optionalTarget?: Vector3): Vector3 {
        const point = optionalTarget || new Vector3();
        if (t === 1) {
            point.copy(this.v2);
        } else {
            point.copy(this.v2).sub(this.v1);
            point.multiplyScalar(t).add(this.v1);
        }
        return point;
    }

    getPointAt(u: number, optionalTarget?: Vector3): Vector3 {
        return this.getPoint(u, optionalTarget);
    }

    clone() {
        return new LineCurve3D().copy(this);
    }

    copy(source: LineCurve3D) {
        super.copy(source);
        this.v1.copy(source.v1);
        this.v2.copy(source.v2);
        return this;
    }

    toJSON(): any {
        const data = super.toJSON();
        data.v1 = this.v1.toArray();
        data.v2 = this.v2.toArray();
        return data;
    }

    fromJSON(json: any) {
        super.fromJSON(json);
        this.v1.fromArray(json.v1);
        this.v2.fromArray(json.v2);
        return this;
    }
}
