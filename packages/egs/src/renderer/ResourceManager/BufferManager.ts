import type { BufferAttribute } from '../../elements/attributes/BufferAttribute.js';
import { type WGLBufferData, WGLBuffer } from '../webgl/WGLBuffer.js';
import type { BufferGeometryBase } from '../../elements/geometries/containers/BufferGeometry.js';
import { logger } from '../../utils/Logger.js';
import { IterableWeakMap } from '../../utils/WeakCollections.js';

// BufferManager manages the ues of buffers, it maintains the GPU buffers' creating, updating and
// deleting, also there is a map to keep record of the buffers which are been shared by to objects. So any buffer will
// only been deleted when necessary.
export class BufferManager {
    private webglBufferMap: IterableWeakMap<BufferAttribute, WGLBufferData>;
    private gl: WebGLRenderingContext | WebGL2RenderingContext;
    private totalByteSize = 0;

    constructor(gl: WebGLRenderingContext | WebGL2RenderingContext) {
        this.webglBufferMap = new IterableWeakMap();
        this.gl = gl;
    }

    getWebGLByteSize() {
        return this.totalByteSize;
    }

    get(attribute: BufferAttribute): WGLBufferData | undefined {
        return this.webglBufferMap.get(attribute);
    }

    delete(attribute: BufferAttribute, bufferGeometry: BufferGeometryBase): void {
        const data = this.webglBufferMap.get(attribute);
        if (!data) {
            return;
        }
        if (data.referencesBy.has(bufferGeometry)) {
            data.referencesBy.delete(bufferGeometry);
        } else {
            logger.unreachable('Resource Manager: webgl buffer can not be located!');
        }

        if (data.referencesBy.size === 0) {
            this.totalByteSize -= data.byteSize;
            this.gl.deleteBuffer(data.buffer);
            this.webglBufferMap.delete(attribute);
        }
    }

    create(attribute: BufferAttribute, bufferType: number, bufferGeometry: BufferGeometryBase): void {
        let data = this.webglBufferMap.get(attribute);

        if (data === undefined) {
            data = WGLBuffer.createWGLBufferData(this.gl, attribute, bufferType);
            this.totalByteSize += data.byteSize;
            this.webglBufferMap.set(attribute, data);
        } else if (data.version < attribute.version) {
            WGLBuffer.updateWGLBufferData(this.gl, data.buffer, attribute, bufferType);
            data.version = attribute.version;
        }
        if (!data.referencesBy.has(bufferGeometry)) {
            data.referencesBy.add(bufferGeometry);
        }
    }

    freeGPU(): void {
        this.webglBufferMap.forEach(value => {
            this.gl.deleteBuffer(value.buffer);
        });
        this.webglBufferMap.clear();
        this.totalByteSize = 0;
    }
}
