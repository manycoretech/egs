import type { Nullable } from '../../utils/Utils';
import { UniformBlockObject } from '../shader/components/UniformBlockObject';
import type { WGLUniformBlockData } from '../webgl/WGLUniformBlock';
import { logger } from '../../utils/Logger';
import { IterableWeakMap } from '../../utils/WeakCollections';

// UBOManager includes create, delete and dispose function, which manages used buffer and stores all UBOs in a private map.
// It also provides function to resource manager for binding UBO and get UBO's parameter in WebGl.
// UBO can save a lot of WebGL API calling and improve quit a lot FPS.
// PS: UBO is only available in WebGL2
export class UBOManager {
    private gl: WebGL2RenderingContext;
    private bindingPoints: Array<Nullable<WebGLBuffer>> = [];
    private UBOMap: IterableWeakMap<UniformBlockObject, WGLUniformBlockData> = new IterableWeakMap();

    private totalByteSize = 0;

    constructor(gl: WebGL2RenderingContext) {
        this.gl = gl;
    }

    getWebGLByteSize() {
        return this.totalByteSize;
    }

    bindUBO(ubo: WebGLBuffer, bindPoint: number) {
        if (this.bindingPoints[bindPoint] !== ubo) {
            this.bindingPoints[bindPoint] = ubo;
            this.gl.bindBufferBase(this.gl.UNIFORM_BUFFER, bindPoint, ubo);
        }
    }

    private _create(provider: UniformBlockObject): WebGLBuffer {
        const gl = this.gl;
        const buffer = gl.createBuffer()!;
        if (buffer === null) {
            logger.webglError('Webgl create buffer failed for UBO');
        }
        gl.bindBuffer(gl.UNIFORM_BUFFER, buffer);
        gl.bufferData(gl.UNIFORM_BUFFER, provider.getUBOBuffer(), gl.STATIC_DRAW);
        return buffer;
    }

    create(provider: UniformBlockObject): WebGLBuffer {
        const ubo = this.UBOMap.get(provider);
        if (ubo === undefined) {
            const newUBO = this._create(provider);
            const cpuBuffer = provider.getUBOBuffer();
            this.totalByteSize += cpuBuffer.byteLength;
            this.UBOMap.set(provider, { buffer: newUBO, version: provider.version, byteSize: cpuBuffer.byteLength });
            return newUBO;
        } else {
            // or maybe we can buffer data sub part?
            if (provider.version !== ubo.version) {
                this.totalByteSize -= ubo.byteSize;
                this.delete(provider);
                return this._create(provider);
            } else {
                return ubo.buffer;
            }
        }
    }

    delete(provider: UniformBlockObject) {
        const block = this.UBOMap.get(provider);
        if (block === undefined) {
            return;
        }
        const buffer = block.buffer;
        if (buffer !== undefined) {
            this.gl.deleteBuffer(buffer);
            this.UBOMap.delete(provider);
        }
    }

    freeGPU(): void {
        this.UBOMap.forEach(buffer => {
            this.gl.deleteBuffer(buffer.buffer);
        });
        this.UBOMap.clear();
        this.bindingPoints = this.bindingPoints.map(_ => null);
        this.totalByteSize = 0;
    }
}
