import { Vector3 } from './Vector3';
/**
 * This class provide a {@link onChange| callback method } which is called by {@link Vector3.x| x }, {@link Vector3.y| y } or {@link Vector3.z| z } changes.
 * @remarks See {@link Vector3| Vector3 } for more details.
 */
export class WatchedVector3 extends Vector3 {
    private _x: number;
    private _y: number;
    private _z: number;

    constructor(x?: number, y?: number, z?: number) {
        super();
        this._x = x || 0;
        this._y = y || 0;
        this._z = z || 0;
    }

    public onChange = () => { };

    set(x: number, y: number, z: number): Vector3 {
        this._x = x;
        this._y = y;
        this._z = z;
        if (this.onChange) {
            this.onChange();
        }
        return this;
    }

    get x() {
        return this._x;
    }
    set x(val) {
        this._x = val;
        if (this.onChange) {
            this.onChange();
        }
    }

    get y() {
        return this._y;
    }
    set y(val) {
        this._y = val;
        if (this.onChange) {
            this.onChange();
        }
    }

    get z() {
        return this._z;
    }
    set z(val) {
        this._z = val;
        if (this.onChange) {
            this.onChange();
        }
    }

}
