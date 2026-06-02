import { RenderInfo } from '../../utils/RenderInfo';
import { _Math } from '../../math/Math';
import { ProgramManager } from './ProgramManager';
import { UBOManager } from './UBOManager';
import { BufferManager } from './BufferManager';
import { TextureManager } from './TextureManager';
import { VAOManager } from './VAOManager';
import { UniformBlockObject } from '../shader/components/UniformBlockObject';
import type { WGLBufferData } from '../webgl/WGLBuffer';
import { Capabilities } from '../Capabilities';
import { WGLProgram } from '../webgl/WGLProgram';
import { BufferGeometryBase, BufferAttribute, Material } from '../../..';
import { GeometryAttributeChangedEvent, GeometryDisposeEvent } from '../../elements/geometries/containers/BufferGeometry';
import type { Nullable } from '../../utils/Utils';
import { IterableWeakSet } from '../../utils/WeakCollections';
import { Renderer } from '../Renderer';

export interface ResourceStatistics {
    geometryBufferByteSize: number,
    textureByteSize: number,
    fboByteSize: number,
    uboByteSize: number,
}
// ResourceManager can provide unified management with related resources,
// which include buffer, frame buffer, texture and WebGL program. All of the resources are GPU related.
// The resource manager can keep records of all the objects uses GPU memories, it can provide a smart way
// to create or delete the GPU memories.
// It involves create, update, delete and dispose functions to manage these resources.
export class ResourceManager {
    readonly gl: WebGLRenderingContext | WebGL2RenderingContext;
    private info: RenderInfo;

    readonly bufferManager: BufferManager;
    readonly textureManager: TextureManager;
    readonly programManager: ProgramManager;
    readonly instanceProgramManager: ProgramManager;
    readonly dynamicPrograms: Map<string, WGLProgram> = new Map();
    readonly uboManager?: UBOManager;
    readonly vaoManager?: VAOManager;

    private geometries: IterableWeakSet<BufferGeometryBase>;

    constructor(renderer: Renderer) {
        renderer.renderState.resourceManager = this; // ugly, can not think of a better way

        this.info = renderer.renderInfo;
        this.gl = renderer.gl;
        this.geometries = new IterableWeakSet();

        this.bufferManager = new BufferManager(this.gl);
        this.textureManager = new TextureManager(renderer);
        this.programManager = new ProgramManager(renderer.renderState, this.info);
        this.instanceProgramManager = new ProgramManager(renderer.renderState, this.info);

        if (Capabilities.IS_SUPPORT_VAO) {
            this.vaoManager = new VAOManager(this.gl, renderer.extensions);
        }

        if (Capabilities.IS_WEBGL2) {
            this.uboManager = new UBOManager(this.gl as WebGL2RenderingContext); // todo need constraint type
            this.programManager.uboManager = this.uboManager;
        }
    }

    outputResourceStatistics(): ResourceStatistics {
        return {
            geometryBufferByteSize: this.bufferManager.getWebGLByteSize(),
            textureByteSize: this.textureManager.getWebGLByteSize(),
            fboByteSize: this.textureManager.getInternalWebGLByteSize(),
            uboByteSize: this.uboManager === undefined ? 0 : this.uboManager.getWebGLByteSize(),
        };
    }

    setupGeometry(bufferGeometry: BufferGeometryBase) {
        if (!this.geometries.has(bufferGeometry)) {
            this.geometries.add(bufferGeometry);
            bufferGeometry.once(GeometryDisposeEvent, this.onGeometryDispose);
            bufferGeometry.on(GeometryAttributeChangedEvent, this.onGeometryAttributeChanged);
            this.info.objectInfo.geometries++;
        }

        const index = bufferGeometry.index;
        if (index !== null) {
            this.bufferManager.create(index, this.gl.ELEMENT_ARRAY_BUFFER, bufferGeometry);
        }

        const geometryAttributes = bufferGeometry.getAttributes();
        for (const name in geometryAttributes) {
            this.bufferManager.create(geometryAttributes[name], this.gl.ARRAY_BUFFER, bufferGeometry);
        }
    }

    setupVAO(bufferGeometry: BufferGeometryBase, attributeKey: string) {
        return this.vaoManager!.create(bufferGeometry, attributeKey);
    }

    private onGeometryAttributeChanged = ({ geometry, newValue, oldValue, update }: { geometry: BufferGeometryBase; attributeName: string; newValue: Nullable<BufferAttribute>, oldValue: Nullable<BufferAttribute>, update: boolean }) => {
        if (oldValue) {
            this.bufferManager.delete(oldValue, geometry);
        }
        if (update && newValue) {
            this.bufferManager.create(newValue, this.gl.ARRAY_BUFFER, geometry);
        }
    };

    private onGeometryDispose = (bufferGeometry: BufferGeometryBase) => {
        if (bufferGeometry.index) {
            this.bufferManager.delete(bufferGeometry.index, bufferGeometry);
        }

        const geometryAttributes = bufferGeometry.getAttributes();
        for (const name in geometryAttributes) {
            this.bufferManager.delete(geometryAttributes[name], bufferGeometry);
        }

        if (Capabilities.IS_SUPPORT_VAO) {
            this.vaoManager!.delete(bufferGeometry);
        }
        this.geometries.delete(bufferGeometry);
        this.info.objectInfo.geometries--;

        bufferGeometry.off(GeometryAttributeChangedEvent, this.onGeometryAttributeChanged);
    };

    getWebGLBufferData(attribute: BufferAttribute): WGLBufferData {
        return this.bufferManager.get(attribute)!;
    }

    setupWGLProgram(material: Material, useInstance: boolean) {
        if (useInstance) {
            return this.instanceProgramManager.get(material);
        } else {
            return this.programManager.get(material);
        }
    }

    setupWGLUBOBuffer(provider: UniformBlockObject): WebGLBuffer {
        return this.uboManager!.create(provider);
    }

    freeGPU(): void {
        // clear geometry resources
        this.geometries.forEach((geometry) => {
            geometry.freeGPU();
        });
        this.geometries.clear();

        this.bufferManager.freeGPU();
        this.textureManager.freeGPU();
        this.programManager.freeGPU();
        this.instanceProgramManager.freeGPU();
        this.dynamicPrograms.forEach(p => p.destroy());
        this.dynamicPrograms.clear();

        if (this.vaoManager) {
            this.vaoManager.freeGPU();
        }

        if (this.uboManager) {
            this.uboManager.freeGPU();
        }
    }
}
