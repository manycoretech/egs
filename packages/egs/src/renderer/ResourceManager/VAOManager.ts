import type { BufferGeometryBase } from '../../elements/geometries/containers/BufferGeometry';
import { Capabilities } from '../Capabilities';
import { type WGLExtensions, WebGLExtEnums } from '../webgl/WGLExtensions';
import type { Nullable } from '../../utils/Utils';
import { IterableWeakMap } from '../../utils/WeakCollections';

// VAOManager provides functions to control the use of Vertex Array Object of WebGL/WebGL2.
// VAO is available in WebGL1 with extensions or WebGL2, which means there is a chance that VAO
// will not work if the platform does not support this.
export class VAOManager {
    private gl: WebGLRenderingContext | WebGL2RenderingContext;
    private webglVAOMap: IterableWeakMap<
        BufferGeometryBase,
        Map<string, WebGLVertexArrayObjectOES | WebGLVertexArrayObject>
    >;
    private VAOExtension: Nullable<OES_vertex_array_object> = null;

    constructor(gl: WebGLRenderingContext | WebGL2RenderingContext, extensions: WGLExtensions) {
        this.gl = gl;
        this.webglVAOMap = new IterableWeakMap();
        this.VAOExtension = extensions.get(WebGLExtEnums.OES_vertex_array_object);
    }

    create(bufferGeometry: BufferGeometryBase, attributeKey: string) {
        const extension = Capabilities.IS_WEBGL2 ? this.gl : this.VAOExtension;
        let vaoMap = this.webglVAOMap.get(bufferGeometry);
        if (!vaoMap) {
            vaoMap = new Map();
            this.webglVAOMap.set(bufferGeometry, vaoMap);
        }

        let vao = vaoMap.get(attributeKey);
        let isNewCreated = false;
        if (!vao) {
            (extension as any)[Capabilities.IS_WEBGL2 ? 'bindVertexArray' : 'bindVertexArrayOES'](null);
            vao = (extension as any)[Capabilities.IS_WEBGL2 ? 'createVertexArray' : 'createVertexArrayOES']();
            vaoMap.set(attributeKey, vao!);
            isNewCreated = true;
        }
        (extension as any)[Capabilities.IS_WEBGL2 ? 'bindVertexArray' : 'bindVertexArrayOES'](vao);
        return isNewCreated;
    }

    delete(bufferGeometry: BufferGeometryBase): void {
        const geoVAO = this.webglVAOMap.get(bufferGeometry);
        const extension = Capabilities.IS_WEBGL2 ? this.gl : this.VAOExtension;
        if (geoVAO) {
            const values = Array.from(geoVAO.values());
            for (let i = 0; i < values.length; i++) {
                (extension as any)[Capabilities.IS_WEBGL2 ? 'deleteVertexArray' : 'deleteVertexArrayOES'](values[i]);
            }
            geoVAO.clear();
            this.webglVAOMap.delete(bufferGeometry);
        }
    }

    freeGPU(): void {
        this.webglVAOMap.forEach((_, key) => {
            this.delete(key);
        });
        this.webglVAOMap.clear();
    }
}
