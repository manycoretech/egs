import type { WebGLLimits } from '../WGLCapabilities.js';
import type { WebGLTextureType } from '../WGLConstants.js';
import type { Nullable } from '../../../utils/Utils.js';
import { logger } from '../../../utils/Logger.js';

interface TextureBindInfo {
    type?: WebGLTextureType;
    texture?: WebGLTexture;
}

export class TextureState {
    readonly gl: WebGLRenderingContext | WebGL2RenderingContext;
    private currentTextureSlot: Nullable<number> = null;
    private currentBindTextures: TextureBindInfo[] = [];
    private slot = 0;
    private textureSlotMap: number[] = [];
    private limits: WebGLLimits;

    constructor(gl: WebGLRenderingContext | WebGL2RenderingContext, limits: WebGLLimits) {
        this.gl = gl;
        this.limits = limits;
        for (let i = 0; i < limits.maxTextureSlots; i++) {
            const name = `TEXTURE${i}`;
            this.textureSlotMap[i] = (gl as any)[name];
        }
    }

    activeTexture(slot: number) {
        if (this.currentTextureSlot !== slot) {
            this.gl.activeTexture(slot);
            this.currentTextureSlot = slot;
        }
    }

    bindTextureAndActiveForUploading(webglType: WebGLTextureType, webglTexture: WebGLTexture) {
        const lastSlot = this.gl.TEXTURE0 + this.limits.maxTextureSlots - 1;
        this.activeTexture(lastSlot);
        this.bindTextureAt(webglType, webglTexture, lastSlot);
    }

    bindTextureAt(webglType: WebGLTextureType, webglTexture: WebGLTexture, slot: number) {
        let boundTexture = this.currentBindTextures[slot];
        if (boundTexture === undefined) {
            boundTexture = { type: undefined, texture: undefined };
            this.currentBindTextures[slot] = boundTexture;
        }
        if (boundTexture.type !== webglType || boundTexture.texture !== webglTexture) {
            this.activeTexture(slot);
            this.gl.bindTexture(webglType, webglTexture);
            boundTexture.type = webglType;
            boundTexture.texture = webglTexture;
        }
    }

    resetSlotIndex() {
        this.slot = 0;
    }

    getFreeSlot(): number {
        const slot = this.slot;
        if (this.slot > this.limits.maxTextureSlots) {
            logger.webglError(
                'EGS: Trying to use ' +
                    this.slot +
                    ' texture units while this GPU supports only ' +
                    this.limits.maxTextureSlots,
            );
            return this.slot - 1;
        }
        this.slot++;
        return slot;
    }
}
