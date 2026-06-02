import { Nullable } from '../utils/Utils';

export interface InterpolantSetting {
    endingStart: number;
    endingEnd: number;
}

export class Interpolant {
    /**
     * Array of positions.
     */
    parameterPositions: any;
    /**
     * Array of samples.
     */
    sampleValues: any;
    /**
     * Number of samples.
     */
    valueSize: number;
    /**
     * Buffer to store the interpolation results.
     */
    resultBuffer: any;
    private _cacheIndex: number;
    private settings: Nullable<InterpolantSetting> = null; // optional, subclass-specific settings structure
    protected DefaultSettings_: InterpolantSetting = {
        endingStart: 0,
        endingEnd: 0,
    }; // Note: The indirection allows central control of many interpolates.
    // --- Protected interface
    private beforeStart_: Function;
    private afterEnd_: Function;

    constructor(parameterPositions: any, sampleValues: any, sampleSize: number, resultBuffer?: any) {
        this.parameterPositions = parameterPositions;
        this._cacheIndex = 0;
        this.resultBuffer = resultBuffer !== undefined ? resultBuffer : new sampleValues.constructor(sampleSize);
        this.sampleValues = sampleValues;
        this.valueSize = sampleSize;
        this.beforeStart_ = this.copySampleValue_;
        this.afterEnd_ = this.copySampleValue_;
    }

    set cacheIndex(index: number) {
        this._cacheIndex = index;
    }

    get cacheIndex() {
        return this._cacheIndex;
    }
    /**
     * Evaluate the interpolant at position `t`.
     */
    evaluate(t: number): any {
        const pp = this.parameterPositions;
        let i1 = this._cacheIndex,
            t1 = pp[i1],
            t0 = pp[i1 - 1];

        validate_interval: {
            seek: {
                let right;
                linear_scan: {
                    // - See http://jsperf.com/comparison-to-undefined/3
                    // - slower code:
                    // - if ( t >= t1 || t1 === undefined ) {
                    forward_scan: if (!(t < t1)) {
                        for (const giveUpAt = i1 + 2; ;) {
                            if (t1 === undefined) {
                                if (t < t0) {
                                    break forward_scan;
                                }
                                // after end
                                i1 = pp.length;
                                this._cacheIndex = i1;
                                return this.afterEnd_(i1 - 1, t, t0);
                            }

                            if (i1 === giveUpAt) {
                                break; // this loop
                            }
                            t0 = t1;
                            t1 = pp[++i1];

                            if (t < t1) {
                                // we have arrived at the sought interval
                                break seek;
                            }
                        }
                        // prepare binary search on the right side of the index
                        right = pp.length;
                        break linear_scan;
                    }
                    // - slower code:
                    // - if ( t < t0 || t0 === undefined ) {
                    if (!(t >= t0)) {
                        // looping?
                        const t1global = pp[1];

                        if (t < t1global) {
                            i1 = 2; // + 1, using the scan for the details
                            t0 = t1global;
                        }

                        // linear reverse scan
                        for (const giveUpAt = i1 - 2; ;) {
                            if (t0 === undefined) {
                                // before start
                                this._cacheIndex = 0;
                                return this.beforeStart_(0, t, t1);
                            }

                            if (i1 === giveUpAt) {
                                break; // this loop
                            }
                            t1 = t0;
                            t0 = pp[--i1 - 1];

                            if (t >= t0) {
                                // we have arrived at the sought interval
                                break seek;
                            }
                        }
                        // prepare binary search on the left side of the index
                        right = i1;
                        i1 = 0;
                        break linear_scan;
                    }

                    // the interval is valid
                    break validate_interval;
                } // linear scan

                // binary search
                while (i1 < right) {
                    const mid: number = (i1 + right) >>> 1;
                    if (t < pp[mid]) {
                        right = mid;
                    } else {
                        i1 = mid + 1;
                    }
                }
                t1 = pp[i1];
                t0 = pp[i1 - 1];

                // check boundary cases, again
                if (t0 === undefined) {
                    this._cacheIndex = 0;
                    return this.beforeStart_(0, t, t1);
                }
                if (t1 === undefined) {
                    i1 = pp.length;
                    this._cacheIndex = i1;
                    return this.afterEnd_(i1 - 1, t0, t);
                }
            } // seek
            this._cacheIndex = i1;
            this.intervalChanged_(i1, t0, t1);
        } // validate_interval
        return this.interpolate_(i1, t0, t, t1);
    }

    protected getSettings_() {
        return this.settings || this.DefaultSettings_;
    }

    protected copySampleValue_(index: number): any {
        const result = this.resultBuffer,
            values = this.sampleValues,
            stride = this.valueSize,
            offset = index * stride;

        for (let i = 0; i !== stride; ++i) {
            result[i] = values[offset + i];
        }
        return result;
    }

    protected interpolate_(..._args: any[] /* i1, t0, t, t1 */) {
        throw new Error('call to abstract method');
        // implementations shall return this.resultBuffer
    }

    protected intervalChanged_(..._args: any[] /* i1, t0, t1 */) {
        // empty
    }
}
