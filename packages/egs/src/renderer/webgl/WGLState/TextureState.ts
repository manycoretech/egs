import { WGLCapabilities } from '../WGLCapabilities';
import { WebGLTextureType } from '../WGLConstants';
import { Nullable } from '../../../utils/Utils';
import { logger } from '../../../utils/Logger';

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

    constructor(gl: WebGLRenderingContext | WebGL2RenderingContext) {
        this.gl = gl;
        for (let i = 0; i < WGLCapabilities.MAX_COMBINED_TEXTURE_IMAGE_UNITS; i++) {
            const name = `TEXTURE${i}`;
            this.textureSlotMap[i] = (gl as any)[name];
        }
    }

    public activeTexture(slot: number) {
        if (this.currentTextureSlot !== slot) {
            this.gl.activeTexture(slot);
            this.currentTextureSlot = slot;
        }
    }

    public bindTextureAndActiveForUploading(webglType: WebGLTextureType, webglTexture: WebGLTexture) {
        const lastSlot = this.gl.TEXTURE0 + WGLCapabilities.MAX_COMBINED_TEXTURE_IMAGE_UNITS - 1;
        this.activeTexture(lastSlot);
        this.bindTextureAt(webglType, webglTexture, lastSlot);
    }

    public bindTextureAt(webglType: WebGLTextureType, webglTexture: WebGLTexture, slot: number) {
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

    public resetSlotIndex() {
        this.slot = 0;
    }

    public getFreeSlot(): number {
        const slot = this.slot;
        if (this.slot > WGLCapabilities.MAX_COMBINED_TEXTURE_IMAGE_UNITS) {
            logger.webglError('EGS: Trying to use ' + this.slot + ' texture units while this GPU supports only ' + WGLCapabilities.MAX_TEXTURES);
            return this.slot - 1;
        }
        this.slot++;
        return slot;
    }

}
