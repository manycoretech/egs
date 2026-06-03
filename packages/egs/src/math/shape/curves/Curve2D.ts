import { Curve } from './Curve';
import type { Vector2 } from '../../Vector2';
import { Box2 } from '../../Box2';
/**
 * A basic class for curve which can be drawn in {@link Path | path }. 2d space
 */
export class Curve2D extends Curve<Vector2>{

    getBounds(bounds = new Box2()) {
        const points = this.getPoints();
        bounds.setFromPoints(points);
        return bounds;
    }

    clone(): Curve2D {
        return new Curve2D().copy(this);
    }

    className(): string {
        return 'Curve2D';
    }
}
