import { Interpolant } from './Interpolant';

export class DiscreteInterpolant extends Interpolant {
    protected interpolate(i1: number) {
        this.to(i1 - 1);
    }
}
