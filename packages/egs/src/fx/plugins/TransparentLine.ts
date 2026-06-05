import { filterBy, DrawableList } from '../../scene/tools/DrawcallList';
import { LineBasicMaterial } from '../../elements/materials/mesh/LineMaterial';
import { MeshBasicMaterial } from '../../elements/materials/mesh/MeshBasicMaterial';
import { LineSegments } from '../../scene/drawables/LineSegments';
import { pass, disableClear } from '../../rendergraph/NodeMakers';
import { MaterialShadingWithDynamicShapeDispatcher } from '../../renderer/MaterialDispatcher';
import { logger } from '../../utils/Logger';
import { createEdge, needRebuild, updateEdgesVisibility } from '../../elements/geometries/operators/Edges';
import { readonlyMath } from '../../math/Readonly';
import type { Color } from '../../math/Color';
import {
    PipelineFilters,
    PipelineContentBridge,
    PipelineContentAPIForRenderingAndFilteringEnabled,
} from '../PipelineAPI';
import { TypeAssert } from '../../scene/tools/TypeAssert';
import { type Drawable, DrawableRenderMode } from '../../scene/drawables/Drawable';
import { PipelinePlugin } from './PipelinePlugin';
import type { HashKeyBuilder } from '../../utils/HashKeyBuilder';
import type { RenderGraph } from '../../rendergraph/RenderGraph';
import type { SceneAdaptorDispatcher } from '../SceneAdaptor';
import type { RendererAdaptor } from '../RendererAdaptor';

export class TransparentLinePlugin extends PipelinePlugin {
    readonly PLUGIN_NAME = 'transparent_line';

    private edgeThreshold = 25;
    private enabledOriginShading = false;
    private enableDrawAdditional = false;

    private lineMat = new LineBasicMaterial({ color: readonlyMath.color(0x000000), depthTest: false });
    private lineD: MaterialShadingWithDynamicShapeDispatcher<LineBasicMaterial>;
    private basicMat = new MeshBasicMaterial({ transparent: true, depthWrite: false, opacity: 0 });
    private basicD: MaterialShadingWithDynamicShapeDispatcher<MeshBasicMaterial>;
    private hideMat = new LineBasicMaterial({ visible: false });

    constructor(scene: SceneAdaptorDispatcher, renderer: RendererAdaptor) {
        super(scene, renderer);
        this.lineD = new MaterialShadingWithDynamicShapeDispatcher(this.lineMat);
        this.basicD = new MaterialShadingWithDynamicShapeDispatcher(this.basicMat);
    }

    destroy() {
        this.lineMat.destroy();
        this.basicMat.destroy();
        this.lineD.destroy();
        this.basicD.destroy();
    }

    updateFrameSize() {}
    updateEffect() {}

    updateGraphHash(hasher: HashKeyBuilder) {
        hasher
            .bool(this.enableDrawAdditional)
            .bool(this.enabledOriginShading)
            .bool(this.basicMat.alpha.opacity !== 0);
    }

    updateRenderGraph(graph: RenderGraph) {
        const scene = this.scene;
        graph.addPass(
            disableClear([
                this.basicMat.alpha.opacity !== 0
                    ? pass('tl_transparent_pass')
                          .useDispatcher(this.enabledOriginShading ? undefined : this.basicD)
                          .draw(filterBy(scene.default, PipelineFilters.transparentLineNotNormal))
                    : undefined,
                pass('tl_normal_pass').draw(filterBy(scene.default, PipelineFilters.transparentLineNormal)),
                pass('tl_pass')
                    .useDispatcher(this.lineD)
                    .use(r => {
                        const drawableList = new DrawableList();
                        // rust need create drawableList from scene3D
                        if (PipelineContentAPIForRenderingAndFilteringEnabled()) {
                            const filter = PipelineFilters.transparentLineNotNormalDrawable();
                            scene.scene.traverseVisible(o => {
                                o.updateMatrixWorld();
                                if (
                                    TypeAssert.isDrawable(o) &&
                                    o.renderMode === DrawableRenderMode.Default &&
                                    filter(o)
                                ) {
                                    const l = this.transform(o);
                                    if (l) {
                                        drawableList.list.push(l);
                                    }
                                }
                            });
                        }
                        // rust, object maybe not in scene3D
                        scene.origin
                            .filter(PipelineFilters.transparentLineNotNormalDrawable, true)
                            .filterMap(this.transform)
                            .forEach(drawable => drawableList.list.push(drawable));

                        const drawcallList = drawableList.project(scene.camera);
                        if (PipelineContentAPIForRenderingAndFilteringEnabled()) {
                            PipelineContentBridge.prepareTempRenderList(drawableList.list);
                            PipelineContentBridge.drawcallListCreateFromDrawableList(
                                drawcallList,
                                drawableList,
                                scene.camera,
                                true,
                                true,
                                true,
                            );
                        }
                        r.render(drawcallList);
                        PipelineContentBridge.cleanupTempRenderList(drawableList.list);
                    }),
                this.enableDrawAdditional
                    ? pass('tl_additional_pass').draw(
                          filterBy(scene.default, PipelineFilters.transparentLineAdditional),
                      )
                    : undefined,
            ]),
        );
    }

    // filter, update and sort the stuff to the right list
    private transform = (object: Drawable) => {
        if (!TypeAssert.isMesh(object)) {
            return null;
        }
        try {
            // build if needed
            if (!object.edges || needRebuild(object, this.edgeThreshold)) {
                object.edges?.geometry.destroyAllResourcesOwned();
                const geometry = createEdge(object.geometry, this.edgeThreshold);
                const material = geometry.getGroups().length ? [this.lineMat, this.hideMat] : this.lineMat;
                object.edges = new LineSegments(geometry, material);
                object.edges.matrixWorld = object.matrixWorld;
                object._syncedEdgeThreshold = this.edgeThreshold;
                object.edges.updateBoundings();
            }

            // sync material visibility
            updateEdgesVisibility(object);

            // sync layers
            if (object.edges.layers.mask !== object.netLayer.mask) {
                object.edges.layers.mask = object.netLayer.mask;
            }

            if (PipelineContentAPIForRenderingAndFilteringEnabled()) {
                object.edges.matrix.copy(object.matrixWorld);
            }

            return object.edges;
        } catch (error) {
            logger.warn('failed to convert EdgesBufferGeometry', error);
            return null;
        }
    };

    createConfig() {
        return {
            enabled: {
                get: () => this._enabled,
                set: (v: boolean) => {
                    this._enabled = v;
                },
            },
            opacity: {
                get: () => this.basicMat.alpha.opacity,
                set: (v: number) => {
                    this.basicMat.alpha.opacity = v;
                    PipelineContentBridge.materialDispatcherCreate(this.basicD);
                },
            },
            transparentColor: {
                get: () => this.basicMat.color.color.clone(),
                set: (v: Color) => {
                    this.basicMat.color.color = v.cloneReadonly();
                    PipelineContentBridge.materialDispatcherCreate(this.basicD);
                },
            },
            lineColor: {
                get: () => this.lineMat.color.color.clone(),
                set: (v: Color) => {
                    this.lineMat.color.color = v.cloneReadonly();
                    PipelineContentBridge.materialDispatcherCreate(this.lineD);
                },
            },
            edgeThreshold: {
                get: () => this.edgeThreshold,
                set: (v: number) => {
                    this.edgeThreshold = v;
                },
            },
            drawWithOriginalMaterial: {
                get: () => this.enabledOriginShading,
                set: (v: boolean) => {
                    this.enabledOriginShading = v;
                },
            },
            drawAdditionalLines: {
                get: () => this.enableDrawAdditional,
                set: (v: boolean) => {
                    this.enableDrawAdditional = v;
                },
            },
        };
    }
}
