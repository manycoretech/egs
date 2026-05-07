import { Splat } from './Splat';

export class SplatManager {
    private _splats = new Set<Splat>();
    private _sceneVersion: number = 0;
    private _splatCounts: number = 0;

    get splats(): Splat[] {
        return Array.from(this._splats);
    }

    get sceneVersion() {
        return this._sceneVersion;
    }

    get splatCounts() {
        return this._splatCounts;
    }

    has(splat: Splat) {
        return this._splats.has(splat);
    }

    add(splat: Splat) {
        this._sceneVersion++;
        this._splats.add(splat);
        this._splatCounts += splat.counts;
    }

    remove(splat: Splat) {
        this._sceneVersion++;
        this._splats.delete(splat);
        this._splatCounts -= splat.counts;
    }
}
