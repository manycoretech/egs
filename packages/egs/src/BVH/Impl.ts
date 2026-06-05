export enum BVHStrategyType {
    Scene = 0,
    Mesh = 1,
}

export interface BVHBuilderData {
    boxes: Float32Array;
    strategyType: BVHStrategyType;
    strategySize?: number;
    maxTreeDepth?: number;
    binSize?: number;
}

export interface BVH {
    pick(ox: number, oy: number, oz: number, tx: number, ty: number, tz: number): Uint32Array;
    free(): void;
}

export interface BVHRaw {
    nodes: Float32Array;
    nodeCounts: number;
    indices: Uint32Array;
    indicesCounts: number;
}

class BVHBuilderImpl {
    isInitd: boolean = false;
    private _build?: (source: BVHBuilderData) => Promise<BVH>;
    private _buildRaw?: (source: BVHBuilderData) => Promise<BVHRaw>;

    init(build: (source: BVHBuilderData) => Promise<BVH>, buildRaw: (source: BVHBuilderData) => Promise<BVHRaw>) {
        this._build = build;
        this._buildRaw = buildRaw;
        this.isInitd = true;
    }

    build(source: BVHBuilderData): Promise<BVH> {
        if (!this._build) {
            return Promise.reject('BVH: import @qunhe/egs-bvh-loader to init!');
        }
        return this._build(source);
    }

    buildRaw(source: BVHBuilderData): Promise<BVHRaw> {
        if (!this._buildRaw) {
            return Promise.reject('BVH: import @qunhe/egs-bvh-loader to init!');
        }
        return this._buildRaw(source);
    }
}

export const BVHBuilder = new BVHBuilderImpl();
