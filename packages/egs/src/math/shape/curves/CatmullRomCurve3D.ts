import { Curve } from './Curve';
import { Vector3 } from '../../Vector3';

class CubicPoly {
    c0 = 0;
    c1 = 0;
    c2 = 0;
    c3 = 0;

    private init(x0: number, x1: number, t0: number, t1: number): void {
        this.c0 = x0;
        this.c1 = t0;
        this.c2 = - 3 * x0 + 3 * x1 - 2 * t0 - t1;
        this.c3 = 2 * x0 - 2 * x1 + t0 + t1;
    }

    initCatmullRom(x0: number, x1: number, x2: number, x3: number, tension: number): void {
        this.init(x1, x2, tension * (x2 - x0), tension * (x3 - x1));
    }

    initNonuniformCatmullRom(x0: number, x1: number, x2: number, x3: number, dt0: number, dt1: number, dt2: number): void {
        // compute tangents when parameterized in [t1,t2]
        let t1 = (x1 - x0) / dt0 - (x2 - x0) / (dt0 + dt1) + (x2 - x1) / dt1;
        let t2 = (x2 - x1) / dt1 - (x3 - x1) / (dt1 + dt2) + (x3 - x2) / dt2;

        // rescale tangents for parametrization in [0,1]
        t1 *= dt1;
        t2 *= dt1;
        this.init(x1, x2, t1, t2);
    }

    calc(t: number): number {
        const t2 = t * t;
        const t3 = t2 * t;
        return this.c0 + this.c1 * t + this.c2 * t2 + this.c3 * t3;
    }
}

const tmp = new Vector3();
const px = new CubicPoly();
const py = new CubicPoly();
const pz = new CubicPoly();
/**
 * The Catmull-Rom curve object is used to help drawing curves in 3D space.
 */
export class CatmullRomCurve3D extends Curve<Vector3> {
    /**
     * The control points used to decide the curve.
     */
    points: Vector3[];
    /**
     * If includes the end point.
     */
    closed: boolean;
    /**
     * Only two types of curves can be chosen, 'centripetal' and 'chordal'.
     */
    curveType: string;
    /**
     * Control the distance between each points.
     */
    tension: number;
    /**
     * Check the type whether it belongs to CatmullRomCurve3D.
     * This value should not be changed by user.
     */
    isCatmullRomCurve3 = true;

    constructor(points?: Vector3[], closed?: boolean, curveType?: string, tension?: number) {
        super();
        this.type = 'CatmullRomCurve3D';
        this.points = points || [];
        this.closed = closed || false;
        this.curveType = curveType || 'centripetal';
        this.tension = tension || 0.5;
    }
    /**
     * Return the position on the curve at t.
     */
    getPoint(t: number, optionalTarget?: Vector3): Vector3 {
        const point = optionalTarget || new Vector3();
        const points = this.points;
        const l = points.length;
        const p = (l - (this.closed ? 0 : 1)) * t;
        let intPoint = Math.floor(p);
        let weight = p - intPoint;

        if (this.closed) {
            intPoint += intPoint > 0 ? 0 : (Math.floor(Math.abs(intPoint) / l) + 1) * l;
        } else if (weight === 0 && intPoint === l - 1) {
            intPoint = l - 2;
            weight = 1;
        }

        let p0, p3;

        if (this.closed || intPoint > 0) {
            p0 = points[(intPoint - 1) % l];
        } else {
            // extrapolate first point
            tmp.subVectors(points[0], points[1]).add(points[0]);
            p0 = tmp;
        }

        const p1 = points[intPoint % l];
        const p2 = points[(intPoint + 1) % l];

        if (this.closed || intPoint + 2 < l) {
            p3 = points[(intPoint + 2) % l];
        } else {
            // extrapolate last point
            tmp.subVectors(points[l - 1], points[l - 2]).add(points[l - 1]);
            p3 = tmp;
        }

        if (this.curveType === 'centripetal' || this.curveType === 'chordal') {
            // init Centripetal / Chordal Catmull-Rom
            const pow = this.curveType === 'chordal' ? 0.5 : 0.25;
            let dt0 = Math.pow(p0.distanceToSquared(p1), pow);
            let dt1 = Math.pow(p1.distanceToSquared(p2), pow);
            let dt2 = Math.pow(p2.distanceToSquared(p3), pow);

            // safety check for repeated points
            if (dt1 < 1e-4) {
                dt1 = 1.0;
            }
            if (dt0 < 1e-4) {
                dt0 = dt1;
            }
            if (dt2 < 1e-4) {
                dt2 = dt1;
            }
            px.initNonuniformCatmullRom(p0.x, p1.x, p2.x, p3.x, dt0, dt1, dt2);
            py.initNonuniformCatmullRom(p0.y, p1.y, p2.y, p3.y, dt0, dt1, dt2);
            pz.initNonuniformCatmullRom(p0.z, p1.z, p2.z, p3.z, dt0, dt1, dt2);
        } else if (this.curveType === 'catmullrom') {
            px.initCatmullRom(p0.x, p1.x, p2.x, p3.x, this.tension);
            py.initCatmullRom(p0.y, p1.y, p2.y, p3.y, this.tension);
            pz.initCatmullRom(p0.z, p1.z, p2.z, p3.z, this.tension);
        }

        point.set(
            px.calc(weight),
            py.calc(weight),
            pz.calc(weight)
        );
        return point;
    }

    clone() {
        return new CatmullRomCurve3D().copy(this);
    }

    copy(source: CatmullRomCurve3D) {
        super.copy(source);
        this.points = [];
        for (let i = 0, l = source.points.length; i < l; i++) {
            const point = source.points[i];
            this.points.push(point.clone());
        }

        this.closed = source.closed;
        this.curveType = source.curveType;
        this.tension = source.tension;
        return this;
    }

    toJSON(): any {
        const data = super.toJSON();
        data.points = [];
        for (let i = 0, l = this.points.length; i < l; i++) {
            const point = this.points[i];
            data.points.push(point.toArray());
        }

        data.closed = this.closed;
        data.curveType = this.curveType;
        data.tension = this.tension;
        return data;
    }

    fromJSON(json: any) {
        super.fromJSON(json);
        this.points = [];
        for (let i = 0, l = json.points.length; i < l; i++) {
            const point = json.points[i];
            this.points.push(new Vector3().fromArray(point));
        }

        this.closed = json.closed;
        this.curveType = json.curveType;
        this.tension = json.tension;
        return this;
    }
}
