import { Vector2 } from './Vector2';
/**
 * This class provide a {@link onChange| callback method } which is called by {@link Vector2.x| x } or {@link Vector2.y| y } changes.
 * @remarks See {@link Vector2| Vector2 } for more details.
 */
export class WatchedVector2 extends Vector2 {
    private _x: number;
    private _y: number;

    constructor(x?: number, y?: number) {
        super();
        this._x = x || 0;
        this._y = y || 0;
    }
    /**
     * Change x and y will not call {@link onChange| callback method } by this method.
     */
    setSilently(x: number, y: number) {
        this._x = x;
        this._y = y;
    }

    onChange = () => { };

    get x() {
        return this._x;
    }
    set x(val) {
        if (this._x === val) {
            return;
        }
        this._x = val;
        if (this.onChange) {
            this.onChange();
        }
    }

    get y() {
        return this._y;
    }
    set y(val) {
        if (this._y === val) {
            return;
        }
        this._y = val;
        if (this.onChange) {
            this.onChange();
        }
    }
}
