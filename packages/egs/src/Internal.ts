export { logger } from './utils/Logger.js';
export {
    MaterialShadingWithDynamicShapeDispatcher,
    DefaultMaterialDispatcher,
    MaterialDispatcher,
} from './renderer/MaterialDispatcher.js';
export {
    ForwardDispatcher,
    PlanarShadowDispatcher,
    BeforeScenePassEvent,
    AfterScenePassEvent,
} from './fx/plugins/Forward.js';
export { ShadowMode, PipelineFilters } from './fx/PipelineAPI.js';
export type { PipelineAPI, IPipelineFilter } from './fx/PipelineAPI.js';
export { EncodeDispatcher } from './fx/plugins/Outline.js';
export {
    RenderObjectsType,
    DrawableList,
    ProjectedDrawcallList,
    DrawcallListClassifyList,
} from './scene/tools/DrawcallList.js';
export type { DrawcallListClassifyType } from './scene/tools/DrawcallList.js';
export { InstancedBufferGeometry } from './elements/geometries/containers/InstancedBufferGeometry.js';
export { SpriteBufferGeometry } from './elements/geometries/containers/SpriteBufferGeometry.js';
export { ShaderComponent } from './renderer/shader/Shader.js';
export { Texture2DCommonLayer } from './elements/textures/Texture2D.js';
export { Camera3D } from './scene/cameras/Camera3D.js';
export { Object3DChangeEvent } from './scene/Object3D.js';
export { RenderTarget, RenderAttachment } from './elements/textures/RenderTarget.js';
export type { Nullable, TypedArray, IRange } from './utils/Utils.js';
export { RendererState, RenderCtxInfo, MemoryGrowFailed, defaultLimits } from './renderer/IRenderer.js';
export type { IRenderer, RendererStatus, RendererParameters, Limits } from './renderer/IRenderer.js';
export { registerGlobal3DRendererOverride, resetGlobal3DRendererOverride } from './renderer/RendererOverride.js';
export { EnvMapMaterial } from './elements/materials/mesh/EnvMapMaterial.js';
export { GradientMaterial } from './elements/materials/mesh/GradientMaterial.js';
export { GroundMaterial } from './elements/materials/mesh/GroundMaterial.js';
export { AlphaShaderComponent } from './renderer/shader/components/AlphaShaderComponent.js';
export { ColorShaderComponent } from './renderer/shader/components/ColorShaderComponent.js';
export { SkinningShaderComponent } from './renderer/shader/components/SkinningShaderComponent.js';
export { PreSkyMapMaterial, SkyMaterial } from './elements/materials/mesh/SkyMaterial.js';
export { Shadow } from './scene/shadows/Shadow.js';
export { DirectionalShadow } from './scene/shadows/DirectionalShadow.js';
export { PointShadow } from './scene/shadows/PointShadow.js';
export { SpotShadow } from './scene/shadows/SpotShadow.js';
export { BlurPassMaterial } from './elements/materials/quad/BlurPassMaterial.js';
export {
    MixColorAndDepthMaterial,
    CopyColorAndDepthMaterial,
    CopyDepthMaterial,
    CopyMaterial,
} from './elements/materials/quad/CopyMaterial.js';
export { MixOITMaterial } from './elements/materials/quad/MixOITMaterial.js';
export { MixPlanarShadowMaterial } from './elements/materials/quad/MixPlanarShadowMaterial.js';
export { HighLightBlendPassMaterial } from './elements/materials/quad/HighLightBlendPassMaterial.js';
export { DownsampleMaterial } from './elements/materials/quad/DownsampleMaterial.js';
export { OutlineComputeMaterial } from './elements/materials/quad/OutlineComputeMaterial.js';
export { OutlineComposeMaterial } from './elements/materials/quad/OutlineComposeMaterial.js';
export { OutlineEncodeMaterial } from './elements/materials/mesh/OutlineEncodeMaterial.js';
export { SSAOBlurPassMaterial } from './elements/materials/quad/SSAOBlurPassMaterial.js';
export { SSAOPassMaterial } from './elements/materials/quad/SSAOPassMaterial.js';
export { TAAMaterial } from './elements/materials/quad/TAAMaterial.js';
export { PseudoColorMaterial } from './elements/materials/quad/PseudoColorMaterial.js';
export { RoomBoxMaterial } from './elements/materials/mesh/RoomBoxMaterial.js';
export { PlanarShadowMaterial } from './elements/materials/mesh/PlanarShadowMaterial.js';
export { FilterMaterial } from './elements/materials/quad/FilterMaterial.js';
export { ToonMaterial } from './elements/materials/mesh/ToonMaterial.js';
export { OITMaterial } from './elements/materials/mesh/OITMaterial.js';
export {
    ExposedCopyMaterial,
    ExposedToneMappingMaterial,
    DialuxLuminanceMaterial,
    DialuxWhiteBalanceExposureMaterial,
    HistogramComputeMaterial,
    AvgLuminanceMaterial,
} from './elements/materials/quad/ExposedCopyMaterial.js';
export { ToneMappingMaterial } from './elements/materials/quad/ToneMappingMaterial.js';
export { BackgroundLikeMaterial } from './elements/materials/base/index.js';
export {
    DeferredDrawAmbientLightMaterial,
    DeferredDrawDirectionalLightMaterial,
    DeferredDrawDiskAreaLightMaterial,
    DeferredDrawPointLightMaterial,
    DeferredDrawRectAreaLightMaterial,
    DeferredDrawSpotLightMaterial,
} from './fx/plugins/Deferred.js';

export { registerPipelineContentAPI, removePipelineContentAPI } from './fx/PipelineAPI.js';
export {
    registerContentAPI,
    unregisterContentAPI,
    registerManagedContentAPI,
    removeManagedContentAPI,
    disposeManagedContentAPI,
} from './ContentAPI.js';
export type { ContentManagedAPI, ContentAPI, WorldRebuildConfig } from './ContentAPI.js';
export { LegacySourceTexture } from './elements/textures/Texture.js';
export { textureCopyInfo, textureCopyFootprint } from './elements/textures/types.js';

export { RenderInfo } from './utils/RenderInfo.js';
export type { Renderable } from './scene/renderables/IRenderable.js';
export { WebGLExtEnums } from './renderer/webgl/WGLExtensions.js';
export { WGLConstantsConvertor } from './renderer/webgl/WGLConstantsConvertor.js';
export { WGLExtensions } from './renderer/webgl/WGLExtensions.js';
export { getBufferSubDataAsync } from './utils/AsyncRead.js';
export { Platform } from './utils/Platform.js';
export { getMaterialShaderComponents, getMaterialProperties } from './ContentAPI.js';
export { ToggleWebGPUEvent, WebGPUUnstable, WebGPUValidationFailed } from './Bridge/utils.js';
export { IterableWeakMap, IterableWeakSet } from './utils/WeakCollections.js';
export { DeferredDispatcher } from './renderer/MaterialDispatcher.js';
export { setupWebGLCapabilities, setupWebGLLimits } from './renderer/webgl/WGLCapabilities.js';
export {
    setupWebGPUCapabilities,
    Capabilities,
    setupWebGPUCompressedTextureCapabilities,
} from './renderer/Capabilities.js';
export { setSortSplats, SplattingRenderMode } from './fx/plugins/Splatting.js';
export { CompressedSplat } from './scene/splat/CompressedSplat.js';
export { SuperCompressedSplat } from './scene/splat/SuperCompressedSplat.js';
export { SogSplat } from './scene/splat/SogSplat.js';
export type { SogSplatMeta } from './scene/splat/SogSplat.js';

export { GLOBAL_CONFIG } from './utils/GlobalConfig.js';
export { deferred } from './utils/Deferred.js';
export type { Deferred } from './utils/Deferred.js';
export { BVHStrategyType, BVHBuilder } from './BVH/index.js';
export type { BVHBuilderData, BVH, BVHRaw } from './BVH/index.js';

export type { ViewerPlugin } from './Viewer.js';

import {
    serializeObject3D as deprecatedSerializeObject3D,
    parseObjects as deprecatedParseObjects,
    deepCloneObject3D as deprecatedDeepCloneObject3D,
    downloadStringAsFile as deprecatedDownloadStringAsFile,
} from './scene/tools/SceneIO.js';

let serializeObject3D = deprecatedSerializeObject3D;
let parseObjects = deprecatedParseObjects;
let deepCloneObject3D = deprecatedDeepCloneObject3D;
let downloadStringAsFile = deprecatedDownloadStringAsFile;
export function injectSerialize(inject: {
    serializeObject3D: typeof serializeObject3D;
    parseObjects: typeof parseObjects;
    deepCloneObject3D: typeof deepCloneObject3D;
    downloadStringAsFile: typeof downloadStringAsFile;
}) {
    serializeObject3D = inject.serializeObject3D;
    parseObjects = inject.parseObjects;
    deepCloneObject3D = inject.deepCloneObject3D;
    downloadStringAsFile = inject.downloadStringAsFile;
}
export { serializeObject3D, parseObjects, deepCloneObject3D, downloadStringAsFile };

export { afterWASMInit, beforeAPIRegister } from './Bridge/index.js';

// gpu driven
export { DrivenCullingMaterial } from './elements/materials/driven/DrivenCullingMaterial.js';
export { DrivenShadingMaterial } from './elements/materials/driven/DrivenShadingMaterial.js';
export { DrivenGenHZBMaterial } from './elements/materials/driven/DrivenGenHZBMaterial.js';
