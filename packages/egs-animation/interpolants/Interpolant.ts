export abstract class Interpolant<T = any> {
    protected positions: ArrayLike<number>;
    protected values: ArrayLike<T>;
    protected stride: number;
    protected result: T[];
    private cacheIndex: number = 0;

    constructor(positions: ArrayLike<number>, values: ArrayLike<T>, stride: number, result: T[]) {
        this.positions = positions;
        this.values = values;
        this.stride = stride;
        this.result = result;
    }

    evaluate(t: number) {
        const { positions, cacheIndex } = this;
        let i1 = cacheIndex,
            t1 = positions[i1],
            t0: number | undefined = positions[i1 - 1];

        // retry scan, is very slowly.
        let isLinearScan: boolean = true;
        if (t < t0) {
            i1 = this.cacheIndex = 0;
            t1 = positions[0];
            t0 = undefined;
            isLinearScan = false;
        }

        // fast path
        if (t < t1) {
            if (t0 === undefined) {
                this.to(i1);
                return;
            } else if (t === t0) {
                this.to(i1 - 1);
                return;
            }
            this.interpolate(i1, t0, t, t1);
            return;
        } else if (t === t1) {
            this.to(i1);
            return;
        }

        // research range index
        if (isLinearScan) {
            for (let i = i1 + 1; i < positions.length; i++) {
                i1 = i;
                if (t < positions[i]) {
                    break;
                }
            }
        } else {
            let right = positions.length - 1;
            while (i1 < right) {
                const mid = (i1 + right) >>> 1;
                if (t < positions[mid]) {
                    right = mid;
                } else {
                    i1 = mid + 1;
                }
            }
        }
        this.cacheIndex = i1;
        t1 = positions[i1];
        t0 = positions[i1 - 1];
        if (t0 === undefined || t === t1) {
            this.to(i1);
            return;
        } else if (t === t0) {
            this.to(i1 - 1);
            return;
        }

        this.intervalChanged(i1, t0, t1);
        this.interpolate(i1, t0, t, t1);
    }

    protected to(index: number) {
        const { result, values, stride } = this;
        const offset = index * stride;
        for (let i = 0; i < stride; i++) {
            result[i] = values[offset + i];
        }
    }

    protected intervalChanged(_i1: number, _t0: number, _t1: number) {}
    protected abstract interpolate(i1: number, t0: number, t: number, t1: number): void;
}
