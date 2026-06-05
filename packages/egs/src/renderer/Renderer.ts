import { WGLExtensions, WebGLExtEnums } from './webgl/WGLExtensions';
import { RenderInfo } from '../utils/RenderInfo';
import { WGLState } from './webgl/WGLState/WGLState';
import { WGLBufferRenderer } from './webgl/WGLBufferRenderer';
import { Vector4 } from '../math/Vector4';
import { WGLIndexedBufferRenderer } from './webgl/WGLIndexedBufferRenderer';
import type { Camera3D } from '../scene/cameras/Camera3D';
import { Color } from '../math/Color';
import { setupWebGLCapabilities, WGLCapabilities } from './webgl/WGLCapabilities';
import { FatLineSegments } from '../scene/drawables/FatLineSegments';
import type { BufferGeometryBase, BufferRange } from '../elements/geometries/containers/BufferGeometry';
import type { Nullable, TypedArray, IRange } from '../utils/Utils';
import type { WGLBufferData } from './webgl/WGLBuffer';
import { TypeAssert } from '../scene/tools/TypeAssert';
import type { Drawable } from '../scene/drawables/Drawable';
import type { WGLProgram } from './webgl/WGLProgram';
import type { Material } from '../elements/materials/Material';
import { RenderState } from './RenderState/RenderState';
import { type ResourceStatistics, ResourceManager } from './ResourceManager/ResourceManager';
import type { Renderable } from '../scene/renderables/IRenderable';
import { InstancePool } from '../scene/tools/proxy/InstancePool';
import { WebGLPixelFormat } from './webgl/WGLConstants';
import { logger } from '../utils/Logger';
import { EventDispatcher } from '../utils/EventDispatcher';
import {
    type IRenderer,
    type MemoryInfo,
    RendererBackend,
    RendererState,
    type RendererParameters,
    ContextLostEvent,
    RenderCtxInfo,
} from './IRenderer';
import type { RenderStatistics } from '../Viewer';
import { DefaultMaterialDispatcher, type MaterialDispatcher } from './MaterialDispatcher';
import type { RenderTarget } from '../elements/textures/RenderTarget';
import { getBufferSubDataAsync } from '../utils/AsyncRead';
import type { WGLRenderAttachment } from './ResourceManager/TextureManager';
import type { Texture } from '../elements/textures/Texture';
import type { ShaderComponentRegistry } from '../scene/ShaderComponentRegistry';

const MAX_COLOR_ATTACHMENTS = 8;

interface RenderPass {
    active: boolean;
    target?: RenderTarget;
    resolveTarget?: RenderTarget;
    viewport: Vector4;
    scissorTest: boolean;
    scissor: Vector4;
    store: boolean;
    resolveContent: boolean;
    resolveDepth: boolean;
    generateMipmap: boolean;
    drawBuffers: number[];
    clearColor: Color;
    clearAlpha: number;
    clearFlags: {
        color: boolean;
        depth: boolean;
        stencil: boolean;
    };
}

const DEFAULT_DRAW_BUFFERS = [36064]; // WebGLRenderingContext.COLOR_ATTACHMENT0

export class Renderer extends EventDispatcher implements IRenderer {
    /**
     * @internal
     */
    readonly backend: RendererBackend = RendererBackend.WEBGL2_JS;
    /**
     * @internal
     */
    readonly rendererStatus = {
        state: RendererState.Ready,
        initialized: Promise.resolve(),
    };

    parameters: RendererParameters;

    domElement: HTMLCanvasElement; // A Canvas where the renderer draws its output.
    // This is automatically created by the renderer in the constructor (if not provided already);
    // you just need to add it to your page.
    gl: WebGLRenderingContext | WebGL2RenderingContext; // The HTML5 Canvas's 'webgl' context obtained from the canvas where the renderer will draw.

    readonly renderInfo = new RenderInfo();
    wglState: WGLState;
    renderState: RenderState;
    resourceManager: ResourceManager;
    extensions: WGLExtensions;
    currentWGLProgram: Nullable<WGLProgram> = null;

    private bufferRenderer: WGLBufferRenderer;
    private indexedBufferRenderer: WGLIndexedBufferRenderer;
    private _currentScissor: Vector4 = new Vector4();
    private _scissor: Vector4;
    private _pixelRatio: number = 1;
    private _currentViewport: Vector4 = new Vector4();
    _viewport: Vector4;
    private _cachedFBO: [WebGLFramebuffer, WebGLFramebuffer, WebGLFramebuffer]; // [draw fbo, copy target, read back target]
    _isContextLost = false;
    private ctx_info: RenderCtxInfo;
    private _width: number;
    private _height: number;
    private _canvas: HTMLCanvasElement;
    private _scissorTest: boolean = false;
    private _currentGeometryProgram: {
        geometry: Nullable<number>;
        program: Nullable<number>;
    } = { geometry: null, program: null };
    private _destroyed = false;
    private renderPass: RenderPass = {
        active: false,
        target: undefined,
        resolveTarget: undefined,
        viewport: new Vector4(),
        scissorTest: false,
        scissor: new Vector4(),
        store: false,
        resolveContent: false,
        resolveDepth: false,
        generateMipmap: false,
        drawBuffers: DEFAULT_DRAW_BUFFERS,
        clearColor: new Color(0x000000),
        clearAlpha: 0,
        clearFlags: {
            color: false,
            depth: false,
            stencil: false,
        },
    };
    private drawFrameBuffer: number;
    private readFrameBuffer: number;
    lastUsedMaterial: Nullable<Material> = null;

    constructor(parameters: RendererParameters) {
        super();

        this.parameters = parameters;
        this._canvas = this.domElement = parameters.canvas;

        this._width = this._canvas.width;
        this._height = this._canvas.height;
        this._viewport = new Vector4(0, 0, this._width, this._height);
        this._currentViewport.copy(this._viewport).multiplyScalar(this._pixelRatio);
        this._scissor = new Vector4(0, 0, this._width, this._height);
        this._currentScissor.copy(this._scissor).multiplyScalar(this._pixelRatio);

        // event listeners must be registered before WebGL context is created, see #12753
        this._canvas.addEventListener('webglcontextlost', this.onContextLost, false);

        if (parameters.preferWebGL1) {
            logger.warn('webgl1 ctx is explicitly preferred by user config');
        }

        const contextAttributes: WebGLContextAttributes = {
            alpha: parameters.alpha,
            depth: parameters.depth,
            stencil: parameters.stencil,
            antialias: parameters.antialias,
            premultipliedAlpha: parameters.premultipliedAlpha,
            preserveDrawingBuffer: parameters.preserveDrawingBuffer,
            powerPreference: parameters.powerPreference,
        };
        this.gl =
            parameters.context ??
            (this._canvas.getContext(
                parameters.preferWebGL1 ? 'webgl' : 'webgl2',
                contextAttributes,
            ) as WebGL2RenderingContext) ??
            this._canvas.getContext('webgl', contextAttributes) ??
            (this._canvas.getContext('experimental-webgl', contextAttributes) as WebGLRenderingContext);
        if (!this.gl) {
            throw new Error(`create WebGL2 or WebGL context fail.`);
        }
        // Some experimental-webgl implementations do not have getShaderPrecisionFormat
        if (this.gl.getShaderPrecisionFormat === undefined) {
            this.gl.getShaderPrecisionFormat = function () {
                return { rangeMin: 1, rangeMax: 1, precision: 1 };
            };
        }

        if (typeof WebGL2RenderingContext !== 'undefined' && this.gl instanceof WebGL2RenderingContext) {
            this.backend = RendererBackend.WEBGL2_JS;
            this.drawFrameBuffer = this.gl.DRAW_FRAMEBUFFER;
            this.readFrameBuffer = this.gl.READ_FRAMEBUFFER;
        } else {
            this.backend = RendererBackend.WEBGL_JS;
            window.EGS_WEBGL1_RENDERER_COUNT = (window.EGS_WEBGL1_RENDERER_COUNT ?? 0) + 1;
            this.drawFrameBuffer = this.gl.FRAMEBUFFER;
            this.readFrameBuffer = this.gl.FRAMEBUFFER;
        }

        this.extensions = new WGLExtensions(this.gl);
        setupWebGLCapabilities(this.gl, this.parameters, this.extensions);
        this.wglState = new WGLState(this.gl, this.extensions);
        this.wglState.setViewport(this._currentViewport);
        this.wglState.setScissor(this._currentScissor);
        this.renderState = new RenderState(this.gl, this.wglState);
        this.resourceManager = new ResourceManager(this);
        this.bufferRenderer = new WGLBufferRenderer(this.gl, this.renderInfo, this.extensions);
        this.indexedBufferRenderer = new WGLIndexedBufferRenderer(this.gl, this.renderInfo, this.extensions);
        this.ctx_info = new RenderCtxInfo(this.gl, this.extensions);
        this._cachedFBO = [this.gl.createFramebuffer()!, this.gl.createFramebuffer()!, this.gl.createFramebuffer()!];

        if (!WGLCapabilities.IS_SUPPORT_INSTANCE) {
            FatLineSegments.UseFallBack = true;
            InstancePool.isAvailable = false;
        }
    }
    getRenderTarget() {
        throw new Error('Method not implemented.');
    }

    getContext() {
        return this.gl;
    }

    beforeFrameRender() {
        this.renderInfo.resetFrameStart();
    }

    afterFrameRender() {}

    getGPUInfo() {
        return this.ctx_info.output();
    }

    tick(timestamp: number) {
        if (this.resourceManager) {
            this.resourceManager.programManager.tick(timestamp);
            this.resourceManager.instanceProgramManager.tick(timestamp);
        }
    }

    updateRenderStatistics(re: RenderStatistics): void {
        if (this._destroyed) {
            return;
        }
        const info = this.renderInfo;
        re.calls = info.objectInfo.calls;
        re.callsByObjectCategoryId = info.objectInfo.callsByObjectCategoryId;
        re.callsBySourceType = info.objectInfo.callsBySourceType;
        re.vertices = info.objectInfo.vertices;
        re.faces = info.objectInfo.faces;
        re.geometries = info.objectInfo.geometries;
        re.textures = info.objectInfo.textures;
        re.programs = info.objectInfo.programs;
        re.counters.set('refreshMaterialCount', info.refreshMaterialCount);
        re.counters.set('refreshProgramCount', info.refreshProgramCount);
        re.counters.set('refreshLightsCount', info.refreshLightsCount);

        const resourceManager = this.resourceManager;
        re.geometryBufferByteSize = resourceManager.bufferManager.getWebGLByteSize();
        re.textureByteSize = resourceManager.textureManager.getWebGLByteSize();
        re.fboByteSize = resourceManager.textureManager.getInternalWebGLByteSize();
        if (resourceManager.uboManager) {
            re.uboByteSize = resourceManager.uboManager.getWebGLByteSize();
        }
    }

    getPixelRatio(): number {
        return this._pixelRatio;
    }

    setPixelRatio(value: number) {
        this._pixelRatio = value;
        this.setSize(this._width, this._height, false);
    }

    // Resizes the output canvas to (width, height), and also sets the viewport to fit that size, starting in (0, 0).
    setSize(width: number, height: number, updateStyle = true): void {
        this._width = width;
        this._height = height;

        this._canvas.width = width * this._pixelRatio;
        this._canvas.height = height * this._pixelRatio;
        if (updateStyle) {
            this._canvas.style.width = width + 'px';
            this._canvas.style.height = height + 'px';
        }
        this.setViewport(0, 0, width, height);
    }

    getSize(): { width: number; height: number } {
        return {
            width: this._width,
            height: this._height,
        };
    }

    getDrawingBufferSize(): { width: number; height: number } {
        return {
            width: this._width * this._pixelRatio,
            height: this._height * this._pixelRatio,
        };
    }

    setViewport(x: number, y: number, width: number, height: number): void {
        this._viewport.set(x, this._height - y - height, width, height);
        this._currentViewport.copy(this._viewport).multiplyScalar(this._pixelRatio);
        this.renderPass.viewport.copy(this._currentViewport);
    }

    setViewportInRenderPass(x: number, y: number, width: number, height: number) {
        if (!this.renderPass.active) {
            return;
        }
        const frameHeight = this.renderPass.target?.height ?? this._height;
        this.renderPass.viewport.set(x, frameHeight - y - height, width, height);
        this.wglState.setViewport(this.renderPass.viewport);
    }

    // Sets the clear color, using color for the color and alpha for the opacity.
    setClearColor(color: Color | string | number, alpha?: number): void {
        this.renderPass.clearColor.set(color);
        this.renderPass.clearAlpha = alpha ?? this.renderPass.clearAlpha;
    }

    // Arguments default to true
    clear(color: boolean = true, depth: boolean = true, stencil: boolean = true): void {
        this.renderPass.clearFlags.color = color;
        this.renderPass.clearFlags.depth = depth;
        this.renderPass.clearFlags.stencil = stencil;
    }

    getCanvas() {
        return this._canvas;
    }

    destroy(forceLost = true): void {
        if (this._destroyed) {
            return;
        }

        this._canvas.removeEventListener('webglcontextlost', this.onContextLost, false);
        this.resourceManager.freeGPU();
        this.resourceManager = null!;
        if (forceLost && !this._isContextLost) {
            this.forceContextLost();
        }
        this.gl = null!;
        this._canvas = undefined!;
        this.domElement = undefined!;
        this.clearAllListeners();
        this._destroyed = true;
        this.rendererStatus.state = RendererState.Destroyed;
        if (this.backend === RendererBackend.WEBGL_JS) {
            if (window.EGS_WEBGL1_RENDERER_COUNT) {
                window.EGS_WEBGL1_RENDERER_COUNT--;
            }
        }
    }

    private manualContextLost: boolean = false;
    // we will not use force ctx restore because it's unstable
    forceContextLost(manual: boolean = true) {
        const extension = this.extensions.get(WebGLExtEnums.WEBGL_lose_context);
        if (extension) {
            extension.loseContext();
        }
        if (manual) {
            this.manualContextLost = true;
        }
    }

    // Events
    private onContextLost = (event: any) => {
        event.preventDefault();
        if (this._isContextLost) {
            return;
        }
        const statics: ResourceStatistics = this.resourceManager.outputResourceStatistics();
        this.resourceManager.freeGPU();
        this._isContextLost = true;
        this.rendererStatus.state = RendererState.ContextLost;
        this.emit(ContextLostEvent, {
            ...statics,
            manual: this.manualContextLost,
        });
        this.manualContextLost = false;
    };

    getCurrentCamera() {
        return this.renderState.builtUniforms.currentCamera as Camera3D;
    }
    getCurrentDrawable() {
        return this.renderState.builtUniforms.currentDrawable as Drawable;
    }

    useCamera(camera: Nullable<Camera3D>) {
        if (camera) {
            this.renderState.updateCamera(camera);
        }
    }
    useRegistry(registry: ShaderComponentRegistry) {
        let current = this.renderState.activeShaderComponentRegistry;
        if (current && current !== registry) {
            current = registry;
            current.light.broadcastToRecompile();
            current.dynamicForwardLight.broadcastToRecompile();
        }
        this.renderState.activeShaderComponentRegistry = registry;
    }

    overrideDispatcher: Nullable<MaterialDispatcher> = null;

    private useGeometry(geometry: BufferGeometryBase, program: WGLProgram) {
        let updateBuffers = false;
        if (
            this._currentGeometryProgram.geometry !== geometry.id ||
            this._currentGeometryProgram.program !== program.id
        ) {
            this._currentGeometryProgram.geometry = geometry.id;
            this._currentGeometryProgram.program = program.id;
            updateBuffers = true;
        }

        if (!updateBuffers) {
            return;
        }
        this.renderState.setupVertexAttributes(geometry, program);
    }

    // core render method
    renderDrawcall(
        geometry: BufferGeometryBase,
        material: Material,
        object: Drawable,
        range: Nullable<BufferRange>,
    ): void {
        if (this._isContextLost) {
            return;
        }

        if (!material.canDraw()) {
            logger.unsupported(`Cant rendering drawable's material due to platform limitation` + material.className());
            return;
        }

        this.renderState.updateDrawable(object); // notify inner state that what to draw may changed

        // do extra plugin logic
        if (object.onBeforeRender) {
            object.onBeforeRender(this, geometry, material, object, range);
        }

        // in this, program and all uniform settled
        const dispatcher = this.overrideDispatcher ?? DefaultMaterialDispatcher.DEFAULT;
        const program = dispatcher.dispatch(this, geometry, material, object);
        if (program === null) {
            return;
        }

        // in this, all geometry buffer is ok and binding settled
        this.useGeometry(geometry, program);

        const index = geometry._index;
        let attribute: WGLBufferData;
        let renderer: WGLBufferRenderer | WGLIndexedBufferRenderer = this.bufferRenderer;

        if (index !== null) {
            attribute = this.resourceManager.getWebGLBufferData(index);
            renderer = this.indexedBufferRenderer;
            renderer.setIndex(attribute);
        }

        const position = geometry.attributes.position;
        let dataCount = Infinity;
        if (index !== null) {
            dataCount = index.count;
        } else if (position !== undefined) {
            dataCount = position.count;
        }

        const drawRange = geometry.drawRange;
        const rangeStart = drawRange.start;
        const rangeCount = drawRange.count;
        const groupStart = range !== null ? range.start : 0;
        const groupCount = range !== null ? range.count : Infinity;
        const drawStart = Math.max(rangeStart, groupStart);
        const drawEnd = Math.min(dataCount, rangeStart + rangeCount, groupStart + groupCount) - 1;
        const drawCount = Math.max(0, drawEnd - drawStart + 1);

        if (drawCount === 0 || drawCount === Infinity) {
            return;
        }

        renderer.setMode(object.drawMode);

        if (TypeAssert.isInstancedBufferGeometry(geometry)) {
            if (geometry.instancedCount > 0) {
                renderer.renderInstances(object, geometry, drawStart, drawCount);
            }
        } else {
            renderer.render(object, drawStart, drawCount);
        }
    }

    renderRenderable(renderable: Renderable) {
        renderable.render(this);
    }

    resetRenderState() {
        this.renderState.resetFrame();
        this.lastUsedMaterial = null;

        this._currentGeometryProgram.geometry = null;
        this._currentGeometryProgram.program = null;
    }

    setMaterialUploadDirty() {
        this.lastUsedMaterial = null;
    }

    private bindTarget(target?: RenderTarget, drawBuffers: number[] = DEFAULT_DRAW_BUFFERS) {
        const { gl, wglState, renderState, _cachedFBO } = this;
        if (!target) {
            gl.bindFramebuffer(this.drawFrameBuffer, null);
            renderState.updateResolution(this._width * this._pixelRatio, this._height * this._pixelRatio);
            return;
        }

        gl.bindFramebuffer(this.drawFrameBuffer, _cachedFBO[0]);
        for (let i = 0; i < MAX_COLOR_ATTACHMENTS; i++) {
            gl.framebufferTexture2D(this.drawFrameBuffer, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, null, 0);
        }
        gl.framebufferTexture2D(this.drawFrameBuffer, gl.DEPTH_STENCIL_ATTACHMENT, gl.TEXTURE_2D, null, 0);

        const { colors, depth, width, height, layer, level } = target;
        const textureManager = this.resourceManager.textureManager;
        colors.forEach((color, i) => {
            const data = textureManager.getAttachment(color, wglState);
            color.attach(gl, this.backend, this.drawFrameBuffer, i, data, layer, level);
        });
        if (depth) {
            const data = textureManager.getAttachment(depth, wglState);
            depth.attach(gl, this.backend, this.drawFrameBuffer, 0, data, layer, level);
        }
        if (this.backend === RendererBackend.WEBGL2_JS) {
            (gl as WebGL2RenderingContext).drawBuffers(drawBuffers);
        }
        renderState.updateResolution(width, height);
    }

    /**
     * do all gl bind stuffs
     * bind Target -> set viewport -> set scissor -> clear
     */
    beginPass(store: boolean, resolveContent: boolean, resolveDepth: boolean, generateMipmap: boolean) {
        const {
            renderPass: { target, viewport, scissorTest, scissor, drawBuffers, clearColor, clearAlpha, clearFlags },
            wglState,
        } = this;
        this.bindTarget(target, drawBuffers);

        wglState.setViewport(viewport);

        wglState.setScissor(scissor);
        wglState.setScissorTest(scissorTest);
        // ignore clear config if nothing need to clear
        if (clearFlags.color || clearFlags.depth || clearFlags.stencil) {
            wglState.colorState.setMask(true);
            wglState.depthState.setMask(true);
            wglState.stencilState.setMask(0xffffffff);
            wglState.setColorClear(clearColor.r, clearColor.g, clearColor.b, clearAlpha);
            wglState.clear(clearFlags.color, clearFlags.depth, clearFlags.stencil);
        }
        // clear clear flags
        clearFlags.color = clearFlags.depth = clearFlags.stencil = false;

        this.renderPass.store = store;
        this.renderPass.resolveContent = resolveContent;
        this.renderPass.resolveDepth = resolveDepth;
        this.renderPass.generateMipmap = generateMipmap;
        this.renderPass.active = true;
    }

    endPass() {
        const {
            _cachedFBO,
            resourceManager,
            wglState,
            drawFrameBuffer,
            readFrameBuffer,
            renderPass: { resolveContent, resolveDepth, generateMipmap, drawBuffers, target, resolveTarget },
        } = this;
        const gl = this.gl as WebGL2RenderingContext;

        // resolve multi sampled target
        if (target && target.multiSample && resolveTarget && this.backend === RendererBackend.WEBGL2_JS) {
            const { depth: dstDepth, colors, width, height } = resolveTarget;
            const enableStencil =
                !!dstDepth && dstDepth.glFormat.external(this.backend) === WebGLPixelFormat.DepthStencil;
            const depthAttachment = enableStencil ? gl.DEPTH_STENCIL_ATTACHMENT : gl.DEPTH_ATTACHMENT;
            const dstTextures = colors.map(c => resourceManager.textureManager.getAttachment(c, wglState));
            const dstDepthBuffer: WGLRenderAttachment | null = dstDepth
                ? resourceManager.textureManager.getAttachment(dstDepth, wglState)
                : null;
            // should always call after begin pass
            // just switch framebuffer, read from current draw framebuffer
            // write to copy framebuffer
            gl.bindFramebuffer(readFrameBuffer, _cachedFBO[0]);
            gl.bindFramebuffer(drawFrameBuffer, _cachedFBO[1]);

            if (dstDepth) {
                dstDepth.attach(
                    gl,
                    this.backend,
                    drawFrameBuffer,
                    0,
                    dstDepthBuffer!,
                    resolveTarget.layer,
                    resolveTarget.level,
                );
            }

            if (resolveContent) {
                resolveTarget.colors.forEach((attachment, i) => {
                    if (drawBuffers[i] === gl.NONE) {
                        return;
                    }
                    attachment.attach(
                        gl,
                        this.backend,
                        this.drawFrameBuffer,
                        0,
                        dstTextures[i],
                        resolveTarget.level,
                        resolveTarget.layer,
                    );
                    gl.readBuffer(gl.COLOR_ATTACHMENT0 + i);
                    gl.blitFramebuffer(0, 0, width, height, 0, 0, width, height, gl.COLOR_BUFFER_BIT, gl.NEAREST);
                });
            }

            if (resolveDepth && target.depth && dstDepth) {
                let mask = gl.DEPTH_BUFFER_BIT;
                if (enableStencil) {
                    mask |= gl.STENCIL_BUFFER_BIT;
                }
                gl.blitFramebuffer(0, 0, width, height, 0, 0, width, height, mask, gl.NEAREST);
            }

            gl.framebufferTexture2D(drawFrameBuffer, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0);
            if (dstDepth) {
                gl.framebufferTexture2D(drawFrameBuffer, depthAttachment, gl.TEXTURE_2D, null, 0);
            }

            // restore the framebuffers
            gl.bindFramebuffer(readFrameBuffer, null);
            gl.bindFramebuffer(drawFrameBuffer, _cachedFBO[0]);
        }

        if (generateMipmap && (target || resolveTarget)) {
            const colors = target?.multiSample ? (resolveTarget?.colors ?? []) : (target?.colors ?? []);
            colors.forEach(color => {
                if (color.mipmaps) {
                    const webglTexture = resourceManager.textureManager.getAttachment(color, wglState) as WebGLTexture;
                    wglState.bindTextureAndActiveForUploading(color.bindableTarget, webglTexture);
                    gl.generateMipmap(color.bindableTarget);
                }
            });
        }

        if (target && !this.renderPass.store && this.backend === RendererBackend.WEBGL2_JS) {
            const attachments = target.colors.map((_, i) => this.gl.COLOR_ATTACHMENT0 + i);
            if (target.depth) {
                attachments.push(
                    target.depth.glFormat.external(this.backend) === WebGLPixelFormat.DepthStencil
                        ? gl.DEPTH_STENCIL_ATTACHMENT
                        : gl.DEPTH_ATTACHMENT,
                );
            }
            gl.invalidateFramebuffer(this.drawFrameBuffer, attachments);
        }

        this.renderPass.scissorTest = false;
        this.renderPass.target = undefined;
        this.renderPass.resolveTarget = undefined;
        this.renderPass.active = false;
    }

    flushCommands() {
        //
    }

    setRenderTarget(target?: RenderTarget, resolveTarget?: RenderTarget) {
        this.renderPass.target = target;
        this.renderPass.resolveTarget = resolveTarget;
        this.renderPass.drawBuffers = DEFAULT_DRAW_BUFFERS;
        if (target && this.backend === RendererBackend.WEBGL2_JS) {
            const gl = this.gl as WebGL2RenderingContext;
            const drawBuffers = map_draw_buffers(gl, target.colors.length, target.drawBuffers);
            this.renderPass.drawBuffers = drawBuffers;
        } else {
            this.renderPass.drawBuffers = DEFAULT_DRAW_BUFFERS;
        }
        if (!target) {
            this.renderPass.viewport.copy(this._currentViewport);
            this.renderPass.scissor.copy(this._currentScissor);
            this.renderPass.scissorTest = this._scissorTest;
        } else {
            this.renderPass.viewport.set(0, 0, target.width, target.height);
            this.renderPass.scissorTest = false;
        }
    }

    // Enable the scissor test. When this is enabled, only the pixels within the defined scissor area will be affected by further renderer actions.
    setScissorTest(enable: boolean): void {
        this._scissorTest = enable;
        this.renderPass.scissorTest = enable;
    }

    // Sets the scissor area from (x, y) to (x + width, y + height).
    setScissor(x: number, y: number, width: number, height: number): void {
        this._scissor.set(x, this._height - y - height, width, height);
        this._currentScissor.copy(this._scissor).multiplyScalar(this._pixelRatio);
        this.renderPass.scissor.copy(this._currentScissor);
    }

    private checkAndBindTargetForReading(target: RenderTarget, range: IRange) {
        if (
            range.x >= 0 &&
            range.x <= target.width - range.width &&
            range.y >= 0 &&
            range.y <= target.height - range.height
        ) {
            return true;
        } else {
            logger.webglError('read pixel range exceed render target');
        }

        return false;
    }

    // webgl read pixel is only guaranteed for unsigned rgba, but other format could been supported by implementation
    readPixels(target: RenderTarget, range: IRange, result: TypedArray) {
        if (this._isContextLost) {
            return;
        }
        if (!this.checkAndBindTargetForReading(target, range)) {
            return;
        }

        const { gl, _cachedFBO, resourceManager, wglState } = this;
        const texture = target.colors[0];
        const readHandle = resourceManager.textureManager.getAttachment(texture, wglState);
        gl.bindFramebuffer(this.readFrameBuffer, _cachedFBO[2]);
        gl.framebufferTexture2D(this.readFrameBuffer, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, readHandle, 0);
        gl.readPixels(
            range.x,
            range.y,
            range.width,
            range.height,
            texture.glFormat.external(this.backend),
            texture.glFormat.dataType(this.backend),
            result,
        );
        gl.framebufferTexture2D(this.readFrameBuffer, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0);
        gl.bindFramebuffer(this.readFrameBuffer, null);
    }

    async readPixelsAsync(target: RenderTarget, range: IRange, result: TypedArray): Promise<void> {
        if (this.backend === RendererBackend.WEBGL_JS) {
            return Promise.resolve(this.readPixels(target, range, result));
        }
        if (this._isContextLost) {
            return Promise.reject(new Error('contextlost'));
        }
        if (!this.checkAndBindTargetForReading(target, range)) {
            return Promise.reject(new Error('check target bind fail'));
        }

        const { _cachedFBO, resourceManager, wglState } = this;
        const gl = this.gl as WebGL2RenderingContext;
        const texture = target.colors[0];
        const readHandle = resourceManager.textureManager.getAttachment(texture, wglState);
        gl.bindFramebuffer(this.readFrameBuffer, _cachedFBO[2]);
        texture.attach(gl, this.backend, this.readFrameBuffer, 0, readHandle, target.layer, target.level);
        gl.readBuffer(gl.COLOR_ATTACHMENT0);

        const buf = gl.createBuffer()!;
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buf);
        gl.bufferData(gl.PIXEL_PACK_BUFFER, result.byteLength, gl.STREAM_READ);
        gl.readPixels(
            range.x,
            range.y,
            range.width,
            range.height,
            texture.glFormat.external(this.backend),
            texture.glFormat.dataType(this.backend),
            0,
        );
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);

        gl.framebufferTexture2D(this.readFrameBuffer, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0);
        gl.bindFramebuffer(this.readFrameBuffer, null);
        await getBufferSubDataAsync(gl, gl.PIXEL_PACK_BUFFER, buf, 0, result);
        gl.deleteBuffer(buf);
    }

    getMemoryInfo(): MemoryInfo {
        return {
            wasm_total_size: 0,
            all_real: 0,
            attributes_manager_real: 0,
            geometries_manager_real: 0,
            materials_manager_real: 0,
            scene_nodes_manager_real: 0,
            scenes_real: 0,
            textures_manager_real: 0,
            ubo_real: 0,

            all_allocated: 0,
            attributes_manager_allocated: 0,
            geometries_manager_allocated: 0,
            materials_manager_allocated: 0,
            scene_nodes_manager_allocated: 0,
            scenes_allocated: 0,
            textures_manager_allocated: 0,
            ubo_allocated: 0,
        };
    }

    releaseUnusedResources() {}

    queueFlushTexture(texture: Texture) {
        this.resourceManager.textureManager.get(texture, this.wglState);
    }
}

// https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext/drawBuffers
function map_draw_buffers(gl: WebGL2RenderingContext, counts: number, des?: number[]) {
    const result: GLenum[] = [];
    if (!des) {
        for (let i = 0; i < counts; i++) {
            result.push(gl.COLOR_ATTACHMENT0 + i);
        }
    } else {
        const maxLocation = Math.max(...des);
        for (let i = 0; i <= maxLocation; i++) {
            result.push(des.includes(i) ? gl.COLOR_ATTACHMENT0 + i : gl.NONE);
        }
    }
    return result;
}
