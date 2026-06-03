import { PipelinePlugin } from './PipelinePlugin';
import type { Plane } from '../../math/Plane';
import type { Scene3D } from '../../scene/Scene3D';

export class SceneClipPlugin extends PipelinePlugin {
    PLUGIN_NAME = 'SceneClip';

    private clippingEnabled: boolean = false;
    private clippingPlanes: Plane[] = [];
    private clippingEnabledCached: boolean = false;
    private clippingPlanesCached: Plane[] = [];

    destroy() { }

    updateEffect() { }

    updateFrameSize() { }

    updateGraphHash() { }

    updateRenderGraph() { }

    setSceneClip(scene: Scene3D) {
        if (!this.enabled) {
            return;
        }
        this.clippingEnabledCached = scene.enableSceneClipping;
        this.clippingPlanesCached = scene.clippingPlanes;
        scene.enableSceneClipping = this.clippingEnabled;
        scene.clippingPlanes = this.clippingPlanes;
        scene.notifyClippingChanged();
    }

    restoreSceneClip(scene: Scene3D) {
        if (!this.enabled) {
            return;
        }
        scene.enableSceneClipping = this.clippingEnabledCached;
        scene.clippingPlanes = this.clippingPlanesCached;
        this.clippingEnabledCached = false;
        this.clippingPlanesCached = [];
        scene.notifyClippingChanged();
    }

    createConfig() {
        return {
            enabled: {
                get: () => this._enabled,
                set: (v: boolean) => {
                    this._enabled = v;
                },
            },
            clippingEnabled: {
                get: () => this.clippingEnabled,
                set: (v: boolean) => {
                    this.clippingEnabled = v;
                },
            },
            clippingPlanes: {
                get: () => this.clippingPlanes,
                set: (v: Plane[]) => {
                    this.clippingPlanes = v;
                },
            },
        };
    }
}
