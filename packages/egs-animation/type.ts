export type TypedArray = Float32Array | Float64Array | Int8Array | Uint8Array | Uint8ClampedArray | Int16Array | Uint16Array | Int32Array | Uint32Array;

export enum Loop {
    Once = 2200,
    Repeat = 2201,
    PingPong = 2202,
}

export enum InterpolationMode {
    Discrete = 2300,
    Linear = 2301,
    Smooth = 2302,
}

export interface KeyframeTrack {
    path: string;
    times: TypedArray;
    values: TypedArray;
    interpolation: InterpolationMode;
}

export enum Blend {
    Normal = 2500,
    Additive = 2501,
}

export interface AnimationClip {
    name: string;
    blend?: Blend;
    tracks: KeyframeTrack[];
}
