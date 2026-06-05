import type { BufferAttribute } from '../../elements/attributes/BufferAttribute';
import type { InstancedBufferAttribute } from '../../elements/attributes/InstancedBufferAttribute';
import type { BufferGeometry } from '../../elements/geometries/containers/BufferGeometry';
import type { Geometry } from '../../elements/geometries/containers/Geometry';
import type { InstancedBufferGeometry } from '../../elements/geometries/containers/InstancedBufferGeometry';
import type { PopBufferGeometry } from '../../elements/geometries/containers/PopBufferGeometry';
import type { Material } from '../../elements/materials/Material';
import type { LightableMaterial } from '../../elements/materials/mesh/LightableMaterial';
import type { MeshBasicMaterial } from '../../elements/materials/mesh/MeshBasicMaterial';
import type { MeshDepthMaterial } from '../../elements/materials/mesh/MeshDepthMaterial';
import type { MeshPhongMaterial } from '../../elements/materials/mesh/MeshPhongMaterial';
import type { SpriteMaterial } from '../../elements/materials/mesh/SpriteMaterial';
import type { Curve2D } from '../../math/shape/curves/Curve2D';
import type { EllipseCurve2D } from '../../math/shape/curves/EllipseCurve2D';
import type { LineCurve2D } from '../../math/shape/curves/LineCurve2D';
import type { SplineCurve2D } from '../../math/shape/curves/SplineCurve2D';
import type { Camera3D } from '../cameras/Camera3D';
import type { OrthographicCamera } from '../cameras/OrthographicCamera';
import type { PerspectiveCamera } from '../cameras/PerspectiveCamera';
import type { Drawable } from '../drawables/Drawable';
import type { FatLineSegments } from '../drawables/FatLineSegments';
import type { InstanceMesh } from '../drawables/InstanceMesh';
import type { Line } from '../drawables/Line';
import type { LineSegments } from '../drawables/LineSegments';
import type { Mesh } from '../drawables/Mesh';
import type { Points } from '../drawables/Points';
import type { PopMesh } from '../drawables/PopMesh';
import type { Sprite } from '../drawables/Sprite';
import type { AmbientLight } from '../lights/AmbientLight';
import type { DirectionalLight } from '../lights/DirectionalLight';
import type { DiskAreaLight } from '../lights/DiskAreaLight';
import type { HemisphereLight } from '../lights/HemisphereLight';
import type { Light } from '../lights/Light';
import type { PointLight } from '../lights/PointLight';
import type { RectAreaLight } from '../lights/RectAreaLight';
import type { SpotLight } from '../lights/SpotLight';
import type { Shadow } from '../shadows/Shadow';
import type { Object3D } from '../Object3D';
import type { ArrayCamera } from '../cameras/ArrayCamera';
import type { RenderAttachment } from '../../elements/textures/RenderTarget';
import type { FatLineBufferGeometry } from '../../elements/geometries/containers/FatLineBufferGeometry';
import type { MergedMeshPhongMaterial } from '../../elements/materials/mesh/MergedMeshPhongMaterial';
import type { ShaderComponent } from '../../renderer/shader/Shader';
import type { SkinnedMesh } from '../drawables/SkinnedMesh';
import type { SpriteBufferGeometry } from '../../elements/geometries/containers/SpriteBufferGeometry';
import type { DeferredMaterial } from '../../elements/materials/base';
import type { LegacySourceTexture } from '../../elements/textures/Texture';
import type { SourceTexture } from '../../elements/textures/SourceTexture';
import type { Splat } from '../splat/Splat';

/**
 * All functions in this class is static and is used to recognize if an object belongs to certain class.
 * Every value as return is boolean variable.
 */
export class TypeAssert {
    static isObject3D(o: any): o is Object3D {
        return o.isObject3D === true;
    }
    static isDrawable(o: any): o is Drawable {
        return (
            o.isDrawable === true ||
            o.isMesh === true || // this for support old export data
            o.isLine === true ||
            o.isPoints === true
        );
    }

    static isMaterial(m: any): m is Material {
        return !!m.isMaterial;
    }

    static isShaderComponent(c: any): c is ShaderComponent {
        return !!c.isShaderComponent;
    }

    static isArrayCamera(camera: any): camera is ArrayCamera {
        return camera.isArrayCamera;
    }

    static isDeferredMaterial(m: Material): m is DeferredMaterial {
        return (m as any).isSupportDeferred === true;
    }

    static isPopBufferGeometry(geometry: any): geometry is PopBufferGeometry {
        return geometry.isPopBufferGeometry === true;
    }

    static isBufferGeometry(geometry: any): geometry is BufferGeometry {
        return geometry.isBufferGeometry === true;
    }

    static isInstancedBufferGeometry(geometry: any): geometry is InstancedBufferGeometry {
        return geometry.isInstancedBufferGeometry === true;
    }

    static isFatlineBufferGeometry(geometry: any): geometry is FatLineBufferGeometry {
        return geometry.isLineSegmentsGeometry === true;
    }

    /**
     * @internal
     */
    static isSpriteBufferGeometry(geometry: any): geometry is SpriteBufferGeometry {
        return geometry.isSpriteBufferGeometry === true;
    }

    static isGeometry(geometry: any): geometry is Geometry {
        return (geometry as any).isGeometry === true;
    }

    static isMesh(obj: any): obj is Mesh {
        return obj.isMesh === true;
    }

    static isPopMesh(obj: any): obj is PopMesh {
        return obj.isPopMesh === true;
    }

    static isSkinnedMesh(obj: any): obj is SkinnedMesh {
        return obj.isSkinnedMesh === true;
    }

    static isLineLike(obj: any): obj is Line | LineSegments | FatLineSegments {
        return (
            TypeAssert.isLineSegments(obj) || TypeAssert.isLine(obj) || TypeAssert.isFatLineSegmentsDecideByUser(obj)
        );
    }

    static isFatLineSegmentsDecideByUser(object: any): object is FatLineSegments {
        return object.isFatLineSegments === true;
    }

    static isFatLineSegments(object: any): object is FatLineSegments {
        return object.__isFatLineSegments === true;
    }

    static isLineSegments(object: any): object is LineSegments {
        return object.isLineSegments === true;
    }

    static isLine(object: any): object is Line {
        return object.isLine === true;
    }

    static isPoints(object: any): object is Points {
        return object.isPoints === true;
    }

    static isSplat(object: any): object is Splat {
        return object.isSplat === true;
    }

    static isLight(obj: any): obj is Light {
        return obj.isLight === true;
    }

    static isShadow(obj: any): obj is Shadow<any> {
        return obj.isShadow === true;
    }

    static isSprite(obj: any): obj is Sprite {
        return obj.isSprite === true;
    }

    static isInstanceMesh(obj: any): obj is InstanceMesh {
        return obj.isInstance === true;
    }

    static isCamera3D(camera: any): camera is Camera3D {
        return (camera as any).isCamera3D;
    }

    static isPerspectiveCamera(camera: Camera3D): camera is PerspectiveCamera {
        return (camera as any).isPerspectiveCamera;
    }

    static isOrthographicCamera(camera: Camera3D): camera is OrthographicCamera {
        return (camera as any).isOrthographicCamera;
    }

    static isEllipseCurve2D(curve: Curve2D): curve is EllipseCurve2D {
        return curve && (curve as any).isEllipseCurve2D;
    }

    static isSplineCurve2D(curve: Curve2D): curve is SplineCurve2D {
        return curve && (curve as any).SplineCurve2D;
    }

    static isLineCurve2D(curve: Curve2D): curve is LineCurve2D {
        return curve && (curve as any).LineCurve2D;
    }

    static isBufferAttribute(item: any): item is BufferAttribute {
        return item.isBufferAttribute === true;
    }

    static isInstancedBufferAttribute(item: any): item is InstancedBufferAttribute {
        return item && item.isInstancedBufferAttribute === true;
    }

    static isAmbientLight(value: any): value is AmbientLight {
        return value.isAmbientLight === true;
    }

    static isDirectionalLight(value: any): value is DirectionalLight {
        return value.isDirectionalLight === true;
    }

    static isSpotLight(value: any): value is SpotLight {
        return value.isSpotLight === true;
    }

    static isPointLight(value: any): value is PointLight {
        return value.isPointLight === true;
    }

    static isRectAreaLight(value: any): value is RectAreaLight {
        return value.isRectAreaLight === true;
    }

    static isDiskAreaLight(value: any): value is DiskAreaLight {
        return value.isDiskAreaLight === true;
    }

    static isHemisphereLight(value: any): value is HemisphereLight {
        return value.isHemisphereLight === true;
    }

    static isLightableMaterial(value: any): value is LightableMaterial {
        return value.isLightableMaterial === true;
    }

    static isSpriteMaterial(value: any): value is SpriteMaterial {
        return value.isSpriteMaterial === true;
    }

    static isMeshBasicMaterial(value: any): value is MeshBasicMaterial {
        return value.isMeshBasicMaterial === true;
    }

    static isMeshPhongMaterial(value: any): value is MeshPhongMaterial {
        return value.isMeshPhongMaterial === true;
    }

    static isMergedMeshPhongMaterial(value: any): value is MergedMeshPhongMaterial {
        return value.isMergedMeshPhongMaterial === true;
    }

    static isMeshDepthMaterial(value: any): value is MeshDepthMaterial {
        return value.isMeshDepthMaterial === true;
    }

    /**
     * @internal
     */
    static isRenderAttachment(value: any): value is RenderAttachment {
        return !!value.isRenderAttachment;
    }

    /**
     * @internal
     */
    static isLegacySourceTexture(value: any): value is LegacySourceTexture {
        return !!value.isLegacySourceTexture;
    }

    /**
     * @internal
     */
    static isSourceTexture(value: any): value is SourceTexture {
        return !!value.isSourceTexture;
    }
}
