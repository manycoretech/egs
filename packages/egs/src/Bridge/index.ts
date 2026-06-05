import {
    type ContentAPI,
    registerContentAPI,
    unregisterContentAPI,
    ContentBridge,
    getMaterialProperties,
    getMaterialShaderComponents,
    getLightProperties,
    hasManagedContentAPI,
    ManagedContentBridge,
} from '../ContentAPI';
import type { BufferAttribute } from '../elements/attributes/BufferAttribute';
import type { Texture } from '../elements/textures/Texture';
import { Texture2D } from '../elements/textures/Texture2D';
import { Texture3D } from '../elements/textures/Texture3D';
import { TextureCube } from '../elements/textures/TextureCube';
import type { BufferGeometryBase } from '../elements/geometries/containers/BufferGeometry';
import { InstancedBufferGeometry } from '../elements/geometries/containers/InstancedBufferGeometry';
import { FatLineBufferGeometry } from '../elements/geometries/containers/FatLineBufferGeometry';
import { PopBufferGeometry } from '../elements/geometries/containers/PopBufferGeometry';
import type { ShaderComponent } from '../renderer/shader/Shader';
import { PatternShaderComponent, shaderBlendKeys } from '../renderer/shader/components/PatternShaderComponent';
import type { Material } from '../elements/materials/Material';
import type { Object3D } from '../scene/Object3D';
import { Camera3D } from '../scene/cameras/Camera3D';
import { Light } from '../scene/lights/Light';
import { Drawable } from '../scene/drawables/Drawable';
import { InstanceMesh } from '../scene/drawables/InstanceMesh';
import type { Scene3D } from '../scene/Scene3D';
import { IterableWeakSet } from '../utils/WeakCollections';
import { BaseElement } from '../utils/ElementBase';
import { Matrix4 } from '../math/Matrix4';
import { Matrix3 } from '../math/Matrix3';
import type { Renderer } from '../renderer/Renderer';
import { Viewer } from '../Viewer';
import { SpriteBufferGeometry } from '../elements/geometries/containers/SpriteBufferGeometry';
import { TypeAssert } from '../scene/tools/TypeAssert';

function checkMaterialPropertyValid(value: any) {
    if (value == null) {
        return false;
    }
    if (value instanceof BaseElement) {
        return !value.isDestroyed();
    }
    return true;
}

class PreInitializedWASMBridge implements ContentAPI {
    static instance: PreInitializedWASMBridge | undefined;

    static getOrCreateInstance() {
        if (!PreInitializedWASMBridge.instance) {
            PreInitializedWASMBridge.instance = new PreInitializedWASMBridge();
        }
        return PreInitializedWASMBridge.instance;
    }

    private attributes = new IterableWeakSet<BufferAttribute>();
    private geometries = new IterableWeakSet<BufferGeometryBase>();
    private textures = new IterableWeakSet<Texture>();
    private shaderComponents = new IterableWeakSet<ShaderComponent>();
    private materials = new IterableWeakSet<Material>();
    private sceneNodes = new IterableWeakSet<Object3D>();
    private scenes = new IterableWeakSet<Scene3D>();
    private lightsToSync: Set<Light> = new Set();

    private constructor() {}

    defaultTexture: Texture2D;
    ltc_1: Texture2D;
    ltc_2: Texture2D;
    init_default_texture(t: Texture2D) {
        this.defaultTexture = t;
    }

    init_ltc(ltc_1: Texture2D, ltc_2: Texture2D) {
        this.ltc_1 = ltc_1;
        this.ltc_2 = ltc_2;
    }

    bufferAttributeCreate(attribute: BufferAttribute) {
        this.attributes.add(attribute);
    }

    bufferAttributeDestroy(attribute: BufferAttribute) {
        this.attributes.delete(attribute);
    }

    bufferGeometryCreate(geo: BufferGeometryBase) {
        this.geometries.add(geo);
    }

    bufferGeometryDestroy(geo: BufferGeometryBase) {
        this.geometries.delete(geo);
    }

    textureCreate(texture: Texture) {
        this.textures.add(texture);
    }

    textureDestroy(texture: Texture) {
        this.textures.delete(texture);
    }

    shaderComponentCreateAttachable(shaderComponent: ShaderComponent) {
        this.shaderComponents.add(shaderComponent);
    }

    materialCreate(material: Material) {
        this.materials.add(material);
    }

    materialDestroy(material: Material) {
        this.materials.delete(material);
    }

    sceneNodeCreate(node: Object3D) {
        this.sceneNodes.add(node);
    }

    sceneNodeDestroy(node: Object3D) {
        this.sceneNodes.delete(node);
    }

    sceneCreate(scene: Scene3D) {
        this.scenes.add(scene);
    }

    sceneDestroy(scene: Scene3D) {
        this.scenes.delete(scene);
    }

    // rebuild functions....
    rebuild() {
        this.attributes.forEach(attribute => {
            this.rebuildBufferAttribute(attribute);
        });

        this.textures.forEach(texture => {
            this.rebuildTexture(texture);
        });

        this.geometries.forEach(geometry => {
            this.rebuildBufferGeometry(geometry);
        });

        this.shaderComponents.forEach(shaderComponent => {
            this.rebuildDetachedShaderComponent(shaderComponent);
        });

        this.materials.forEach(materials => {
            this.rebuildMaterial(materials);
        });

        this.sceneNodes.forEach(node => {
            this.rebuildSceneNode(node);
        });

        this.lightsToSync.forEach(l => this.syncLight(l));

        this.sceneNodes.forEach(node => {
            if (node.parent) {
                ContentBridge.sceneNodeAdd(node.parent, node);
            }
        });

        this.scenes.forEach(scene => {
            this.rebuildScene(scene);
        });

        if (this.defaultTexture) {
            ContentBridge.init_default_texture(this.defaultTexture);
        }
        if (this.ltc_1 && this.ltc_2) {
            ContentBridge.init_ltc(this.ltc_1, this.ltc_2);
        }

        this.attributes.clear();
        this.geometries.clear();
        this.textures.clear();
        this.shaderComponents.clear();
        this.materials.clear();
        this.sceneNodes.clear();
        this.scenes.clear();
        this.lightsToSync.clear();
    }

    cleanupJsImpl() {
        this.scenes.forEach(scene => {
            scene.renderProxyManager.cleanDrawableListCache();
        });
    }

    private rebuildBufferAttribute(attribute: BufferAttribute) {
        ContentBridge.bufferAttributeCreate(attribute);
        attribute.array = attribute._array;
    }

    private rebuildTexture(texture: Texture) {
        ContentBridge.textureCreate(texture);
        ContentBridge.textureSyncSamplerAndMetaInfo(texture);
        if (texture instanceof Texture2D || texture instanceof Texture3D) {
            texture.source.syncData(texture);
        } else if (texture instanceof TextureCube) {
            texture.syncData();
        } else if (TypeAssert.isSourceTexture(texture)) {
            texture.syncAllLevels();
        }
    }

    private rebuildBufferGeometry(geometry: BufferGeometryBase) {
        ContentBridge.bufferGeometryCreate(geometry);
        geometry.getGroups().forEach((group, i) => {
            ContentBridge.bufferGeometrySetGroup(geometry, i, group);
        });

        if (geometry instanceof InstancedBufferGeometry) {
            ContentBridge.bufferGeometrySetInstanceCount(geometry, geometry.instancedCount);
        }

        if (geometry instanceof FatLineBufferGeometry) {
            ContentBridge.bufferGeometrySetIsFatline(geometry);
        }

        if (geometry instanceof SpriteBufferGeometry) {
            ContentBridge.bufferGeometrySetIsSprite(geometry);
        }

        for (const key in geometry.attributes) {
            const attribute = geometry.attributes[key];
            ContentBridge.bufferGeometrySetAttribute(geometry, key, attribute);
        }
        if (geometry.index) {
            ContentBridge.bufferGeometrySetIndexAttribute(geometry, geometry.index);
        }

        if (geometry instanceof PopBufferGeometry) {
            ContentBridge.popBufferGeometrySetModel(geometry, geometry.model);
        }
    }

    private rebuildDetachedShaderComponent(component: ShaderComponent) {
        ContentBridge.shaderComponentCreateAttachable(component);
        const properties = getMaterialProperties(component);
        if (properties) {
            properties.forEach(key => {
                const value = (component as any)[key];
                if (checkMaterialPropertyValid(value)) {
                    ContentBridge.materialSetProperty(component, key, value, true);
                }
            });
        }
        if (component instanceof PatternShaderComponent) {
            shaderBlendKeys.forEach(key => {
                const value = (component.blendConfig as any)[key];
                if (checkMaterialPropertyValid(value)) {
                    ContentBridge.materialSetProperty(component, key, value, true);
                }
            });
        }
    }

    private rebuildMaterial(material: Material) {
        ContentBridge.materialCreate(material);

        const properties = getMaterialProperties(material);
        if (properties) {
            properties.forEach(key => {
                const value = (material as any)[key];
                if (checkMaterialPropertyValid(value)) {
                    ContentBridge.materialSetProperty(material, key, value, true);
                }
            });
        }

        // copy embedded shader components
        const embedded = getMaterialShaderComponents(material);
        if (embedded) {
            embedded.forEach(key => {
                const component = (material as any)[key];
                if (component) {
                    component.__material = material;
                    const componentProperties = getMaterialProperties(component);
                    componentProperties.forEach(key => {
                        const value = component[key];
                        if (checkMaterialPropertyValid(value)) {
                            ContentBridge.materialSetProperty(component, key, value, true);
                        }
                    });
                }
            });
        }

        const components = material.getComponents();
        for (let i = 0; i < components.length; i++) {
            ContentBridge.materialAddShaderComponent(material, components[i], i);
        }
    }

    private rebuildSceneNode(node: Object3D) {
        ContentBridge.sceneNodeCreate(node);
        ContentBridge.sceneNodeSyncData(node);
        ContentBridge.sceneNodeSyncMatrix(node);
        ContentBridge.sceneNodeSyncLayers(node);
        ContentBridge.sceneNodeUpdate(node);

        if (node instanceof Camera3D) {
            ContentBridge.cameraInit(node);
            ContentBridge.cameraSyncData(node);
        }

        if (node instanceof Light) {
            ContentBridge.lightInit(node);
            this.lightsToSync.add(node);
        }

        if (node instanceof Drawable) {
            node._clearViewIndependentOverrideScale();
            ContentBridge.drawableInit(node);
            ContentBridge.drawableSyncAllData(node);

            if (node.geometry) {
                // when mesh init, geometry may not exist
                ContentBridge.drawableSetGeometry(node, node.geometry);
            }
            node.getMaterials().forEach((m, i) => {
                ContentBridge.drawableSetMaterial(node, m, i);
            });
        }

        if (node instanceof InstanceMesh) {
            node.updateSource(node.proxyedMeshes);
        }
    }

    private rebuildScene(scene: Scene3D) {
        ContentBridge.sceneCreate(scene);
        ContentBridge.sceneSyncData(scene);
        scene.traverse(node => {
            ContentBridge.sceneNodeAttachScene(scene, node);
        });
    }

    private syncLight(light: Light) {
        const properties = getLightProperties(light);
        if (properties) {
            properties.forEach((bridgeKey, key) => {
                ContentBridge.lightSetProperty(light, bridgeKey, light, (light as any)[key]);
            });
        }
        const shadow = (light as any).shadow;
        if (shadow && shadow.enabled) {
            const shadowProperties = getLightProperties(shadow);
            shadowProperties?.forEach((bridgeKey, key) => {
                if (key === 'map') {
                    return; // should not sync map current
                }
                ContentBridge.lightSetProperty(light, bridgeKey, shadow, shadow[key]);
            });
        }
    }
}

function prepareWASM() {
    registerContentAPI(PreInitializedWASMBridge.getOrCreateInstance());
    window.EGS_WASM_PREPARED = true;
}

export function beforeAPIRegister() {
    if (PreInitializedWASMBridge.instance) {
        Viewer.instances.forEach(viewer => {
            viewer.clearPipelineCache();
        });
        PreInitializedWASMBridge.instance.cleanupJsImpl();
    }
}

function patchMath() {
    (Matrix3 as any).prototype._applyToBufferAttribute = Matrix3.prototype.applyToBufferAttribute;
    Matrix3.prototype.applyToBufferAttribute = function (
        this: Matrix3,
        attribute: BufferAttribute,
        __forceJSImpl: boolean = false,
    ): BufferAttribute {
        if (!__forceJSImpl && hasManagedContentAPI() && ManagedContentBridge.isContentOwnGeometricData()) {
            ManagedContentBridge.bufferAttributeApplyMat3(attribute, this);
            return attribute;
        }
        return (this as any)._applyToBufferAttribute(attribute, __forceJSImpl);
    };
    (Matrix4 as any).prototype._applyToBufferAttribute = Matrix4.prototype.applyToBufferAttribute;
    Matrix4.prototype.applyToBufferAttribute = function (
        this: Matrix4,
        attribute: BufferAttribute,
        __forceJSImpl: boolean = false,
    ): BufferAttribute {
        if (!__forceJSImpl && hasManagedContentAPI() && ManagedContentBridge.isContentOwnGeometricData()) {
            ManagedContentBridge.bufferAttributeApplyMat4(attribute, this);
            return attribute;
        }
        return (this as any)._applyToBufferAttribute(attribute, __forceJSImpl);
    };
}

export function afterWASMInit() {
    patchMath();

    if (PreInitializedWASMBridge.instance) {
        unregisterContentAPI(PreInitializedWASMBridge.instance);
        PreInitializedWASMBridge.instance.rebuild();
        Viewer.instances.forEach(viewer => {
            const engine = viewer._getEngine();
            const renderer = engine.renderer as Renderer;
            engine.resetRenderer(renderer.getCanvas(), renderer.getContext());
            // try enable gpu driven rendering.
            if (viewer.enableGpuDriven !== viewer.renderingConfig.gpuDriven.requested) {
                viewer.enableGpuDriven = viewer.renderingConfig.gpuDriven.requested;
            }
        });
    }
}

if (window.EGS_WASM_NEED_PREPARE) {
    prepareWASM();
}
