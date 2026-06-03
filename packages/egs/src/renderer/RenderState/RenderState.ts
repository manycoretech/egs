
import { logger } from '../../utils/Logger';
import type { BufferGeometryBase } from '../../elements/geometries/containers/BufferGeometry';
import type { Texture } from '../../elements/textures/Texture';
import type { Camera3D } from '../../scene/cameras/Camera3D';
import type { Drawable } from '../../scene/drawables/Drawable';
import { TypeAssert } from '../../scene/tools/TypeAssert';
import type { ResourceManager } from '../ResourceManager/ResourceManager';
import { Capabilities } from '../Capabilities';
import type { WGLProgram } from '../webgl/WGLProgram';
import type { WGLState } from '../webgl/WGLState/WGLState';
import { BuiltInUniforms, BuiltInUniformTypes } from './BuiltInUniforms';
import type { PopMesh } from '../../scene/drawables/PopMesh';
import type { SkinnedMesh } from '../../scene/drawables/SkinnedMesh';
import { WGLCapabilities } from '../webgl/WGLCapabilities';
import { ShaderComponentRegistry } from '../../scene/ShaderComponentRegistry';

const DEFAULT_LOD = new Float32Array([1, 1, 0, 0, 0]);

// RenderState manages the necessary uniforms, attributes for the shader.
// The texture, attributes, VAOs, VBOs all need to use the function in this class to setup
// or update and return corresponding status.
export class RenderState {
    builtUniforms: BuiltInUniforms;
    activeShaderComponentRegistry = new ShaderComponentRegistry(); // a default registry, will set by scene
    resourceManager: ResourceManager;
    state: WGLState;
    readonly gl: WebGLRenderingContext | WebGL2RenderingContext;

    // Global Uniform settings:
    isCameraPositionDirty = true;
    isCameraProjectionDirty = true;
    isCameraViewProjectionDirty = true;
    isViewMatrixDirty = true;
    isModelMatrixDirty = true;
    isNormalMatrixDirty = true;
    isModelViewMatrixDirty = true;

    constructor(gl: WebGLRenderingContext | WebGL2RenderingContext, state: WGLState) {
        this.gl = gl;
        this.state = state;
        this.builtUniforms = new BuiltInUniforms();
    }

    setTexture(texture: Texture, namedSlot?: number): number {
        const slot = this.state.getFreeTextureSlot(namedSlot);
        const data = this.resourceManager.textureManager.get(texture, this.state);
        this.state.bindTextureAt(texture.bindableTarget, data.webglTexture, this.gl.TEXTURE0 + slot);
        return slot;
    }

    setupVBOs(bufferGeometry: BufferGeometryBase, program: WGLProgram, needUpdateAttribute?: string[], updateIndex: boolean = true): void {
        const programAttributes = program.getAttributesInfo();
        for (const name of (needUpdateAttribute ?? Object.keys(programAttributes))) {
            const programAttribute = programAttributes[name];
            if (programAttribute === -1) {
                continue; // gl_InstanceID, gl_VertexID
            }
            const geometryAttribute = bufferGeometry.getAttributes()[name];
            if (geometryAttribute === undefined) {
                logger.warn(`Shader need attributes <${name}>, but cant find on geometry`);
                continue;
            }
            const { gl, resourceManager, state } = this;
            const { normalized, itemSize: size } = geometryAttribute;
            const { buffer, type } = resourceManager.getWebGLBufferData(geometryAttribute);

            if (TypeAssert.isInstancedBufferAttribute(geometryAttribute)) {
                state.attributeState.enableAttributeAndDivisor(programAttribute, geometryAttribute.meshPerAttribute);
            } else {
                state.attributeState.enableAttribute(programAttribute);
            }
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            if (type !== gl.FLOAT && WGLCapabilities.IS_WEBGL2) {
                (this.gl as WebGL2RenderingContext).vertexAttribIPointer(programAttribute, size, type, 0, 0);
            } else {
                if (type !== gl.FLOAT) {
                    logger.webglError('attribute invalid.');
                }
                gl.vertexAttribPointer(programAttribute, size, type, normalized, 0, 0);
            }
        }
        const index = bufferGeometry.index;
        if (index && updateIndex) {
            const indexBufferData = this.resourceManager.getWebGLBufferData(index);
            if (indexBufferData) {
                this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, indexBufferData.buffer);
            }
        }
    }

    setupVertexAttributes(bufferGeometry: BufferGeometryBase, program: WGLProgram) {
        if (Capabilities.IS_SUPPORT_VAO) {
            if (this.resourceManager.setupVAO(bufferGeometry, program.attributeKey)) {
                this.resourceManager.setupGeometry(bufferGeometry);
                this.setupVBOs(bufferGeometry, program);
            } else {
                const needUpdateAttribute: string[] = [];
                const bindMap = bufferGeometry._attributeBindMap;
                const programAttributes = program.getAttributesInfo();
                const geometryAttributes = bufferGeometry.getAttributes();
                for (const name of Object.keys(programAttributes)) {
                    const geometryAttribute = geometryAttributes[name];
                    if (geometryAttribute && (bindMap[name] !== geometryAttribute.uuid)) {
                        needUpdateAttribute.push(name);
                        bindMap[name] = geometryAttribute.uuid;
                    }
                }
                let updateIndex = false;
                if (bufferGeometry.index && (bindMap.index !== bufferGeometry.index.uuid)) {
                    updateIndex = true;
                    bindMap.index = bufferGeometry.index.uuid;
                }
                this.resourceManager.setupGeometry(bufferGeometry);
                this.setupVBOs(bufferGeometry, program, needUpdateAttribute, updateIndex);
            }
        } else {
            this.state.attributeState.initAttributes();
            this.resourceManager.setupGeometry(bufferGeometry);
            this.setupVBOs(bufferGeometry, program);
            this.state.attributeState.disableUnusedAttributes();
        }
    }

    // this.resourceManger.resetFrame
    updateGlobalUniforms(program: WGLProgram) {
        const { currentDrawable, currentCamera } = this.builtUniforms;
        const globalUniforms = program.shaderInfo.globalUniforms;
        const length = globalUniforms.length;
        for (let i = 0; i < length; i++) {
            const uni = globalUniforms[i];
            switch (uni) {
                case BuiltInUniformTypes.resolution:
                    program.setUniform('resolution', this.builtUniforms.resolution);
                    break;
                case BuiltInUniformTypes.cameraPosition:
                    if (this.isCameraPositionDirty) {
                        program.setUniform('cameraPosition', this.builtUniforms.cameraPosition);
                        this.isCameraPositionDirty = false;
                    }
                    break;
                case BuiltInUniformTypes.normalMatrix:
                    if (this.isNormalMatrixDirty) {
                        program.setUniform('normalMatrix', currentDrawable.normalMatrix);
                        this.isNormalMatrixDirty = false;
                    }
                    break;
                case BuiltInUniformTypes.viewMatrix:
                    if (this.isViewMatrixDirty) {
                        program.setUniform('viewMatrix', currentCamera.matrixWorldInverse);
                        this.isViewMatrixDirty = false;
                    }
                    break;
                case BuiltInUniformTypes.modelMatrix:
                    if (this.isModelMatrixDirty) {
                        program.setUniform('modelMatrix', currentDrawable.matrixWorld);
                        this.isModelMatrixDirty = false;
                    }
                    break;
                case BuiltInUniformTypes.modelViewMatrix:
                    if (this.isModelViewMatrixDirty) {
                        program.setUniform('modelViewMatrix', currentDrawable.modelViewMatrix);
                        this.isModelViewMatrixDirty = false;
                    }
                    break;
                case BuiltInUniformTypes.projectionMatrix:
                    if (this.isCameraProjectionDirty) {
                        program.setUniform('projectionMatrix', currentCamera.projectionMatrix);
                        this.isCameraProjectionDirty = false;
                    }
                    break;
                case BuiltInUniformTypes.lodInfo: {
                    program.setUniform('popLODInfo[0]', (currentDrawable as PopMesh).lodInfo ?? DEFAULT_LOD);
                    break;
                }
                case BuiltInUniformTypes.boneTexture: {
                    program.setTexture2D('boneTexture', (currentDrawable as SkinnedMesh).boneMatricesTexture!);
                    break;
                }
                case BuiltInUniformTypes.boneTextureSize: {
                    program.setUniform('boneTextureSize', (currentDrawable as SkinnedMesh).boneTextureSize);
                    break;
                }
                default:
                    break;
            }
        }
    }

    updateDrawable(drawable: Drawable) {
        if (drawable !== this.builtUniforms.currentDrawable) {
            this.isModelMatrixDirty = true;
            this.isNormalMatrixDirty = true;
            this.isModelViewMatrixDirty = true;
            this.builtUniforms.currentDrawable = drawable;
        }
    }

    updateCamera(camera: Camera3D) {
        if (camera !== this.builtUniforms.currentCamera) {
            this.isCameraPositionDirty = true;
            this.isCameraProjectionDirty = true;
            this.isCameraViewProjectionDirty = true;
            this.isNormalMatrixDirty = true;
            this.isViewMatrixDirty = true;
            this.isModelViewMatrixDirty = true;
            this.builtUniforms.currentCamera = camera;
            if (TypeAssert.isCamera3D(camera)) {
                this.builtUniforms.cameraPosition.setFromMatrixPosition(camera.matrixWorld);
            }
        }
    }

    // this.resourceManger.resetFrame
    markAllDirty() {
        this.isCameraPositionDirty = true;
        this.isCameraProjectionDirty = true;
        this.isCameraViewProjectionDirty = true;
        this.isModelMatrixDirty = true;
        this.isNormalMatrixDirty = true;
        this.isViewMatrixDirty = true;
        this.isModelViewMatrixDirty = true;
    }

    // this.resourceManger.resetFrame
    updateResolution(width: number, height: number) {
        this.builtUniforms.resolution.set(width, height);
    }

    // this.resourceManger.resetFrame
    resetFrame() {
        this.markAllDirty();
        this.builtUniforms.reset();
    }
}
