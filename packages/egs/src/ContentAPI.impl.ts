// @ts-nocheck
// AUTO GENERATED DO NOT MODIFY, IF FOUND COMPILE ERROR RUN "pnpm generate:content-api" in package/egs-main

import type { TypedArray, Nullable } from './utils/Utils';
import type { BufferGeometryBase, BufferGroup } from './elements/geometries/containers/BufferGeometry';
import type { Material } from './elements/materials/Material';
import type { Object3D } from './scene/Object3D';
import type { InstancedBufferGeometry } from './elements/geometries/containers/InstancedBufferGeometry';
import type { RenderTarget, RenderTargetCube } from './elements/textures/RenderTarget';
import type { Drawable } from './scene/drawables/Drawable';
import type { Camera3D } from './scene/cameras/Camera3D';
import type { Texture2D } from './elements/textures/Texture2D';
import type { ShaderComponent } from './renderer/shader/Shader';
import type { Shadow } from './scene/shadows/Shadow';
import type { Intersection, Raycaster } from './scene/tools/Raycaster';
import type { Light } from './scene/lights/Light';
import type { Viewer } from './Viewer';
import type { BufferAttribute } from './elements/attributes/BufferAttribute';
import type { PopBufferGeometry } from './elements/geometries/containers/PopBufferGeometry';
import type { IPopbufferInfo } from './elements/geometries/containers/IPopBufferInfo';
import type { SkinnedMesh } from './scene/drawables/SkinnedMesh';
import type { Texture } from './elements/textures/Texture';
import type { MipLevelSource, LayerSource, SourceTexture } from './elements/textures/SourceTexture';
import type { Matrix3 } from './math/Matrix3';
import type { Matrix4 } from './math/Matrix4';
import type { Scene3D } from './scene/Scene3D';
import type { ReadonlyVector2 } from './math/Vector2';
import type { ContentAPI, ContentManagedAPI, WorldRebuildConfig } from './ContentAPI';

let registeredManagedContentAPI: ContentManagedAPI | undefined;
export function registerManagedContentAPI(api: ContentManagedAPI) {
    registeredManagedContentAPI = api;
}
export function hasManagedContentAPI() {
    return registeredManagedContentAPI !== undefined;
}
export function removeManagedContentAPI() {
    registeredManagedContentAPI = undefined;
}
export function disposeManagedContentAPI() {
    registeredManagedContentAPI?.dispose();
    registeredManagedContentAPI = undefined;
    globalThis.EGS_MANAGED_CONTENT_API_DISABLED = true;
}

const warnInvalidInternalStaticInitLogic = new Proxy(
    {},
    {
        get: (_: any, key: string) => {
            console.warn('invalid egs static init logic: ', key);
            return () => {};
        },
    },
);

const registeredContentAPI: ContentAPI[] = [warnInvalidInternalStaticInitLogic];

export function hasAnyRegisteredContentAPI() {
    return registeredContentAPI.length !== 0;
}

export function registerContentAPI(api: ContentAPI) {
    registeredContentAPI.push(api);
}

export function unregisterContentAPI(api: ContentAPI) {
    const index = registeredContentAPI.indexOf(api);
    if (index > -1) {
        registeredContentAPI.splice(index, 1);
    }
}

export function egsInitFinished() {
    unregisterContentAPI(warnInvalidInternalStaticInitLogic);
}

export const ContentBridge: Required<ContentAPI> = {
    maintainTheWorld(scene?: Scene3D) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.maintainTheWorld?.(scene);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    setEnablePhysicalShading(v: boolean) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.setEnablePhysicalShading?.(v);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    init_default_texture(t: Texture2D) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.init_default_texture?.(t);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    init_ltc(ltc_1: Texture2D, ltc_2: Texture2D) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.init_ltc?.(ltc_1, ltc_2);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    beforeFrame(v: Viewer) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.beforeFrame?.(v);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    afterFrame() {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.afterFrame?.();
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    bufferGeometryCreate(geo: BufferGeometryBase) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.bufferGeometryCreate?.(geo);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    bufferGeometryDestroy(geo: BufferGeometryBase) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.bufferGeometryDestroy?.(geo);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    bufferGeometryFreeGPU(geo: BufferGeometryBase) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.bufferGeometryFreeGPU?.(geo);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    bufferGeometrySetAttribute(geo: BufferGeometryBase, key: string, buffer: Nullable<BufferAttribute>) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.bufferGeometrySetAttribute?.(geo, key, buffer);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    bufferGeometrySetIndexAttribute(geo: BufferGeometryBase, buffer: Nullable<BufferAttribute>) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.bufferGeometrySetIndexAttribute?.(geo, buffer);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    bufferGeometrySetGroup(geo: BufferGeometryBase, index: number, group: BufferGroup) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.bufferGeometrySetGroup?.(geo, index, group);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    bufferGeometryClearGroups(geo: BufferGeometryBase) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.bufferGeometryClearGroups?.(geo);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    bufferGeometrySetInstanceCount(geo: InstancedBufferGeometry, count: number) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.bufferGeometrySetInstanceCount?.(geo, count);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    bufferGeometrySetIsFatline(geo: InstancedBufferGeometry) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.bufferGeometrySetIsFatline?.(geo);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    bufferGeometrySetIsSprite(geo: SpriteBufferGeometry) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.bufferGeometrySetIsSprite?.(geo);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    popBufferGeometrySetModel(geo: PopBufferGeometry, model: IPopbufferInfo) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.popBufferGeometrySetModel?.(geo, model);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    bufferAttributeCreate(attribute: BufferAttribute) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.bufferAttributeCreate?.(attribute);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    bufferAttributeDestroy(attribute: BufferAttribute) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.bufferAttributeDestroy?.(attribute);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    bufferAttributeFreeGPU(attribute: BufferAttribute) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.bufferAttributeFreeGPU?.(attribute);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    bufferAttributeSetData(
        attribute: BufferAttribute,
        data: TypedArray,
        itemSize: number,
        count: number,
        normalized: boolean,
    ) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.bufferAttributeSetData?.(attribute, data, itemSize, count, normalized);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    bufferAttributeNotifyContentChange(attribute: BufferAttribute) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.bufferAttributeNotifyContentChange?.(attribute);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    textureCreate(texture: Texture) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.textureCreate?.(texture);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    textureDestroy(texture: Texture) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.textureDestroy?.(texture);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    textureFreeGPU(texture: Texture) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.textureFreeGPU?.(texture);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    textureSyncSamplerAndMetaInfo(texture: Texture) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.textureSyncSamplerAndMetaInfo?.(texture);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    textureSetLayerLevelSource(texture: Texture, layer: number, level: number, source: any) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.textureSetLayerLevelSource?.(texture, layer, level, source);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    sourceTextureSetLevelData(texture: SourceTexture, source: MipLevelSource, level: number) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.sourceTextureSetLevelData?.(texture, source, level);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    sourceTextureSetLevelLayerData(texture: SourceTexture, source: LayerSource, level: number, layer: number) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.sourceTextureSetLevelLayerData?.(texture, source, level, layer);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    targetCreate(target: RenderTarget) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.targetCreate?.(target);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    targetDestroy(target: RenderTarget) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.targetDestroy?.(target);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    targetSync(target: RenderTarget) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.targetSync?.(target);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    targetSetAttachments(target: RenderTarget, colors: Texture[], depth?: Texture) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.targetSetAttachments?.(target, colors, depth);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    targetSetBindInfo(target: RenderTarget, level: number, drawBuffers?: number[]) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.targetSetBindInfo?.(target, level, drawBuffers);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    shaderComponentCreateAttachable(shaderComponent: ShaderComponent) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.shaderComponentCreateAttachable?.(shaderComponent);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    materialCreate(material: Material) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.materialCreate?.(material);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    materialDestroy(material: Material) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.materialDestroy?.(material);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    materialFreeGPU(material: Material) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.materialFreeGPU?.(material);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    materialSetShaderComponent(
        material: Material,
        key: string,
        prev: Nullable<ShaderComponent>,
        value: ShaderComponent,
    ) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.materialSetShaderComponent?.(material, key, prev, value);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    materialAddShaderComponent(material: Material, component: ShaderComponent, index?: number) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.materialAddShaderComponent?.(material, component, index);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    materialDeleteShaderComponent(material: Material, component: ShaderComponent, index: number) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.materialDeleteShaderComponent?.(material, component, index);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    materialSetProperty(material: Material | ShaderComponent, key: string, value: any, force?: boolean) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.materialSetProperty?.(material, key, value, force);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    sceneNodeCreate(node: Object3D) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.sceneNodeCreate?.(node);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    sceneNodeDestroy(node: Object3D) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.sceneNodeDestroy?.(node);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    sceneNodeFreeGPU(node: Object3D) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.sceneNodeFreeGPU?.(node);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    sceneNodeSyncData(node: Object3D) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.sceneNodeSyncData?.(node);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    sceneNodeUpdate(node: Object3D) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.sceneNodeUpdate?.(node);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    sceneNodeSyncMatrix(node: Object3D) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.sceneNodeSyncMatrix?.(node);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    sceneNodeSyncLayers(node: Object3D) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.sceneNodeSyncLayers?.(node);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    sceneNodeAdd(node: Object3D, child: Object3D) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.sceneNodeAdd?.(node, child);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    sceneNodeRemove(node: Object3D, child: Object3D) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.sceneNodeRemove?.(node, child);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    sceneNodeAttachScene(scene: Scene3D, node: Object3D) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.sceneNodeAttachScene?.(scene, node);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    sceneNodeDetachScene(scene: Scene3D, node: Object3D) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.sceneNodeDetachScene?.(scene, node);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    drawableInit(node: Drawable) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.drawableInit?.(node);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    drawableClearMaterial(node: Drawable) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.drawableClearMaterial?.(node);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    drawableSetMaterial(node: Drawable, material: Material, index: number) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.drawableSetMaterial?.(node, material, index);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    drawableSetGeometry(node: Drawable, geometry: BufferGeometryBase) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.drawableSetGeometry?.(node, geometry);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    drawableSyncData(node: Drawable, key: string, value: any) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.drawableSyncData?.(node, key, value);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    drawableSyncAllData(node: Drawable) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.drawableSyncAllData?.(node);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    skinnedMeshSetSkeleton<M extends Material, T extends Texture2D | SourceTexture>(node: SkinnedMesh<M, T>) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.skinnedMeshSetSkeleton?.(node);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    skinnedMeshSyncBoneMatrices<M extends Material, T extends Texture2D | SourceTexture>(node: SkinnedMesh<M, T>) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.skinnedMeshSyncBoneMatrices?.(node);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    lightInit(light: Light) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.lightInit?.(light);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    lightSetProperty(light: Light, key: string, target: Light | Shadow<unknown>, value: any) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.lightSetProperty?.(light, key, target, value);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    cameraInit(camera: Camera3D) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.cameraInit?.(camera);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    cameraSyncData(camera: Camera3D) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.cameraSyncData?.(camera);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    cameraUpdateJitter(camera: Camera3D, jitter: ReadonlyVector2) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.cameraUpdateJitter?.(camera, jitter);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    cameraUpdatePrev(camera: Camera3D) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.cameraUpdatePrev?.(camera);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    sceneCreate(scene: Scene3D) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.sceneCreate?.(scene);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    sceneSyncData(scene: Scene3D) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.sceneSyncData?.(scene);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    sceneUpdate(scene: Scene3D) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.sceneUpdate?.(scene);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    sceneDestroy(scene: Scene3D) {
        try {
            const _l = registeredContentAPI.length;
            for (let _i = 0; _i < _l; _i++) {
                registeredContentAPI[_i]?.sceneDestroy?.(scene);
            }
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
};

export const ManagedContentBridge: Required<ContentManagedAPI> = {
    maintainTheWorld(scene?: Scene3D) {
        try {
            return registeredManagedContentAPI?.maintainTheWorld?.(scene);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    setEnablePhysicalShading(v: boolean) {
        try {
            return registeredManagedContentAPI?.setEnablePhysicalShading?.(v);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    init_default_texture(t: Texture2D) {
        try {
            return registeredManagedContentAPI?.init_default_texture?.(t);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    init_ltc(ltc_1: Texture2D, ltc_2: Texture2D) {
        try {
            return registeredManagedContentAPI?.init_ltc?.(ltc_1, ltc_2);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    beforeFrame(v: Viewer) {
        try {
            return registeredManagedContentAPI?.beforeFrame?.(v);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    afterFrame() {
        try {
            return registeredManagedContentAPI?.afterFrame?.();
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    bufferGeometryCreate(geo: BufferGeometryBase) {
        try {
            return registeredManagedContentAPI?.bufferGeometryCreate?.(geo);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    bufferGeometryDestroy(geo: BufferGeometryBase) {
        try {
            return registeredManagedContentAPI?.bufferGeometryDestroy?.(geo);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    bufferGeometryFreeGPU(geo: BufferGeometryBase) {
        try {
            return registeredManagedContentAPI?.bufferGeometryFreeGPU?.(geo);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    bufferGeometrySetAttribute(geo: BufferGeometryBase, key: string, buffer: Nullable<BufferAttribute>) {
        try {
            return registeredManagedContentAPI?.bufferGeometrySetAttribute?.(geo, key, buffer);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    bufferGeometrySetIndexAttribute(geo: BufferGeometryBase, buffer: Nullable<BufferAttribute>) {
        try {
            return registeredManagedContentAPI?.bufferGeometrySetIndexAttribute?.(geo, buffer);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    bufferGeometrySetGroup(geo: BufferGeometryBase, index: number, group: BufferGroup) {
        try {
            return registeredManagedContentAPI?.bufferGeometrySetGroup?.(geo, index, group);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    bufferGeometryClearGroups(geo: BufferGeometryBase) {
        try {
            return registeredManagedContentAPI?.bufferGeometryClearGroups?.(geo);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    bufferGeometrySetInstanceCount(geo: InstancedBufferGeometry, count: number) {
        try {
            return registeredManagedContentAPI?.bufferGeometrySetInstanceCount?.(geo, count);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    bufferGeometrySetIsFatline(geo: InstancedBufferGeometry) {
        try {
            return registeredManagedContentAPI?.bufferGeometrySetIsFatline?.(geo);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    bufferGeometrySetIsSprite(geo: SpriteBufferGeometry) {
        try {
            return registeredManagedContentAPI?.bufferGeometrySetIsSprite?.(geo);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    popBufferGeometrySetModel(geo: PopBufferGeometry, model: IPopbufferInfo) {
        try {
            return registeredManagedContentAPI?.popBufferGeometrySetModel?.(geo, model);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    bufferAttributeCreate(attribute: BufferAttribute) {
        try {
            return registeredManagedContentAPI?.bufferAttributeCreate?.(attribute);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    bufferAttributeDestroy(attribute: BufferAttribute) {
        try {
            return registeredManagedContentAPI?.bufferAttributeDestroy?.(attribute);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    bufferAttributeFreeGPU(attribute: BufferAttribute) {
        try {
            return registeredManagedContentAPI?.bufferAttributeFreeGPU?.(attribute);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    bufferAttributeSetData(
        attribute: BufferAttribute,
        data: TypedArray,
        itemSize: number,
        count: number,
        normalized: boolean,
    ) {
        try {
            return registeredManagedContentAPI?.bufferAttributeSetData?.(attribute, data, itemSize, count, normalized);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    bufferAttributeNotifyContentChange(attribute: BufferAttribute) {
        try {
            return registeredManagedContentAPI?.bufferAttributeNotifyContentChange?.(attribute);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    textureCreate(texture: Texture) {
        try {
            return registeredManagedContentAPI?.textureCreate?.(texture);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    textureDestroy(texture: Texture) {
        try {
            return registeredManagedContentAPI?.textureDestroy?.(texture);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    textureFreeGPU(texture: Texture) {
        try {
            return registeredManagedContentAPI?.textureFreeGPU?.(texture);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    textureSyncSamplerAndMetaInfo(texture: Texture) {
        try {
            return registeredManagedContentAPI?.textureSyncSamplerAndMetaInfo?.(texture);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    textureSetLayerLevelSource(texture: Texture, layer: number, level: number, source: any) {
        try {
            return registeredManagedContentAPI?.textureSetLayerLevelSource?.(texture, layer, level, source);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    sourceTextureSetLevelData(texture: SourceTexture, source: MipLevelSource, level: number) {
        try {
            return registeredManagedContentAPI?.sourceTextureSetLevelData?.(texture, source, level);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    sourceTextureSetLevelLayerData(texture: SourceTexture, source: LayerSource, level: number, layer: number) {
        try {
            return registeredManagedContentAPI?.sourceTextureSetLevelLayerData?.(texture, source, level, layer);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    targetCreate(target: RenderTarget) {
        try {
            return registeredManagedContentAPI?.targetCreate?.(target);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    targetDestroy(target: RenderTarget) {
        try {
            return registeredManagedContentAPI?.targetDestroy?.(target);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    targetSync(target: RenderTarget) {
        try {
            return registeredManagedContentAPI?.targetSync?.(target);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    targetSetAttachments(target: RenderTarget, colors: Texture[], depth?: Texture) {
        try {
            return registeredManagedContentAPI?.targetSetAttachments?.(target, colors, depth);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    targetSetBindInfo(target: RenderTarget, level: number, drawBuffers?: number[]) {
        try {
            return registeredManagedContentAPI?.targetSetBindInfo?.(target, level, drawBuffers);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    shaderComponentCreateAttachable(shaderComponent: ShaderComponent) {
        try {
            return registeredManagedContentAPI?.shaderComponentCreateAttachable?.(shaderComponent);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    materialCreate(material: Material) {
        try {
            return registeredManagedContentAPI?.materialCreate?.(material);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    materialDestroy(material: Material) {
        try {
            return registeredManagedContentAPI?.materialDestroy?.(material);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    materialFreeGPU(material: Material) {
        try {
            return registeredManagedContentAPI?.materialFreeGPU?.(material);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    materialSetShaderComponent(
        material: Material,
        key: string,
        prev: Nullable<ShaderComponent>,
        value: ShaderComponent,
    ) {
        try {
            return registeredManagedContentAPI?.materialSetShaderComponent?.(material, key, prev, value);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    materialAddShaderComponent(material: Material, component: ShaderComponent, index?: number) {
        try {
            return registeredManagedContentAPI?.materialAddShaderComponent?.(material, component, index);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    materialDeleteShaderComponent(material: Material, component: ShaderComponent, index: number) {
        try {
            return registeredManagedContentAPI?.materialDeleteShaderComponent?.(material, component, index);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    materialSetProperty(material: Material | ShaderComponent, key: string, value: any, force?: boolean) {
        try {
            return registeredManagedContentAPI?.materialSetProperty?.(material, key, value, force);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    sceneNodeCreate(node: Object3D) {
        try {
            return registeredManagedContentAPI?.sceneNodeCreate?.(node);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    sceneNodeDestroy(node: Object3D) {
        try {
            return registeredManagedContentAPI?.sceneNodeDestroy?.(node);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    sceneNodeFreeGPU(node: Object3D) {
        try {
            return registeredManagedContentAPI?.sceneNodeFreeGPU?.(node);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    sceneNodeSyncData(node: Object3D) {
        try {
            return registeredManagedContentAPI?.sceneNodeSyncData?.(node);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    sceneNodeUpdate(node: Object3D) {
        try {
            return registeredManagedContentAPI?.sceneNodeUpdate?.(node);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    sceneNodeSyncMatrix(node: Object3D) {
        try {
            return registeredManagedContentAPI?.sceneNodeSyncMatrix?.(node);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    sceneNodeSyncLayers(node: Object3D) {
        try {
            return registeredManagedContentAPI?.sceneNodeSyncLayers?.(node);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    sceneNodeAdd(node: Object3D, child: Object3D) {
        try {
            return registeredManagedContentAPI?.sceneNodeAdd?.(node, child);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    sceneNodeRemove(node: Object3D, child: Object3D) {
        try {
            return registeredManagedContentAPI?.sceneNodeRemove?.(node, child);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    sceneNodeAttachScene(scene: Scene3D, node: Object3D) {
        try {
            return registeredManagedContentAPI?.sceneNodeAttachScene?.(scene, node);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    sceneNodeDetachScene(scene: Scene3D, node: Object3D) {
        try {
            return registeredManagedContentAPI?.sceneNodeDetachScene?.(scene, node);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    drawableInit(node: Drawable) {
        try {
            return registeredManagedContentAPI?.drawableInit?.(node);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    drawableClearMaterial(node: Drawable) {
        try {
            return registeredManagedContentAPI?.drawableClearMaterial?.(node);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    drawableSetMaterial(node: Drawable, material: Material, index: number) {
        try {
            return registeredManagedContentAPI?.drawableSetMaterial?.(node, material, index);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    drawableSetGeometry(node: Drawable, geometry: BufferGeometryBase) {
        try {
            return registeredManagedContentAPI?.drawableSetGeometry?.(node, geometry);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    drawableSyncData(node: Drawable, key: string, value: any) {
        try {
            return registeredManagedContentAPI?.drawableSyncData?.(node, key, value);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    drawableSyncAllData(node: Drawable) {
        try {
            return registeredManagedContentAPI?.drawableSyncAllData?.(node);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    skinnedMeshSetSkeleton<M extends Material, T extends Texture2D | SourceTexture>(node: SkinnedMesh<M, T>) {
        try {
            return registeredManagedContentAPI?.skinnedMeshSetSkeleton?.(node);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    skinnedMeshSyncBoneMatrices<M extends Material, T extends Texture2D | SourceTexture>(node: SkinnedMesh<M, T>) {
        try {
            return registeredManagedContentAPI?.skinnedMeshSyncBoneMatrices?.(node);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    lightInit(light: Light) {
        try {
            return registeredManagedContentAPI?.lightInit?.(light);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    lightSetProperty(light: Light, key: string, target: Light | Shadow<unknown>, value: any) {
        try {
            return registeredManagedContentAPI?.lightSetProperty?.(light, key, target, value);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    cameraInit(camera: Camera3D) {
        try {
            return registeredManagedContentAPI?.cameraInit?.(camera);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    cameraSyncData(camera: Camera3D) {
        try {
            return registeredManagedContentAPI?.cameraSyncData?.(camera);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    cameraUpdateJitter(camera: Camera3D, jitter: ReadonlyVector2) {
        try {
            return registeredManagedContentAPI?.cameraUpdateJitter?.(camera, jitter);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    cameraUpdatePrev(camera: Camera3D) {
        try {
            return registeredManagedContentAPI?.cameraUpdatePrev?.(camera);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    sceneCreate(scene: Scene3D) {
        try {
            return registeredManagedContentAPI?.sceneCreate?.(scene);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    sceneSyncData(scene: Scene3D) {
        try {
            return registeredManagedContentAPI?.sceneSyncData?.(scene);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    sceneUpdate(scene: Scene3D) {
        try {
            return registeredManagedContentAPI?.sceneUpdate?.(scene);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    sceneDestroy(scene: Scene3D) {
        try {
            return registeredManagedContentAPI?.sceneDestroy?.(scene);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    isContentOwnGeometricData() {
        try {
            return registeredManagedContentAPI?.isContentOwnGeometricData?.();
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    bufferAttributeGetRefreshDataView(attribute: BufferAttribute) {
        try {
            return registeredManagedContentAPI?.bufferAttributeGetRefreshDataView?.(attribute);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    bufferAttributeApplyMat3(attribute: BufferAttribute, mat3: Matrix3) {
        try {
            return registeredManagedContentAPI?.bufferAttributeApplyMat3?.(attribute, mat3);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    bufferAttributeApplyMat4(attribute: BufferAttribute, mat4: Matrix4) {
        try {
            return registeredManagedContentAPI?.bufferAttributeApplyMat4?.(attribute, mat4);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    bufferGeometryGetLocalBBox(geo: BufferGeometryBase) {
        try {
            return registeredManagedContentAPI?.bufferGeometryGetLocalBBox?.(geo);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    bufferGeometryGetLocalBBall(geo: BufferGeometryBase) {
        try {
            return registeredManagedContentAPI?.bufferGeometryGetLocalBBall?.(geo);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    meshGetLocalBBox(mesh: Mesh) {
        try {
            return registeredManagedContentAPI?.meshGetLocalBBox?.(mesh);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    raycast(drawable: Drawable, result: Intersection[], raycaster: Raycaster) {
        try {
            return registeredManagedContentAPI?.raycast?.(drawable, result, raycaster);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    raycastFirst(drawable: Drawable, raycaster: Raycaster) {
        try {
            return registeredManagedContentAPI?.raycastFirst?.(drawable, raycaster);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    raycastScene(scene: Scene3D, result: Intersection[], raycaster: Raycaster) {
        try {
            return registeredManagedContentAPI?.raycastScene?.(scene, result, raycaster);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    raycastSceneFirst(scene: Scene3D, raycaster: Raycaster) {
        try {
            return registeredManagedContentAPI?.raycastSceneFirst?.(scene, raycaster);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    raycastList(list: Object3D[], recursive: boolean, result: Intersection[], raycaster: Raycaster) {
        try {
            return registeredManagedContentAPI?.raycastList?.(list, recursive, result, raycaster);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    raycastListFirst(list: Object3D[], recursive: boolean, raycaster: Raycaster) {
        try {
            return registeredManagedContentAPI?.raycastListFirst?.(list, recursive, raycaster);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    sceneTick(scene: Scene3D, timestamp: number) {
        try {
            return registeredManagedContentAPI?.sceneTick?.(scene, timestamp);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    sceneOptimize(scene: Scene3D) {
        try {
            return registeredManagedContentAPI?.sceneOptimize?.(scene);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    rebuildWorld(config?: WorldRebuildConfig) {
        try {
            return registeredManagedContentAPI?.rebuildWorld?.(config);
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
    dispose() {
        try {
            return registeredManagedContentAPI?.dispose?.();
        } catch (e) {
            if (window.EGS_WASM_FATAL_ERROR_OCCURRED !== true) {
                throw e;
            }
        }
    },
};
