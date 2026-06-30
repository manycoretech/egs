/* EGS System public APIs * */
import './check.js';
import './Bridge/index.js';

import * as shapeBuilderImport from './elements/geometries/builder/Index.js';
import * as geomOperatorImport from './elements/geometries/operators/Index.js';
import { egsInitFinished } from './ContentAPI.js';
export { Utils } from './utils/Utils.js';

export { ContextLostEvent, ContextLostRestoreFailedEvent, RendererBackend } from './renderer/IRenderer.js';
export type { MemoryInfo } from './renderer/IRenderer.js';
export { EventDispatcher, EventType } from './utils/EventDispatcher.js';
export {
    Viewer,
    ViewerResizeEvent,
    ViewerUnInitializeEvent,
    RenderOverEvent,
    RenderStatistics,
    RuntimeFatalErrorEvent,
} from './Viewer.js';
export type { HighLightItem, HighlightGroup } from './Viewer.js';
export type { Viewport } from './Viewport.js';
export { createViewerContext } from './ViewerContext.js';
export type { IViewerContext } from './ViewerContext.js';
export { ResetRendererEvent } from './engine/RenderEngine.js';
export { RenderMode, setViewerConfig } from './engine/EngineConfig.js';
export type { EngineInitializeConfig } from './engine/EngineConfig.js';
/**
 * @deprecated
 */
export { setViewerConfig as setValueToConfig } from './engine/EngineConfig.js';
export { Texture2DCompressed, CompressTexture2DLayer } from './elements/textures/Texture2DCompressed.js';
/**
 * @deprecated
 */
export { logger } from './utils/Logger.js';
export * from './snapshot/SnapshotRenderer.js';
export { PresetRenderConfig } from './snapshot/SnapshotRendererV2.js';
export { SnapshotResultResultType, SnapshotResult } from './snapshot/SnapshotResult.js';
export type { SnapshotCameraInfo } from './snapshot/SnapshotResult.js';
export {
    SnapshotBoxPrecision,
    SnapshotAxisDirection,
    computeCameraPosition,
    computeProjectionSize,
} from './snapshot/util.js';
export { Application, projectName } from './Application.js';

export { Box2 } from './math/Box2.js';
export { Box3 } from './math/Box3.js';
export { Color } from './math/Color.js';
export type { ReadonlyColor } from './math/Color.js';
export { Cylindrical } from './math/Cylindrical.js';
export { Euler } from './math/Euler.js';
export { Frustum } from './math/Frustum.js';
export { Interpolant } from './math/Interpolant.js';
export { Line3 } from './math/Line3.js';
export * from './math/Math.js';
export { Matrix3 } from './math/Matrix3.js';
export type { ReadonlyMatrix3 } from './math/Matrix3.js';
export { Matrix4 } from './math/Matrix4.js';
export type { ReadonlyMatrix4 } from './math/Matrix4.js';
export { Plane } from './math/Plane.js';
export { Quaternion } from './math/Quaternion.js';
export { Ray } from './math/Ray.js';
export { Sphere } from './math/Sphere.js';
export { Spherical } from './math/Spherical.js';
export { Triangle } from './math/Triangle.js';
export { Vector2 } from './math/Vector2.js';
export type { ReadonlyVector2 } from './math/Vector2.js';
export { Vector3 } from './math/Vector3.js';
export type { ReadonlyVector3 } from './math/Vector3.js';
export { Vector4 } from './math/Vector4.js';
export type { ReadonlyVector4 } from './math/Vector4.js';
export { Face3 } from './math/Face3.js';
export { Cone } from './math/Cone.js';
export * from './math/Readonly.js';
export { Shape } from './math/shape/plane/Shape.js';
export { Path } from './math/shape/plane/Path.js';
export * from './math/shape/curves/Curves.js';
export * from './math/shape/plane/Font.js';

export { Object3D } from './scene/Object3D.js';
export * from './scene/drawables/Drawable.js';

export { Texture, TextureMipmapGroup } from './elements/textures/Texture.js';
export { Texture2D, Texture2DLayer, Texture2DCommonLayer } from './elements/textures/Texture2D.js';
export { Texture3D, Texture3DLayer } from './elements/textures/Texture3D.js';
export { TextureCube } from './elements/textures/TextureCube.js';
export type { TextureCubeSide } from './elements/textures/TextureCube.js';

export { SourceTexture } from './elements/textures/SourceTexture.js';
export type { MipLevelSource, LayerSource } from './elements/textures/SourceTexture.js';
export { TextureDimension, TextureViewDimension, TextureFormat } from './elements/textures/types.js';

export { FatLineMaterial } from './elements/materials/mesh/FatLineMaterial.js';
export * from './elements/materials/mesh/MeshBasicMaterial.js';
export * from './elements/materials/mesh/MeshPhongMaterial.js';
export * from './elements/materials/mesh/MergedMeshPhongMaterial.js';
export * from './elements/materials/mesh/MeshDepthMaterial.js';
export * from './elements/materials/mesh/SpriteMaterial.js';
export * from './elements/materials/mesh/RoomBoxMaterial.js';
export * from './elements/materials/mesh/MeshNormalMaterial.js';
export * from './elements/materials/mesh/PanoEnvMaterial.js';
export * from './elements/materials/mesh/LineMaterial.js';
export * from './elements/materials/Material.js';
export * from './elements/materials/mesh/PointsMaterial.js';
export * from './elements/materials/mesh/PhysicalMaterial.js';
export { ToneMapping } from './elements/materials/quad/ToneMappingMaterial.js';
export { FilterTarget } from './elements/materials/quad/FilterMaterial.js';
export { SceneClipMaterial } from './elements/materials/base/index.js';

export * from './utils/Constants.js';
export * from './renderer/webgl/WGLConstants.js';
export * from './scene/renderables/Background.js';
export * from './scene/renderables/Ground.js';

import {
    DrawMode,
    SamplerWrap,
    SamplerFilter,
    BlendingEquation,
    BlendingFactor,
    StencilFunc,
    StencilOp,
} from './utils/Constants.js';

export {
    /**
     * @deprecated use DrawMode instead
     */
    DrawMode as WebGLDrawMode,
    /**
     * @deprecated use SamplerWrap instead
     */
    SamplerWrap as WebGLTextureWrap,
    /**
     * @deprecated use SamplerFilter instead
     */
    SamplerFilter as WebGLTextureFilter,
    /**
     * @deprecated use BlendingEquation instead
     */
    BlendingEquation as WebGLBlendingEquation,
    /**
     * @deprecated use BlendingFactor instead
     */
    BlendingFactor as WebGLBlendingDst,
    /**
     * @deprecated use StencilFunc instead
     */
    StencilFunc as WebGLStencilFunc,
    /**
     * @deprecated use StencilOp instead
     */
    StencilOp as WebGLStencilOp,
};

export { createDataTexture } from './scene/tools/mesh-merge/DataTextureCreator.js';

/**
 * @deprecated DON'T USE IT!!
 */
export type { TypedArray as TypeArray } from './utils/Utils.js';
export { TypeAssert } from './scene/tools/TypeAssert.js';
export { Scene3D } from './scene/Scene3D.js';
/**
 * @internal
 */
export { Scene3D as Scene } from './scene/Scene3D.js';
export { Layers } from './scene/tools/Layers.js';
export { Picker } from './scene/tools/Picker.js';
export * from './scene/tools/Raycaster.js';

export { Line } from './scene/drawables/Line.js';
export { LineSegments } from './scene/drawables/LineSegments.js';
export { Mesh } from './scene/drawables/Mesh.js';
export { Points } from './scene/drawables/Points.js';
export { PopMesh } from './scene/drawables/PopMesh.js';
export { Sprite } from './scene/drawables/Sprite.js';
export { SkinnedMesh } from './scene/drawables/SkinnedMesh.js';
export { Splat, SplatState, SplatRenderingStabilityChangedEvent, SplatSortedEvent } from './scene/splat/Splat.js';
export type { SplatEffectConfig } from './scene/splat/Splat.js';

export { InstanceMesh } from './scene/drawables/InstanceMesh.js';
export { FatLineSegments } from './scene/drawables/FatLineSegments.js';

export { Group } from './scene/Group.js';

export { Camera3D as Camera } from './scene/cameras/Camera3D.js';
export { ArrayCamera } from './scene/cameras/ArrayCamera.js';
export { PerspectiveCamera } from './scene/cameras/PerspectiveCamera.js';
export { OrthographicCamera } from './scene/cameras/OrthographicCamera.js';

export { ArrowHelper } from './scene/helpers/ArrowHelper.js';
export { AxisHelper } from './scene/helpers/AxisHelper.js';
export { GridHelper } from './scene/helpers/GridHelper.js';
export { CoordinateSystemHelper } from './scene/helpers/CoordinateSystemHelper.js';

export { Light } from './scene/lights/Light.js';
export { DirectionalLight } from './scene/lights/DirectionalLight.js';
export { PointLight } from './scene/lights/PointLight.js';
export { SpotLight } from './scene/lights/SpotLight.js';
export { RectAreaLight } from './scene/lights/RectAreaLight.js';
export { DiskAreaLight } from './scene/lights/DiskAreaLight.js';
export { HemisphereLight } from './scene/lights/HemisphereLight.js';
export { AmbientLight } from './scene/lights/AmbientLight.js';
export * from './renderer/shader/components/EnvMapIBLShaderComponent.js';
export * from './renderer/shader/components/SpottedShaderComponent.js';
export * from './renderer/shader/components/PavingShaderComponent.js';
export * from './renderer/shader/components/ClippingShaderComponent.js';
export * from './renderer/shader/components/PatternShaderComponent.js';

export * from './elements/attributes/BufferAttribute.js';
export { InstancedBufferAttribute } from './elements/attributes/InstancedBufferAttribute.js';

export { Geometry } from './elements/geometries/containers/Geometry.js';
export * from './elements/geometries/containers/BufferGeometry.js';
export { GeometryBase } from './elements/geometries/containers/GeometryBase.js';
export type { IPopbufferInfo } from './elements/geometries/containers/IPopBufferInfo.js';
export { PopBufferGeometry } from './elements/geometries/containers/PopBufferGeometry.js';
export { FatLineBufferGeometry } from './elements/geometries/containers/FatLineBufferGeometry.js';

export const shapeBuilder = shapeBuilderImport;
export const geomOperator = geomOperatorImport;

export { Clock } from './utils/Clock.js';

export { Capabilities } from './renderer/Capabilities.js';
export { TextureCompression } from './fx/plugins/PipelinePlugin.js';

// some webgl info need expose;
export { WGLCapabilities } from './renderer/webgl/WGLCapabilities.js';

export { Rectangle } from './math/shape/plane/Rectangle.js';
export { RoundedRectangle } from './math/shape/plane/RoundedRectangle.js';
export { Circle } from './math/shape/plane/Circle.js';
export { Ellipse } from './math/shape/plane/Ellipse.js';
export { Polygon } from './math/shape/plane/Polygon.js';

export { Ticker } from './utils/Ticker.js';

export { serializeObject3D, parseObjects, deepCloneObject3D, downloadStringAsFile } from './Internal.js';

/**
 * @internal
 */
export * as __INNER__ from './Internal.js';

/**
 * DO NOT USE THIS!!!!
 */
export * as __INTERNAL__ from './Internal.js';

egsInitFinished();
