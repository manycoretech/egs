/**
 * Math utility class containing scalar helpers.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export class _Math {
    /**
     * Two Pi.
     */
    static PI_2 = Math.PI * 2;
    /**
     * A coefficient changes degree to radius.
     */
    static DEG2RAD = Math.PI / 180;
    /**
     * A coefficient changes radius to degree.
     */
    static RAD2DEG = 180 / Math.PI;
    /**
     * Return an unique string in whole runtime.
     */
    static generateUUID() {
        // http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript/21963136#21963136
        const lut: string[] = [];
        for (let i = 0; i < 256; i++) {
            lut[i] = (i < 16 ? '0' : '') + (i).toString(16);
        }

        const d0 = Math.random() * 0xffffffff | 0;
        const d1 = Math.random() * 0xffffffff | 0;
        const d2 = Math.random() * 0xffffffff | 0;
        const d3 = Math.random() * 0xffffffff | 0;
        const uuid = lut[d0 & 0xff] + lut[d0 >> 8 & 0xff] + lut[d0 >> 16 & 0xff] + lut[d0 >> 24 & 0xff] + '-' +
            lut[d1 & 0xff] + lut[d1 >> 8 & 0xff] + '-' + lut[d1 >> 16 & 0x0f | 0x40] + lut[d1 >> 24 & 0xff] + '-' +
            lut[d2 & 0x3f | 0x80] + lut[d2 >> 8 & 0xff] + '-' + lut[d2 >> 16 & 0xff] + lut[d2 >> 24 & 0xff] +
            lut[d3 & 0xff] + lut[d3 >> 8 & 0xff] + lut[d3 >> 16 & 0xff] + lut[d3 >> 24 & 0xff];

        // .toUpperCase() here flattens concatenated strings to save heap memory space.
        return uuid.toUpperCase();
    }
    /**
     * Return the mid number of given three.
     */
    static clamp(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, value));
    }
    /**
     * compute {@link https://en.wikipedia.org/wiki/Modulo_operation| euclidean modulo} of m % n.
     */
    static euclideanModulo(n: number, m: number): number {
        return ((n % m) + m) % m;
    }
    /**
     * Linear mapping from range <a1, a2> to range <b1, b2>.
     */
    static mapLinear(x: number, a1: number, a2: number, b1: number, b2: number): number {
        return b1 + (x - a1) * (b2 - b1) / (a2 - a1);
    }
    /**
     * {@link https://en.wikipedia.org/wiki/Linear_interpolation | Linear interpolation}
     */
    static lerp(x: number, y: number, t: number): number {
        return (1 - t) * x + t * y;
    }
    /**
     * {@link http://en.wikipedia.org/wiki/Smoothstep | Smoothstep }
     */
    static smoothstep(x: number, min: number, max: number): number {
        if (x <= min) {
            return 0;
        }
        if (x >= max) {
            return 1;
        }

        x = (x - min) / (max - min);
        return x * x * (3 - 2 * x);
    }
    /**
     * Use the fifth power of x function to get result between min and max.
     */
    static smootherstep(x: number, min: number, max: number): number {
        if (x <= min) {
            return 0;
        }
        if (x >= max) {
            return 1;
        }
        x = (x - min) / (max - min);
        return x * x * x * (x * (x * 6 - 15) + 10);
    }
    /**
     * Random integer from <low, high> interval.
     */
    static randInt(low: number, high: number): number {
        return low + Math.floor(Math.random() * (high - low + 1));
    }
    /**
     * Random float from <low, high> interval.
     */
    static randFloat(low: number, high: number): number {
        return low + Math.random() * (high - low);
    }
    /**
     * Random float from <-range/2, range/2> interval.
     */
    static randFloatSpread(range: number): number {
        return range * (0.5 - Math.random());
    }
    /**
     * Change degree to radius.
     */
    static degToRad(degrees: number): number {
        return degrees * _Math.DEG2RAD;
    }
    /**
     * Change radius to degree.
     */
    static radToDeg(radians: number): number {
        return radians * _Math.RAD2DEG;
    }
    /**
     * Return `true` if value is a power of 2.
     */
    static isPowerOfTwo(value: number): boolean {
        return (value & (value - 1)) === 0 && value !== 0;
    }
    /**
     * Returns the smallest power of 2 that is greater than or equal to value.
     */
    static ceilPowerOfTwo(value: number): number {
        return Math.pow(2, Math.ceil(Math.log(value) / Math.LN2));
    }
    /**
     * Returns the largest power of 2 that is less than or equal to value.
     */
    static floorPowerOfTwo(value: number): number {
        return Math.pow(2, Math.floor(Math.log(value) / Math.LN2));
    }
    /**
     * Returns the smallest or largest power of 2 which is closer to value.
     */
    static nearestPowerOfTwo(value: number): number {
        return 1 << Math.round(Math.log(value) / Math.LN2);
    }
    /**
     * Calculate the value at t of Catmull-Rom spline which through p0, p1, p2 and p3.
     */
    static CatmullRom(t: number, p0: number, p1: number, p2: number, p3: number): number {
        const v0 = (p2 - p0) * 0.5;
        const v1 = (p3 - p1) * 0.5;
        const t2 = t * t;
        const t3 = t * t2;
        return (2 * p1 - 2 * p2 + v0 + v1) * t3 + (- 3 * p1 + 3 * p2 - 2 * v0 - v1) * t2 + v0 * t + p1;
    }
    /**
     * Calculate the value at t of Bezier Curve which is controlled by p0, p1 and p2.
     */
    static QuadraticBezier(t: number, p0: number, p1: number, p2: number): number {
        return (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * p1 + t * t * p2;
    }
    /**
     * Calculate the value at t of Bezier Curve which is controlled by p0, p1, p2 and p3.
     */
    static CubicBezier(t: number, p0: number, p1: number, p2: number, p3: number): number {
        return (1 - t) * (1 - t) * (1 - t) * p0 + 3 * (1 - t) * (1 - t) * t * p1 + 3 * (1 - t) * t * t * p2 + t * t * t * p3;
    }
    /**
     * Compute values of the standard normal distribution, the results will contain (2*kernelRadius + 1) numbers.
     */
    static ComputeGaussianWeights(kernelRadius: number): number[] {
        const size = 2 * kernelRadius + 1;
        const sigma = (size + 1) / 6;
        const twoSigmaSquare = 2.0 * sigma * sigma;
        const sigmaRoot = Math.sqrt(twoSigmaSquare * Math.PI);
        const weights: number[] = [];
        let total = 0.0;
        for (let i = -kernelRadius; i <= kernelRadius; ++i) {
            const distance = i * i;
            const index = i + kernelRadius;
            weights[index] = Math.exp(-distance / twoSigmaSquare) / sigmaRoot;
            total += weights[index];
        }
        for (let i = 0; i < weights.length; i++) {
            weights[i] /= total;
        }
        return weights;
    }
    /**
     * Compute values of the normal distribution with given sigma, the results will contain (kernelRadius + 1) numbers.
     */
    static CreateSampleWeights(kernelRadius: number, stdDev = 2): number[] {
        const weights: number[] = [];
        for (let i = 0; i <= kernelRadius; i++) {
            const v = Math.exp(- (i * i) / (2.0 * (stdDev * stdDev))) / (Math.sqrt(2.0 * Math.PI) * stdDev);
            weights.push(v);
        }
        return weights;
    }
    /**
     * Compute the summary of array's elements whose index between 'from' and 'to'.
     */
    static SumArraySection(array: number[], from: number, to: number): number {
        let sum = 0;
        for (let i = from; i <= to; i++) {
            if (array[i] !== undefined) {
                sum += array[i];
            }
        }
        return sum;
    }
}
