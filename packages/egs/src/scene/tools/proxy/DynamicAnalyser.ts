import { type Drawable, DrawableRenderMode } from '../../drawables/Drawable.js';
import type { DrawableList } from '../DrawcallList.js';

export class DynamicAnalyser<T extends Drawable = Drawable> {
    // after this time duration, the dynamic node is considered to be static
    // dynamicConvertingGroup -> staticWaitingGroup
    static DYNAMIC_CONVERSION_TIME = 3000; // in ms

    // checking conversion time resolution
    // we should not check conversion in every tick because frame will be marked as dirty too frequently.
    static CONVERSION_CHECK_TIME_INTERVAL = 1000; // in ms

    // map drawable to a ticking time;
    private dynamicGroup: Set<T> = new Set();
    private dynamicConvertingGroup: Map<T, number> = new Map();
    private staticFrameGroup: Set<T> = new Set();
    onStaticFrameDirty = () => {};

    get staticFrameSize() {
        return this.staticFrameGroup.size;
    }

    // this is used for saving the cost of performance.now() call
    // we need a outer ticker to update with every frame
    private lastConversionTimeStamp: number = 0;
    private currentTimeStamp: number = 0;
    tick(timeStamp: number) {
        this.currentTimeStamp = timeStamp;
        if (this.currentTimeStamp - this.lastConversionTimeStamp > DynamicAnalyser.CONVERSION_CHECK_TIME_INTERVAL) {
            this.convert();
            this.lastConversionTimeStamp = this.currentTimeStamp;
        }
    }

    private convert() {
        const current = this.currentTimeStamp;
        this.dynamicConvertingGroup.forEach((v, k) => {
            if (k.isAlwaysDynamic) {
                return;
            }
            if (current - v > DynamicAnalyser.DYNAMIC_CONVERSION_TIME) {
                this.dynamicConvertingGroup.delete(k);
                this.staticFrameGroup.add(k);
                this.onStaticFrameDirty();
            }
        });
    }

    generateStaticDrawcallList(staticResult: DrawableList) {
        const ext = extractorCreator(staticResult);
        this.staticFrameGroup.forEach(ext);
    }

    generateDynamicDrawcallList(dynamicResult: DrawableList) {
        const ext = extractorCreator(dynamicResult);
        this.dynamicGroup.forEach(ext);
        this.dynamicConvertingGroup.forEach((_, d) => {
            if (d.netVisibility === false) {
                return;
            }
            dynamicResult.push(d);
        });
    }

    onObjectChange(obj: T): void {
        if (this.staticFrameGroup.has(obj)) {
            this.onStaticFrameDirty();
        }
        this.onObjectDelete(obj);
        this.onObjectAdd(obj);
    }

    onObjectAdd(obj: T) {
        if (obj.isAlwaysDynamic) {
            this.dynamicGroup.add(obj);
        } else {
            this.dynamicConvertingGroup.set(obj, this.currentTimeStamp);
        }
    }

    onObjectDelete(obj: T) {
        if (this.staticFrameGroup.has(obj)) {
            this.onStaticFrameDirty();
        }
        this.dynamicConvertingGroup.delete(obj);
        this.dynamicGroup.delete(obj);
        this.staticFrameGroup.delete(obj);
    }
}

export function extractorCreator(
    cache: DrawableList,
    renderMode: DrawableRenderMode = DrawableRenderMode.Default,
): (o: Drawable) => void {
    return (o: Drawable) => {
        if (o.netVisibility && o.renderMode === renderMode) {
            cache.push(o);
        }
    };
}
