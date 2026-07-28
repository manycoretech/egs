import {
    Viewer,
    type Viewport,
    type __INTERNAL__,
    ViewerResizeEvent,
    type IViewerContext,
    PerspectiveCamera,
    Vector4,
    EventDispatcher,
    EventType,
    Matrix4,
} from '@qunhe/egs';
import { vertex, fragment } from './shader/WebXRQuad.js';

export type WebXRSession = 'immersive-vr' | 'immersive-ar';

interface ExtendedViewerPlugin extends __INTERNAL__.ViewerPlugin, EventDispatcher {
    /**
     * XRSession, but typing was missing in ts 3.8, use any instead.
     * @type XRSession
     */
    readonly session: any;
    registerToViewer(viewer: IViewerContext | Viewer): void;
}

export const OnXRViewChanged = new EventType<Viewport[]>();
const QUAD_VERTEX = new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]);

interface GLResource {
    vao: WebGLVertexArrayObject;
    vertexBuffer: WebGLBuffer;
    vertexShader: WebGLShader;
    fragmentShader: WebGLShader;
    program: WebGLProgram;
    sceneResult?: WebGLTexture;
}

interface Size {
    width: number;
    height: number;
}

interface XRRenderer {
    readonly viewerFramebufferSize: Size;
    readonly xrFramebufferSize: Size;
    readonly xrProxyFramebufferSize: Size;
    initDevice(session: XRSession, options?: XRPluginOptions): Promise<void>;
    initResource(): void;
    render(pose: XRViewerPose, source: HTMLCanvasElement): void;
    getViewports(pose: XRViewerPose): XRViewport[];
    setSize(renderingBufferSize: Size, xrProxyBufferSize: Size): void;
    destroy(): void;
}

abstract class XRWebGLRenderer implements XRRenderer {
    viewerFramebufferSize: Size;
    xrProxyFramebufferSize: Size;
    protected contextlost: boolean;
    protected contextAttributes: WebGLContextAttributes;
    protected gl: WebGL2RenderingContext;
    protected resource: GLResource;
    protected baseLayer: XRWebGLLayer;

    get xrFramebufferSize() {
        if (!this.baseLayer) {
            return {
                width: 4,
                height: 4,
            };
        }
        return {
            width: this.baseLayer.framebufferWidth,
            height: this.baseLayer.framebufferHeight,
        };
    }

    constructor() {
        this.contextAttributes = {
            antialias: false,
            depth: false,
            alpha: false,
            preserveDrawingBuffer: false,
        };
        this.viewerFramebufferSize = { width: 4, height: 4 };
        this.xrProxyFramebufferSize = { width: 4, height: 4 };
        this.contextlost = false;
    }

    protected onContextLost = () => {
        this.contextlost = true;
    };

    protected onContextRestore = () => {
        this.contextlost = false;
        this.initResource();
        this.buildSceneResource();
    };

    async initDevice(session: XRSession, options?: XRPluginOptions) {
        await this.gl.makeXRCompatible();
        this.baseLayer = new XRWebGLLayer(session, this.gl, {
            alpha: true,
            depth: false,
            stencil: false,
            ignoreDepthValues: true,
            framebufferScaleFactor: options?.framebufferScaleFactor ?? 1,
        });
        session.updateRenderState({ baseLayer: this.baseLayer });
    }

    getViewports(pose: XRViewerPose) {
        return pose.views.map(view => this.baseLayer.getViewport(view) ?? { x: 0, y: 0, width: 0, height: 0 });
    }

    render(_pose: XRViewerPose, source: HTMLCanvasElement) {
        if (this.resource.sceneResult && !this.contextlost) {
            const {
                gl,
                viewerFramebufferSize: rendingBufferSize,
                xrFramebufferSize: xrFrameBufferSize,
                baseLayer,
                resource: { sceneResult, program, vao },
            } = this;
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, sceneResult);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
            gl.texSubImage2D(
                gl.TEXTURE_2D,
                0,
                0,
                0,
                rendingBufferSize.width,
                rendingBufferSize.height,
                gl.RGBA,
                gl.UNSIGNED_BYTE,
                source,
            );
            gl.useProgram(program);
            gl.bindVertexArray(vao);
            gl.bindFramebuffer(gl.FRAMEBUFFER, baseLayer.framebuffer);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
            gl.viewport(0, 0, xrFrameBufferSize.width, xrFrameBufferSize.height);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
            gl.bindTexture(gl.TEXTURE_2D, null);
            gl.useProgram(null);
            gl.bindVertexArray(null);
        }
    }

    initResource() {
        const gl = this.gl;
        const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
        const program = gl.createProgram()!;
        const vao = gl.createVertexArray()!;
        const vertexBuffer = gl.createBuffer()!;

        gl.shaderSource(vertexShader, vertex);
        gl.shaderSource(fragmentShader, fragment);
        gl.compileShader(vertexShader);
        gl.compileShader(fragmentShader);
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        gl.useProgram(program);
        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, QUAD_VERTEX, gl.STATIC_DRAW);

        const location = gl.getAttribLocation(program, 'position');
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, 3, gl.FLOAT, false, 12, 0);
        gl.uniform1i(gl.getUniformLocation(program, 'map'), 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindVertexArray(null);
        gl.useProgram(null);

        gl.clearColor(0, 0, 0, 0);
        gl.clearDepth(1.0);
        gl.clearStencil(0);
        gl.frontFace(gl.CCW);
        gl.cullFace(gl.BACK);
        gl.enable(gl.CULL_FACE);

        this.resource = {
            vertexShader,
            fragmentShader,
            program,
            vao,
            vertexBuffer,
        };
    }

    protected buildSceneResource() {
        const { width, height } = this.viewerFramebufferSize;
        if (this.resource.sceneResult) {
            this.gl.deleteTexture(this.resource.sceneResult);
        }
        this.resource.sceneResult = this.gl.createTexture()!;
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.resource.sceneResult);
        this.gl.texStorage2D(this.gl.TEXTURE_2D, 1, this.gl.RGBA8, width, height);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
        this.gl.bindTexture(this.gl.TEXTURE_2D, null);
    }

    setSize(viewerFramebufferSize: Size, xrProxyFramebufferSize: Size) {
        Object.assign(this.viewerFramebufferSize, viewerFramebufferSize);
        Object.assign(this.xrProxyFramebufferSize, xrProxyFramebufferSize);
        this.buildSceneResource();
    }

    destroy() {
        this.contextlost = true;
        const {
            gl,
            resource: { vao, vertexBuffer, vertexShader, fragmentShader, program, sceneResult },
        } = this;
        gl.deleteVertexArray(vao);
        gl.deleteBuffer(vertexBuffer);
        gl.deleteProgram(program);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        if (sceneResult) {
            gl.deleteTexture(sceneResult);
        }
    }
}

class CanvasXRRenderer extends XRWebGLRenderer {
    private canvas: HTMLCanvasElement;

    constructor() {
        super();
        this.canvas = document.createElement('canvas');
        this.viewerFramebufferSize = {
            width: this.canvas.width,
            height: this.canvas.height,
        };
        const gl = this.canvas.getContext('webgl2', this.contextAttributes);
        if (!gl) {
            throw new Error('Cannot create WebGL2 context for WebXR');
        }
        this.gl = gl;
        this.canvas.addEventListener('webglcontextlost', this.onContextLost);
        this.canvas.addEventListener('webglcontextrestored', this.onContextRestore);
    }

    setSize(viewerFramebufferSize: Size, xrProxyFramebufferSize: Size): void {
        this.canvas.width = xrProxyFramebufferSize.width;
        this.canvas.height = xrProxyFramebufferSize.height;
        super.setSize(viewerFramebufferSize, xrProxyFramebufferSize);
    }

    destroy() {
        super.destroy();
        this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
        this.canvas.removeEventListener('webglcontextrestored', this.onContextRestore);
    }
}

class OffscreenCanvasXRRenderer extends XRWebGLRenderer {
    private canvas: OffscreenCanvas;

    constructor() {
        super();
        this.canvas = new OffscreenCanvas(4, 4);
        this.viewerFramebufferSize = {
            width: this.canvas.width,
            height: this.canvas.height,
        };
        const gl = this.canvas.getContext('webgl2', this.contextAttributes);
        if (!gl) {
            throw new Error('Cannot create WebGL2 context for WebXR');
        }
        this.gl = gl;
        this.canvas.addEventListener('webglcontextlost', this.onContextLost);
        this.canvas.addEventListener('webglcontextrestored', this.onContextRestore);
    }

    setSize(viewerFramebufferSize: Size, xrProxyFramebufferSize: Size): void {
        this.canvas.width = xrProxyFramebufferSize.width;
        this.canvas.height = xrProxyFramebufferSize.height;
        super.setSize(viewerFramebufferSize, xrProxyFramebufferSize);
    }

    destroy() {
        super.destroy();
        this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
        this.canvas.removeEventListener('webglcontextrestored', this.onContextRestore);
    }
}

interface XRPluginOptions {
    /**
     * @default 1
     * @remarks
     * use as following parameter:
     *  - https://developer.mozilla.org/en-US/docs/Web/API/XRWebGLLayer/XRWebGLLayer#framebufferscalefactor
     *  - https://developer.mozilla.org/en-US/docs/Web/API/XRWebGLBinding/createProjectionLayer#scalefactor
     */
    framebufferScaleFactor?: number;
    /**
     * pixel ratio of the viewer,
     * @default 1
     * @remarks
     * viewer.renderPixelRatio = 1 / window.devicePixelRatio * pixelRatio
     */
    pixelRatio?: number;
    /**
     * the scale for XRRenderState.depthFar
     * @default 1
     * @remarks
     * camera.far = XRRenderState.depthFar * depthScale
     */
    depthScale?: number;
    /**
     * compute camera transform matrix from XRView
     * @param transform XRView.transform.matrix
     * @param viewIndex index of the camera associated view
     * @default transform => new Matrix4().fromArray(transform)
     */
    computeCameraMatrix?(transform: Float32Array, viewIndex: number): Matrix4;
}

const DEFAULT_OPTIONS: Required<XRPluginOptions> = {
    framebufferScaleFactor: 1,
    depthScale: 1,
    pixelRatio: 1,
    computeCameraMatrix(transform) {
        return new Matrix4().fromArray(transform);
    },
};

class WebXRPlugin extends EventDispatcher implements ExtendedViewerPlugin {
    private viewer: Viewer;
    private raf: number;
    private initialized: boolean;
    private views: Viewport[];
    private options: Required<XRPluginOptions>;

    constructor(
        readonly session: XRSession,
        private refSpace: XRReferenceSpace | XRBoundedReferenceSpace,
        private renderer: XRRenderer,
        options?: XRPluginOptions,
    ) {
        super();
        this.views = [];
        this.options = Object.assign({}, DEFAULT_OPTIONS, options);
    }

    init(): void {
        this.viewer.frameInfo.setupAnimationFunction(
            this.session.requestAnimationFrame.bind(this.session),
            this.session.cancelAnimationFrame.bind(this.session),
        );
        this.renderer.initResource();
        this.viewer.renderPixelRatio = (1 / window.devicePixelRatio) * this.options.pixelRatio;
        this.syncSize();
        this.viewer.on(ViewerResizeEvent, this.onViewerResize);
        this.raf = this.session.requestAnimationFrame(this.onAnimationFrame);
        this.initialized = true;
    }

    destroy(): void {
        if (!this.initialized) {
            return;
        }
        this.viewer.frameInfo.resetDefaultAnimationFunction();
        this.initialized = false;
        this.session.cancelAnimationFrame(this.raf);
        this.session.end().then(_ => {
            this.renderer.destroy();
        });
        this.viewer.renderPixelRatio = 1;
        this.viewer.off(ViewerResizeEvent, this.onViewerResize);
        this.clearAllListeners();
    }

    private syncSize() {
        const bufferSize = this.viewer._getEngine().renderer.getDrawingBufferSize();
        const logicSize = this.viewer._getEngine().renderer.getSize();
        this.renderer.setSize(bufferSize, logicSize);
    }

    private setupViewport(view: Viewport, xrView: XRView, xrViewport: XRViewport | undefined, index: number) {
        const camera = view.camera;
        const { width, height } = this.renderer.xrFramebufferSize;
        if (xrViewport) {
            const bound = new Vector4(
                xrViewport.x / width,
                xrViewport.y / height,
                xrViewport.width / width,
                xrViewport.height / height,
            );
            bound.y = 1.0 - bound.y - bound.w;
            view.bound = bound;
        }

        camera.matrix = this.options.computeCameraMatrix(xrView.transform.matrix, index);
        // sync fov and aspect
        {
            const fov = ((Math.atan(1 / xrView.projectionMatrix[5]) * 2) / Math.PI) * 180;
            const aspect = xrView.projectionMatrix[5] / xrView.projectionMatrix[0];
            const perspectiveCamera = camera as PerspectiveCamera;
            if (perspectiveCamera.fov !== fov) {
                perspectiveCamera.fov = fov;
            }
            if (perspectiveCamera.aspect !== aspect) {
                perspectiveCamera.aspect = aspect;
            }
        }
    }

    private updateViewport(xrViews: ReadonlyArray<XRView>, viewports: ReadonlyArray<XRViewport>) {
        const renderState = this.session.renderState;
        // recreate views
        if (xrViews.length !== this.views.length) {
            this.views.length = 0;
            this.viewer.clearViewport();
            for (let i = 0; i < xrViews.length; i++) {
                const view = this.viewer.createViewport(`xr-${i}`);
                view.camera = new PerspectiveCamera(
                    60,
                    1,
                    renderState.depthNear,
                    renderState.depthFar * this.options.depthScale,
                );
                view.config.effects.__INTERNAL__.Composite.enabled.set(true);
                this.views.push(view);
            }
            this.emit(OnXRViewChanged, this.views);
        }

        for (let i = 0; i < xrViews.length; i++) {
            this.setupViewport(this.views[i], xrViews[i], viewports[i], i);
        }
    }

    private onAnimationFrame = (_time: number, frame: XRFrame) => {
        if (this.initialized) {
            this.raf = this.session.requestAnimationFrame(this.onAnimationFrame);
            const pose = frame.getViewerPose(this.refSpace);
            if (pose) {
                const frameBufferSize = this.renderer.xrFramebufferSize;
                if (
                    this.renderer.xrProxyFramebufferSize.width !== frameBufferSize.width ||
                    this.renderer.xrProxyFramebufferSize.height !== frameBufferSize.height
                ) {
                    this.viewer.resize(frameBufferSize);
                }
                this.updateViewport(pose.views, this.renderer.getViewports(pose));
                this.viewer.forceNextFrameRender = true;
                this.viewer.render();
                this.renderer.render(pose, this.viewer._getEngine().canvasElement);
            }
        }
    };

    private onViewerResize = () => {
        this.syncSize();
    };

    /**
     * Register this animation plugin to the viewer.
     * @param viewer Viewer or IViewerContext
     */
    registerToViewer(viewer: IViewerContext | Viewer) {
        if (viewer instanceof Viewer) {
            this.viewer = viewer;
        } else {
            this.viewer = viewer.viewer;
        }
        this.viewer.registerPlugin(this);
    }

    /**
     * @internal
     */
    unregisterFromViewer() {
        this.viewer?.unregisterPlugin(this);
    }
}

const USE_OFFSCREEN_RENDERER = true;

export interface WebXROptions extends XRPluginOptions {
    session: WebXRSession;
    referenceSpace?: 'local' | 'local-floor' | 'unbounded' | 'bounded-floor' | 'viewer';
    optionalFeatures?: string[];
    requiredFeatures?: string[];
}

export async function initWebXR(options?: WebXROptions): Promise<ExtendedViewerPlugin> {
    const session = options?.session ?? 'immersive-vr';
    const supported = await navigator.xr?.isSessionSupported(session);
    if (!supported) {
        throw new Error(`Request XR session not supported: ${session}`);
    }
    const xrSession = await navigator.xr?.requestSession(session, options);
    if (!xrSession) {
        throw new Error(`Request XR session creation failed: ${session}`);
    }
    const refSpace = await xrSession.requestReferenceSpace(options?.referenceSpace ?? 'local');

    const renderer = USE_OFFSCREEN_RENDERER ? new OffscreenCanvasXRRenderer() : new CanvasXRRenderer();
    try {
        await renderer.initDevice(xrSession, options);
    } catch (error) {
        xrSession.end();
        throw error;
    }
    return new WebXRPlugin(xrSession, refSpace, renderer, options);
}
