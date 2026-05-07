import { HighLightBlendPassMaterial } from '../../elements/materials/quad/HighLightBlendPassMaterial';
import { target, pass, colorAttachment } from '../../rendergraph/NodeMakers';
import { Vector4 } from '../../math/Vector4';
import { RendererAdaptor, drawQuadDynamic } from '../RendererAdaptor';
import { MaterialShadingWithDynamicShapeDispatcher } from '../../renderer/MaterialDispatcher';
import { Camera3D } from '../../scene/cameras/Camera3D';
import { ProjectedDrawcallList, DrawableList, Drawcall } from '../../scene/tools/DrawcallList';
import { Material } from '../../elements/materials/Material';
import { Nullable } from '../../utils/Utils';
import { BufferGroup } from '../../elements/geometries/containers/BufferGeometry';
import { TypeAssert } from '../../scene/tools/TypeAssert';
import { MeshBasicMaterial } from '../../elements/materials/mesh/MeshBasicMaterial';
import { PipelineContentBridge } from '../PipelineAPI';
import { Drawable } from '../../scene/drawables/Drawable';
import { InstanceMesh } from '../../scene/drawables/InstanceMesh';
import { Group } from '../../scene/Group';
import { Color } from '../../math/Color';
import { PipelineContentAPIForRenderingAndFilteringEnabled } from '../PipelineAPI.impl';
import { PipelinePlugin } from './PipelinePlugin';
import { HashKeyBuilder } from '../../utils/HashKeyBuilder';
import { RenderGraph } from '../../rendergraph/RenderGraph';
import { SceneAdaptorDispatcher } from '../SceneAdaptor';
import { Platform } from '../../utils/Platform';
import { Vector2 } from '../../math/Vector2';
import { Texture2D } from '../../elements/textures/Texture2D';
import { TextureFormat } from '../../elements/textures/types';

/**
 * Type of parameters of {@link setHighlightObjects|setHighlightObjects}
 * @highlightGroupIndex If there are more than one material for geometry groups, the index of groups which need be highlight must push into this.
*/
export interface HighLightItem {
    object: Drawable;
    highlightGroupIndex?: number[];
    instanceIndex?: number;
}

export interface HighlightGroup {
    items: HighLightItem[];
    width?: number;
    borderColor?: Color;
    borderOpacity?: number;
    innerColor?: Color;
    innerOpacity?: number;
}

function createHighlightDrawcallList(highlightList: HighLightItem[], camera: Camera3D, viewHeight = window.innerHeight) {
    const list = new DrawableList();

    if (PipelineContentAPIForRenderingAndFilteringEnabled()) {
        highlightList.forEach(item => list.push(item.object));
        const result = new ProjectedDrawcallList(list, [], [], camera);
        PipelineContentBridge.drawcallListCreateFromDrawableList(
            result, list, camera, true, false, false,
            highlightList.map(item => ({ groupIndex: item.highlightGroupIndex, instanceIndex: item.instanceIndex })),
        );
        return result;
    }

    const selfList = highlightList.map(item => {
        if (item.instanceIndex !== undefined) {
            const object = (item.object as InstanceMesh).proxyedMeshes[item.instanceIndex].clone();
            const group = new Group();
            group.add(object);
            group.matrixWorld = item.object.matrixWorld.clone();
            group.updateMatrixWorld();
            return { ...item, object };
        } else {
            return item;
        }
    });
    selfList.forEach(item => list.push(item.object));
    list.updateRenderInfoInList(camera, viewHeight);
    list.updateLODs(camera, viewHeight);

    const transparent: Drawcall[] = [];
    const opaque: Drawcall[] = [];
    const addDrawcall = (object: Drawable, material: Material, group: Nullable<BufferGroup>) => {
        const array = material.transparent ? transparent : opaque;
        array.push({
            object,
            material,
            // disable proxy when need specific group.
            geometry: group ? object.geometry : object.renderGeometry,
            range: group,
        });
    };

    selfList.forEach(item => {
        const geometry = item.object.geometry;
        if (TypeAssert.isBufferGeometry(geometry) && item.highlightGroupIndex) {
            item.highlightGroupIndex.forEach(index => {
                const group = geometry.getGroups()[index];
                const groupMaterial = item.object.getMaterials()[group.materialIndex];
                addDrawcall(item.object, groupMaterial, group);
            });
        } else {
            const m = item.object.getMaterials();
            const groups = item.object.geometry.getGroups();
            if (!item.object.shouldUseGeometryGroupsWhenOnlyHasOneMaterial && m.length === 1) {
                addDrawcall(item.object, m[0], null);
            } else {
                groups.forEach(group => addDrawcall(item.object, m[group.materialIndex], group));
            }
        }
    });

    return new ProjectedDrawcallList(list, opaque, transparent, camera);
}

export class HighlightPlugin extends PipelinePlugin {
    readonly PLUGIN_NAME = 'highlight';

    private dispatcher = new MaterialShadingWithDynamicShapeDispatcher(new MeshBasicMaterial({ depthTest: false }));
    private blendMaterials: HighLightBlendPassMaterial[] = [];
    private width: number = 5;
    private borderColor: Color = new Color();
    private borderOpacity: number = 1;
    private innerColor: Color = new Color();
    private innerOpacity: number = 0;

    private highlightGroups: HighlightGroup[] = [];
    private texelSize = new Vector2(0, 0);

    get enabled() {
        return this._enabled && this.highlightGroups.length > 0;
    }
    set enabled(v: boolean) {
        this._enabled = v;
    }

    constructor(scene: SceneAdaptorDispatcher, renderer: RendererAdaptor) {
        super(scene, renderer);
    }

    destroy() {
        this.highlightGroups = [];
        this.dispatcher.destroy();
        for (const material of this.blendMaterials) {
            material.destroy();
        }
        this.blendMaterials.length = 0;
    }

    updateFrameSize(width: number, height: number) {
        for (const material of this.blendMaterials) {
            material.setTexelSize(width, height);
        }
        this.texelSize.set(width, height);
    }

    updateEffect() { }

    notifyChanged() {
        for (const material of this.blendMaterials) {
            material.map = Texture2D.default;
        }
    }

    updateGraphHash(hasher: HashKeyBuilder) {
        hasher.raw(this.highlightGroups.length);
    }

    updateRenderGraph(graph: RenderGraph) {
        const scene = this.scene;

        for (let i = 0; i < this.highlightGroups.length; i++) {
            const highlightTarget = target(`highlight_target_${i}`, false, false)
                .modify(node => {
                    const color = colorAttachment(`highlight_target_${i}-color`);
                    color.format = this.IS_WEBGL2 ? TextureFormat.R8Unorm : TextureFormat.Rgba8Unorm;
                    node.attach(color);
                })
                .from([
                    pass(`highlight_part_pass_${i}`)
                        .setClearColor(new Vector4(0, 0, 0, 0))
                        .useDispatcher(this.dispatcher)
                        .draw(() => createHighlightDrawcallList(this.highlightGroups[i].items, scene.camera)),
                ]);
            graph.addPass([
                pass(`blend_highlight_pass_${i}`)
                    .disableClear()
                    .input('map', highlightTarget)
                    .before(() => {
                        const blendMaterial = this.blendMaterials[i];
                        const highlightGroup = this.highlightGroups[i];
                        blendMaterial.width = highlightGroup.width ?? this.width;
                        const borderColor = (highlightGroup.borderColor ?? this.borderColor);
                        if (!blendMaterial.borderColor.equals(borderColor)) {
                            blendMaterial.borderColor = borderColor.cloneReadonly();
                        }
                        blendMaterial.borderOpacity = highlightGroup.borderOpacity ?? this.borderOpacity;
                        const innerColor = (highlightGroup.innerColor ?? this.innerColor);
                        if (!blendMaterial.innerColor.equals(innerColor)) {
                            blendMaterial.innerColor = innerColor.cloneReadonly();
                        }
                        blendMaterial.innerOpacity = highlightGroup.innerOpacity ?? this.innerOpacity;
                    })
                    .use(drawQuadDynamic(() => this.blendMaterials[i]))
            ]);
        }
    }

    createConfig() {
        return {
            enabled: {
                get: () => this._enabled,
                set: (v: boolean) => { this._enabled = v; },
            },
            width: {
                get: () => this.width,
                set: (v: number) => { this.width = v; },
            },
            borderColor: {
                get: () => this.borderColor.clone(),
                set: (v: Color) => { this.borderColor = v.clone(); },
            },
            borderOpacity: {
                get: () => this.borderOpacity,
                set: (v: number) => { this.borderOpacity = v; },
            },
            innerColor: {
                get: () => this.innerColor.clone(),
                set: (v: Color) => { this.innerColor = v.clone(); },
            },
            innerOpacity: {
                get: () => this.innerOpacity,
                set: (v: number) => { this.innerOpacity = v; },
            },
        };
    }

    setHighlightGroups(highlightGroups: HighlightGroup[]) {
        this.highlightGroups = highlightGroups.filter(group => group.items.length > 0);

        // update blend materials
        while (this.highlightGroups.length > this.blendMaterials.length) {
            const blendMaterial = new HighLightBlendPassMaterial();
            blendMaterial.setTexelSize(this.texelSize.x, this.texelSize.y);
            blendMaterial.hightQuality = !Platform.getInstance().mobile;
            this.blendMaterials.push(blendMaterial);
        }
        while (this.highlightGroups.length < this.blendMaterials.length) {
            this.blendMaterials.pop()?.destroy();
        }
    }
}
