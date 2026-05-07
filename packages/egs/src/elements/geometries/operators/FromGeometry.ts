import { BufferGeometry, LineStrip, LineList } from '../../../elements/geometries/containers/BufferGeometry';
import { logger } from '../../../utils/Logger';
import { Vector2 } from '../../../math/Vector2';
import { BufferAttribute } from '../../attributes/BufferAttribute';
import { Geometry } from '../containers/Geometry';
import { Vector3 } from '../../../math/Vector3';
import { Color } from '../../../math/Color';

export function updateByGeometry(me: BufferGeometry, geometry: Geometry) {
    const faces = geometry.faces;
    const vertices = geometry.vertices;
    const faceVertexUvs = geometry.faceVertexUvs;
    const hasFaceVertexUv = faceVertexUvs[0] && faceVertexUvs[0].length > 0;
    const hasFaceVertexUv2 = faceVertexUvs[1] && faceVertexUvs[1].length > 0;

    const m_vertices: Vector3[] = [];
    const m_normals: Vector3[] = [];
    const m_colors: Color[] = [];
    const m_uvs: Vector2[] = [];
    const m_uvs2: Vector2[] = [];
    if (vertices.length > 0 && faces.length === 0) {
        logger.invalidInput('EGS.GeometryConvert: Faceless geometries are not supported.');
    }

    for (let i = 0; i < faces.length; i++) {
        const face = faces[i];
        m_vertices.push(vertices[face.a], vertices[face.b], vertices[face.c]);
        const vertexNormals = face.vertexNormals;
        if (vertexNormals.length === 3) {
            m_normals.push(vertexNormals[0], vertexNormals[1], vertexNormals[2]);
        } else {
            const normal = face.normal;
            m_normals.push(normal, normal, normal);
        }
        const vertexColors = face.vertexColors;
        if (vertexColors.length === 3) {
            m_colors.push(vertexColors[0], vertexColors[1], vertexColors[2]);
        } else {
            const color = face.color;
            m_colors.push(color, color, color);
        }
        if (hasFaceVertexUv === true) {
            const vertexUvs = faceVertexUvs[0][i];
            if (vertexUvs !== undefined) {
                m_uvs.push(vertexUvs[0], vertexUvs[1], vertexUvs[2]);
            } else {
                logger.invalidInput('EGS.GeometryConvert.fromGeometry(): Undefined vertexUv ' + i);
                m_uvs.push(new Vector2(), new Vector2(), new Vector2());
            }
        }

        if (hasFaceVertexUv2 === true) {
            const vertexUvs = faceVertexUvs[1][i];
            if (vertexUvs !== undefined) {
                m_uvs2.push(vertexUvs[0], vertexUvs[1], vertexUvs[2]);
            } else {
                logger.invalidInput('EGS.GeometryConvert.fromGeometry(): Undefined vertexUv2 ' + i);
                m_uvs2.push(new Vector2(), new Vector2(), new Vector2());
            }
        }
    }

    const positions = new Float32Array(m_vertices.length * 3);
    me.addAttribute('position', new BufferAttribute(positions, 3).copyVector3Array(m_vertices));

    if (m_normals.length > 0) {
        const normals = new Float32Array(m_normals.length * 3);
        me.addAttribute('normal', new BufferAttribute(normals, 3).copyVector3Array(m_normals));
    }

    if (geometry.colors.length > 0) {
        const colors = new Float32Array(geometry.colors.length * 3);
        me.addAttribute('color', new BufferAttribute(colors, 3).copyColorArray(geometry.colors));
    }

    if (m_uvs.length > 0) {
        const uvs = new Float32Array(m_uvs.length * 2);
        me.addAttribute('uv', new BufferAttribute(uvs, 2).copyVector2Array(m_uvs));
    }

    if (m_uvs2.length > 0) {
        const uvs2 = new Float32Array(m_uvs2.length * 2);
        me.addAttribute('uv2', new BufferAttribute(uvs2, 2).copyVector2Array(m_uvs2));
    }

    // groups
    me._computeGroups(geometry);

    me.notifyShapeChanged();

    return me;
}

export function updateByGeometryAsLine<T extends LineStrip | LineList>(me: BufferGeometry<T>, geometry: Geometry) {
    const positions = new BufferAttribute(new Float32Array(geometry.vertices.length * 3), 3);
    const colors = new BufferAttribute(new Float32Array(geometry.colors.length * 3), 3);
    me.addAttribute('position', positions.copyVector3Array(geometry.vertices));
    me.addAttribute('color', colors.copyColorArray(geometry.colors));
    if (geometry.lineDistances && geometry.lineDistances.length === geometry.vertices.length) {
        const lineDistances = new BufferAttribute(new Float32Array(geometry.lineDistances.length), 1);
        me.addAttribute('lineDistance', lineDistances.copyArray(geometry.lineDistances));
    }

    me.notifyShapeChanged();
    return me;
}
