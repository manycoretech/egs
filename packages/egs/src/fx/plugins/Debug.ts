import { type IEffectConfig, PipelinePlugin, type PipelineContext } from './PipelinePlugin.js';
import { type DepthPackingStrategies, MeshDepthMaterial } from '../../elements/materials/mesh/MeshDepthMaterial.js';
import { MeshNormalMaterial } from '../../elements/materials/mesh/MeshNormalMaterial.js';
import type { RenderGraph } from '../../rendergraph/RenderGraph.js';
import { MaterialShadingWithDynamicShapeDispatcher } from '../../renderer/MaterialDispatcher.js';
import { pass } from '../../rendergraph/NodeMakers.js';
import type { SceneAdaptor } from '../SceneAdaptor.js';
import type { HashKeyBuilder } from '../../utils/HashKeyBuilder.js';
import { PipelineContentBridge } from '../PipelineAPI.impl.js';
import type { Material } from '../../elements/materials/Material.js';
import { DrivenCullingMaterial } from '../../elements/materials/driven/DrivenCullingMaterial.js';
import { DrivenShadingMaterial, DrivenShadingMode } from '../../elements/materials/driven/DrivenShadingMaterial.js';
import type { PassNode } from '../../rendergraph/nodes/PassNode.js';
import type { RenderTargetNode } from '../../rendergraph/nodes/RenderTargetNode.js';

export enum DebugMode {
    Depth = 0,
    Normal = 1,
}

export class DebugPlugin extends PipelinePlugin {
    readonly PLUGIN_NAME = 'debug';

    private debugMode = DebugMode.Depth;

    private normalMaterial = new MeshNormalMaterial();
    private depthMaterial = new MeshDepthMaterial();
    private dispatcher = new MaterialShadingWithDynamicShapeDispatcher<Material>(this.depthMaterial);

    private drivenCullingMaterial: DrivenCullingMaterial = new DrivenCullingMaterial();
    private drivenShadingMaterial: DrivenShadingMaterial = new DrivenShadingMaterial();

    destroy() {
        this.normalMaterial.destroy();
        this.depthMaterial.destroy();
        this.dispatcher.destroy();
    }

    updateFrameSize(_width: number, _height: number) {}

    updateEffect(
        _scene: SceneAdaptor,
        _isFrameStable: boolean,
        _isCameraStable: boolean,
        _effectConfig: IEffectConfig,
    ) {}

    updateGraphHash(_hasher: HashKeyBuilder) {}

    updateRenderGraph(graph: RenderGraph, context: PipelineContext, depthPyramid: RenderTargetNode) {
        const scene = this.scene;
        const { enabled: drivenEnabled } = context.renderingConfig.gpuDriven;
        const passList: PassNode[] = [];

        const drivenPass = pass('prepare_driven_pass')
            .disableClear()
            .before(() => {
                this.drivenCullingMaterial.update(context.drivenCullingConfig);
            })
            .useDriven(this.drivenCullingMaterial)
            .input('depthPyramid', depthPyramid)
            .draw(scene.default);
        graph.sceneCullingPass = drivenPass;

        const debugPass = pass('debug_shading_pass').disableClear().useDispatcher(this.dispatcher).draw(scene.default);

        if (drivenEnabled) {
            debugPass
                .depend(drivenPass)
                .useDriven(this.drivenShadingMaterial)
                .before(() => {
                    switch (this.debugMode) {
                        case DebugMode.Depth: {
                            this.drivenShadingMaterial.shadingMode = DrivenShadingMode.DepthShading;
                            this.drivenShadingMaterial.depthPackMode = this.depthMaterial.depthPacking;
                            break;
                        }
                        case DebugMode.Normal: {
                            this.drivenShadingMaterial.shadingMode = DrivenShadingMode.NormalShading;
                            break;
                        }
                    }
                })
                .after(() => {
                    this.drivenShadingMaterial.shadingMode = DrivenShadingMode.PhongShading;
                });
            passList.push(drivenPass);
        }
        passList.push(debugPass);

        graph.addPass(passList);
    }

    createConfig() {
        return {
            enabled: {
                get: () => this._enabled,
                set: (v: boolean) => {
                    this._enabled = v;
                },
            },
            debugMode: {
                get: () => this.debugMode,
                set: (v: DebugMode) => {
                    this.debugMode = v;
                    switch (this.debugMode) {
                        case DebugMode.Depth: {
                            this.dispatcher.material = this.depthMaterial;
                            break;
                        }
                        case DebugMode.Normal: {
                            this.dispatcher.material = this.normalMaterial;
                            break;
                        }
                    }
                    PipelineContentBridge.materialDispatcherCreate(this.dispatcher);
                },
            },
            depthPacking: {
                get: () => this.depthMaterial.depthPacking,
                set: (v: DepthPackingStrategies) => {
                    this.depthMaterial.depthPacking = v;
                    this.depthMaterial.notifyRecompileShader();
                    PipelineContentBridge.materialDispatcherCreate(this.dispatcher);
                },
            },
        };
    }
}
