export { logger } from './utils/Logger';
export { MaterialShadingWithDynamicShapeDispatcher, DefaultMaterialDispatcher, MaterialDispatcher } from './renderer/MaterialDispatcher';
export { ForwardDispatcher, PlanarShadowDispatcher, BeforeScenePassEvent, AfterScenePassEvent } from './fx/plugins/Forward';
export { ShadowMode, PipelineAPI, IPipelineFilter, PipelineFilters } from './fx/PipelineAPI';
export { EncodeDispatcher } from './fx/plugins/Outline';
export { RenderObjectsType, DrawableList, ProjectedDrawcallList, DrawcallListClassifyType, DrawcallListClassifyList } from './scene/tools/DrawcallList';
export { InstancedBufferGeometry } from './elements/geometries/containers/InstancedBufferGeometry';
export { SpriteBufferGeometry } from './elements/geometries/containers/SpriteBufferGeometry';
export { ShaderComponent } from './renderer/shader/Shader';
export { Texture2DCommonLayer } from './elements/textures/Texture2D';
export { Camera3D } from './scene/cameras/Camera3D';
export { Object3DChangeEvent } from './scene/Object3D';
export { RenderTarget, RenderAttachment } from './elements/textures/RenderTarget';
export { Nullable, TypedArray, IRange } from './utils/Utils';
export { IRenderer, RendererStatus, RendererState, RendererParameters, RenderCtxInfo, MemoryGrowFailed } from './renderer/IRenderer';
export { registerGlobal3DRendererOverride, resetGlobal3DRendererOverride, } from './renderer/RendererOverride';
export { EnvMapMaterial } from './elements/materials/mesh/EnvMapMaterial';
export { GradientMaterial } from './elements/materials/mesh/GradientMaterial';
export { GroundMaterial } from './elements/materials/mesh/GroundMaterial';
export { AlphaShaderComponent } from './renderer/shader/components/AlphaShaderComponent';
export { ColorShaderComponent } from './renderer/shader/components/ColorShaderComponent';
export { SkinningShaderComponent } from './renderer/shader/components/SkinningShaderComponent';
export { PreSkyMapMaterial, SkyMaterial } from './elements/materials/mesh/SkyMaterial';
export { Shadow } from './scene/shadows/Shadow';
export { DirectionalShadow } from './scene/shadows/DirectionalShadow';
export { PointShadow } from './scene/shadows/PointShadow';
export { SpotShadow } from './scene/shadows/SpotShadow';
export { BlurPassMaterial } from './elements/materials/quad/BlurPassMaterial';
export { MixColorAndDepthMaterial, CopyColorAndDepthMaterial, CopyDepthMaterial, CopyMaterial } from './elements/materials/quad/CopyMaterial';
export { MixOITMaterial } from './elements/materials/quad/MixOITMaterial';
export { MixPlanarShadowMaterial } from './elements/materials/quad/MixPlanarShadowMaterial';
export { HighLightBlendPassMaterial } from './elements/materials/quad/HighLightBlendPassMaterial';
export { DownsampleMaterial } from './elements/materials/quad/DownsampleMaterial';
export { OutlineComputeMaterial } from './elements/materials/quad/OutlineComputeMaterial';
export { OutlineComposeMaterial } from './elements/materials/quad/OutlineComposeMaterial';
export { OutlineEncodeMaterial } from './elements/materials/mesh/OutlineEncodeMaterial';
export { SSAOBlurPassMaterial } from './elements/materials/quad/SSAOBlurPassMaterial';
export { SSAOPassMaterial } from './elements/materials/quad/SSAOPassMaterial';
export { TAAMaterial } from './elements/materials/quad/TAAMaterial';
export { PseudoColorMaterial } from './elements/materials/quad/PseudoColorMaterial';
export { RoomBoxMaterial } from './elements/materials/mesh/RoomBoxMaterial';
export { PlanarShadowMaterial } from './elements/materials/mesh/PlanarShadowMaterial';
export { FilterMaterial } from './elements/materials/quad/FilterMaterial';
export { ToonMaterial } from './elements/materials/mesh/ToonMaterial';
export { OITMaterial } from './elements/materials/mesh/OITMaterial';
export {
    ExposedCopyMaterial, ExposedToneMappingMaterial,
    DialuxLuminanceMaterial, DialuxWhiteBalanceExposureMaterial,
    HistogramComputeMaterial, AvgLuminanceMaterial
} from './elements/materials/quad/ExposedCopyMaterial';
export { ToneMappingMaterial } from './elements/materials/quad/ToneMappingMaterial';
export { BackgroundLikeMaterial } from './elements/materials/base';
export {
    DeferredDrawAmbientLightMaterial, DeferredDrawDirectionalLightMaterial,
    DeferredDrawDiskAreaLightMaterial, DeferredDrawPointLightMaterial,
    DeferredDrawRectAreaLightMaterial, DeferredDrawSpotLightMaterial
} from './fx/plugins/Deferred';

export { registerPipelineContentAPI, removePipelineContentAPI } from './fx/PipelineAPI';
export { registerContentAPI, unregisterContentAPI, ContentManagedAPI, ContentAPI, registerManagedContentAPI, removeManagedContentAPI, WorldRebuildConfig } from './ContentAPI';
export { LegacySourceTexture } from './elements/textures/Texture';
export { textureCopyInfo, textureCopyFootprint } from './elements/textures/types';

export { RenderInfo } from './utils/RenderInfo';
export { Renderable } from './scene/renderables/IRenderable';
export { WebGLExtEnums } from './renderer/webgl/WGLExtensions';
export { WGLConstantsConvertor } from './renderer/webgl/WGLConstantsConvertor';
export { WGLExtensions } from './renderer/webgl/WGLExtensions';
export { getBufferSubDataAsync } from './utils/AsyncRead';
export { Platform } from './utils/Platform';
export { getMaterialShaderComponents, getMaterialProperties } from './ContentAPI';
export { ToggleWebGPUEvent, WebGPUUnstable, WebGPUValidationFailed } from './Bridge/utils';
export { IterableWeakMap, IterableWeakSet } from './utils/WeakCollections';
export { DeferredDispatcher } from './renderer/MaterialDispatcher';
export { setupWebGLCapabilities } from './renderer/webgl/WGLCapabilities';
export { setupWebGPUCapabilities, Capabilities, setupWebGPUCompressedTextureCapabilities } from './renderer/Capabilities';
export { setSortSplats, SplattingRenderMode } from './fx/plugins/Splatting';
export { CompressedSplat } from './scene/splat/CompressedSplat';
export { SuperCompressedSplat } from './scene/splat/SuperCompressedSplat';
export { SogSplat, SogSplatMeta } from './scene/splat/SogSplat';

export { GLOBAL_CONFIG } from './utils/GlobalConfig';
export { Deferred, deferred } from './utils/Deferred';
export { BVHStrategyType, BVHBuilderData, BVH, BVHRaw, BVHBuilder } from './BVH';

export { ViewerPlugin } from './Viewer';

import {
    serializeObject3D as deprecatedSerializeObject3D,
    parseObjects as deprecatedParseObjects,
    deepCloneObject3D as deprecatedDeepCloneObject3D,
    downloadStringAsFile as deprecatedDownloadStringAsFile,
} from './scene/tools/SceneIO';

let serializeObject3D = deprecatedSerializeObject3D;
let parseObjects = deprecatedParseObjects;
let deepCloneObject3D = deprecatedDeepCloneObject3D;
let downloadStringAsFile = deprecatedDownloadStringAsFile;
export function injectSerialize(inject: {
    serializeObject3D: typeof serializeObject3D,
    parseObjects: typeof parseObjects,
    deepCloneObject3D: typeof deepCloneObject3D,
    downloadStringAsFile: typeof downloadStringAsFile,
}) {
    serializeObject3D = inject.serializeObject3D;
    parseObjects = inject.parseObjects;
    deepCloneObject3D = inject.deepCloneObject3D;
    downloadStringAsFile = inject.downloadStringAsFile;
}
export { serializeObject3D, parseObjects, deepCloneObject3D, downloadStringAsFile };

export function afterWASMInit() {
    require('./Bridge').afterWASMInit();
}

export function beforeAPIRegister() {
    require('./Bridge').beforeAPIRegister();
}

// gpu driven
export { DrivenCullingMaterial } from './elements/materials/driven/DrivenCullingMaterial';
export { DrivenShadingMaterial } from './elements/materials/driven/DrivenShadingMaterial';
export { DrivenGenHZBMaterial } from './elements/materials/driven/DrivenGenHZBMaterial';
