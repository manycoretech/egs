export interface Vector {
    setComponent(index: number, value: number): void;

    getComponent(index: number): number;

    // copy(v:T):T;
    copy(v: this): Vector;

    // add(v:T):T;
    add(v: Vector): Vector;

    // addVectors(a:T, b:T):T;
    addVectors(a: Vector, b: Vector): Vector;

    // sub(v:T):T;
    sub(v: Vector): Vector;

    // subVectors(a:T, b:T):T;
    subVectors(a: Vector, b: Vector): Vector;

    // multiplyScalar(s:number):T;
    multiplyScalar(s: number): Vector;

    // divideScalar(s:number):T;
    divideScalar(s: number): Vector;

    // negate():T;
    negate(): Vector;

    // dot(v:T):T;
    dot(v: Vector): number;

    // lengthSq():number;
    lengthSq(): number;

    // length():number;
    length(): number;

    // normalize():T;
    normalize(): Vector;

    // distanceTo(v:T):number; NOTE: Vector4 doesn't have the property.
    distanceTo?(v: Vector): number;

    // distanceToSquared(v:T):number; NOTE: Vector4 doesn't have the property.
    distanceToSquared?(v: Vector): number;

    // setLength(l:number):T;
    setLength(l: number): Vector;

    // lerp(v:T, alpha:number):T;
    lerp(v: Vector, alpha: number): Vector;

    // equals(v:T):boolean;
    equals(v: Vector): boolean;

    // clone():T;
    clone(): Vector;

    toArray(arr?: number[]): number[];
}
