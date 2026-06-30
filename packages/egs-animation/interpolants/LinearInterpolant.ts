import { Interpolant } from './Interpolant.js';

export class LinearInterpolant extends Interpolant<number> {
    protected interpolate(i1: number, t0: number, t: number, t1: number) {
        const { values, result, stride } = this;
        const offset1 = i1 * stride;
        const offset0 = offset1 - stride;
        const weight1 = (t - t0) / (t1 - t0);
        const weight0 = 1 - weight1;
        for (let i = 0; i < stride; i++) {
            result[i] = values[offset0 + i] * weight0 + values[offset1 + i] * weight1;
        }
    }
}
