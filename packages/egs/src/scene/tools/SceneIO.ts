import { BufferGeometry } from '../../elements/geometries/containers/BufferGeometry.js';
import { PopBufferGeometry } from '../../elements/geometries/containers/PopBufferGeometry.js';
import { Curve2D } from '../../math/shape/curves/Curve2D.js';
import {
    ArcCurve2D,
    CubicBezierCurve2D,
    CubicBezierCurve3D,
    EllipseCurve2D,
    LineCurve2D,
    QuadraticBezierCurve2D,
    SplineCurve2D,
} from '../../math/shape/curves/Curves.js';
import { Circle } from '../../math/shape/plane/Circle.js';
import { Ellipse } from '../../math/shape/plane/Ellipse.js';
import { Path } from '../../math/shape/plane/Path.js';
import { Polygon } from '../../math/shape/plane/Polygon.js';
import { Rectangle } from '../../math/shape/plane/Rectangle.js';
import { RoundedRectangle } from '../../math/shape/plane/RoundedRectangle.js';
import { Shape } from '../../math/shape/plane/Shape.js';
import { Star } from '../../math/shape/plane/Star.js';
import { FatLineMaterial } from '../../elements/materials/mesh/FatLineMaterial.js';
import { LineBasicMaterial, LineDashedMaterial } from '../../elements/materials/mesh/LineMaterial.js';
import { MeshBasicMaterial } from '../../elements/materials/mesh/MeshBasicMaterial.js';
import { MeshPhongMaterial } from '../../elements/materials/mesh/MeshPhongMaterial.js';
import { PointsMaterial } from '../../elements/materials/mesh/PointsMaterial.js';
import { SpriteMaterial } from '../../elements/materials/mesh/SpriteMaterial.js';
import { WHITE_IMAGE_DATA } from '../../elements/textures/Texture.js';
import { Deserializer, Serializer, SerializerMetaData } from '../../utils/Serialization.js';
import { Utils } from '../../utils/Utils.js';
import { OrthographicCamera } from '../cameras/OrthographicCamera.js';
import { PerspectiveCamera } from '../cameras/PerspectiveCamera.js';
import { FatLineSegments } from '../drawables/FatLineSegments.js';
import { Line } from '../drawables/Line.js';
import { LineSegments } from '../drawables/LineSegments.js';
import { Mesh } from '../drawables/Mesh.js';
import { PopMesh } from '../drawables/PopMesh.js';
import { Sprite } from '../drawables/Sprite.js';
import { Group } from '../Group.js';
import { AmbientLight } from '../lights/AmbientLight.js';
import { DirectionalLight } from '../lights/DirectionalLight.js';
import { SpotLight } from '../lights/SpotLight.js';
import { Object3D } from '../Object3D.js';
import { Scene3D } from '../Scene3D.js';
import { Texture2D } from '../../elements/textures/Texture2D.js';
import { PointLight } from '../lights/PointLight.js';
import { DiskAreaLight } from '../lights/DiskAreaLight.js';
import { RectAreaLight } from '../lights/RectAreaLight.js';
import { FontPath } from '../../math/shape/plane/Font.js';
import { PavingShaderComponent } from '../../renderer/shader/components/PavingShaderComponent.js';
import { ClippingShaderComponent } from '../../renderer/shader/components/ClippingShaderComponent.js';
import { EnvMapIBLShaderComponent } from '../../renderer/shader/components/EnvMapIBLShaderComponent.js';
import { createDefaultTextureCube } from '../../elements/textures/TextureCube.js';
import { SpottedShaderComponent } from '../../renderer/shader/components/SpottedShaderComponent.js';

export function exportScene(scene: Scene3D, name: string): void {
    const { geoBufferLength, geoBuffer, sceneData } = serializeScene(scene);
    const header = new ArrayBuffer(4);
    const headerView = new DataView(header);
    headerView.setUint32(0, geoBufferLength, true);
    const fileBlob = new Blob([header, ...geoBuffer, Utils.stringToArrayBuffer(JSON.stringify(sceneData))]);
    downloadContent(fileBlob, name + '.egs');
}

export const EGSSerializerMetaData = new SerializerMetaData();

EGSSerializerMetaData.registerCtor('Object3D', () => new Object3D());
EGSSerializerMetaData.registerCtor('Scene3D', () => new Scene3D());
EGSSerializerMetaData.registerCtor('Scene', () => new Scene3D());
EGSSerializerMetaData.registerCtor('Group', () => new Group());
EGSSerializerMetaData.registerCtor('PerspectiveCamera', () => new PerspectiveCamera());
EGSSerializerMetaData.registerCtor('OrthographicCamera', () => new OrthographicCamera());
EGSSerializerMetaData.registerCtor('Mesh', () => new Mesh());
EGSSerializerMetaData.registerCtor('Line', () => new Line());
EGSSerializerMetaData.registerCtor('PopMesh', () => new PopMesh(undefined as any, [] as any));
EGSSerializerMetaData.registerCtor('PopBufferGeometry', () => new PopBufferGeometry(undefined as any));
EGSSerializerMetaData.registerCtor('BufferGeometry', () => new BufferGeometry());
EGSSerializerMetaData.registerCtor('Geometry', () => new BufferGeometry());
EGSSerializerMetaData.registerCtor('MeshPhongMaterial', () => new MeshPhongMaterial());
EGSSerializerMetaData.registerCtor('MeshBasicMaterial', () => new MeshBasicMaterial());
EGSSerializerMetaData.registerCtor('AmbientLight', () => new AmbientLight());
EGSSerializerMetaData.registerCtor('DirectionalLight', () => new DirectionalLight());
EGSSerializerMetaData.registerCtor('Texture', () => Texture2D.createByMainLayerSource(WHITE_IMAGE_DATA));
EGSSerializerMetaData.registerCtor('Texture2D', () => Texture2D.createByMainLayerSource(WHITE_IMAGE_DATA));
EGSSerializerMetaData.registerCtor('TextureCube', createDefaultTextureCube);
EGSSerializerMetaData.registerCtor('LineBasicMaterial', () => new LineBasicMaterial());
EGSSerializerMetaData.registerCtor('LineDashedMaterial', () => new LineDashedMaterial());
EGSSerializerMetaData.registerCtor('LineSegments', () => new LineSegments());
EGSSerializerMetaData.registerCtor('FatLineSegments', () => new FatLineSegments(undefined as any, undefined as any));
EGSSerializerMetaData.registerCtor('PointsMaterial', () => new PointsMaterial());
EGSSerializerMetaData.registerCtor('SpriteMaterial', () => new SpriteMaterial(undefined as any));
EGSSerializerMetaData.registerCtor('Sprite', () => new Sprite(undefined as any));
EGSSerializerMetaData.registerCtor('FatLineMaterial', () => new FatLineMaterial());
EGSSerializerMetaData.registerCtor('SpotLight', () => new SpotLight());
EGSSerializerMetaData.registerCtor('PointLight', () => new PointLight());
EGSSerializerMetaData.registerCtor('DiskAreaLight', () => new DiskAreaLight());
EGSSerializerMetaData.registerCtor('RectAreaLight', () => new RectAreaLight());
EGSSerializerMetaData.registerCtor('MeshPhongSpottedMaterial', () => new MeshPhongMaterial());
EGSSerializerMetaData.registerCtor('SpottedShaderComponent', () => new SpottedShaderComponent());

EGSSerializerMetaData.registerCtor('Curve2D', () => new Curve2D());
EGSSerializerMetaData.registerCtor('ArcCurve2D', () => new ArcCurve2D());
EGSSerializerMetaData.registerCtor('CubicBezierCurve2D', () => new CubicBezierCurve2D());
EGSSerializerMetaData.registerCtor('EllipseCurve2D', () => new EllipseCurve2D());
EGSSerializerMetaData.registerCtor('SplineCurve2D', () => new SplineCurve2D());
EGSSerializerMetaData.registerCtor('QuadraticBezierCurve2D', () => new QuadraticBezierCurve2D());
EGSSerializerMetaData.registerCtor('Rectangle', () => new Rectangle());
EGSSerializerMetaData.registerCtor('RoundedRectangle', () => new RoundedRectangle());
EGSSerializerMetaData.registerCtor('Circle', () => new Circle());
EGSSerializerMetaData.registerCtor('Ellipse', () => new Ellipse());
EGSSerializerMetaData.registerCtor('Star', () => new Star());
EGSSerializerMetaData.registerCtor('Polygon', () => new Polygon());
EGSSerializerMetaData.registerCtor('Shape', () => new Shape());
EGSSerializerMetaData.registerCtor('CubicBezierCurve3D', () => new CubicBezierCurve3D());
EGSSerializerMetaData.registerCtor('LineCurve2D', () => new LineCurve2D());
EGSSerializerMetaData.registerCtor('Path', () => new Path());
EGSSerializerMetaData.registerCtor('FontPath', () => new FontPath());
createShaderComponent(EGSSerializerMetaData);
/**
 * Deserialize scene from JSON and vertex data from buffer.
 * @param { any } data A parsed object from scene raw data of JSON format.
 * @param { ArrayBuffer } buffer An ArrayBuffer stored vertex data of object.
 */
export async function parseScene(data: any, buffer: ArrayBuffer): Promise<Scene3D> {
    const deserialize = new Deserializer(data, [buffer], EGSSerializerMetaData);
    const result = deserialize.deserialize(data.resource[data.root]) as Scene3D;
    await deserialize.loadResourceAsync(() => {
        result.notifySceneChange();
    });
    return result;
}

export function downloadContent(fileBlob: Blob, name: string): void {
    const aLink = document.createElement('a');
    aLink.download = name;
    aLink.href = URL.createObjectURL(fileBlob);
    aLink.click();
}

export function downloadStringAsFile(str: string, name: string): void {
    const b = new Blob([Utils.stringToArrayBuffer(str)]);
    downloadContent(b, name);
}
/**
 * Serialize given scene and store into Blob.
 * @param { Scene3D } scene which scene need to be serialized
 */
export function serializeScene(scene: Scene3D): { geoBufferLength: number; geoBuffer: ArrayBuffer[]; sceneData: any } {
    const serializer = new Serializer();
    const rootUuid = serializer.serialize(scene).data;
    const data = {
        root: rootUuid,
        resource: serializer.serializedResource,
    };

    return { geoBufferLength: serializer.byteLengthAll, geoBuffer: serializer.buffer, sceneData: data };
}

export function serializeObject3D(objects: Object3D[]): { data: any; geoBuffer: ArrayBuffer[]; objectId: string[] } {
    const serializer = new Serializer();
    const result = objects.map(o => {
        return serializer.serialize(o).data;
    });
    return { data: { resource: serializer.serializedResource }, geoBuffer: serializer.buffer, objectId: result };
}

export async function deepCloneObject3D(objects: Object3D[]): Promise<Object3D[]> {
    const serializer = new Serializer();
    const objectsId = objects.map(o => {
        return serializer.serialize(o).data;
    });
    const geo = serializer.buffer;
    const deserializer = new Deserializer(
        { resource: serializer.serializedResource },
        geo,
        EGSSerializerMetaData,
        false,
    );
    const results = deserializer.deserializeObjectsById(objectsId);
    await deserializer.loadResourceAsync(() => {
        results.forEach(object => {
            object.notifySceneChange();
        });
    });
    return results;
}

export async function parseObjects(data: any, geoBuffer: ArrayBuffer[], objectId: string[]): Promise<Object3D[]> {
    const deserializer = new Deserializer(data, geoBuffer, EGSSerializerMetaData, false);
    const results = deserializer.deserializeObjectsById(objectId);
    await deserializer.loadResourceAsync(() => {
        results.forEach(object => {
            object.notifySceneChange();
        });
    });
    return results;
}

function createShaderComponent(meta: SerializerMetaData) {
    meta.registerCtor('PavingShaderComponent', () => new PavingShaderComponent());
    meta.registerCtor('ClippingShaderComponent', () => new ClippingShaderComponent());
    meta.registerCtor('EnvMapIBLShaderComponent', () => new EnvMapIBLShaderComponent());
}
