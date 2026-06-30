import { Vector2 } from './Vector2.js';

/**
 * This class provide a {@link onChange| callback method } which is called by {@link Vector2.x| x } or {@link Vector2.y| y } changes.
 * @remarks See {@link Vector2| Vector2 } for more details.
 */
export class WatchedVector2 extends Vector2 {
    protected _x: number;
    protected _y: number;

    constructor(x?: number, y?: number) {
        super();
        this._x = x || 0;
        this._y = y || 0;
    }

    onChange = () => {};

    set(x: number, y: number): WatchedVector2 {
        this._x = x;
        this._y = y;
        if (this.onChange) {
            this.onChange();
        }
        return this;
    }

    /**
     * Change x and y will not call {@link onChange| callback method } by this method.
     */
    setSilently(x: number, y: number) {
        this._x = x;
        this._y = y;
    }
}

Object.defineProperties(WatchedVector2.prototype, {
    x: {
        get() {
            return this._x;
        },
        set(val: number) {
            if (this._x === val) {
                return;
            }
            this._x = val;
            this.onChange?.();
        },
        enumerable: true,
        configurable: true,
    },
    y: {
        get() {
            return this._y;
        },
        set(val: number) {
            if (this._y === val) {
                return;
            }
            this._y = val;
            this.onChange?.();
        },
        enumerable: true,
        configurable: true,
    },
});
