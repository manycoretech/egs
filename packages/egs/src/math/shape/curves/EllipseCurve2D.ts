import { Vector2 } from '../../Vector2';
import { Curve2D } from './Curve2D';
import { Serializer, Deserializer } from '../../../utils/Serialization';
/**
 * Creates a 2d curve in the shape of an ellipse. Setting the xRadius equal to the yRadius will result in a circle.
 */
export class EllipseCurve2D extends Curve2D {
    aX: number;
    aY: number;
    xRadius: number;
    yRadius: number;
    aStartAngle: number;
    aEndAngle: number;
    aClockwise: boolean;
    aRotation: number;
    isEllipseCurve2D = true;
    divisions?: number;

    /**
     * @param { number } aX The X center of the ellipse. Default is 0.
     * @param { number } aY The Y center of the ellipse. Default is 0.
     * @param { number } xRadius The radius of the ellipse in the x direction. Default is 1.
     * @param { number } yRadius The radius of the ellipse in the y direction. Default is 1.
     * @param { number } aStartAngle The start angle of the curve in radians starting from the positive X axis. Default is 0.
     * @param { number } aEndAngle The end angle of the curve in radians starting from the positive X axis. Default is 2 PI.
     * @param { number } aClockwise Whether the ellipse is drawn clockwise. Default is false.
     * @param { number } aRotation The rotation angle of the ellipse in radians, counterclockwise from the positive X axis (optional). Default is 0.
     * @param { number } divisions How many parts will each curve been seperated(Optional).
     */
    constructor(aX?: number, aY?: number, xRadius?: number, yRadius?: number, aStartAngle?: number, aEndAngle?: number, aClockwise?: boolean, aRotation?: number, divisions?: number) {
        super();
        this.type = 'EllipseCurve2D';

        this.aX = aX || 0;
        this.aY = aY || 0;

        this.xRadius = xRadius || 1;
        this.yRadius = yRadius || 1;

        this.aStartAngle = aStartAngle || 0;
        this.aEndAngle = aEndAngle || 2 * Math.PI;

        this.aClockwise = aClockwise || false;

        this.aRotation = aRotation || 0;
        this.divisions = divisions;
    }

    serialize(ctx: Serializer) {
        ctx.puts<EllipseCurve2D>(['aX', 'aY', 'xRadius', 'yRadius', 'aStartAngle', 'aEndAngle', 'aClockwise', 'aRotation']);
    }

    deserialize(ctx: Deserializer) {
        ctx.reads<EllipseCurve2D>(['aX', 'aY', 'xRadius', 'yRadius', 'aStartAngle', 'aEndAngle', 'aClockwise', 'aRotation']);
    }

    className(): string {
        return 'EllipseCurve2D';
    }

    getPoints(divisions?: number) {
        if (divisions === undefined) {
            divisions = this.divisions;
        }
        const points = super.getPoints(divisions);
        return points;
    }

    getPoint(t: number, optionalTarget?: Vector2): Vector2 {
        const point = optionalTarget || new Vector2();
        const twoPi = Math.PI * 2;
        let deltaAngle = this.aEndAngle - this.aStartAngle;
        const samePoints = Math.abs(deltaAngle) < Number.EPSILON;

        // ensures that deltaAngle is 0 .. 2 PI
        while (deltaAngle < 0) {
            deltaAngle += twoPi;
        }
        while (deltaAngle > twoPi) {
            deltaAngle -= twoPi;
        }

        if (deltaAngle < Number.EPSILON) {
            if (samePoints) {
                deltaAngle = 0;
            } else {
                deltaAngle = twoPi;
            }
        }

        if (this.aClockwise === true && !samePoints) {
            if (deltaAngle === twoPi) {
                deltaAngle = - twoPi;
            } else {
                deltaAngle = deltaAngle - twoPi;
            }
        }

        const angle = this.aStartAngle + t * deltaAngle;
        let x = this.aX + this.xRadius * Math.cos(angle);
        let y = this.aY + this.yRadius * Math.sin(angle);

        if (this.aRotation !== 0) {
            const cos = Math.cos(this.aRotation);
            const sin = Math.sin(this.aRotation);
            const tx = x - this.aX;
            const ty = y - this.aY;

            // Rotate the point about the center of the ellipse.
            x = tx * cos - ty * sin + this.aX;
            y = tx * sin + ty * cos + this.aY;
        }
        return point.set(x, y);
    }

    clone() {
        return new EllipseCurve2D().copy(this);
    }

    copy(source: EllipseCurve2D) {
        super.copy(source);
        this.aX = source.aX;
        this.aY = source.aY;

        this.xRadius = source.xRadius;
        this.yRadius = source.yRadius;

        this.aStartAngle = source.aStartAngle;
        this.aEndAngle = source.aEndAngle;

        this.aClockwise = source.aClockwise;
        this.aRotation = source.aRotation;
        return this;
    }
}
