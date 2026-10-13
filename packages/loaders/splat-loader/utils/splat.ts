import type { ISingleSplat } from '../types.js';

export function createSingleSplat(): ISingleSplat {
    return {
        x: 0,
        y: 0,
        z: 0,
        sx: 0,
        sy: 0,
        sz: 0,
        qx: 0,
        qy: 0,
        qz: 0,
        qw: 0,
        r: 0,
        g: 0,
        b: 0,
        a: 0,
    };
}

export const SH_C0 = 0.28209479177387814;

export const SH_MAPS: Record<number, number> = {
    0: 0,
    1: 9,
    2: 24,
    3: 45,
};

export const NUM_F_REST_TO_SH_DEGREE: Record<number, number> = {
    0: 0,
    9: 1,
    24: 2,
    45: 3,
};
