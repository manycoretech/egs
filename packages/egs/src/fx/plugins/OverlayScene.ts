import { PipelinePlugin } from './PipelinePlugin';
import type { HashKeyBuilder } from '../../utils/HashKeyBuilder';
import type { RenderGraph } from '../../rendergraph/RenderGraph';
import { pass } from '../../rendergraph/NodeMakers';
import { DefaultMaterialDispatcher } from '../../renderer/MaterialDispatcher';
import type { Renderer } from '../../renderer/Renderer';
import type { Material } from '../../elements/materials/Material';
import type { Drawable } from '../../scene/drawables/Drawable';

export class OverlaySceneDispatcher extends DefaultMaterialDispatcher {
    className() {
        return 'OverlaySceneDispatcher';
    }

    setMaterialState(renderer: Renderer, material: Material, drawable: Drawable) {
        super.setMaterialState(renderer, material, drawable);
        renderer.wglState.setDepthTest(false);
    }
}

export class OverlayScenePlugin extends PipelinePlugin {
    readonly PLUGIN_NAME = 'overlay_scene';

    private dispatcher = new OverlaySceneDispatcher();

    protected _enabled = true;

    destroy() {
        this.dispatcher.destroy();
    }

    updateFrameSize() { }
    updateEffect() { }

    updateGraphHash(_hasher: HashKeyBuilder) { }

    updateRenderGraph(graph: RenderGraph) {
        const scene = this.scene;
        graph.addPass([
            pass('overlay_scene_pass')
                .disableClear()
                .useDispatcher(this.dispatcher)
                .draw(scene.overlay),
        ]);
    }

    createConfig() {
        return {
            enabled: {
                get: () => this._enabled,
                set: (v: boolean) => {
                    this._enabled = v;
                },
            },
        };
    }
}
