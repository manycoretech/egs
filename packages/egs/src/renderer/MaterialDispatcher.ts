import { Renderer } from './Renderer';
import { Material } from '../elements/materials/Material';
import { WGLProgram } from './webgl/WGLProgram';
import { logger } from '../utils/Logger';
import { BufferGeometryBase } from '../elements/geometries/containers/BufferGeometry';
import { Drawable } from '../scene/drawables/Drawable';
import { TypeAssert } from '../scene/tools/TypeAssert';
import { Capabilities } from './Capabilities';
import { ShaderBuilder, ShaderInjectionTypes } from './shader/builders/ShaderBuilder';
import { Nullable, singleton } from '../utils/Utils';
import { PipelineContentBridge } from '../fx/PipelineAPI';
import { BaseElement } from '../utils/ElementBase';
import { Blending } from '../utils/Constants';
import { DeferredMaterial } from '../elements/materials/base';
import { ShaderBlockPool } from './shader/builders/ShaderBlockPool';
import type { ShaderComponentRegistry } from '../scene/ShaderComponentRegistry';

export function checkInstance(object: Drawable, geometry: BufferGeometryBase): boolean {
    const isInstance = TypeAssert.isInstanceMesh(object);
    if (isInstance && !TypeAssert.isInstancedBufferGeometry(geometry)) {
        logger.invalidInput('Should use EGS.InstancedBufferGeometry in InstanceRendering.');
    }
    if (TypeAssert.isInstancedBufferGeometry(geometry) && (!Capabilities.IS_SUPPORT_INSTANCE)) {
        logger.unsupported('Using EGS.InstancedBufferGeometry but hardware does not support instance rendering.');
    }
    return isInstance;
}

export abstract class MaterialDispatcher extends BaseElement {
    constructor(skip?: boolean) {
        super();
        if (!skip) {
            PipelineContentBridge.materialDispatcherCreate(this);
        }
    }

    destroy() {
        PipelineContentBridge.materialDispatcherDestroy(this);
        super.destroy();
    }

    update() {
        PipelineContentBridge.materialDispatcherUpdate(this);
    }

    abstract className(): string;
    abstract dispatch(renderer: Renderer, geometry: BufferGeometryBase, material: Material, object: Drawable): Nullable<WGLProgram>;
}

const DEFAULT = singleton(() => new DefaultMaterialDispatcher());
export class DefaultMaterialDispatcher extends MaterialDispatcher {
    static get DEFAULT() {
        return DEFAULT();
    }

    className() {
        return 'DefaultMaterialDispatcher';
    }

    setMaterialState(renderer: Renderer, material: Material, drawable: Drawable) {
        renderer.wglState.setMaterial(material, drawable.frontFaceCW);
    }

    dispatch(renderer: Renderer, geometry: BufferGeometryBase, material: Material, drawable: Drawable): Nullable<WGLProgram> {
        const isInstance = checkInstance(drawable, geometry);
        material.refreshInstanceInBuilding(isInstance);
        this.setMaterialState(renderer, material, drawable);
        renderer.wglState.resetTextureSlotIndex();

        const program = renderer.resourceManager.setupWGLProgram(material, isInstance);
        const programChanged = renderer.wglState.useProgram(program);
        if (programChanged) {
            renderer.currentWGLProgram = program;
            renderer.renderInfo.refreshProgramCount++;
            renderer.renderState.markAllDirty();
        }

        if (material.onBeforeRender) {
            material.onBeforeRender(renderer);
        }

        renderer.renderState.updateGlobalUniforms(program);
        const materialChanged = renderer.lastUsedMaterial !== material;
        if (programChanged || materialChanged) {
            material.updateUniforms(program, renderer.renderState.activeShaderComponentRegistry);
            renderer.lastUsedMaterial = material;
        }

        return program;
    }
}

export abstract class ShapeExtractableDispatcher extends MaterialDispatcher {
    abstract dispatchKey(r: ShaderComponentRegistry): string;

    abstract updateUniforms(p: WGLProgram, reg: ShaderComponentRegistry, origin: Material): void;

    abstract extendShaderShading(b: ShaderBuilder, reg: ShaderComponentRegistry, origin: Material): void;

    preExit(_: Material) {
        return false;
    }

    setState(renderer: Renderer, material: Material, drawable: Drawable) {
        renderer.wglState.setMaterial(material, drawable.frontFaceCW);
    }

    createBuilder(): ShaderBuilder {
        return new ShaderBuilder();
    }

    customKey(origin: Material, registry: ShaderComponentRegistry, isInstance: boolean): string {
        return origin.getShapeKey(registry) + this.dispatchKey(registry) + (isInstance ? '0' : '1');
    }

    createShader(r: ShaderComponentRegistry, m: Material): ShaderBuilder {
        const builder = this.createBuilder();
        m.extendShaderShape(builder, r);
        m.getComponents().forEach(c => c.extendShaderShape(builder));
        this.extendShaderShading(builder, r, m);
        return builder;
    }

    dispatch(renderer: Renderer, geometry: BufferGeometryBase, material: Material, drawable: Drawable): Nullable<WGLProgram> {
        if (this.preExit(material)) {
            return null;
        }
        const isInstance = checkInstance(drawable, geometry);
        material.refreshInstanceInBuilding(isInstance);

        this.setState(renderer, material, drawable);

        const programCache = renderer.resourceManager.dynamicPrograms;
        const registry = renderer.renderState.activeShaderComponentRegistry;
        const shaderKey = this.customKey(material, registry, isInstance);
        let program = programCache.get(shaderKey);
        if (program === undefined) {
            try {
                program = new WGLProgram(renderer.renderState, this.createShader(registry, material).build(), null, shaderKey);
            } catch (error) {
                logger.unsupported('cant create shader in dispatcher');
                logger.unsupported(error);
            }
            if (!program) {
                return null;
            }
            programCache.set(shaderKey, program);
        }

        renderer.wglState.resetTextureSlotIndex();
        const programChanged = renderer.wglState.useProgram(program);
        renderer.currentWGLProgram = program;

        if (programChanged) {
            renderer.renderInfo.refreshProgramCount++;
            renderer.renderState.markAllDirty();
        }

        if (material.onBeforeRender !== undefined) {
            material.onBeforeRender(renderer);
        }

        renderer.renderState.updateGlobalUniforms(program);
        material.updateShapeUniforms(program, registry);
        const components = material.getComponents();
        for (let i = 0; i < components.length; i++) {
            const component = components[i];
            if (component.updateShapeUniforms) {
                component.updateShapeUniforms(program);
            }
        }
        this.updateUniforms(program, registry, material);

        renderer.lastUsedMaterial = material;

        return program;
    }
}

export class DeferredDispatcher extends ShapeExtractableDispatcher {
    forceOpaque = false;
    decodeSrgb = false;

    className() {
        return 'DeferredDispatcher';
    }

    dispatchKey(): string {
        return 'deferred';
    }

    customKey(origin: Material, registry: ShaderComponentRegistry, isInstance: boolean): string {
        return origin.generateShaderKey(registry) + this.dispatchKey() + (isInstance ? '0' : '1')
            + this.decodeSrgb;
    }

    preExit(m: Material) {
        return !TypeAssert.isDeferredMaterial(m);
    }

    updateUniforms(p: WGLProgram, _: ShaderComponentRegistry, origin: DeferredMaterial) {
        // components uniform is updated in updateDeferredUniform
        origin.updateDeferredUniform(p);
    }

    setState(renderer: Renderer, material: Material, drawable: Drawable) {
        renderer.wglState.setMaterial(material, drawable.frontFaceCW);
        if (this.forceOpaque) {
            renderer.wglState.setBlending(Blending.NoBlending);
        }
    }

    extendShaderShading(b: ShaderBuilder, reg: ShaderComponentRegistry, origin: Material) {
        if (TypeAssert.isDeferredMaterial(origin)) {
            b.addNewFragOutputChannel('fragOut1');
            b.addNewFragOutputChannel('fragOut2');
            origin.extendEncodeDeferred(b);
            if (this.decodeSrgb) {
                b.addFragment(ShaderBlockPool.ColorTransferFunctions);
                b.inject(ShaderInjectionTypes.frag_any, `
                fragOut1 = srgbToLinear(fragOut1);
            `);
            }
        } else {
            origin.extendShaderShading(b, reg);
        }

        // the base class shape extractor only build component shape, but in deferred mode, we also require shading
        origin.getComponents().forEach(c => c.extendShaderShading(b));
    }

    dispatch(renderer: Renderer, geometry: BufferGeometryBase, material: Material, drawable: Drawable): Nullable<WGLProgram> {
        renderer.renderState.activeShaderComponentRegistry.isDeferMode = true;
        const p = super.dispatch(renderer, geometry, material, drawable);
        renderer.renderState.activeShaderComponentRegistry.isDeferMode = false;
        return p;
    }
}

export class DynamicForwardLightsDispatcher extends DefaultMaterialDispatcher {
    className() {
        return 'DynamicForwardLightsDispatcher';
    }

    dispatchKey(): string {
        return 'DynamicForwardLightsDispatcher';
    }

    customKey(origin: Material, registry: ShaderComponentRegistry, isInstance: boolean): string {
        return origin.generateShaderKey(registry) + this.dispatchKey() + (isInstance ? '0' : '1');
    }

    dispatch(renderer: Renderer, geometry: BufferGeometryBase, material: Material, drawable: Drawable): Nullable<WGLProgram> {
        const registry = renderer.renderState.activeShaderComponentRegistry;

        // Prepare specific lights for transparent MeshPhongMaterial.
        if (material.transparent && registry.dynamicForwardLight.lights) {
            registry.dynamicForwardLight.dirtyKey = Math.random();
            registry.dynamicForwardLight.collectDynamicForwardLightsByDrawable(drawable);
        }

        const isInstance = checkInstance(drawable, geometry);
        material.refreshInstanceInBuilding(isInstance);
        renderer.wglState.setMaterial(material, drawable.frontFaceCW);

        const programCache = renderer.resourceManager.dynamicPrograms;
        const shaderKey = this.customKey(material, registry, isInstance);
        let program = programCache.get(shaderKey);
        if (program === undefined) {
            try {
                program = new WGLProgram(renderer.renderState, material.createShader(registry), null, shaderKey);
            } catch (error) {
                logger.unsupported('cant create shader in dispatcher');
                logger.unsupported(error);
            }
            if (!program) {
                return null;
            }
            programCache.set(shaderKey, program);
        }

        renderer.wglState.resetTextureSlotIndex();
        const programChanged = renderer.wglState.useProgram(program);
        renderer.currentWGLProgram = program;

        if (programChanged) {
            renderer.renderInfo.refreshProgramCount++;
            renderer.renderState.markAllDirty();
        }

        if (material.onBeforeRender !== undefined) {
            material.onBeforeRender(renderer);
        }

        renderer.renderState.updateGlobalUniforms(program);
        material.updateUniforms(program, renderer.renderState.activeShaderComponentRegistry);
        renderer.lastUsedMaterial = material;

        return program;
    }
}

export class MaterialShadingWithDynamicShapeDispatcher<M extends Material> extends ShapeExtractableDispatcher {
    material: M;

    constructor(material: M) {
        super(true);
        this.material = material;
        PipelineContentBridge.materialDispatcherCreate(this);
    }

    className() {
        return 'MaterialShadingWithDynamicShapeDispatcher';
    }

    dispatchKey(r: ShaderComponentRegistry): string {
        return this.material.getShaderKey(r);
    }

    updateUniforms(p: WGLProgram, reg: ShaderComponentRegistry, _origin: Material) {
        this.material.updateShadingUniforms(p, reg);
    }

    extendShaderShading(b: ShaderBuilder, reg: ShaderComponentRegistry, _origin: Material) {
        this.material.extendShaderShading(b, reg);
    }

    setState(renderer: Renderer, m: Material, drawable: Drawable) {
        this.material.side = m.side; // always sync origin material's side
        this.material.useInstance = m.useInstance;
        this.material.polygonOffset = m.polygonOffset;
        this.material.polygonOffsetFactor = m.polygonOffsetFactor;
        this.material.polygonOffsetUnits = m.polygonOffsetUnits;
        renderer.wglState.setMaterial(this.material, drawable.frontFaceCW);
    }
}
