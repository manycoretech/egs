import type { HashKeyBuilder } from '../../utils/HashKeyBuilder';
import type { RenderGraph } from '../../rendergraph/RenderGraph';
import { Capabilities } from '../../renderer/Capabilities';
import type { SceneAdaptorDispatcher, SceneAdaptor } from '../SceneAdaptor';
import type { RendererAdaptor } from '../RendererAdaptor';
import type { RenderTargetNode } from '../../rendergraph/nodes/RenderTargetNode';

export interface ConfigCell<T> {
    get: () => T;
    set: (value: T) => void;
}

interface ConfigCellObject { [key: string]: ConfigCell<any> | ConfigCellObject }

export interface IEffectConfig {
    isPerformanceSlow: boolean;
    planarShadowEnabled: boolean;
    planarShadowReady: boolean;
    taaEnabled: boolean;
    taaStable: boolean;
}

export interface DrivenCullingConfig {
    frustumCullingEnabled: boolean,
    occlusionCullingEnabled: boolean,
    detailCullingEnabled: boolean,
    layersCullingEnabled: boolean,
    triCullingEnabled: boolean,
    occlusionCullingBias: number,
}
/**
 * Texture compression supported by render time compression
 */
export enum TextureCompression {
    None = 0,
    BC3,
    BC3HighQuality,
    BC7,
}
export interface GpuDrivenConfig {
    enabled: boolean,
    requested: boolean, // flag to indicate if the user requested to enable it
    textureCompression: TextureCompression,
}

/**
 * some global rendering config.
 */
export interface RenderingConfig {
    tlsFlags: number,
    gpuDriven: GpuDrivenConfig,
    MSAA: boolean
}

export interface PipelineContext {
    renderingConfig: RenderingConfig,
    drivenCullingConfig: DrivenCullingConfig
}

export abstract class PipelinePlugin {
    protected readonly scene: SceneAdaptorDispatcher;
    protected readonly renderer: RendererAdaptor;
    protected readonly IS_SUPPORT_DEPTH_TEXTURE: boolean;

    protected get IS_WEBGL2() {
        return Capabilities.IS_WEBGL2;
    }

    protected get IS_WEBGPU() {
        return Capabilities.IS_WEBGPU;
    }

    protected get IS_ADVANCED_BACKEND() {
        return Capabilities.IS_ADVANCED_BACKEND;
    }

    // stable
    abstract readonly PLUGIN_NAME: string;

    get envSupported() {
        return true;
    }

    protected _enabled: boolean = false;
    get enabled(): boolean {
        return this._enabled;
    }
    set enabled(v: boolean) {
        this._enabled = v;
    }

    get shouldRender() {
        return false;
    }

    constructor(scene: SceneAdaptorDispatcher, renderer: RendererAdaptor) {
        this.scene = scene;
        this.renderer = renderer;
        this.IS_SUPPORT_DEPTH_TEXTURE = Capabilities.IS_SUPPORT_DEPTH_TEXTURE;
    }

    abstract destroy(): void;

    abstract updateFrameSize(width: number, height: number): void;
    abstract updateEffect(scene: SceneAdaptor, isFrameStable: boolean, isCameraStable: boolean, effectConfig: IEffectConfig): void;

    abstract updateGraphHash(hasher: HashKeyBuilder): void;
    abstract updateRenderGraph(graph: RenderGraph, context: PipelineContext, depthPyramid: RenderTargetNode): void;

    abstract createConfig(): ConfigCellObject;
}
