import type { BufferAttribute } from '../../elements/attributes/BufferAttribute.js';
import { TypeAssert } from '../../scene/tools/TypeAssert.js';
import type { BufferGeometryBase } from '../../elements/geometries/containers/BufferGeometry.js';
import { logger } from '../../utils/Logger.js';

// Data type created by WGlBuffer
export interface WGLBufferData {
    buffer: WebGLBuffer;
    type: number;
    bytesPerElement: number;
    version: number;
    referencesBy: Set<BufferGeometryBase>;
    byteSize: number;
}

// WGLBuffer has two static functions,create and update data of WebGLBuffer.
// Both functions will bind and upload data to WGLBufferData.
// If a buffer is created, a WebGLBuffer object with information of data type and bytes would be returned.
// This class instances will be manged by BufferManager.
export class WGLBuffer {
    static createWGLBufferData(
        gl: WebGLRenderingContext | WebGL2RenderingContext,
        attribute: BufferAttribute,
        bufferType: number,
    ): WGLBufferData {
        const array = attribute.array;
        const usage = attribute.dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW;

        const buffer = gl.createBuffer()!;
        if (buffer === null) {
            logger.webglError('webgl buffer create failed');
        }

        gl.bindBuffer(bufferType, buffer);
        gl.bufferData(bufferType, array, usage);

        if (TypeAssert.isBufferAttribute(attribute)) {
            attribute.onUploadCallback();
            if (attribute.removeDataAfterUpload) {
                attribute.destroy();
            }
        }

        let type: number = gl.FLOAT;
        if (array instanceof Float32Array) {
            type = gl.FLOAT;
        } else if (array instanceof Float64Array) {
            logger.unsupported('WGLBuffer: Unsupported data buffer format: Float64Array.');
        } else if (array instanceof Uint16Array) {
            type = gl.UNSIGNED_SHORT;
        } else if (array instanceof Int16Array) {
            type = gl.SHORT;
        } else if (array instanceof Uint32Array) {
            type = gl.UNSIGNED_INT;
        } else if (array instanceof Int32Array) {
            type = gl.INT;
        } else if (array instanceof Int8Array) {
            type = gl.BYTE;
        } else if (array instanceof Uint8Array) {
            type = gl.UNSIGNED_BYTE;
        }

        return {
            buffer,
            type,
            bytesPerElement: array.BYTES_PER_ELEMENT,
            version: attribute.version,
            referencesBy: new Set(),
            byteSize: array.byteLength,
        };
    }

    static updateWGLBufferData(
        gl: WebGLRenderingContext | WebGL2RenderingContext,
        buffer: WebGLBuffer,
        attribute: BufferAttribute,
        bufferType: number,
    ): void {
        const array = attribute.array;
        const updateRange = attribute.updateRange;
        gl.bindBuffer(bufferType, buffer);

        if (attribute.dynamic === false) {
            gl.bufferData(bufferType, array, gl.STATIC_DRAW);
        } else if (updateRange.count === -1) {
            // Not using update ranges
            gl.bufferSubData(bufferType, 0, array);
        } else if (updateRange.count === 0) {
            logger.invalidInput(
                'Dynamic EGS.BufferAttribute marked as needsUpdate but updateRange.count is 0, ensure you are using set methods or updating manually.',
            );
        } else {
            gl.bufferSubData(
                bufferType,
                updateRange.offset * array.BYTES_PER_ELEMENT,
                array.subarray(updateRange.offset, updateRange.offset + updateRange.count),
            );
            updateRange.count = -1; // reset range
        }
    }
}
