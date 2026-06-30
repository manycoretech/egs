import { Interpolant } from './Interpolant.js';

export enum InterpolationEndingModes {
    ZeroCurvatureEnding = 2400,
    ZeroSlopeEnding = 2401,
    WrapAroundEnding = 2402,
}

interface CubicInterpolantConfig {
    endingStart: InterpolationEndingModes;
    endingEnd: InterpolationEndingModes;
}

export class CubicInterpolant extends Interpolant<number> {
    private weightPrev: number = 0;
    private offsetPrev: number = 0;
    private weightNext: number = 0;
    private offsetNext: number = 0;
    private config: CubicInterpolantConfig = {
        endingStart: InterpolationEndingModes.ZeroCurvatureEnding,
        endingEnd: InterpolationEndingModes.ZeroCurvatureEnding,
    };

    protected intervalChanged(i1: number, t0: number, t1: number) {
        const { positions, stride, config } = this;
        let iPrev = i1 - 2;
        let iNext = i1 + 1;
        let tPrev = positions[iPrev];
        let tNext = positions[iNext];

        if (tPrev === undefined) {
            switch (config.endingStart) {
                case InterpolationEndingModes.ZeroSlopeEnding:
                    // f'(t0) = 0
                    iPrev = i1;
                    tPrev = 2 * t0 - t1;
                    break;
                case InterpolationEndingModes.WrapAroundEnding:
                    // use the other end of the curve
                    iPrev = positions.length - 2;
                    tPrev = t0 + positions[iPrev] - positions[iPrev + 1];
                    break;
                case InterpolationEndingModes.ZeroCurvatureEnding:
                    // f''(t0) = 0 a.k.a. Natural Spline
                    iPrev = i1;
                    tPrev = t1;
            }
        }

        if (tNext === undefined) {
            switch (config.endingEnd) {
                case InterpolationEndingModes.ZeroSlopeEnding:
                    // f'(tN) = 0
                    iNext = i1;
                    tNext = 2 * t1 - t0;
                    break;

                case InterpolationEndingModes.WrapAroundEnding:
                    // use the other end of the curve
                    iNext = 1;
                    tNext = t1 + positions[1] - positions[0];
                    break;

                case InterpolationEndingModes.ZeroCurvatureEnding:
                    // f''(tN) = 0, a.k.a. Natural Spline
                    iNext = i1 - 1;
                    tNext = t0;
            }
        }

        const halfDt = (t1 - t0) * 0.5;
        this.weightPrev = halfDt / (t0 - tPrev);
        this.weightNext = halfDt / (tNext - t1);
        this.offsetPrev = iPrev * stride;
        this.offsetNext = iNext * stride;
    }

    protected interpolate(i1: number, t0: number, t: number, t1: number) {
        const { result, values, stride, offsetPrev: oP, offsetNext: oN, weightPrev: wP, weightNext: wN } = this;

        const o1 = i1 * stride;
        const o0 = o1 - stride;
        const p = (t - t0) / (t1 - t0),
            pp = p * p,
            ppp = pp * p;

        // evaluate polynomials
        const sP = -wP * ppp + 2 * wP * pp - wP * p;
        const s0 = (1 + wP) * ppp + (-1.5 - 2 * wP) * pp + (-0.5 + wP) * p + 1;
        const s1 = (-1 - wN) * ppp + (1.5 + wN) * pp + 0.5 * p;
        const sN = wN * ppp - wN * pp;

        // combine data linearly
        for (let i = 0; i < stride; i++) {
            result[i] = sP * values[oP + i] + s0 * values[o0 + i] + s1 * values[o1 + i] + sN * values[oN + i];
        }
    }
}
