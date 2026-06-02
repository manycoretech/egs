import { Deserializer, Serializer } from '../../../utils/Serialization';
import { Box2 } from '../../Box2';
import { Vector2 } from '../../Vector2';
import { CubicBezierCurve2D } from '../curves/CubicBezierCurve2D';
import { Curve2D } from '../curves/Curve2D';
import * as Curves from '../curves/Curves';
import { EllipseCurve2D } from '../curves/EllipseCurve2D';
import { LineCurve2D } from '../curves/LineCurve2D';
import { QuadraticBezierCurve2D } from '../curves/QuadraticBezierCurve2D';
import { SplineCurve2D } from '../curves/SplineCurve2D';

/**
 * The class provides methods for creating paths and contours of 2D shapes similar to the 2D Canvas API.
 */
export class Path extends Curve2D {
    /**
     * Store all the drawn curves into this.
     */
    curves: Curve2D[];
    /**
     * Automatically closes the path.
     */
    autoClose: boolean;
    /**
     * Cache values if curves and cache array are same length.
     */
    cacheLengths?: number[];
    /**
     * Record the latest point's position.
     */
    currentPoint: Vector2;

    constructor(points?: Vector2[]) {
        super();
        this.curves = [];
        this.type = 'Path';
        this.currentPoint = new Vector2();
        this.autoClose = false; // Automatically closes the path
        if (points) {
            this.setFromPoints(points);
        }
    }
    /**
     * @internal
     */
    serialize(ctx: Serializer) {
        super.serialize(ctx);
        ctx.puts<Path>(['curves', 'autoClose']);
    }
    /**
     * @internal
     */
    deserialize(ctx: Deserializer) {
        super.deserialize(ctx);
        ctx.reads<Path>(['curves', 'autoClose']);
    }
    /**
     * The name of instance's class.
     */
    className(): string {
        return 'Path';
    }
    /**
     * Add a curve to this path.
     */
    add(curve: Curve2D): void {
        this.curves.push(curve);
    }
    /**
     * Add a line curve if start and end of lines are not connected.
     */
    closePath(): void {
        const startPoint = this.curves[0].getPoint(0);
        const endPoint = this.curves[this.curves.length - 1].getPoint(1);

        if (!startPoint.equals(endPoint)) {
            this.curves.push(new LineCurve2D(endPoint, startPoint));
        }
    }
    /**
     * Return the point at specified position index of whole curves.
     * @param t proportion from 0 - 1.
     */
    getPoint(t: number): Vector2 {
        const d = t * this.getLength();
        const curveLengths = this.getCurveLengths();
        let i = 0;

        // To think about boundaries points.
        while (i < curveLengths.length) {
            if (curveLengths[i] >= d) {
                const diff = curveLengths[i] - d;
                const curve = this.curves[i];
                const segmentLength = curve.getLength();
                const u = segmentLength === 0 ? 0 : 1 - diff / segmentLength;
                return curve.getPointAt(u);
            }
            i++;
        }
        return new Vector2();
    }
    /**
     * We cannot use the default {@link getPoint| getPoint} with getLength() because in curve,
     * getLength() depends on getPoint() but in {@link getPoint| getPoint} depends on getLength().
     */
    getLength(): number {
        const lens = this.getCurveLengths();
        return lens[lens.length - 1];
    }
    /**
     * Compute lengths and cache them.
     * We cannot overwrite getLengths() because UtoT mapping uses it.
     */
    updateArcLengths(): void {
        this.needsUpdate = true;
        this.cacheLengths = undefined;
        this.getCurveLengths();
    }
    /**
     * Return the length of every curves.
     */
    getCurveLengths(): number[] {
        // We use cache values if curves and cache array are same length
        if (this.cacheLengths && this.cacheLengths.length === this.curves.length) {
            return this.cacheLengths;
        }

        // Get length of sub-curve
        // Push sums into cached array
        const lengths = [];
        let sums = 0;
        for (let i = 0, l = this.curves.length; i < l; i++) {
            sums += this.curves[i].getLength();
            lengths.push(sums);
        }
        this.cacheLengths = lengths;
        return lengths;
    }
    /**
     * Return points array which the numbers equals to 'divisions'.
     * Each pair of points has same space between them.
     * Default return 40 points.
     */
    getSpacedPoints(divisions?: number): Vector2[] {
        if (divisions === undefined) {
            divisions = 40;
        }

        const points = [];
        for (let i = 0; i <= divisions; i++) {
            points.push(this.getPoint(i / divisions));
        }

        if (this.autoClose) {
            points.push(points[0]);
        }
        return points;
    }
    /**
     * Return all points from all {@link curves| curves}.
     */
    getPoints(divisions?: number): Vector2[] {
        const points: Vector2[] = [];
        let last: Vector2 | undefined;

        for (let i = 0, curves = this.curves; i < curves.length; i++) {
            const curve = curves[i];
            const pts = curve.getPoints(divisions);
            for (let j = 0; j < pts.length; j++) {
                const point = pts[j];
                if (last && last.equals(point)) {
                    continue; // ensures no consecutive points are duplicates
                }
                points.push(point);
                last = point;
            }
        }

        if (this.autoClose && points.length > 1 && !points[points.length - 1].equals(points[0])) {
            if (Math.abs(points[points.length - 1].x - points[0].x) < 1e-4 && Math.abs(points[points.length - 1].y - points[0].y) < 1e-4) {
                points[points.length - 1].copy(points[0]);
            } else {
                points.push(points[0]);
            }
        }
        return points;
    }
    /**
     * Use line to connect points one by one.
     */
    setFromPoints(points: Vector2[]): void {
        this.moveTo(points[0].x, points[0].y);
        for (let i = 1, l = points.length; i < l; i++) {
            this.lineTo(points[i].x, points[i].y);
        }
    }

    moveTo(x: number, y: number): void {
        this.currentPoint.set(x, y); // TODO consider referencing vectors instead of copying?
    }

    lineTo(x: number, y: number): void {
        const curve = new LineCurve2D(this.currentPoint.clone(), new Vector2(x, y));
        this.curves.push(curve);
        this.currentPoint.set(x, y);
    }

    quadraticCurveTo(aCPx: number, aCPy: number, aX: number, aY: number): void {
        const curve = new QuadraticBezierCurve2D(
            this.currentPoint.clone(),
            new Vector2(aCPx, aCPy),
            new Vector2(aX, aY)
        );
        this.curves.push(curve);
        this.currentPoint.set(aX, aY);
    }

    bezierCurveTo(aCP1x: number, aCP1y: number, aCP2x: number, aCP2y: number, aX: number, aY: number): void {
        const curve = new CubicBezierCurve2D(
            this.currentPoint.clone(),
            new Vector2(aCP1x, aCP1y),
            new Vector2(aCP2x, aCP2y),
            new Vector2(aX, aY)
        );
        this.curves.push(curve);
        this.currentPoint.set(aX, aY);
    }

    splineThru(pts: Vector2[]): void {
        const npts = [this.currentPoint.clone()].concat(pts);
        const curve = new SplineCurve2D(npts);
        this.curves.push(curve);
        this.currentPoint.copy(pts[pts.length - 1]);
    }

    arc(aX: number, aY: number, aRadius?: number, aStartAngle?: number, aEndAngle?: number, aClockwise?: boolean, divisions?: number, isFill?: boolean): void {
        const x0 = this.currentPoint.x;
        const y0 = this.currentPoint.y;

        this.absArc(aX + x0, aY + y0, aRadius, aStartAngle, aEndAngle, aClockwise, divisions, isFill);
    }

    absArc(aX: number, aY: number, aRadius?: number, aStartAngle?: number, aEndAngle?: number, aClockwise?: boolean, divisions?: number, isFill?: boolean): void {
        this.absEllipse(aX, aY, aRadius, aRadius, aStartAngle, aEndAngle, aClockwise, undefined, divisions, isFill);
    }

    ellipse(aX: number, aY: number, xRadius: number, yRadius: number, aStartAngle: number, aEndAngle: number, aClockwise: boolean, aRotation: number, isFill?: boolean): void {
        const x0 = this.currentPoint.x;
        const y0 = this.currentPoint.y;

        this.absEllipse(aX + x0, aY + y0, xRadius, yRadius, aStartAngle, aEndAngle, aClockwise, aRotation, undefined, isFill);
    }

    absEllipse(aX?: number, aY?: number, xRadius?: number, yRadius?: number, aStartAngle?: number, aEndAngle?: number, aClockwise?: boolean, aRotation?: number, divisions?: number, isFill = false): void {
        const curve = new EllipseCurve2D(aX, aY, xRadius, yRadius, aStartAngle, aEndAngle, aClockwise, aRotation, divisions);
        isFill = isFill || this.curves.length > 0;
        if (isFill) {
            // if a previous curve is present, attempt to join
            const firstPoint = curve.getPoint(0);
            if (!firstPoint.equals(this.currentPoint)) {
                this.lineTo(firstPoint.x, firstPoint.y);
            }
        }

        this.curves.push(curve);
        const lastPoint = curve.getPoint(1);
        this.currentPoint.copy(lastPoint);
    }

    getBounds(bounds = new Box2()) {
        const temp = new Box2();
        this.curves.reduce((pv, cv) => {
            cv.getBounds(temp);
            pv.union(temp);
            return pv;
        }, bounds);
        return bounds;
    }

    clone() {
        return new Path().copy(this);
    }

    copy(source: Path) {
        super.copy(source);
        this.curves = [];
        for (let i = 0, l = source.curves.length; i < l; i++) {
            const curve = source.curves[i];
            this.curves.push(curve.clone());
        }
        this.autoClose = source.autoClose;
        this.currentPoint.copy(source.currentPoint);
        return this;
    }

    toJSON(): any {
        const data = super.toJSON();
        data.autoClose = this.autoClose;
        data.curves = [];

        for (let i = 0, l = this.curves.length; i < l; i++) {
            const curve = this.curves[i];
            data.curves.push(curve.toJSON());
        }
        data.currentPoint = this.currentPoint.toArray();
        return data;
    }

    fromJSON(json: any) {
        super.fromJSON.call(this, json);
        this.autoClose = json.autoClose;
        this.curves = [];

        for (let i = 0, l = json.curves.length; i < l; i++) {
            const curve = json.curves[i];
            this.curves.push(new (Curves as any)[curve.type]().fromJSON(curve));
        }
        this.currentPoint.fromArray(json.currentPoint);
        return this;
    }
}
