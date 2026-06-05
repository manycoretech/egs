import { SplatData } from './SplatData';
import { type ISplatData, type ISingleSplat, ISamplerFormat } from './utils';

export type SogMetadata = {
    counts: number;
    shDegree: number;
    means: { mins: [number, number, number]; maxs: [number, number, number] };
} & (
    | {
          version: 1;
          scales: { mins: [number, number, number]; maxs: [number, number, number] };
          sh0: { mins: [number, number, number, number]; maxs: [number, number, number, number] };
          shN?: { mins: number; maxs: number };
      }
    | {
          version: 2;
          scales: { codebook: number[] };
          sh0: { codebook: number[] };
          shN?: { codebook: number[] };
      }
);

export class SogSplatData extends SplatData {
    counts: number = 0;
    shDegree: number = 0;

    private meta: SogMetadata;
    private meansL: Uint8Array;
    private meansU: Uint8Array;
    private quats: Uint8Array;
    private scales: Uint8Array;
    private colors: Uint8Array;
    private shNLabels?: Uint8Array;
    private shNCentroids?: Uint8Array;

    init(_counts: number, _shDegree: number) {
        throw new Error('Method not implemented.');
    }

    load(
        meta: SogMetadata,
        meansL: Uint8Array,
        meansU: Uint8Array,
        quats: Uint8Array,
        scales: Uint8Array,
        colors: Uint8Array,
        shNLabels?: Uint8Array,
        shNCentroids?: Uint8Array,
    ) {
        this.meta = meta;
        this.meansL = meansL;
        this.meansU = meansU;
        this.quats = quats;
        this.scales = scales;
        this.colors = colors;
        this.shNLabels = shNLabels;
        this.shNCentroids = shNCentroids;
    }

    set(_i: number, _single: ISingleSplat) {
        throw new Error('Method not implemented.');
    }

    setCenter(_i: number, _x: number, _y: number, _z: number) {
        throw new Error('Method not implemented.');
    }

    setScale(_i: number, _sx: number, _sy: number, _sz: number) {
        throw new Error('Method not implemented.');
    }

    setQuat(_i: number, _qx: number, _qy: number, _qz: number, _qw: number) {
        throw new Error('Method not implemented.');
    }

    setColor(_i: number, _r: number, _g: number, _b: number) {
        throw new Error('Method not implemented.');
    }

    setAlpha(_i: number, _a: number) {
        throw new Error('Method not implemented.');
    }

    setShN(_i: number, _shN: number[]) {
        throw new Error('Method not implemented.');
    }

    get(_i: number, _single: ISingleSplat) {
        throw new Error('Method not implemented.');
    }

    getCenter(_i: number, _single: ISingleSplat) {
        throw new Error('Method not implemented.');
    }

    getScale(_i: number, _single: ISingleSplat) {
        throw new Error('Method not implemented.');
    }

    getQuat(_i: number, _single: ISingleSplat) {
        throw new Error('Method not implemented.');
    }

    getColor(_i: number, _single: ISingleSplat) {
        throw new Error('Method not implemented.');
    }

    getAlpha(_i: number, _single: ISingleSplat) {
        throw new Error('Method not implemented.');
    }

    getShN(_i: number, _shN: number[]) {
        throw new Error('Method not implemented.');
    }

    fillCenters(_centers: Float32Array) {
        throw new Error('Method not implemented.');
    }

    serialize(): ISplatData {
        return {
            counts: this.meta.counts,
            shDegree: this.meta.shDegree,
            samplers: [
                this.meansL,
                this.meansU,
                this.quats,
                this.scales,
                this.colors,
                this.shNLabels,
                this.shNCentroids,
            ]
                .filter(v => !!v)
                .map(v => ({
                    width: 1,
                    height: 1,
                    depth: 1,
                    format: ISamplerFormat.RGBA_UINT,
                    source: v!,
                })),
            extras: [this.meta],
        };
    }

    deserialize(data: ISplatData) {
        const { samplers, extras = [] } = data;
        this.meta = extras[0];
        this.meansL = samplers[0].source;
        this.meansU = samplers[1].source;
        this.quats = samplers[2].source;
        this.scales = samplers[3].source;
        this.colors = samplers[4].source;
        if (samplers[5]) {
            this.shNLabels = samplers[5].source;
        }
        if (samplers[6]) {
            this.shNCentroids = samplers[6].source;
        }
    }
}
