import { FPSTimer } from './FPSTimer';
import { ValueCounter } from './ValueCounter';
import type { Object3D } from '../scene/Object3D';

export class RenderInfo {
    objectInfo: ObjectStatsInfo = new ObjectStatsInfo(); // render info for last frame
    refreshProgramCount: number = 0; // shader program switch time (Renderer.refreshProgram)
    refreshMaterialCount: number = 0;
    refreshLightsCount: number = 0;

    resetFrameStart(): void {
        this.objectInfo.reset();
        this.refreshMaterialCount = 0;
        this.refreshProgramCount = 0;
        this.refreshLightsCount = 0;
    }
}

export class FrameInfo {
    fpsCollector: FPSTimer;
    timeStart: number = 0; // current frame starts time
    timeEnd: number = 0; // current frame ends time
    lastFrameTimeStart: number = 0; // last frame starts time
    lastFrameRenderCPUTime: number = 0; // CPU time for last frame(raf)
    frameCPUCounter = new ValueCounter();

    constructor() {
        this.fpsCollector = new FPSTimer();
        this.fpsCollector.start();
    }

    get averageRenderFrameTime(): number {
        return this.fpsCollector.getAverageFrameTime();
    }

    getActiveCPUHistoryData(): string {
        return this.frameCPUCounter.toJSON();
    }

    get lastFrameTime(): number {
        return this.fpsCollector.lastFrameTime;
    }

    // reset the render info by needs
    resetRenderFrameTimeStat(): void {
        this.fpsCollector.reset();
    }

    setupAnimationFunction(
        requestAnimationFrame: typeof globalThis.requestAnimationFrame,
        cancelAnimationFrame: typeof globalThis.cancelAnimationFrame,
    ) {
        this.fpsCollector.setupAnimationFunction(requestAnimationFrame, cancelAnimationFrame);
    }

    resetDefaultAnimationFunction() {
        this.fpsCollector.resetDefaultAnimationFunction();
    }

    // call before all the rendering starts for every frame
    beginFrameTick(): void {
        this.lastFrameTimeStart = this.timeStart;
        this.timeStart = performance.now();
    }

    // call after all the rendering starts for every frame
    endFrameTick(): void {
        this.timeEnd = performance.now();
        this.lastFrameRenderCPUTime = this.timeEnd - this.timeStart;
        this.frameCPUCounter.set(this.lastFrameRenderCPUTime);
        this.fpsCollector.pick();
    }

    destroy(): void {
        this.fpsCollector.destroy();
    }
}

function increaseMapCount(map: Map<string, number>, key: string) {
    const previous = map.get(key);
    if (previous === undefined) {
        map.set(key, 1);
    } else {
        map.set(key, previous + 1);
    }
}

// render objects info
export class ObjectStatsInfo {
    geometries: number = 0; // geometries number
    textures: number = 0; // textures number
    calls: number = 0; // drawcall number
    vertices: number = 0; // vertex number
    faces: number = 0; // face number
    programs: number = 0;
    callsByObjectCategoryId: Map<string, number> = new Map();
    callsBySourceType: Map<string, number> = new Map();
    enableDrawcallClassify = false;

    addDrawcall(object: Object3D): void {
        if (this.enableDrawcallClassify) {
            increaseMapCount(this.callsByObjectCategoryId, object.categoryId);
            increaseMapCount(this.callsBySourceType, object.sourceType);
        }
        this.calls++;
    }

    reset(): void {
        this.calls = 0;
        this.callsByObjectCategoryId.clear();
        this.callsBySourceType.clear();
        this.vertices = 0;
        this.faces = 0;
    }
}
