import { Color } from '../math/Color';
import type { Material } from '../elements/materials/Material';
import type { Texture } from '../elements/textures/Texture';
import { Vector2 } from '../math/Vector2';

const INT8 = new Int8Array(4);
const INT32 = new Int32Array(INT8.buffer, 0, 1);
const FLOAT32 = new Float32Array(INT8.buffer, 0, 1);

export function isNumber(v: any): boolean {
    return typeof v === 'number';
}

export function iter(count: number, f: (index: number) => any) {
    for (let i = 0; i < count; i++) {
        f(i);
    }
}

export function singleton<T>(creator: () => T): () => T {
    let instance: T;
    return () => {
        if (instance === undefined) {
            instance = creator();
        }
        return instance;
    };
}

/**
 * General-purpose helper methods.
 */
export class Utils {
    static wait(time: number): Promise<void> {
        return new Promise((resolve, _reject) => {
            setTimeout(resolve, time);
        });
    }

    static arrayMin(array: number[]): number {
        if (array.length === 0) {
            return Infinity;
        }
        let min = array[0];

        for (let i = 1, l = array.length; i < l; ++i) {
            if (array[i] < min) {
                min = array[i];
            }
        }

        return min;
    }

    static arrayMax(array: number[] | TypedArray): number {
        if (array.length === 0) {
            return -Infinity;
        }
        let max = array[0];
        for (let i = 1, l = array.length; i < l; ++i) {
            if (array[i] > max) {
                max = array[i];
            }
        }
        return max;
    }

    static decodeUTF8(data: Uint8Array): string {
        let text = '';
        for (let i = 0; i < data.length; i++) {
            const value = data[i];
            if (value < 0x80) {
                text += String.fromCharCode(value);
            } else if (value > 0xbf && value < 0xe0) {
                text += String.fromCharCode(((value & 0x1f) << 6) | (data[i + 1] & 0x3f));
                i += 1;
            } else if (value > 0xdf && value < 0xf0) {
                text += String.fromCharCode(
                    ((value & 0x0f) << 12) | ((data[i + 1] & 0x3f) << 6) | (data[i + 2] & 0x3f),
                );
                i += 2;
            } else {
                // surrogate pair
                const charCode =
                    (((value & 0x07) << 18) |
                        ((data[i + 1] & 0x3f) << 12) |
                        ((data[i + 2] & 0x3f) << 6) |
                        (data[i + 3] & 0x3f)) -
                    0x010000;
                text += String.fromCharCode((charCode >> 10) | 0xd800, (charCode & 0x03ff) | 0xdc00);
                i += 3;
            }
        }
        return text;
    }

    static intBitsToFloat(i: number): number {
        INT32[0] = i;
        return FLOAT32[0];
    }

    static stringToArrayBuffer(text: string): ArrayBuffer {
        if ((window as any).TextEncoder !== undefined) {
            return new (window as any).TextEncoder().encode(text).buffer;
        }
        const buffer = new ArrayBuffer(text.length);
        const bufferView = new Uint8Array(buffer);
        for (let i = 0; i < text.length; ++i) {
            bufferView[i] = text.charCodeAt(i);
        }
        return buffer;
    }

    static copyProperty(toKey: string, fromKey: string, to: any, from?: any) {
        if (from === undefined) {
            return;
        }

        const toValue = to[toKey];
        const fromValue = from[fromKey];
        if (fromValue === undefined) {
            return;
        }

        if (toValue && toValue.isColor) {
            to[toKey] = new Color(fromValue);
        } else {
            to[toKey] = fromValue;
        }
    }

    static isShaderMayChanged(a: any, b: any) {
        if (a === null && b !== null) {
            return true;
        } else if (a !== null && b === null) {
            return true;
        } else if (typeof a === 'boolean' && typeof b === 'boolean') {
            if (a !== b) {
                return true;
            }
        }
        return false;
    }

    static notifyRecompileByCheckingKey(key: string, material: Material, data: { [index: string]: any }): boolean {
        const source = data[key];
        const dest = (material as any)[key];
        if (source !== undefined) {
            if (Utils.isShaderMayChanged(source, dest)) {
                material.notifyRecompileShader();
                return true;
            }
        }
        return false;
    }

    static notifyRecompileByCheckingKeys(keys: string[], material: Material, data: { [index: string]: any }) {
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            if (Utils.notifyRecompileByCheckingKey(key, material, data)) {
                return;
            }
        }
    }

    static copyPropertiesAndCheckRecompile(keys: string[], checkKeys: string[], to: Material, from?: any) {
        if (from === undefined) {
            return;
        }
        Utils.notifyRecompileByCheckingKeys(checkKeys, to, from);

        keys.forEach(key => Utils.copyProperty(key, key, to, from));
    }

    static copyProperties(keys: string[], to: any, from?: any) {
        if (from === undefined) {
            return;
        }

        keys.forEach(key => Utils.copyProperty(key, key, to, from));
    }

    // converts an array to a specific type
    static convertArray(array: any, type: any, forceClone?: boolean): any {
        // let 'undefined' and 'null' pass
        if (!array || (!forceClone && array.constructor === type)) {
            return array;
        }

        if (typeof type.BYTES_PER_ELEMENT === 'number') {
            return new type(array); // create typed array
        }
        return Array.prototype.slice.call(array); // create Array
    }

    // same as Array.prototype.slice, but also works on typed arrays
    static arraySlice(array: any, from: number, to: number): any {
        if (Utils.isTypedArray(array)) {
            // in ios9 array.subarray(from, undefined) will return empty array
            // but array.subarray(from) or array.subarray(from, len) is correct
            return new array.constructor(array.subarray(from, to !== undefined ? to : array.length));
        }
        return array.slice(from, to);
    }

    static isTypedArray(object: any) {
        return ArrayBuffer.isView(object) && !(object instanceof DataView);
    }

    static visitTexture(tex: Array<Texture | null>, visitor: Function) {
        tex.forEach(item => {
            if (item !== null && item !== undefined) {
                visitor(item);
            }
        });
    }

    static preComputeHalton(count: number) {
        const result: Vector2[] = [];
        for (let i = 0; i < count; i++) {
            result.push(new Vector2(halton(i, 2), halton(i, 3)));
        }
        const sampleCenter = new Vector2(0.5, 0.5);
        result.sort((a, b) => a.distanceToSquared(sampleCenter) - b.distanceToSquared(sampleCenter));
        return result;
    }
}

function halton(index: number, base: number) {
    let result = 0;
    let f = 1 / base;
    let i = index;
    while (i > 0) {
        result = result + f * (i % base);
        i = Math.floor(i / base);
        f = f / base;
    }
    return result;
}
export interface Size {
    width: number;
    height: number;
    depth?: number;
}

export interface IRange {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface Uniforms {
    [key: string]: { value: any };
}

export interface Shader {
    defines?: any;
    uniforms: Uniforms;
    vertexShader: string;
    fragmentShader: string;
}

export type Nullable<T> = T | null;

export type PickSubTypeProperty<T, U> = { [P in keyof T]: T[P] extends U ? P : never }[keyof T];

/**
 * Union of typed-array.
 */
export type TypedArray =
    | Float32Array
    | Float64Array
    | Int8Array
    | Uint8Array
    | Uint8ClampedArray
    | Int16Array
    | Uint16Array
    | Int32Array
    | Uint32Array;

export type PickReadonly<T extends ReadOnlyMarkedCreatable<T>, K extends keyof T> = Readonly<
    Pick<ReadonlyMarked<T>, K | '_readonly_mark' | 'cloneReadonly' | 'clone'>
>;
export type ReadonlyMarked<T> = { _readonly_mark: unknown } & T;

export interface ReadOnlyMarkedCreatable<T> {
    clone(): T;
    cloneReadonly(): any;
}

export const DEFAULT_RAF_FUNCTION = {
    requestAnimationFrame: globalThis.requestAnimationFrame.bind(globalThis),
    cancelAnimationFrame: globalThis.cancelAnimationFrame.bind(globalThis),
};
