import { Interpolant } from './Interpolant.js';

export class DiscreteInterpolant extends Interpolant {
    protected interpolate(i1: number) {
        this.to(i1 - 1);
    }
}
