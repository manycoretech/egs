import { logger } from './Logger';

export interface ElementsWithGPUResource {
    freeGPU(): void;
}

let guid = 0;
export class BaseElement {
    /**
     * @internal
     */
    $weak: any = undefined;
    /**
     * @internal
     */
    __DO_NOT_USE_THIS_URC: any = undefined;

    private isFreed = false;
    private __guid = guid++;
    private _businessTag: string = 'empty';
    /**
     * @internal
     */
    metaData: Record<string, any> = {};
    readonly userData: Record<keyof any, any> = {};
    markBusinessTag(v: string) {
        this.businessTag = v;
        return this;
    }
    set businessTag(v) {
        this._businessTag = v;
    }
    get businessTag() {
        return this._businessTag;
    }

    constructor() {}

    isDestroyed() {
        return this.isFreed;
    }

    destroy() {
        if ((this as any).freeGPU) {
            (this as any).freeGPU();
        }
        this.isFreed = true;
    }

    validate() {
        if (this.isFreed) {
            logger.warn(
                `Element has been freed but still in use, ObjectID: ${this.__guid}, tag: ${this._businessTag}, ClassName: ${this.constructor.name}`,
            );
        }
    }

    destroyAllResourcesOwned() {
        this.destroy();
    }

    freeAllGpuResourceOwned() {
        (this as any).freeGPU?.();
    }
}
