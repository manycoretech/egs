import { ReadonlyVector2 } from './math/Vector2';
import { ContentBridge } from './ContentAPI.impl';
import { TypedArray, Nullable } from './utils/Utils';
import { BufferGeometryBase, BufferGroup } from './elements/geometries/containers/BufferGeometry';
import { Material } from './elements/materials/Material';
import { Object3D } from './scene/Object3D';
import { InstancedBufferGeometry } from './elements/geometries/containers/InstancedBufferGeometry';
import { RenderTarget } from './elements/textures/RenderTarget';
import { Drawable } from './scene/drawables/Drawable';
import { Camera3D } from './scene/cameras/Camera3D';
import { Texture2D } from './elements/textures/Texture2D';
import { ShaderComponent } from './renderer/shader/Shader';
import { Shadow } from './scene/shadows/Shadow';
import { Box3 } from './math/Box3';
import { Intersection, Raycaster } from './scene/tools/Raycaster';
import { Light } from './scene/lights/Light';
import { Viewer } from './Viewer';
import { BufferAttribute } from './elements/attributes/BufferAttribute';
import { PopBufferGeometry } from './elements/geometries/containers/PopBufferGeometry';
import { IPopbufferInfo } from './elements/geometries/containers/IPopBufferInfo';
import { Texture } from './elements/textures/Texture';
import { Matrix3 } from './math/Matrix3';
import { Matrix4 } from './math/Matrix4';
import { Sphere } from './math/Sphere';
import { Scene3D } from './scene/Scene3D';
import { logger } from './utils/Logger';
import { TypeAssert } from './scene/tools/TypeAssert';
import { SkinnedMesh } from './scene/drawables/SkinnedMesh';
import { Mesh } from './scene/drawables/Mesh';
import { SpriteBufferGeometry } from './elements/geometries/containers/SpriteBufferGeometry';
import { MipLevelSource, LayerSource, SourceTexture } from './elements/textures/SourceTexture';

function getInheritanceChainByConstructor(constructor: any): any[] {
    const result: any[] = [];
    let current: any = constructor;
    while (current) {
        result.push(current);
        const proto = Object.getPrototypeOf(current.prototype);
        if (proto) {
            current = proto.constructor;
        } else {
            current = undefined;
        }
    }
    return result;
}

let materialShaderComponents: Map<any, Set<string>>;
export function getMaterialShaderComponents(target: Material): Set<string> {
    if (!materialShaderComponents) {
        materialShaderComponents = new Map();
    }

    const classKey = target.constructor;
    let set = materialShaderComponents.get(classKey);
    if (!set) {
        set = new Set();
        const chain = getInheritanceChainByConstructor(target.constructor);
        // should append parent keys to current target
        for (const ctor of chain) {
            const embedded = materialShaderComponents.get(ctor);
            if (embedded) {
                embedded.forEach(key => set!.add(key));
            }
        }
        materialShaderComponents.set(classKey, set);
    }
    return set;
}

function registerEmbeddedShaderComponent(target: Material, propertyKey: string) {
    const set = getMaterialShaderComponents(target);
    if (set.has(propertyKey)) {
        logger.warn(`embedded component already registered: ${propertyKey} for ${target.constructor.name}`);
    }
    set.add(propertyKey);
}

let materialProperties: Map<any, Set<string>>;
export function getMaterialProperties(target: Material | ShaderComponent) {
    if (!materialProperties) {
        materialProperties = new Map();
    }

    const classKey = target.constructor;
    let set = materialProperties.get(classKey);
    if (!set) {
        set = new Set<string>();
        const chain = getInheritanceChainByConstructor(target.constructor);
        // should append parent keys to current target
        for (const ctor of chain) {
            const properties = materialProperties.get(ctor);
            if (properties) {
                properties.forEach(key => set!.add(key));
            }
        }
        materialProperties.set(classKey, set);
    }
    return set;
}

function registerMaterialProperty(target: Material | ShaderComponent, propertyKey: string) {
    const set = getMaterialProperties(target);
    if (set.has(propertyKey)) {
        logger.warn(`property already registered: ${propertyKey} for ${target.constructor.name}`);
    }
    set.add(propertyKey);
}

export function materialPropertyDeclare() {
    return function (_target: Material | ShaderComponent, _propertyKey: string) {
        // registerMaterialProperty(target, propertyKey);
    };
}

const materialGetSetCache = new Map<string, { getter: any, setter: any }>();
export function materialProperty() {
    return function (target: Material | ShaderComponent, propertyKey: string) {
        if (window.EGS_ENABLE_CONTENT_API !== true) {
            return;
        }
        registerMaterialProperty(target, propertyKey);
        (target as any).$ContentBridge = ContentBridge;

        let cache = materialGetSetCache.get(propertyKey);
        if (!cache) {
            const inner_name = '__' + propertyKey;
            const getter = new Function(`return this.${inner_name}`) as any;
            const setter = new Function('newVal', `
                if (this.${inner_name} === newVal) {
                    return;
                }
                this.$ContentBridge.materialSetProperty(this, '${propertyKey}', newVal);
                this.${inner_name} = newVal;
            `);
            cache = { getter, setter };
            materialGetSetCache.set(propertyKey, cache);
        }

        Object.defineProperty(target, propertyKey, {
            get: cache.getter,
            set: cache.setter,
        });
    };
}

export function shaderComponentInMaterial() {
    return function (target: any, propertyKey: string) {
        if (window.EGS_ENABLE_CONTENT_API !== true) {
            return;
        }

        registerEmbeddedShaderComponent(target, propertyKey);

        const inner_name = '__' + propertyKey;
        const getter = new Function(`return this.${inner_name}`) as any;
        const setter = function (this: any, newVal: any) {
            ContentBridge.materialSetShaderComponent(this, propertyKey, this[inner_name], newVal);
            this[inner_name] = newVal;
        };
        Object.defineProperty(target, propertyKey, {
            get: getter,
            set: setter
        });
    };
}

const lightProperties = new Map<any, Map<string, string>>();
export function getLightProperties(target: any) {
    if (window.EGS_ENABLE_CONTENT_API !== true) {
        return;
    }

    const classKey = target.constructor;
    let map = lightProperties.get(classKey);

    if (!map) {
        map = new Map();
        const chain = getInheritanceChainByConstructor(target.constructor);
        // should append parent keys to current target
        for (const ctor of chain) {
            const properties = lightProperties.get(ctor);
            if (properties) {
                properties.forEach((value, key) => map!.set(key, value));
            }
        }
        lightProperties.set(classKey, map);
    }
    return map;
}

function registerLightProperty(target: any, propertyKey: string, bridgeKey = propertyKey) {
    if (window.EGS_ENABLE_CONTENT_API !== true) {
        return;
    }
    const map = getLightProperties(target);
    if (!map) {
        return;
    }
    if (map.has(propertyKey)) {
        logger.warn(`property already registered: ${propertyKey} for ${target.constructor.name}`);
    }
    map.set(propertyKey, bridgeKey);
}

export function lightPropertyDeclare() {
    return registerLightProperty;
}
export function lightProperty(bridgeKey?: string) {
    return function (target: any, propertyKey: string) {
        if (window.EGS_ENABLE_CONTENT_API !== true) {
            return;
        }

        registerLightProperty(target, propertyKey, bridgeKey);

        const inner_name = '__' + propertyKey;
        const getter = new Function(`return this.${inner_name}`) as any;
        const setter = function (this: any, newVal: any) {
            if (TypeAssert.isLight(this)) {
                ContentBridge.lightSetProperty(this, bridgeKey || propertyKey, this, newVal);
            } else if (TypeAssert.isShadow(this)) {
                ContentBridge.lightSetProperty(this.light as Light, bridgeKey || propertyKey, this, newVal);
            } else {
                logger.unsupported(`unsupported light type: ${this}`);
            }
            this[inner_name] = newVal;
        };
        Object.defineProperty(target, propertyKey, {
            get: getter,
            set: setter
        });
    };
}

const drawableGetSetCache = new Map<string, { getter: any, setter: any }>();
export function drawableState() {
    return function (target: Drawable, propertyKey: string) {
        if (window.EGS_ENABLE_CONTENT_API !== true) {
            return;
        }
        (target as any).$ContentBridge = ContentBridge;

        let cache = drawableGetSetCache.get(propertyKey);
        if (!cache) {
            const inner_name = '__' + propertyKey;
            const getter = new Function(`return this.${inner_name}`) as any;
            const setter = new Function('newVal', `
                if (this.${inner_name} === newVal) {
                    return;
                }
                this.$ContentBridge.drawableSyncData(this, '${propertyKey}', newVal);
                this.${inner_name} = newVal;
            `);
            cache = { getter, setter };
            drawableGetSetCache.set(propertyKey, cache);
        }

        Object.defineProperty(target, propertyKey, {
            get: cache.getter,
            set: cache.setter,
        });
    };
}

export function cameraState() {
    return function (target: Camera3D, propertyKey: string) {
        if (window.EGS_ENABLE_CONTENT_API !== true) {
            return;
        }

        const inner_name = '__' + propertyKey;
        const getter = new Function(`return this.${inner_name}`) as any;
        const setter = function (this: any, newVal: any) {
            this[inner_name] = newVal;
            ContentBridge.cameraSyncData(this);
        };
        Object.defineProperty(target, propertyKey, {
            get: getter,
            set: setter
        });
    };
}

// This interface is the abstraction of "content" change. The content
// means the the description of what will be drawn such as scene object
// The implementor can subscribe any content change by implement this api
// The implementor can do mutation recording, validation, content synchronization
// (maybe into another memory heap like wasm, or across runtime/ environment
// boundaries like webworker/rpc/networking).
// Globally we can have multiple content api implementations. The mutation
// will be triggered and dispatched by the ContentBridge global object.
export interface ContentAPI {
    maintainTheWorld?(scene?: Scene3D): void;
    setEnablePhysicalShading?(v: boolean): void;
    init_default_texture?(t: Texture2D): void;
    init_ltc?(ltc_1: Texture2D, ltc_2: Texture2D): void;
    beforeFrame?(v: Viewer): void;
    afterFrame?(): void;

    bufferGeometryCreate?(geo: BufferGeometryBase): void;
    bufferGeometryDestroy?(geo: BufferGeometryBase): void;
    bufferGeometryFreeGPU?(geo: BufferGeometryBase): void;
    bufferGeometrySetAttribute?(geo: BufferGeometryBase, key: string, buffer: Nullable<BufferAttribute>): void;
    bufferGeometrySetIndexAttribute?(geo: BufferGeometryBase, buffer: Nullable<BufferAttribute>): void;
    bufferGeometrySetGroup?(geo: BufferGeometryBase, index: number, group: BufferGroup): void;
    bufferGeometryClearGroups?(geo: BufferGeometryBase): void;
    bufferGeometrySetInstanceCount?(geo: InstancedBufferGeometry, count: number): void;
    bufferGeometrySetIsFatline?(geo: InstancedBufferGeometry): void;
    bufferGeometrySetIsSprite?(geo: SpriteBufferGeometry): void;
    popBufferGeometrySetModel?(geo: PopBufferGeometry, model: IPopbufferInfo): void;

    bufferAttributeCreate?(attribute: BufferAttribute): void;
    bufferAttributeDestroy?(attribute: BufferAttribute): void;
    bufferAttributeFreeGPU?(attribute: BufferAttribute): void;
    bufferAttributeSetData?(attribute: BufferAttribute, data: TypedArray, itemSize: number, count: number): void;
    bufferAttributeNotifyContentChange?(attribute: BufferAttribute): void;

    textureCreate?(texture: Texture): void;
    textureDestroy?(texture: Texture): void;
    textureFreeGPU?(texture: Texture): void;
    textureSyncSamplerAndMetaInfo?(texture: Texture): void;
    textureSetLayerLevelSource?(texture: Texture, layer: number, level: number, source: any): void;
    sourceTextureSetLevelData?(texture: SourceTexture, source: MipLevelSource, level: number): void;
    sourceTextureSetLevelLayerData?(texture: SourceTexture, source: LayerSource, level: number, layer: number): void;

    targetCreate?(target: RenderTarget): void;
    targetDestroy?(target: RenderTarget): void;
    targetSync?(target: RenderTarget): void;
    targetSetAttachments?(target: RenderTarget, colors: Texture[], depth?: Texture): void;
    targetSetBindInfo?(target: RenderTarget, level: number, drawBuffers?: number[]): void;

    shaderComponentCreateAttachable?(shaderComponent: ShaderComponent): void;

    materialCreate?(material: Material): void;
    materialDestroy?(material: Material): void;
    materialFreeGPU?(material: Material): void;
    materialSetShaderComponent?(material: Material, key: string, prev: Nullable<ShaderComponent>, value: ShaderComponent): void;
    materialAddShaderComponent?(material: Material, component: ShaderComponent, index?: number): void;
    materialDeleteShaderComponent?(material: Material, component: ShaderComponent, index: number): void;
    materialSetProperty?(material: Material | ShaderComponent, key: string, value: any, force?: boolean): void;

    sceneNodeCreate?(node: Object3D): void;
    sceneNodeDestroy?(node: Object3D): void;
    sceneNodeFreeGPU?(node: Object3D): void;
    sceneNodeSyncData?(node: Object3D): void;
    sceneNodeUpdate?(node: Object3D): void;
    sceneNodeSyncMatrix?(node: Object3D): void;
    sceneNodeSyncLayers?(node: Object3D): void;
    sceneNodeAdd?(node: Object3D, child: Object3D): void;
    sceneNodeRemove?(node: Object3D, child: Object3D): void;
    sceneNodeAttachScene?(scene: Scene3D, node: Object3D): void;
    sceneNodeDetachScene?(scene: Scene3D, node: Object3D): void;

    drawableInit?(node: Drawable): void;
    drawableClearMaterial?(node: Drawable): void;
    drawableSetMaterial?(node: Drawable, material: Material, index: number): void;
    drawableSetGeometry?(node: Drawable, geometry: BufferGeometryBase): void;
    drawableSyncData?(node: Drawable, key: string, value: any): void;
    drawableSyncAllData?(node: Drawable): void;

    skinnedMeshSetSkeleton?<M extends Material, T extends Texture2D | SourceTexture>(node: SkinnedMesh<M, T>): void;
    skinnedMeshSyncBoneMatrices?<M extends Material, T extends Texture2D | SourceTexture>(node: SkinnedMesh<M, T>): void;

    lightInit?(light: Light): void;
    lightSetProperty?(light: Light, key: string, target: Light | Shadow<unknown>, value: any): void;

    cameraInit?(camera: Camera3D): void;
    cameraSyncData?(camera: Camera3D): void;
    cameraUpdateJitter?(camera: Camera3D, jitter: ReadonlyVector2): void;
    cameraUpdatePrev?(camera: Camera3D): void;

    sceneCreate?(scene: Scene3D): void;
    sceneSyncData?(scene: Scene3D): void;
    sceneUpdate?(scene: Scene3D): void;
    sceneDestroy?(scene: Scene3D): void;
}

export interface WorldRebuildConfig {
    startupMemorySize?: number;
    allocUnitSize?: number;
}

// Besides the content API, the ContentManagedAPI is another story..
// The content API's main purpose, as we mentioned, is to dispatch
// the content's change to others, so the methods on the interface
// should not return any values because it's meaningless
// (we can have multiple implementors).
// However, in some cases, for example wasm optimization, we did need
// the host(the egs scene itself) delegate some expensive works to
// the implementor(the content api implementor) which require return value,
// Another consideration is even if we don't bother by the return value
// the host's work could be eliminate if some content is actually owned
// and managed by implementors, so we should have a formal way to express
// such ownership information.
// so we create this interface.
export interface ContentManagedAPI extends ContentAPI {
    isContentOwnGeometricData(): boolean;
    bufferAttributeGetRefreshDataView(attribute: BufferAttribute): void;
    bufferAttributeApplyMat3(attribute: BufferAttribute, mat3: Matrix3): void;
    bufferAttributeApplyMat4(attribute: BufferAttribute, mat4: Matrix4): void;
    bufferGeometryGetLocalBBox(geo: BufferGeometryBase): Box3;
    bufferGeometryGetLocalBBall(geo: BufferGeometryBase): Sphere;
    meshGetLocalBBox(mesh: Mesh): Box3;
    raycast(drawable: Drawable, result: Intersection[], raycaster: Raycaster): void;
    raycastFirst(drawable: Drawable, raycaster: Raycaster): Intersection | null;
    raycastScene(scene: Scene3D, result: Intersection[], raycaster: Raycaster): void;
    raycastSceneFirst(scene: Scene3D, raycaster: Raycaster): Intersection | null;
    raycastList(list: Object3D[], recursive: boolean, result: Intersection[], raycaster: Raycaster): void;
    raycastListFirst(list: Object3D[], recursive: boolean, raycaster: Raycaster): Intersection | null;
    sceneTick(scene: Scene3D, timestamp: number): void;
    sceneOptimize(scene: Scene3D): void;
    rebuildWorld(config?: WorldRebuildConfig): Promise<void>;
}

export * from './ContentAPI.impl';
