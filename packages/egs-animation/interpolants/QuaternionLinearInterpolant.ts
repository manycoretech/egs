import { Quaternion } from '@qunhe/egs';
import { Interpolant } from './Interpolant';

export class QuaternionLinearInterpolant extends Interpolant<number> {
    protected interpolate(i1: number, t0: number, t: number, t1: number) {
        const { values, result, stride } = this;
        const weight1 = (t - t0) / (t1 - t0);
        const offset1 = i1 * stride;
        const offset0 = offset1 - stride;
        Quaternion.slerpFlat(result, 0, values as number[], offset0, values as number[], offset1, weight1);
    }
}
