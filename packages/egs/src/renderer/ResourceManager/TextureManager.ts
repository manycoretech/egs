import { type Texture, TextureDisposeEvent, WebGLTextureUploadCtx } from '../../elements/textures/Texture';
import type { WGLState } from '../webgl/WGLState/WGLState';
import { Capabilities } from '../Capabilities';
import { IterableWeakMap } from '../../utils/WeakCollections';
import { TypeAssert } from '../../scene/tools/TypeAssert';
import type { RenderAttachment } from '../../elements/textures/RenderTarget';
import { RendererBackend } from '../IRenderer';
import type { Renderer } from '../Renderer';

interface WGLTextureData {
    webglTexture: WebGLTexture;
    byteSize: number;
}

type RenderBufferAttachment = WebGLRenderbuffer[];

export type WGLRenderAttachment = WebGLTexture | RenderBufferAttachment;

interface WGLAttachmentData {
    attachment: RenderBufferAttachment;
    byteSize: number;
}

// TextureManager manages all types of texture data created by WebGL context.
// It controls the shader and problem in the engine. There are plenty of maps to record all the usage of
// each program.
export class TextureManager {
    private renderer: Renderer;
    private isWebGL1: boolean;

    private webglTextureMap = new IterableWeakMap<Texture, WGLTextureData>();

    private bufferAttachmentMap = new IterableWeakMap<RenderAttachment, WGLAttachmentData>();
    private totalUserByteSize = 0;
    private totalInternalByteSize = 0;

    constructor(renderer: Renderer) {
        this.renderer = renderer;
        this.isWebGL1 = renderer.backend === RendererBackend.WEBGL_JS;
    }

    getWebGLByteSize() {
        return this.totalUserByteSize;
    }

    getInternalWebGLByteSize() {
        return this.totalInternalByteSize;
    }

    get(texture: Texture, glState: WGLState): WGLTextureData {
        let data = this.webglTextureMap.get(texture);
        if (!data) {
            const webglTexture = this.renderer.gl.createTexture()!;
            glState.bindTextureAndActiveForUploading(texture.bindableTarget, webglTexture);
            const byteSize = texture.uploadWebGL(
                new WebGLTextureUploadCtx(
                    this.renderer.gl as WebGL2RenderingContext,
                    this.renderer.backend,
                    this.isWebGL1,
                    Capabilities.MAX_TEXTURE_SIZE,
                    true,
                ),
            );
            data = { webglTexture, byteSize };
            this.webglTextureMap.set(texture, data);
            texture.once(TextureDisposeEvent, this.onTextureDispose);
            if (texture.isInternal) {
                this.totalInternalByteSize += byteSize;
            } else {
                this.totalUserByteSize += byteSize;
                this.renderer.renderInfo.objectInfo.textures++;
            }
        } else if (TypeAssert.isSourceTexture(texture)) {
            glState.bindTextureAndActiveForUploading(texture.bindableTarget, data.webglTexture);
            texture.uploadWebGL(
                new WebGLTextureUploadCtx(
                    this.renderer.gl as WebGL2RenderingContext,
                    this.renderer.backend,
                    this.isWebGL1,
                    Capabilities.MAX_TEXTURE_SIZE,
                    false,
                ),
            );
        }
        return data;
    }

    getAttachment(attachment: RenderAttachment, glState: WGLState): WGLRenderAttachment {
        if (attachment.sampleCount > 1 || attachment.forceRenderBuffer) {
            let data = this.bufferAttachmentMap.get(attachment);
            if (!data) {
                const renderBuffer = this.createRenderBuffer(attachment);
                data = { attachment: renderBuffer, byteSize: attachment.byteSize };
                this.bufferAttachmentMap.set(attachment, data);
                attachment.once(TextureDisposeEvent, this.onAttachmentDispose);
            }
            return data.attachment;
        }

        const texture = this.get(attachment, glState);
        return texture.webglTexture;
    }

    private createRenderBuffer(attachment: RenderAttachment): RenderBufferAttachment {
        const data: RenderBufferAttachment = [];
        for (let i = 0; i < attachment.depthOrArrayLayers; i++) {
            const buffer = this.renderer.gl.createRenderbuffer()!;
            data.push(buffer);
            this.renderer.gl.bindRenderbuffer(this.renderer.gl.RENDERBUFFER, buffer);
            if (attachment.sampleCount > 1 && this.renderer.backend !== RendererBackend.WEBGL_JS) {
                const gl = this.renderer.gl as WebGL2RenderingContext;
                gl.renderbufferStorageMultisample(
                    this.renderer.gl.RENDERBUFFER,
                    4,
                    attachment.glFormat.internal(this.renderer.backend),
                    attachment.width,
                    attachment.height,
                );
            } else {
                this.renderer.gl.renderbufferStorage(
                    this.renderer.gl.RENDERBUFFER,
                    attachment.glFormat.internal(this.renderer.backend),
                    attachment.width,
                    attachment.height,
                );
            }
        }
        this.renderer.gl.bindRenderbuffer(this.renderer.gl.RENDERBUFFER, null);
        return data;
    }

    private onTextureDispose = (texture: Texture) => {
        const data = this.webglTextureMap.get(texture);
        if (!data) {
            return;
        }
        this.renderer.gl.deleteTexture(data.webglTexture);
        this.webglTextureMap.delete(texture);
        if (texture.isInternal) {
            this.totalInternalByteSize -= data.byteSize;
        } else {
            this.totalUserByteSize -= data.byteSize;
            this.renderer.renderInfo.objectInfo.textures--;
        }
    };

    private onAttachmentDispose = (attachment: RenderAttachment) => {
        const data = this.bufferAttachmentMap.get(attachment);
        if (!data) {
            return;
        }
        const buffers = data.attachment;
        for (let i = 0; i < buffers.length; i++) {
            this.renderer.gl.deleteRenderbuffer(buffers[i]);
        }
        this.bufferAttachmentMap.delete(attachment);
        this.totalInternalByteSize -= data.byteSize;
    };

    freeGPU() {
        this.webglTextureMap.forEach((_, texture) => texture.freeGPU());
        this.webglTextureMap.clear();
        this.bufferAttachmentMap.forEach((_, texture) => texture.freeGPU());
        this.bufferAttachmentMap.clear();
        this.totalUserByteSize = 0;
        this.totalInternalByteSize = 0;
    }
}
