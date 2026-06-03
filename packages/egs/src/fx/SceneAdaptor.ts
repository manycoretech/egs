import type { DirectionalLight } from '../scene/lights/DirectionalLight';
import type { SpotLight } from '../scene/lights/SpotLight';
import type { Scene3D } from '../scene/Scene3D';
import type { Camera3D } from '../scene/cameras/Camera3D';
import { type ProjectedDrawcallList, DrawcallListClassifyList } from '../scene/tools/DrawcallList';
import type { Nullable } from '../utils/Utils';
import type { RendererAdaptor } from './RendererAdaptor';
import type { PassExecuteCtx } from '../rendergraph/nodes/PassNode';
import { Shadow } from '../scene/shadows/Shadow';
import { PipelineFilters } from './PipelineAPI';
import type { ResizeFN } from '../rendergraph/nodes/utils';

export class SceneAdaptorDispatcher {
    adaptor: SceneAdaptor;

    setAdaptor(a: SceneAdaptor) {
        this.adaptor = a;
    }
    get scene() {
        return this.adaptor.scene;
    }
    get camera() {
        return this.adaptor.camera;
    }
    get origin() {
        return this.adaptor.origin;
    }
    get default() {
        return () => this.adaptor.default;
    }
    get OIT() {
        return () => this.adaptor.OIT;
    }
    get static() {
        return () => this.adaptor.static;
    }
    get dynamic() {
        return () => this.adaptor.dynamic;
    }
    get overlay() {
        return () => this.adaptor.overlay;
    }

    syncDirectionalShadowLayers(i: number) {
        return () => {
            const l = this.adaptor.scene.shaderComponentRegistry.light.getNthShadowDirectionalLight(i);
            const sceneCameraLayers = this.camera.layers.getSerializeData();
            const shadowCameraLayers = l.shadow.camera.layers.getSerializeData();
            if (sceneCameraLayers !== shadowCameraLayers) {
                l.isShadowNeedsUpdate = true;
                l.shadow.camera.layers.setSerializeData(sceneCameraLayers);
            }
        };
    }

    isDirectionalShadowRequireUpdate(i: number) {
        return () => {
            const l = this.adaptor.scene.shaderComponentRegistry.light.getNthShadowDirectionalLight(i);
            return l.isShadowNeedsUpdate ||
                this.adaptor.scene.isShadowMapNeedsUpdate ||
                (Shadow._IN_TEMPORAL && Shadow.ENABLE_TEMPORAL_EFFECT) ||
                !l.shadow.map || l.shadow.map.isDestroyed();
        };
    }

    getDirectionalShadowMapSize(i: number): ResizeFN {
        return (_) => {
            const l = this.adaptor.scene.shaderComponentRegistry.light.getNthShadowDirectionalLight(i);
            return l.shadow.mapSize.intoSize();
        };
    }

    renderDirectionalShadow(i: number, useProxy: boolean) {
        return (renderer: RendererAdaptor) => {
            const l = this.adaptor.scene.shaderComponentRegistry.light.getNthShadowDirectionalLight(i);
            renderer.render(this.adaptor.getDirectionalShadowMapCaster(l, useProxy));
        };
    }

    returnDirectionalShadowResult(i: number) {
        return (r: PassExecuteCtx) => {
            const l = this.adaptor.scene.shaderComponentRegistry.light.getNthShadowDirectionalLight(i);
            l.shadow.map = r.target!.colors[0];
            l.isShadowNeedsUpdate = false;
        };
    }

    syncSpotShadowLayers(i: number) {
        return () => {
            const l = this.adaptor.scene.shaderComponentRegistry.light.getNthShadowSpotLight(i);
            const sceneCameraLayers = this.camera.layers.getSerializeData();
            const shadowCameraLayers = l.shadow.camera.layers.getSerializeData();
            if (sceneCameraLayers !== shadowCameraLayers) {
                l.isShadowNeedsUpdate = true;
                l.shadow.camera.layers.setSerializeData(sceneCameraLayers);
            }
        };
    }

    isSpotShadowRequireUpdate(i: number) {
        return () => {
            const l = this.adaptor.scene.shaderComponentRegistry.light.getNthShadowSpotLight(i);
            return l.isShadowNeedsUpdate ||
                this.adaptor.scene.isShadowMapNeedsUpdate ||
                (Shadow._IN_TEMPORAL && Shadow.ENABLE_TEMPORAL_EFFECT) ||
                !l.shadow.map || l.shadow.map.isDestroyed();
        };
    }

    getSpotShadowMapSize(i: number): ResizeFN {
        return (_) => {
            const l = this.adaptor.scene.shaderComponentRegistry.light.getNthShadowSpotLight(i);
            return l.shadow.mapSize.intoSize();
        };
    }

    renderSpotShadow(i: number, useProxy: boolean) {
        return (renderer: RendererAdaptor) => {
            const l = this.adaptor.scene.shaderComponentRegistry.light.getNthShadowSpotLight(i);
            renderer.render(this.adaptor.getSpotShadowMapCaster(l, useProxy));
        };
    }

    returnSpotShadowResult(i: number) {
        return (r: PassExecuteCtx) => {
            const l = this.adaptor.scene.shaderComponentRegistry.light.getNthShadowSpotLight(i);
            l.shadow.map = r.target!.colors[0];
            l.isShadowNeedsUpdate = false;
        };
    }

    syncPointShadowLayers(i: number) {
        return () => {
            const l = this.adaptor.scene.shaderComponentRegistry.light.getNthShadowPointLight(i);
            const sceneCameraLayers = this.camera.layers.getSerializeData();
            for (const camera of l.shadow.camera.cameras) {
                const shadowCameraLayers = camera.layers.getSerializeData();
                if (sceneCameraLayers !== shadowCameraLayers) {
                    l.isShadowNeedsUpdate = true;
                    camera.layers.setSerializeData(sceneCameraLayers);
                }
            }
        };
    }

    isPointShadowRequireUpdate(i: number) {
        return () => {
            const l = this.adaptor.scene.shaderComponentRegistry.light.getNthShadowPointLight(i);
            return l.isShadowNeedsUpdate ||
                this.adaptor.scene.isShadowMapNeedsUpdate ||
                (Shadow._IN_TEMPORAL && Shadow.ENABLE_TEMPORAL_EFFECT) ||
                !l.shadow.map || l.shadow.map.isDestroyed();
        };
    }

    getPointShadowMapSize(i: number): ResizeFN {
        return (_) => {
            const l = this.adaptor.scene.shaderComponentRegistry.light.getNthShadowPointLight(i);
            return l.shadow.mapSize.intoSize();
        };
    }

    getPointShadowPassContent(useProxy: boolean) {
        return () => {
            return (useProxy ? this.adaptor.proxied : this.adaptor.origin)
                .filter(PipelineFilters.isDrawableShadowMapCaster);
        };
    }

    getPointShadowPassContentUnfiltered() {
        return () => {
            return this.adaptor.proxied;
        };
    }

    getAndUpdatePointCamera(i: number) {
        return () => {
            const l = this.adaptor.scene.shaderComponentRegistry.light.getNthShadowPointLight(i);
            l.shadow.updateCamera(l);
            return l.shadow.camera;
        };
    }

    returnPointShadowResult(i: number) {
        return (r: PassExecuteCtx) => {
            const l = this.adaptor.scene.shaderComponentRegistry.light.getNthShadowPointLight(i);
            l.shadow.map = r.target!.colors[0];
            l.isShadowNeedsUpdate = false;
        };
    }
}

export class SceneAdaptor {
    constructor(
        public scene: Scene3D,
        public camera: Camera3D
    ) { }
    get origin() {
        return this.scene.generateDrawableList(false);
    }

    get proxied() {
        return this.scene.generateDrawableList(true);
    }

    private cachedDefault: Nullable<ProjectedDrawcallList> = null;
    get default() {
        if (this.cachedDefault === null) {
            this.cachedDefault = this.scene.generateDrawableList(true).project(this.camera);
            this.cachedDefault.useOnce = false;
        }
        return this.cachedDefault;
    }

    private cachedOIT: Nullable<ProjectedDrawcallList> = null;
    get OIT() {
        if (this.cachedOIT === null) {
            this.cachedOIT = this.scene.generateDrawableList(true)
                .project(this.camera, undefined, undefined, DrawcallListClassifyList.oit);
            this.cachedOIT.useOnce = false;
        }
        return this.cachedOIT;
    }

    private cachedStatic: ProjectedDrawcallList | null = null;
    get static() {
        if (this.cachedStatic === null) {
            this.cachedStatic = this.scene.renderProxyManager.generateStaticList(this.camera);
            this.cachedStatic.useOnce = false;
        }
        return this.cachedStatic;
    }

    private cachedDynamic: ProjectedDrawcallList | null = null;
    get dynamic() {
        if (this.cachedDynamic === null) {
            this.cachedDynamic = this.scene.renderProxyManager.generateDynamicList(this.camera);
            this.cachedDynamic.useOnce = false;
        }
        return this.cachedDynamic;
    }

    private cachedOverlay: ProjectedDrawcallList | null = null;
    get overlay() {
        if (this.cachedOverlay === null) {
            this.cachedOverlay = this.scene.renderProxyManager
                .generateOverlayDrawableList()
                .project(this.camera, true, undefined, DrawcallListClassifyList.overlay);
            this.cachedOverlay.useOnce = false;
        }
        return this.cachedOverlay;
    }

    getDirectionalShadowMapCaster = (light: DirectionalLight, useProxy: boolean) => {
        const shadow = light.shadow;
        const camera = shadow.camera;
        shadow.updateCameraAndShadowMatrices(light);
        camera.culler.update(camera);

        const full = useProxy ? this.proxied : this.origin;
        const caster = full.filter(PipelineFilters.isDrawableShadowMapCaster);
        return caster.project(camera, false, undefined, DrawcallListClassifyList.opaque);
    };

    getDirectionalShadowMapCasterUnfiltered = (light: DirectionalLight) => {
        const shadow = light.shadow;
        const camera = shadow.camera;
        shadow.updateCameraAndShadowMatrices(light);
        camera.culler.update(camera);

        return this.proxied.project(camera, false, undefined, DrawcallListClassifyList.opaque, false);
    };

    getSpotShadowMapCaster = (light: SpotLight, useProxy: boolean) => {
        const shadow = light.shadow;
        const camera = shadow.camera;
        shadow.updateCamera(light);
        camera.culler.update(camera);
        light.updateCone();

        const shadowList = (useProxy ? this.proxied : this.origin)
            .filter(() => PipelineFilters.isDrawableShadowMapCaster())
            .filter(() => PipelineFilters.isInsideCone(light.cone));
        shadow.updateSpotNearFar(shadowList, light);
        shadow.updateShadowMatrix();

        // culling is in light's culler
        return shadowList.project(camera, false, undefined, DrawcallListClassifyList.opaque);
    };

    getSpotShadowMapCasterUnfiltered = (light: SpotLight) => {
        const shadow = light.shadow;
        const camera = shadow.camera;
        shadow.updateCamera(light);
        camera.culler.update(camera);
        light.updateCone();

        // use origin list to update shadow near/far
        const shadowList = this.origin
            .filter(() => PipelineFilters.isDrawableShadowMapCaster())
            .filter(() => PipelineFilters.isInsideCone(light.cone));
        shadow.updateSpotNearFar(shadowList, light);
        shadow.updateShadowMatrix();
        shadowList.destroy();

        // culling is in light's culler
        return this.proxied.project(camera, false, undefined, DrawcallListClassifyList.opaque, false);
    };

    destroy() {
        if (this.cachedDefault) {
            this.cachedDefault.destroy();
        }
        if (this.cachedStatic) {
            this.cachedStatic.destroy();
        }
        if (this.cachedDynamic) {
            this.cachedDynamic.destroy();
        }
        if (this.cachedOIT) {
            this.cachedOIT.destroy();
        }
        if (this.cachedOverlay) {
            this.cachedOverlay.destroy();
        }
    }
}
