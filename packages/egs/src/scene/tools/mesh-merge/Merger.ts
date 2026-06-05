import type { Drawable } from '../../drawables/Drawable';
import type { Material } from '../../../elements/materials/Material';
import type { BufferGeometry } from '../../../elements/geometries/containers/BufferGeometry';
import { logger } from '../../../utils/Logger';
import type { GeometryBase } from '../../../elements/geometries/containers/GeometryBase';
import type { Nullable } from '../../../utils/Utils';

export interface MergeDrawcallSource<
    T extends Drawable,
    M extends Material,
    G extends BufferGeometry = BufferGeometry,
> {
    drawable: T;
    geometry: G;
    groupIndex: number;
    material: M;
}

export abstract class DrawcallMerger<
    T extends Drawable,
    M extends Material,
    G extends BufferGeometry = BufferGeometry,
> {
    protected inputs: Array<{
        drawable: T;
        materials: M[];
        geometry: G;
    }>;

    protected mergeGroup: Array<Array<MergeDrawcallSource<T, M, G>>> = [];

    protected results: T[] = [];

    extraCheck(_inputs: Drawable[]) {
        return true;
    }
    abstract downcastInputDrawable(input: Drawable): input is T;
    abstract downcastInputMaterial(input: Material): input is M;
    abstract downcastInputGeometry(input: GeometryBase): input is G;

    // do input checking use downcast methods
    // return if failed
    private input(inputs: Drawable[]) {
        if (inputs.length === 0) {
            return true;
        }
        let failed = false;
        this.inputs = inputs.map(i => {
            let inputDrawable: T;
            let inputGeometry: G;
            const inputMaterialArray: M[] = [];
            if (this.downcastInputDrawable(i)) {
                inputDrawable = i;
                const geometry = i.geometry;
                if (this.downcastInputGeometry(geometry)) {
                    inputGeometry = geometry;
                } else {
                    failed = true;
                    logger.unsupported('mesh merger input error');
                }

                i.forEachMaterial(m => {
                    if (this.downcastInputMaterial(m)) {
                        inputMaterialArray.push(m);
                    } else {
                        failed = true;
                        logger.unsupported('mesh merger input error');
                    }
                });

                return {
                    drawable: inputDrawable,
                    materials: inputMaterialArray,
                    geometry: inputGeometry!,
                };
            } else {
                failed = true;
                logger.unsupported('mesh merger input error');
            }
            return undefined as any;
        });
        if (!this.extraCheck(inputs)) {
            failed = true;
        }
        return failed;
    }

    protected splitMergeDecisionByCheckTransparency() {
        const newResult: Array<Array<MergeDrawcallSource<T, M, G>>> = [];
        this.mergeGroup.forEach(g => {
            const newOpaque: Array<MergeDrawcallSource<T, M, G>> = [];
            const newTransparent: Array<MergeDrawcallSource<T, M, G>> = [];
            g.forEach(item => {
                if (item.material.transparent) {
                    newTransparent.push(item);
                } else {
                    newOpaque.push(item);
                }
            });
            if (newOpaque.length > 0) {
                newResult.push(newOpaque);
            }
            if (newTransparent.length > 0) {
                newResult.push(newTransparent);
            }
        });
        this.mergeGroup = newResult;
    }

    private foreachInputDrawcall(v: (s: MergeDrawcallSource<T, M, G>) => void) {
        for (let i = 0; i < this.inputs.length; i++) {
            const { drawable, geometry, materials } = this.inputs[i];
            const groups = geometry.getGroups();
            if (groups.length > 0) {
                for (let j = 0; j < groups.length; j++) {
                    const group = groups[j];
                    const material = materials[group.materialIndex];
                    if (!material) {
                        continue;
                    }
                    v({
                        drawable,
                        geometry,
                        groupIndex: j,
                        material,
                    });
                }
            } else {
                // NOTE: pop geometry should never go here.
                v({
                    drawable,
                    geometry,
                    groupIndex: -1, // NOTE: magic number for ungrouped full range geometry.
                    material: materials[0],
                });
            }
        }
    }

    protected foreachMergeGroup(v: (g: Array<MergeDrawcallSource<T, M, G>>) => boolean) {
        for (let i = 0; i < this.mergeGroup.length; i++) {
            const element = this.mergeGroup[i];
            if (v(element)) {
                return;
            }
        }
    }

    merge(inputs: Drawable[]): Nullable<T[]> {
        this.reset();

        // input and checking merge source
        if (this.input(inputs)) {
            return null;
        }

        // create merge info
        this.foreachInputDrawcall(input => {
            this.decideNextDrawcall(input);
        });

        this.splitMergeDecisionByCheckTransparency();

        // early return for some case
        if (this.earlyReturn(this.mergeGroup) === true) {
            return null;
        }

        // start merge
        this.foreachMergeGroup(g => {
            const result = this.mergeImpl(g);
            if (result !== null) {
                if (Array.isArray(result)) {
                    this.results = this.results.concat(result);
                } else {
                    this.results.push(result);
                }
            }
            return false;
        });
        this.afterMerge();
        const result = this.results.slice();
        this.reset(); // cleanup remained result
        return result;
    }

    // implementor should push drawcall to merge groups in here
    abstract decideNextDrawcall(drawcall: MergeDrawcallSource<T, M, G>): void;

    abstract mergeImpl(group: Array<MergeDrawcallSource<T, M, G>>): Nullable<T> | T[];
    afterMerge() {}
    earlyReturn(_group: Array<Array<MergeDrawcallSource<T, M, G>>>): boolean {
        return false;
    }
    reset() {
        this.inputs = [];
        this.results = [];
        this.mergeGroup = [];
    }
}
