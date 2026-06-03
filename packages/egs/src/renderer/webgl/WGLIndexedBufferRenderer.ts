import { WGLCapabilities } from './WGLCapabilities';
import { type WGLExtensions, WebGLExtEnums } from './WGLExtensions';
import type { RenderInfo, ObjectStatsInfo } from '../../utils/RenderInfo';
import type { Drawable } from '../../scene/drawables/Drawable';
import type { InstancedBufferGeometry } from '../../elements/geometries/containers/InstancedBufferGeometry';
import type { WGLBufferData } from './WGLBuffer';
import { logger } from '../../utils/Logger';
import type { Nullable } from '../../utils/Utils';

// WGLBufferRenderer provides functions to control the method of drawing and drawing primitives with index buffer.
// This also provides a function to draw instanced BufferGeometryBase.
export class WGLIndexedBufferRenderer {
    private gl: WebGLRenderingContext | WebGL2RenderingContext;
    private mode: number;
    private type: number;

    private bytesPerElement = 1;
    private infoRender: ObjectStatsInfo;
    private instanceExtension: Nullable<ANGLE_instanced_arrays>;

    constructor(gl: WebGLRenderingContext | WebGL2RenderingContext, renderInfo: RenderInfo, extensions: WGLExtensions) {
        this.gl = gl;
        this.mode = gl.TRIANGLES;
        this.type = gl.FLOAT;
        this.infoRender = renderInfo.objectInfo;

        if (!WGLCapabilities.IS_WEBGL2) {
            this.instanceExtension = extensions.get(WebGLExtEnums.ANGLE_instanced_arrays);
        }
    }

    setMode(value: number): void {
        this.mode = value;
    }

    setIndex(value: WGLBufferData): void {
        this.type = value.type;
        this.bytesPerElement = value.bytesPerElement;
    }

    render(object: Drawable, start: number, count: number): void {
        this.gl.drawElements(this.mode, count, this.type, start * this.bytesPerElement);
        this.infoRender.addDrawcall(object);
        this.infoRender.vertices += count;
        if (this.mode === this.gl.TRIANGLES) {
            this.infoRender.faces += count / 3;
        }
    }

    renderInstances(object: Drawable, geometry: InstancedBufferGeometry, start: number, count: number): void {
        if (WGLCapabilities.IS_WEBGL2) {
            (this.gl as WebGL2RenderingContext).drawElementsInstanced(this.mode, count, this.type, start * this.bytesPerElement, geometry.instancedCount);
        } else {
            if (this.instanceExtension === null || this.instanceExtension === undefined) {
                logger.unsupported('WGLIndexedBufferRenderer: using InstancedBufferGeometry but hardware does not support extension ANGLE_instanced_arrays.');
                return;
            }
            this.instanceExtension.drawElementsInstancedANGLE(this.mode, count, this.type, start * this.bytesPerElement, geometry.instancedCount);
        }
        this.infoRender.addDrawcall(object);
        this.infoRender.vertices += count * geometry.instancedCount;

        if (this.mode === this.gl.TRIANGLES) {
            this.infoRender.faces += geometry.instancedCount * count / 3;
        }
    }
}
