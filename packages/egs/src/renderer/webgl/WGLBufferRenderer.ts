import { WGLExtensions, WebGLExtEnums } from './WGLExtensions';
import { RenderInfo, ObjectStatsInfo } from '../../utils/RenderInfo';
import { WGLCapabilities } from './WGLCapabilities';
import { Drawable } from '../../scene/drawables/Drawable';
import { InstancedBufferGeometry } from '../../elements/geometries/containers/InstancedBufferGeometry';
import { logger } from '../../utils/Logger';
import { Nullable } from '../../utils/Utils';

// WGLBufferRenderer provides functions to control the method of drawing and drawing primitives without indices.
// This also provides a function to draw instanced BufferGeometryBase.
export class WGLBufferRenderer {
    private gl: WebGLRenderingContext | WebGL2RenderingContext;
    private mode: number;
    private infoRender: ObjectStatsInfo;
    private instanceExtension: Nullable<ANGLE_instanced_arrays>;

    constructor(gl: WebGLRenderingContext | WebGL2RenderingContext, renderInfo: RenderInfo, extensions: WGLExtensions) {
        this.gl = gl;
        this.mode = gl.TRIANGLES;
        this.infoRender = renderInfo.objectInfo;

        if (!WGLCapabilities.IS_WEBGL2) {
            this.instanceExtension = extensions.get(WebGLExtEnums.ANGLE_instanced_arrays);
        }
    }

    // To set the type primitive to render
    setMode(value: number): void {
        this.mode = value;
    }

    // Controls the starting index and count of primitives' array for drawing. Record rendering information.
    render(object: Drawable, start: number, count: number): void {
        this.gl.drawArrays(this.mode, start, count);

        this.infoRender.addDrawcall(object);
        this.infoRender.vertices += count;

        if (this.mode === this.gl.TRIANGLES) {
            this.infoRender.faces += count / 3;
        }
    }

    // Controls the starting index and count of primitives' array for rendering instances, it will be used when
    // instance rendering is available.
    renderInstances(object: Drawable, geometry: InstancedBufferGeometry, start: number, count: number): void {
        if (WGLCapabilities.IS_WEBGL2) {
            (this.gl as WebGL2RenderingContext).drawArraysInstanced(this.mode, start, count, geometry.instancedCount);
        } else {
            if (this.instanceExtension === null || this.instanceExtension === undefined) {
                logger.unsupported('WGLIndexedBufferRenderer: using InstancedBufferGeometry but hardware does not support extension ANGLE_instanced_arrays.');
                return;
            }
            this.instanceExtension.drawArraysInstancedANGLE(this.mode, start, count, geometry.instancedCount);
        }

        this.infoRender.addDrawcall(object);
        this.infoRender.vertices += count * geometry.instancedCount;

        if (this.mode === this.gl.TRIANGLES) {
            this.infoRender.faces += geometry.instancedCount * count / 3;
        }
    }
}
