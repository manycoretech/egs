import type { BufferGeometryBase, BufferRange } from '../elements/geometries/containers/BufferGeometry.js';
import type { Material } from '../elements/materials/Material.js';
import type { Color } from '../math/Color.js';
import type { Camera3D } from '../scene/cameras/Camera3D.js';
import type { Drawable } from '../scene/drawables/Drawable.js';
import type { Renderable } from '../scene/renderables/IRenderable.js';
import { type EventDispatcher, EventType } from '../utils/EventDispatcher.js';
import type { Nullable, TypedArray, IRange } from '../utils/Utils.js';
import type { RenderStatistics } from '../Viewer.js';
import type { MaterialDispatcher } from './MaterialDispatcher.js';
import type { RenderInfo } from '../utils/RenderInfo.js';
import type { RenderTarget } from '../elements/textures/RenderTarget.js';
import type { ResourceStatistics } from './ResourceManager/ResourceManager.js';
import { WebGLExtEnums, type WGLExtensions } from './webgl/WGLExtensions.js';
import { Platform } from '../utils/Platform.js';
import type { Texture } from '../elements/textures/Texture.js';
import type { ShaderComponentRegistry } from '../scene/ShaderComponentRegistry.js';

export type RendererParameters = Required<
    Pick<
        WebGLContextAttributes,
        'alpha' | 'antialias' | 'depth' | 'powerPreference' | 'premultipliedAlpha' | 'preserveDrawingBuffer' | 'stencil'
    >
> & {
    version: string;
    name: string;
    canvas: HTMLCanvasElement; // A Canvas where the renderer draws its output.
    container: HTMLElement;
    context?: WebGLRenderingContext | WebGL2RenderingContext;
    preferWebGL1?: boolean;

    precision?: string;
    logarithmicDepthBuffer?: boolean;
};

export type CtxLostInfo = ResourceStatistics & {
    manual: boolean;
};
/**
 * Event emitted when the rendering context is lost.
 */
export const ContextLostEvent = new EventType<CtxLostInfo>();
export const ContextRestoreEvent = new EventType();
/**
 * Event emitted when context restoration fails after a loss.
 */
export const ContextLostRestoreFailedEvent = new EventType();
export const MemoryGrowFailed = new EventType();

/**
 * Renderer memory usage reported by the engine backend.
 */
export interface MemoryInfo {
    wasm_total_size: number;

    all_real: number;
    attributes_manager_real: number;
    geometries_manager_real: number;
    materials_manager_real: number;
    scene_nodes_manager_real: number;
    scenes_real: number;
    textures_manager_real: number;
    ubo_real: number;

    all_allocated: number;
    attributes_manager_allocated: number;
    geometries_manager_allocated: number;
    materials_manager_allocated: number;
    scene_nodes_manager_allocated: number;
    scenes_allocated: number;
    textures_manager_allocated: number;
    ubo_allocated: number;
}

/**
 * Renderer backends.
 */
export enum RendererBackend {
    WEBGL_JS = 'WEBGL_JS',
    // @deprecated webgl1 on wasm has been disabled. will not use this enum value anymore.
    WEBGL_WASM = 'WEBGL_WASM',
    WEBGL2_JS = 'WEBGL2_JS',
    WEBGL2_WASM = 'WEBGL2_WASM',
    WEBGPU_WASM = 'WEBGPU_WASM',
}

export enum RendererState {
    Initializing,
    Ready,
    ContextLost,
    Destroyed,
}

export interface RendererStatus {
    state: RendererState;
    initialized: Promise<void>;
}

export class RenderCtxInfo {
    vendor = 'unknown';
    renderer = 'unknown';

    constructor(gl?: WebGLRenderingContext | WebGL2RenderingContext, extensions?: WGLExtensions) {
        if (gl && extensions) {
            this.setWebGL(gl, extensions);
        }
    }

    output() {
        return `ua: ${Platform.getInstance().ua} \nvender: ${this.vendor} \nrenderer: ${this.renderer}`;
    }

    /**
     * @internal
     */
    setWebGPU(info?: any) {
        this.vendor = info?.vendor ?? 'unknown';
        this.renderer = `${info?.architecture ?? 'unknown'}, ${info?.device ?? 'unknown'}`;
    }

    /**
     * @internal
     */
    setWebGL(gl: WebGLRenderingContext | WebGL2RenderingContext, extensions: WGLExtensions) {
        const debugInfo = extensions.get(WebGLExtEnums.WEBGL_debug_renderer_info);
        if (debugInfo) {
            this.vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
            this.renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        } else {
            // for firefox, firefox will remove WEBGL_debug_renderer_info in future.
            this.vendor = gl.getParameter(gl.VENDOR);
            this.renderer = gl.getParameter(gl.RENDERER);
        }
    }
}

// WebGPU limits compatible for renderer
export interface Limits {
    maxTextureDimension1D: number;
    maxTextureDimension2D: number;
    maxTextureDimension3D: number;
    maxTextureArrayLayers: number;
    maxSampledTexturesPerShaderStage: number;
    maxInterStageShaderVariables: number;
    maxColorAttachments: number;
    maxVertexBuffers: number;
    maxVertexAttributes: number;
    minUniformBufferOffsetAlignment: number;
}

export function defaultLimits(): Limits {
    return {
        maxTextureDimension1D: 8192,
        maxTextureDimension2D: 8192,
        maxTextureDimension3D: 2048,
        maxTextureArrayLayers: 256,
        maxSampledTexturesPerShaderStage: 16,
        maxInterStageShaderVariables: 16,
        maxColorAttachments: 8,
        maxVertexBuffers: 8,
        maxVertexAttributes: 16,
        minUniformBufferOffsetAlignment: 256,
    };
}

export interface IRenderer extends EventDispatcher {
    readonly renderInfo: RenderInfo;
    /**
     * @internal
     */
    readonly backend: RendererBackend;
    /**
     * @internal
     */
    readonly rendererStatus: Readonly<RendererStatus>;

    /**
     * @internal
     */
    readonly parameters: RendererParameters;

    /**
     * @internal
     */
    readonly limits: Limits;

    overrideDispatcher: Nullable<MaterialDispatcher>;

    getGPUInfo(): string;

    beforeFrameRender(requestFrameId: number, lastRenderedFrameId: number): void;
    afterFrameRender(renderedFrameId: number): void;

    updateRenderStatistics(r: RenderStatistics): void;

    getPixelRatio(): number;

    setPixelRatio(value: number): void;
    // Resizes the output canvas to (width, height), and also sets the viewport to fit that size, starting in (0, 0).
    setSize(width: number, height: number, updateStyle?: boolean): void;

    getSize(): { width: number; height: number };

    getDrawingBufferSize(): { width: number; height: number };

    // Sets the viewport to render from (x, y) to (x + width, y + height).
    setViewport(x: number, y: number, width: number, height: number): void;

    setViewportInRenderPass(x: number, y: number, width: number, height: number): void;

    // Sets the clear color, using color for the color and alpha for the opacity.
    setClearColor(color: Color | string | number, alpha?: number): void;

    /**
     * Tells the renderer to clear its color, depth or stencil drawing buffer(s).
     * @param color @default true
     * @param depth @default true
     * @param stencil @default true
     */
    clear(color?: boolean, depth?: boolean, stencil?: boolean): void;

    getCanvas(): HTMLCanvasElement;

    destroy(forceLost?: boolean): void;

    tick(timestamp: number): void;

    getCurrentCamera(): Camera3D;

    useCamera(camera: Nullable<Camera3D>): void;
    useRegistry(registry: ShaderComponentRegistry): void;

    // core render method
    renderDrawcall(
        geometry: BufferGeometryBase,
        material: Material,
        object: Drawable,
        range: Nullable<BufferRange>,
    ): void;

    renderRenderable(renderable: Renderable): void;

    resetRenderState(): void;

    setMaterialUploadDirty(): void;

    beginPass(
        store: boolean,
        resolveContent: boolean,
        resolveDepth: boolean,
        generateMipmap: boolean,
        material?: Material,
    ): void;
    endPass(): void;
    flushCommands(): void;

    setRenderTarget(target?: RenderTarget, resolveTarget?: RenderTarget): void;

    // Enable the scissor test. When this is enabled, only the pixels within the defined scissor area will be affected by further renderer actions.
    setScissorTest(enable: boolean): void;

    // Sets the scissor area from (x, y) to (x + width, y + height).
    setScissor(x: number, y: number, width: number, height: number): void;

    /**
     * @deprecated use readPixelsAsync instead.
     */
    readPixels(target: RenderTarget, range: IRange, result: TypedArray): void;
    readPixelsAsync(target: RenderTarget, range: IRange, result: TypedArray): Promise<void>;
    forceContextLost(manual?: boolean): void;

    getMemoryInfo(whenGrowFailed?: boolean): Readonly<MemoryInfo>;

    releaseUnusedResources(delta: number): void;

    /**
     * queue a task to upload texture to gpu.
     */
    queueFlushTexture(texture: Texture): void;
}
