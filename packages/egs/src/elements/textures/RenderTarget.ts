import { ContentBridge } from '../../ContentAPI';
import type { WebGLTextureUploadCtx, SamplerDescriptor } from './Texture';
import { TextureV2 } from './TextureV2';
import { WebGLPixelFormat } from '../../renderer/webgl/WGLConstants';
import type { WGLRenderAttachment } from '../../renderer/ResourceManager/TextureManager';
import type { TextureViewDimension, TextureFormat, TextureDimension } from './types';
import type { RendererBackend } from '../../renderer/IRenderer';

/**
 * color or depth attachment for render target.
 * Anything affect texture size should be specified at creation, and will be immutable after creation.
 */
export class RenderAttachment extends TextureV2 {
    /**
     * @internal
     */
    readonly isRenderAttachment = true;

    /**
     * @internal
     */
    readonly forceRenderBuffer: boolean = false;

    constructor(
        dimension: TextureDimension, viewDimension: TextureViewDimension,
        format: TextureFormat,
        width: number, height: number, depthOrArrayLayers: number,
        mipmaps: boolean, sampleCount: number, forceRenderBuffer: boolean,
        sampler: SamplerDescriptor,
    ) {
        super(
            dimension, viewDimension, format,
            width, height, depthOrArrayLayers, sampleCount,
            mipmaps, true
        );
        this.forceRenderBuffer = forceRenderBuffer;
        this.samplerDescriptor.copy(sampler);
        ContentBridge.textureCreate(this);
    }

    /**
     * @internal
     */
    protected upload(ctx: WebGLTextureUploadCtx): number {
        const { gl, isWebGL1 } = ctx;

        this.samplerDescriptor.sync_webgl(gl, this.bindableTarget, this.mipmaps, isWebGL1 && !this.isPot);
        this.storageDescriptor.sync_webgl(gl);

        return this.byteSize;
    }

    /**
     * @internal
     */
    attach(gl: WebGL2RenderingContext | WebGLRenderingContext, backend: RendererBackend, frameBuffer: number, attachment: number, data: WGLRenderAttachment, layer: number, level: number) {
        let glAttachment = gl.COLOR_ATTACHMENT0 + attachment;
        if (this.glFormat.external(backend) === WebGLPixelFormat.Depth) {
            glAttachment = gl.DEPTH_ATTACHMENT;
        } else if (this.glFormat.external(backend) === WebGLPixelFormat.DepthStencil) {
            glAttachment = gl.DEPTH_STENCIL_ATTACHMENT;
        }
        const target = this.bindableTarget;
        if (Array.isArray(data)) {
            gl.framebufferRenderbuffer(frameBuffer, glAttachment, gl.RENDERBUFFER, data[layer]);
        } else {
            if (this.isLayeredTexture) {
                (gl as WebGL2RenderingContext).framebufferTextureLayer(frameBuffer, glAttachment, data, level, layer);
            }
            if (target === gl.TEXTURE_CUBE_MAP) {
                gl.framebufferTexture2D(frameBuffer, glAttachment, gl.TEXTURE_CUBE_MAP_POSITIVE_X + layer, data, level);
            } else {
                gl.framebufferTexture2D(frameBuffer, glAttachment, gl.TEXTURE_2D, data, level);
            }
        }
    }
}

export class RenderTarget {
    width: number;
    height: number;
    depthOrArrayLayers: number;
    multiSample: boolean;
    colors: RenderAttachment[] = [];
    depth?: RenderAttachment;
    layer: number = 0;
    level: number = 0;
    drawBuffers?: number[];

    constructor(width: number, height: number, depthOrArrayLayers: number, multiSample: boolean = false) {
        this.width = width;
        this.height = height;
        this.depthOrArrayLayers = depthOrArrayLayers;
        this.multiSample = multiSample;
        ContentBridge.targetCreate(this);
    }

    setSize(width: number, height: number, depthOrArrayLayers: number) {
        const isSync = this.width !== width || this.height !== height || this.depthOrArrayLayers !== depthOrArrayLayers;
        this.width = width;
        this.height = height;
        this.depthOrArrayLayers = depthOrArrayLayers;
        if (isSync) {
            ContentBridge.targetSync(this);
        }
    }

    setAttachments(colors: RenderAttachment[], depth?: RenderAttachment) {
        this.colors = colors;
        this.depth = depth;
        ContentBridge.targetSetAttachments(this, colors, depth);
    }

    setBindInfo(level: number, buffers?: number[]) {
        this.level = level;
        this.drawBuffers = buffers;
        ContentBridge.targetSetBindInfo(this, level, buffers);
    }

    destroy() {
        this.colors.forEach(c => c.destroy());
        this.depth?.destroy();
        ContentBridge.targetDestroy(this);
    }
}
