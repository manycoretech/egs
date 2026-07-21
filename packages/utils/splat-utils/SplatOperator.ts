import {
    type Splat,
    SplatState,
    WGLCapabilities,
    type __INTERNAL__,
    SourceTexture,
    TextureViewDimension,
    TextureDimension,
    TextureFormat,
} from '@qunhe/egs';
import type { SplatData, ISingleSplat } from '@qunhe/egs-splat-loader';

interface IVector3 {
    set(x: number, y: number, z: number): void;
}

const DEFAULT_SINGLE_SPLAT: ISingleSplat = {
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
export class SplatOperator {
    splat: Splat;
    /**
     * @internal
     */
    data: SplatData;
    private counts: number;
    private centers: Float32Array;

    constructor(splat: Splat, data: SplatData) {
        this.splat = splat;
        this.data = data;
        this.counts = splat.counts;
        this.centers = new Float32Array(this.counts * 3);
        this.data.fillCenters(this.centers);
    }

    getActiveCounts(): number {
        const {
            counts,
            splat: { stateTex },
        } = this;
        if (!stateTex) {
            return counts;
        }
        const stateBuffer = stateTex.getLevelLayerSource(0) as Uint8Array;
        let result = 0;
        for (let i = 0; i < counts; i++) {
            if ((stateBuffer[i] & SplatState.Deleted) !== 0) {
                continue;
            }
            result++;
        }
        return result;
    }

    readSplatCenter<T extends IVector3>(index: number, result: T): T {
        const { centers } = this;
        const i3 = index * 3;
        result.set(centers[i3], centers[i3 + 1], centers[i3 + 2]);
        return result;
    }

    foreachSplatCenter(callback: (i: number, x: number, y: number, z: number) => void) {
        const {
            counts,
            centers,
            splat: { stateTex },
        } = this;
        const stateBuffer = stateTex ? (stateTex.getLevelLayerSource(0) as Uint8Array) : undefined;
        for (let i = 0; i < counts; i++) {
            if (stateBuffer && (stateBuffer[i] & SplatState.Deleted) !== 0) {
                continue;
            }
            callback(i, centers[i * 3], centers[i * 3 + 1], centers[i * 3 + 2]);
        }
    }

    readSplat(index: number, single: ISingleSplat = DEFAULT_SINGLE_SPLAT): ISingleSplat {
        this.data.get(index, single);
        return single;
    }

    foreachSplat(callback: (i: number, single: ISingleSplat) => void, single: ISingleSplat = DEFAULT_SINGLE_SPLAT) {
        const {
            counts,
            splat: { stateTex },
            data,
        } = this;
        const stateBuffer = stateTex ? (stateTex.getLevelLayerSource(0) as Uint8Array) : undefined;
        for (let i = 0; i < counts; i++) {
            if (stateBuffer && (stateBuffer[i] & SplatState.Deleted) !== 0) {
                continue;
            }
            data.get(i, single);
            callback(i, single);
        }
    }

    private initState() {
        const { splat } = this;
        if (splat.stateTex) {
            return;
        }
        const pixels = splat.counts;
        const width = Math.min(2 ** Math.ceil(Math.log2(Math.sqrt(pixels))), WGLCapabilities.MAX_TEXTURE_SIZE);
        const height = Math.ceil(pixels / width);
        splat.stateTex = new SourceTexture(
            TextureDimension.D2,
            TextureViewDimension.D2,
            TextureFormat.R8Uint,
            width,
            height,
            1,
            false,
            false,
        )
            .configAsDataTexture()
            .setLevelData(new Uint8Array(width * height), 0);
    }

    setState(indices: number[], state: SplatState, invert: boolean = false) {
        if (!indices.length) {
            return;
        }
        this.initState();
        const { splat } = this;
        const stateBuffer = splat.stateTex!.getLevelLayerSource(0) as Uint8Array;
        for (let i = 0; i < indices.length; i++) {
            const idx = indices[i];
            const v = stateBuffer[idx];
            stateBuffer[idx] = invert ? v & ~state : v | state;
        }
        splat.stateTex!.setLevelData(new Uint8Array(stateBuffer.buffer, stateBuffer.byteOffset, stateBuffer.length), 0);
        splat.notifySceneChange();
    }

    clearState() {
        const { splat } = this;
        if (!splat.stateTex) {
            return;
        }
        splat.stateTex.freeGPU();
        splat.stateTex = undefined;
        splat.notifySceneChange();
    }
}
