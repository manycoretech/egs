import { type IRenderer, RendererBackend } from '../../renderer/IRenderer.js';
import { OrthographicCamera } from '../cameras/OrthographicCamera.js';
import { Mesh } from '../drawables/Mesh.js';
import type { Renderable } from './IRenderable.js';
import type { Material } from '../../elements/materials/Material.js';
import {
    PipelineContentBridge,
    PipelineContentAPIForRenderingAndFilteringEnabled,
    ShadowMode,
} from '../../fx/PipelineAPI.js';
import type { DeferredLightBase } from '../../fx/plugins/Deferred.js';
import { FullScreenTriangleBufferGeometry } from '../../elements/geometries/builder/Triangle.js';
import type { BufferGeometry } from '../../elements/geometries/containers/BufferGeometry.js';
import type { Scene3D } from '../Scene3D.js';
import type { Light } from '../lights/Light.js';

export class Quad implements Renderable {
    private quadCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    private quad: Mesh<Material>;

    constructor(isTargetQuad = true, isWebGPU = !!window.EGS_ENABLE_WEBGPU) {
        this.quad = new Mesh<Material>(new FullScreenTriangleBufferGeometry(isTargetQuad, isWebGPU));
    }

    /**
     * @internal
     */
    get geometry(): FullScreenTriangleBufferGeometry {
        return this.quad.geometry as FullScreenTriangleBufferGeometry;
    }

    setMaterial(mat: Material) {
        this.quad.setOnlyMaterial(mat);
    }

    config(renderer: IRenderer) {
        this.geometry.updateUV(renderer.backend === RendererBackend.WEBGPU_WASM);
        return true;
    }

    setGeometry(geometry: BufferGeometry) {
        this.quad.geometry = geometry;
    }

    render(renderer: IRenderer) {
        const oldCamera = renderer.getCurrentCamera();
        renderer.useCamera(this.quadCamera);
        renderer.setMaterialUploadDirty();
        renderer.renderDrawcall(this.quad.geometry, this.quad.expectOnlyMaterial(), this.quad, null);
        renderer.useCamera(oldCamera);
    }

    private renderDeferred<L extends Light>(
        renderer: IRenderer,
        scene: Scene3D,
        lights: L[],
        before?: (light: L) => void,
        shadowMode: ShadowMode = ShadowMode.EnableAll,
    ) {
        if (PipelineContentAPIForRenderingAndFilteringEnabled()) {
            for (const light of lights) {
                if (before) {
                    before(light);
                }
            }
            PipelineContentBridge.renderDeferLights(renderer, scene, lights, shadowMode, this.quad, this.quadCamera);
        } else {
            for (const light of lights) {
                if (before) {
                    before(light);
                }
                const oldCamera = renderer.getCurrentCamera();
                renderer.setMaterialUploadDirty();
                renderer.renderDrawcall(this.quad.geometry, this.quad.expectOnlyMaterial(), this.quad, null);
                renderer.useCamera(oldCamera);
            }
        }
    }

    renderDeferredWithMaterial<L extends Light>(
        renderer: IRenderer,
        scene: Scene3D,
        lights: L[],
        deferLightMaterial: DeferredLightBase<L>,
        before?: (light: L) => void,
        shadowMode: ShadowMode = ShadowMode.EnableAll,
    ) {
        deferLightMaterial.setResult();
        this.setMaterial(deferLightMaterial);
        this.renderDeferred(renderer, scene, lights, before, shadowMode);
    }

    destroy() {
        this.quadCamera.destroy();
        this.quad.geometry.destroyAllResourcesOwned();
        this.quad.destroy();
    }
}
