import { Vector3 } from './Vector3';

/**
 * This class provide a {@link onChange| callback method } which is called by {@link Vector3.x| x }, {@link Vector3.y| y } or {@link Vector3.z| z } changes.
 * @remarks See {@link Vector3| Vector3 } for more details.
 */
export class WatchedVector3 extends Vector3 {
    protected _x: number;
    protected _y: number;
    protected _z: number;

    constructor(x?: number, y?: number, z?: number) {
        super();
        this._x = x || 0;
        this._y = y || 0;
        this._z = z || 0;
    }

    onChange = () => {};

    set(x: number, y: number, z: number): WatchedVector3 {
        this._x = x;
        this._y = y;
        this._z = z;
        if (this.onChange) {
            this.onChange();
        }
        return this;
    }

    /**
     * Change x,y,z will not call {@link onChange| callback method } by this method.
     */
    setSilently(x: number, y: number, z: number) {
        this._x = x;
        this._y = y;
        this._z = z;
    }
}

Object.defineProperties(WatchedVector3.prototype, {
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
    z: {
        get() {
            return this._z;
        },
        set(val: number) {
            if (this._z === val) {
                return;
            }
            this._z = val;
            this.onChange?.();
        },
        enumerable: true,
        configurable: true,
    },
});
