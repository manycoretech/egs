/* EGS System public APIs * */
import './prepareWASM';

import * as shapeBuilderImport from './elements/geometries/builder/Index';
import * as geomOperatorImport from './elements/geometries/operators/Index';
import { egsInitFinished } from './ContentAPI';
export { Utils } from './utils/Utils';

export { ContextLostEvent, ContextLostRestoreFailedEvent, MemoryInfo, RendererBackend } from './renderer/IRenderer';
export { EventDispatcher, EventType } from './utils/EventDispatcher';
export {
    Viewer, ViewerResizeEvent, ViewerUnInitializeEvent, RenderOverEvent,
    RenderStatistics, HighLightItem, HighlightGroup, RuntimeFatalErrorEvent,
} from './Viewer';
export type { Viewport } from './Viewport';
export { IViewerContext, createViewerContext } from './ViewerContext';
export { ResetRendererEvent } from './engine/RenderEngine';
export { EngineInitializeConfig, RenderMode, setViewerConfig } from './engine/EngineConfig';
/**
 * @deprecated
 */
export { setViewerConfig as setValueToConfig } from './engine/EngineConfig';
export { Texture2DCompressed, CompressTexture2DLayer } from './elements/textures/Texture2DCompressed';
/**
 * @deprecated
 */
export { logger } from './utils/Logger';
export * from './snapshot/SnapshotRenderer';
export { PresetRenderConfig } from './snapshot/SnapshotRendererV2';
export { SnapshotResultResultType, SnapshotResult, SnapshotCameraInfo } from './snapshot/SnapshotResult';
export { SnapshotBoxPrecision, SnapshotAxisDirection, computeCameraPosition, computeProjectionSize } from './snapshot/util';
export { Application, projectName } from './Application';

export { Box2 } from './math/Box2';
export { Box3 } from './math/Box3';
export { Color, ReadonlyColor } from './math/Color';
export { Cylindrical } from './math/Cylindrical';
export { Euler } from './math/Euler';
export { Frustum } from './math/Frustum';
export { Interpolant } from './math/Interpolant';
export { Line3 } from './math/Line3';
export * from './math/Math';
export { Matrix3, ReadonlyMatrix3 } from './math/Matrix3';
export { Matrix4, ReadonlyMatrix4 } from './math/Matrix4';
export { Plane } from './math/Plane';
export { Quaternion } from './math/Quaternion';
export { Ray } from './math/Ray';
export { Sphere } from './math/Sphere';
export { Spherical } from './math/Spherical';
export { Triangle } from './math/Triangle';
export { Vector2, ReadonlyVector2 } from './math/Vector2';
export { Vector3, ReadonlyVector3 } from './math/Vector3';
export { Vector4, ReadonlyVector4 } from './math/Vector4';
export { Face3 } from './math/Face3';
export { Cone } from './math/Cone';
export * from './math/Readonly';
export { Shape } from './math/shape/plane/Shape';
export { Path } from './math/shape/plane/Path';
export * from './math/shape/curves/Curves';
export * from './math/shape/plane/Font';

export { Object3D } from './scene/Object3D';
export * from './scene/drawables/Drawable';

export { Texture, TextureMipmapGroup } from './elements/textures/Texture';
export { Texture2D, Texture2DLayer, Texture2DCommonLayer } from './elements/textures/Texture2D';
export { Texture3D, Texture3DLayer } from './elements/textures/Texture3D';
export { TextureCube, TextureCubeSide } from './elements/textures/TextureCube';

export { FatLineMaterial } from './elements/materials/mesh/FatLineMaterial';
export * from './elements/materials/mesh/MeshBasicMaterial';
export * from './elements/materials/mesh/MeshPhongMaterial';
export * from './elements/materials/mesh/MergedMeshPhongMaterial';
export * from './elements/materials/mesh/MeshDepthMaterial';
export * from './elements/materials/mesh/SpriteMaterial';
export * from './elements/materials/mesh/RoomBoxMaterial';
export * from './elements/materials/mesh/MeshNormalMaterial';
export * from './elements/materials/mesh/PanoEnvMaterial';
export * from './elements/materials/mesh/LineMaterial';
export * from './elements/materials/Material';
export * from './elements/materials/mesh/PointsMaterial';
export * from './elements/materials/mesh/PhysicalMaterial';
export { ToneMapping } from './elements/materials/quad/ToneMappingMaterial';
export { FilterTarget } from './elements/materials/quad/FilterMaterial';
export { SceneClipMaterial } from './elements/materials/base';

export * from './utils/Constants';
export * from './renderer/webgl/WGLConstants';
export * from './scene/renderables/Background';
export * from './scene/renderables/Ground';

import { DrawMode, SamplerWrap, SamplerFilter, BlendingEquation, BlendingFactor, StencilFunc, StencilOp } from './utils/Constants';

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
    StencilOp as WebGLStencilOp
};

export { createDataTexture } from './scene/tools/mesh-merge/DataTextureCreator';

/**
 * @deprecated DON'T USE IT!!
 */
export { TypedArray as TypeArray } from './utils/Utils';
export { TypeAssert } from './scene/tools/TypeAssert';
export { Scene3D } from './scene/Scene3D';
/**
 * @ignore
*/
export { Scene3D as Scene } from './scene/Scene3D';
export { Layers } from './scene/tools/Layers';
export * from './scene/tools/Raycaster';

export { Line } from './scene/drawables/Line';
export { LineSegments } from './scene/drawables/LineSegments';
export { Mesh } from './scene/drawables/Mesh';
export { Points } from './scene/drawables/Points';
export { PopMesh } from './scene/drawables/PopMesh';
export { Sprite } from './scene/drawables/Sprite';
export { SkinnedMesh } from './scene/drawables/SkinnedMesh';
export { Splat, SplatState, SplatRenderingStabilityChangedEvent, SplatSortedEvent, SplatEffectConfig } from './scene/splat/Splat';

export { InstanceMesh } from './scene/drawables/InstanceMesh';
export { FatLineSegments } from './scene/drawables/FatLineSegments';

export { Group } from './scene/Group';

export { Camera3D as Camera } from './scene/cameras/Camera3D';
export { ArrayCamera } from './scene/cameras/ArrayCamera';
export { PerspectiveCamera } from './scene/cameras/PerspectiveCamera';
export { OrthographicCamera } from './scene/cameras/OrthographicCamera';

export { ArrowHelper } from './scene/helpers/ArrowHelper';
export { AxisHelper } from './scene/helpers/AxisHelper';
export { GridHelper } from './scene/helpers/GridHelper';
export { CoordinateSystemHelper } from './scene/helpers/CoordinateSystemHelper';

export { Light } from './scene/lights/Light';
export { DirectionalLight } from './scene/lights/DirectionalLight';
export { PointLight } from './scene/lights/PointLight';
export { SpotLight } from './scene/lights/SpotLight';
export { RectAreaLight } from './scene/lights/RectAreaLight';
export { DiskAreaLight } from './scene/lights/DiskAreaLight';
export { HemisphereLight } from './scene/lights/HemisphereLight';
export { AmbientLight } from './scene/lights/AmbientLight';
export * from './renderer/shader/components/EnvMapIBLShaderComponent';
export * from './renderer/shader/components/SpottedShaderComponent';
export * from './renderer/shader/components/PavingShaderComponent';
export * from './renderer/shader/components/ClippingShaderComponent';
export * from './renderer/shader/components/PatternShaderComponent';

export * from './elements/attributes/BufferAttribute';
export { InstancedBufferAttribute } from './elements/attributes/InstancedBufferAttribute';

export { Geometry } from './elements/geometries/containers/Geometry';
export * from './elements/geometries/containers/BufferGeometry';
export { GeometryBase } from './elements/geometries/containers/GeometryBase';
export { IPopbufferInfo } from './elements/geometries/containers/IPopBufferInfo';
export { PopBufferGeometry } from './elements/geometries/containers/PopBufferGeometry';
export { FatLineBufferGeometry } from './elements/geometries/containers/FatLineBufferGeometry';

export const shapeBuilder = shapeBuilderImport;
export const geomOperator = geomOperatorImport;

export { Clock } from './utils/Clock';

export { Capabilities } from './renderer/Capabilities';
export { TextureCompression } from './fx/plugins/PipelinePlugin';

// some webgl info need expose;
export { WGLCapabilities } from './renderer/webgl/WGLCapabilities';

export { Rectangle } from './math/shape/plane/Rectangle';
export { RoundedRectangle } from './math/shape/plane/RoundedRectangle';
export { Circle } from './math/shape/plane/Circle';
export { Ellipse } from './math/shape/plane/Ellipse';
export { Polygon } from './math/shape/plane/Polygon';

export { Ticker } from './utils/Ticker';

import * as __INNER__ from './EGSInner';

export { serializeObject3D, parseObjects, deepCloneObject3D, downloadStringAsFile } from './EGSInner';

/**
 * DO NOT USE THIS!!!!
 */
export { __INNER__ };

egsInitFinished();
