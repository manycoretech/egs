import { EllipseCurve2D } from './EllipseCurve2D';
import { _Math } from '../../Math';
import { Curve } from './Curve';
/**
 * This class is used to draw an arc-curve that is a part of ellipse curve.
 */
export class ArcCurve2D extends EllipseCurve2D {
    isArcCurve2D = true;
    /**
     * @param { number } aX The X center of the ellipse. Default is 0.
     * @param { number } aY The Y center of the ellipse. Default is 0.
     * @param { number } aRadius The radius of this arc-curve. Default is 1.
     * @param { number } aStartAngle The start angle of the curve in radians starting from the positive X axis. Default is 0.
     * @param { number } aEndAngle The end angle of the curve in radians starting from the positive X axis. Default is 2 PI.
     * @param { number } aClockwise Whether the ellipse is drawn clockwise. Default is false.
     */
    constructor(aX?: number, aY?: number, aRadius?: number, aStartAngle?: number, aEndAngle?: number, aClockwise?: boolean) {
        super(aX, aY, aRadius, aRadius, aStartAngle, aEndAngle, aClockwise);
        this.type = 'ArcCurve';
    }

    className(): string {
        return 'ArcCurve2D';
    }

    // Get sequence of points using getPoint(t)
    getPoints(divisions?: number) {
        if (divisions === undefined) {
            const sweep = this.aEndAngle - this.aStartAngle;
            divisions = Curve.segmentsCount(
                Math.abs(sweep) * this.xRadius,
                Math.ceil(Math.abs(sweep) / _Math.PI_2) * 40
            );
        }
        return super.getPoints(divisions);
    }

    clone(): ArcCurve2D {
        return new ArcCurve2D().copy(this);
    }
}
