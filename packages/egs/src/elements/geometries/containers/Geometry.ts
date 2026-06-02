import { Sphere } from '../../../math/Sphere';
import { EventDispatcher } from '../../../utils/EventDispatcher';

import { Color } from '../../../math/Color';
import { Face3 } from '../../../math/Face3';
import { _Math } from '../../../math/Math';
import { Matrix3 } from '../../../math/Matrix3';
import { Matrix4 } from '../../../math/Matrix4';
import { Vector2 } from '../../../math/Vector2';
import { Vector3 } from '../../../math/Vector3';
import { Object3D } from '../../../scene/Object3D';
import { Deserializer, Serializer } from '../../../utils/Serialization';
import { BufferGeometry } from './BufferGeometry';
import { singleton } from '../../../utils/Utils';
import { logger } from '../../../utils/Logger';

const m1 = new Matrix4();
const obj = singleton(() => new Object3D());

/**
 * Editable face-and-vertex geometry container.
 */
export class Geometry extends EventDispatcher {
    /**
     * The name of instance's class.
     */
    className() {
        return 'Geometry';
    }
    /**
     * Unique number of this geometry instance.
     */
    id: number;
    /**
     * Name for this geometry. Default is an empty string.
     */
    name = '';
    /**
     * The type of this instance.
     */
    type = 'Geometry';
    /**
     * An array of vertices hold every position of points of the model.
     */
    vertices: Vector3[] = [];
    /**
     * An array of vertex colors, matching number and order of vertices.
     * Used in ParticleSystem, Line and Ribbon.
     * Meshes use per-face-use-of-vertex colors embedded directly in faces.
     */
    colors: Color[] = [];
    /**
     * An array of triangles or/and quads.
     * The array of faces describe how each vertex in the model is connected with each other.
     * @remarks See {@link Face3| Face3} for more details.
     */
    faces: Face3[] = [];
    /**
     * An array of face UV layers.
     * Each UV layer is an array of UV matching order and number of vertices in faces.
     */
    faceVertexUvs: Vector2[][][] = [[]];
    /**
     * The distance is used to determine the length of line, this is necessary for drawing segmented line.
     * The value can be calculated by {@link BufferAttribute.getAttributeLayoutKey| getAttributeLayoutKey()}.
     */
    lineDistances: number[] = [];
    /**
     * Used to check type of this or extended instance.
     * This value should not be changed by user.
     */
    isGeometry = true;
    /**
     * Let every positional and normal vector multiple with specified matrix.
     * @param {Matrix4} matrix a 4×4 matrix which is applied to.
     */
    // Bakes matrix transform directly into vertex coordinates.
    applyMatrix(matrix: Matrix4): Geometry {
        const normalMatrix = new Matrix3().getNormalMatrix(matrix);
        for (let i = 0, il = this.vertices.length; i < il; i++) {
            const vertex = this.vertices[i];
            vertex.applyMatrix4(matrix);
        }

        for (let i = 0, il = this.faces.length; i < il; i++) {
            const face = this.faces[i];
            face.normal.applyMatrix3(normalMatrix).normalize();
            for (let j = 0, jl = face.vertexNormals.length; j < jl; j++) {
                face.vertexNormals[j].applyMatrix3(normalMatrix).normalize();
            }
        }

        return this;
    }
    /**
     * Rotate this object around X independently.
     * @param {number} angle a radian value to rotate.
     */
    rotateX(angle: number): Geometry {
        m1.makeRotationX(angle);
        this.applyMatrix(m1);
        return this;
    }
    /**
     * Rotate this object around Y independently.
     * @param {number} angle a radian value to rotate.
     */
    rotateY(angle: number): Geometry {
        m1.makeRotationY(angle);
        this.applyMatrix(m1);
        return this;
    }
    /**
     * Rotate this object around Z independently.
     * @param {number} angle a radian value to rotate.
     */
    rotateZ(angle: number): Geometry {
        m1.makeRotationZ(angle);
        this.applyMatrix(m1);
        return this;
    }
    /**
     * Translate the geometry with specified vector.
     * @param {number} x translate vector' x, represent the distance of moving object along X.
     * @param {number} y translate vector' y, represent the distance of moving object along Y.
     * @param {number} z translate vector' z, represent the distance of moving object along Z.
     */
    translate(x: number, y: number, z: number): Geometry {
        m1.makeTranslation(x, y, z);
        this.applyMatrix(m1);
        return this;
    }
    /**
     * Make object bigger or smaller.
     * @param {number} x change the size on X direction.
     * @param {number} y change the size on Y direction.
     * @param {number} z change the size on Z direction.
     */
    scale(x: number, y: number, z: number): Geometry {
        m1.makeScale(x, y, z);
        this.applyMatrix(m1);
        return this;
    }
    /**
     * Rotates the object to face to a point in world space.
     * @param {Vector3} vector A vector representing position of target in world space.
     */
    lookAt(vector: Vector3): void {
        obj().lookAt(vector);
        obj().updateMatrix();
        this.applyMatrix(obj().matrix);
    }
    /**
     * Duplicate data from {@link BufferGeometry| BufferGeometry} to this {@link Geometry| Geometry} object.
     * @param {BufferGeometry} geometry the data source.
     */
    fromBufferGeometry(geometry: BufferGeometry): Geometry {
        const scope = this;
        const indices = geometry.index !== null ? geometry.index.array : undefined;
        const attributes = geometry.getAttributes();
        const positions = attributes.position.array;
        const normals = attributes.normal !== undefined ? attributes.normal.array : undefined;
        const colors = attributes.color !== undefined ? attributes.color.array : undefined;
        const uvs = attributes.uv !== undefined ? attributes.uv.array : undefined;
        const uvs2 = attributes.uv2 !== undefined ? attributes.uv2.array : undefined;

        if (uvs2 !== undefined) {
            this.faceVertexUvs[1] = [];
        }

        for (let i = 0, j = 0; i < positions.length; i += 3, j += 2) {
            scope.vertices.push(new Vector3().fromArray(positions, i));
            if (colors !== undefined) {
                scope.colors.push(new Color().fromArray(colors, i));
            }
        }

        function addFace(a: number, b: number, c: number, materialIndex?: number) {
            const vertexColors = (colors === undefined) ? [] : [
                scope.colors[a].clone(),
                scope.colors[b].clone(),
                scope.colors[c].clone()];

            const vertexNormals = (normals === undefined) ? [] : [
                new Vector3().fromArray(normals, a * 3),
                new Vector3().fromArray(normals, b * 3),
                new Vector3().fromArray(normals, c * 3)
            ];

            const face = new Face3(a, b, c, vertexNormals, vertexColors, materialIndex);
            scope.faces.push(face);

            if (uvs !== undefined) {
                scope.faceVertexUvs[0].push([
                    new Vector2().fromArray(uvs, a * 2),
                    new Vector2().fromArray(uvs, b * 2),
                    new Vector2().fromArray(uvs, c * 2)
                ]);
            }

            if (uvs2 !== undefined) {
                scope.faceVertexUvs[1].push([
                    new Vector2().fromArray(uvs2, a * 2),
                    new Vector2().fromArray(uvs2, b * 2),
                    new Vector2().fromArray(uvs2, c * 2)
                ]);
            }
        }

        const groups = geometry.getGroups();
        if (groups.length > 0) {
            for (let i = 0; i < groups.length; i++) {
                const group = groups[i];
                const start = group.start;
                const count = group.count;
                for (let j = start, jl = start + count; j < jl; j += 3) {
                    if (indices !== undefined) {
                        addFace(indices[j], indices[j + 1], indices[j + 2], group.materialIndex);
                    } else {
                        addFace(j, j + 1, j + 2, group.materialIndex);
                    }
                }
            }
        } else {
            if (indices !== undefined) {
                for (let i = 0; i < indices.length; i += 3) {
                    addFace(indices[i], indices[i + 1], indices[i + 2]);
                }
            } else {
                for (let i = 0; i < positions.length / 3; i += 3) {
                    addFace(i, i + 1, i + 2);
                }
            }
        }

        this.computeFaceNormals();
        return this;
    }
    /**
     * Make all numbers' abs of {@link vertices| vertices} and {@link faces| faces} less than 1.
     */
    normalize(): Geometry {
        const sphere = new Sphere().setFromPoints(this.vertices);
        const center = sphere.center;
        const radius = sphere.radius;
        const s = radius === 0 ? 1 : 1.0 / radius;
        const matrix = new Matrix4();
        matrix.set(
            s, 0, 0, - s * center.x,
            0, s, 0, - s * center.y,
            0, 0, s, - s * center.z,
            0, 0, 0, 1
        );
        this.applyMatrix(matrix);
        return this;
    }
    /**
     * Computes the distance between two vertexes, store to {@link lineDistances| lineDistances}.
     * the distance is used to determine the length of line, this is necessary for drawing segmented line.
     */
    computeLineDistances() {
        const vertices = this.vertices;
        this.lineDistances = [0];
        for (let i = 1, l = vertices.length; i < l; i++) {
            this.lineDistances[i] = this.lineDistances[i - 1];
            this.lineDistances[i] += vertices[i - 1].distanceTo(vertices[i]);
        }
    }
    /**
     * Compute normals for every faces.
     */
    computeFaceNormals(): void {
        const cb = new Vector3();
        const ab = new Vector3();
        for (let f = 0, fl = this.faces.length; f < fl; f++) {
            const face = this.faces[f];
            const vA = this.vertices[face.a];
            const vB = this.vertices[face.b];
            const vC = this.vertices[face.c];
            cb.subVectors(vC, vB);
            ab.subVectors(vA, vB);
            cb.cross(ab);
            cb.normalize();
            face.normal.copy(cb);
        }
    }
    /**
     * Computes vertex normals by averaging face normals. Face normals must be existing / computed beforehand.
     */
    computeVertexNormals(areaWeighted?: boolean): void {
        if (areaWeighted === undefined) {
            areaWeighted = true;
        }
        let v, vl, f, fl, face;
        const vertices = new Array(this.vertices.length);
        for (v = 0, vl = this.vertices.length; v < vl; v++) {
            vertices[v] = new Vector3();
        }
        if (areaWeighted) {
            // vertex normals weighted by triangle areas
            // http://www.iquilezles.org/www/articles/normals/normals.htm
            let vA, vB, vC;
            const cb = new Vector3();
            const ab = new Vector3();
            for (f = 0, fl = this.faces.length; f < fl; f++) {
                face = this.faces[f];
                vA = this.vertices[face.a];
                vB = this.vertices[face.b];
                vC = this.vertices[face.c];
                cb.subVectors(vC, vB);
                ab.subVectors(vA, vB);
                cb.cross(ab);
                vertices[face.a].add(cb);
                vertices[face.b].add(cb);
                vertices[face.c].add(cb);
            }

        } else {
            this.computeFaceNormals();
            for (f = 0, fl = this.faces.length; f < fl; f++) {
                face = this.faces[f];
                vertices[face.a].add(face.normal);
                vertices[face.b].add(face.normal);
                vertices[face.c].add(face.normal);
            }
        }

        for (v = 0, vl = this.vertices.length; v < vl; v++) {
            vertices[v].normalize();
        }

        for (f = 0, fl = this.faces.length; f < fl; f++) {
            face = this.faces[f];
            const vertexNormals = face.vertexNormals;
            if (vertexNormals.length === 3) {
                vertexNormals[0].copy(vertices[face.a]);
                vertexNormals[1].copy(vertices[face.b]);
                vertexNormals[2].copy(vertices[face.c]);
            } else {
                vertexNormals[0] = vertices[face.a].clone();
                vertexNormals[1] = vertices[face.b].clone();
                vertexNormals[2] = vertices[face.c].clone();
            }
        }

    }
    /**
     * Compute vertex normals, but duplicating face normals.
     */
    computeFlatVertexNormals(): void {
        let f, fl, face;
        this.computeFaceNormals();
        for (f = 0, fl = this.faces.length; f < fl; f++) {
            face = this.faces[f];
            const vertexNormals = face.vertexNormals;
            if (vertexNormals.length === 3) {
                vertexNormals[0].copy(face.normal);
                vertexNormals[1].copy(face.normal);
                vertexNormals[2].copy(face.normal);
            } else {
                vertexNormals[0] = face.normal.clone();
                vertexNormals[1] = face.normal.clone();
                vertexNormals[2] = face.normal.clone();
            }
        }
    }
    /**
     * Combine all data of external geometry and this geometry into one array.
     * @param {Geometry} geometry all attributes from this geometry will be merged.
     * @param {Matrix4} matrix a matrix to modify the vertices' data. Usually this is the world matrix of merged object.
     * @param {number} materialIndexOffset an index mark the material data for the merged object.
     */
    merge(geometry: Geometry, matrix?: Matrix4, materialIndexOffset?: number): void {
        if (!(geometry && geometry.isGeometry)) {
            logger.error('EGS.Geometry.merge(): geometry not an instance of EGS.Geometry.');
            return;
        }

        let normalMatrix;
        const vertexOffset = this.vertices.length;
        const vertices1 = this.vertices;
        const vertices2 = geometry.vertices;
        const faces1 = this.faces;
        const faces2 = geometry.faces;
        const uvs1 = this.faceVertexUvs[0];
        const uvs2 = geometry.faceVertexUvs[0];
        const colors1 = this.colors;
        const colors2 = geometry.colors;

        if (materialIndexOffset === undefined) {
            materialIndexOffset = 0;
        }

        if (matrix !== undefined) {
            normalMatrix = new Matrix3().getNormalMatrix(matrix);
        }

        // vertices
        for (let i = 0, il = vertices2.length; i < il; i++) {
            const vertex = vertices2[i];
            const vertexCopy = vertex.clone();
            if (matrix !== undefined) {
                vertexCopy.applyMatrix4(matrix);
            }
            vertices1.push(vertexCopy);
        }

        // colors
        for (let i = 0, il = colors2.length; i < il; i++) {
            colors1.push(colors2[i].clone());
        }

        // faces
        for (let i = 0, il = faces2.length; i < il; i++) {
            let normal, color;
            const face = faces2[i];
            const faceVertexNormals = face.vertexNormals;
            const faceVertexColors = face.vertexColors;
            const faceCopy = new Face3(face.a + vertexOffset, face.b + vertexOffset, face.c + vertexOffset);
            faceCopy.normal.copy(face.normal);
            if (normalMatrix !== undefined) {
                faceCopy.normal.applyMatrix3(normalMatrix).normalize();
            }
            for (let j = 0, jl = faceVertexNormals.length; j < jl; j++) {
                normal = faceVertexNormals[j].clone();
                if (normalMatrix !== undefined) {
                    normal.applyMatrix3(normalMatrix).normalize();
                }
                faceCopy.vertexNormals.push(normal);
            }
            faceCopy.color.copy(face.color);
            for (let j = 0, jl = faceVertexColors.length; j < jl; j++) {
                color = faceVertexColors[j];
                faceCopy.vertexColors.push(color.clone());
            }
            faceCopy.materialIndex = face.materialIndex + materialIndexOffset;
            faces1.push(faceCopy);
        }

        // uvs
        for (let i = 0, il = uvs2.length; i < il; i++) {
            const uv = uvs2[i];
            const uvCopy: Vector2[] = [];

            if (uv === undefined) {
                continue;
            }

            for (let j = 0, jl = uv.length; j < jl; j++) {
                uvCopy.push(uv[j].clone());
            }
            uvs1.push(uvCopy);

        }
    }
    /**
     * Checks for duplicate vertices using hashmap.
     * Duplicated vertices are removed and faces' vertices are updated.
     */
    mergeVertices(): number {
        const verticesMap: Record<string, number> = {}; // Hashmap for looking up vertices by position coordinates (and making sure they are unique)
        const unique: Vector3[] = [];
        const changes: number[] = [];
        const precisionPoints = 4; // number of decimal points, e.g. 4 for epsilon of 0.0001
        const precision = Math.pow(10, precisionPoints);
        let i, il, face, indices, j, jl, v, key;

        for (i = 0, il = this.vertices.length; i < il; i++) {
            v = this.vertices[i];
            key = Math.round(v.x * precision) + '_' + Math.round(v.y * precision) + '_' + Math.round(v.z * precision);
            if (verticesMap[key] === undefined) {
                verticesMap[key] = i;
                unique.push(this.vertices[i]);
                changes[i] = unique.length - 1;
            } else {
                changes[i] = changes[verticesMap[key]];
            }
        }
        // if faces are completely degenerate after merging vertices, we
        // have to remove them from the geometry.
        const faceIndicesToRemove: number[] = [];

        for (i = 0, il = this.faces.length; i < il; i++) {
            face = this.faces[i];
            face.a = changes[face.a];
            face.b = changes[face.b];
            face.c = changes[face.c];
            indices = [face.a, face.b, face.c];

            // if any duplicate vertices are found in a Face3
            // we have to remove the face as nothing can be saved
            for (let n = 0; n < 3; n++) {
                if (indices[n] === indices[(n + 1) % 3]) {
                    faceIndicesToRemove.push(i);
                    break;
                }
            }
        }

        for (i = faceIndicesToRemove.length - 1; i >= 0; i--) {
            const idx = faceIndicesToRemove[i];
            this.faces.splice(idx, 1);
            for (j = 0, jl = this.faceVertexUvs.length; j < jl; j++) {
                this.faceVertexUvs[j].splice(idx, 1);
            }
        }
        // Use unique set of vertices
        const diff = this.vertices.length - unique.length;
        this.vertices = unique;
        return diff;
    }
    /**
     * Add some new vertices to this geometry.
     * @param {Vector3[]} points every Vector3 represent a vertex on object.
     */
    setFromPoints(points: Vector3[]) {
        this.vertices = [];
        for (let i = 0, l = points.length; i < l; i++) {
            const point = points[i];
            this.vertices.push(new Vector3(point.x, point.y, point.z || 0));
        }
        return this;
    }
    /**
     * Sorts the faces array according to material index. For complex geometries with several materials,
     * this can result in reduced draw calls and improved performance.
     */
    sortFacesByMaterialIndex(): void {
        const faces = this.faces;
        const length = faces.length;

        // tag faces
        for (let i = 0; i < length; i++) {
            (faces[i] as any)._id = i;
        }

        // sort faces
        function materialIndexSort(a: Face3, b: Face3) {
            return a.materialIndex - b.materialIndex;
        }
        faces.sort(materialIndexSort);

        // sort uvs
        const uvs1 = this.faceVertexUvs[0];
        const uvs2 = this.faceVertexUvs[1];
        let newUvs1: Vector2[][] | undefined, newUvs2: Vector2[][] | undefined;
        if (uvs1 && uvs1.length === length) {
            newUvs1 = [];
        }
        if (uvs2 && uvs2.length === length) {
            newUvs2 = [];
        }
        for (let i = 0; i < length; i++) {
            const id = (faces[i] as any)._id;
            if (newUvs1) {
                newUvs1.push(uvs1[id]);
            }
            if (newUvs2) {
                newUvs2.push(uvs2[id]);
            }
        }
        if (newUvs1) {
            this.faceVertexUvs[0] = newUvs1;
        }
        if (newUvs2) {
            this.faceVertexUvs[1] = newUvs2;
        }
    }
    /**
     * Get UUID of this object instance.
     * This value is automatically assigned, so this shouldn't be edited.
     */
    getUUID(): string {
        return this.uuid;
    }
    /**
     * Parse the data for this class from string according to serializing format.
     * @param {Deserializer} ctx this parameter has not supported external Deserializer yet.
     * It may cause that this method can not be used directly.
     */
    deserialize(ctx: Deserializer) {
        parseModel(ctx.getData().data, this);
    }
    /**
     * Store the attributes of this class into string as serializing format.
     * @param {Serializer} ctx this parameter has not supported external Serializer yet.
     * It may cause that this method can not be used directly.
     */
    serialize(ctx: Serializer) {
        ctx.puts<Geometry>(['name', 'type']);

        const vertices: number[] = [];
        for (let i = 0; i < this.vertices.length; i++) {
            const vertex = this.vertices[i];
            vertices.push(vertex.x, vertex.y, vertex.z);
        }

        const faces: number[] = [];
        const normals: number[] = [];
        const normalsHash: Record<string, number> = {};
        const colors: number[] = [];
        const colorsHash: Record<string, number> = {};
        const uvs: number[] = [];
        const uvsHash: Record<string, number> = {};

        for (let i = 0; i < this.faces.length; i++) {
            const face = this.faces[i];
            const hasMaterial = true;
            const hasFaceUv = false; // deprecated
            const hasFaceVertexUv = this.faceVertexUvs[0][i] !== undefined;
            const hasFaceNormal = face.normal.length() > 0;
            const hasFaceVertexNormal = face.vertexNormals.length > 0;
            const hasFaceColor = face.color.r !== 1 || face.color.g !== 1 || face.color.b !== 1;
            const hasFaceVertexColor = face.vertexColors.length > 0;
            let faceType = 0;

            faceType = setBit(faceType, 0, false); // isQuad
            faceType = setBit(faceType, 1, hasMaterial);
            faceType = setBit(faceType, 2, hasFaceUv);
            faceType = setBit(faceType, 3, hasFaceVertexUv);
            faceType = setBit(faceType, 4, hasFaceNormal);
            faceType = setBit(faceType, 5, hasFaceVertexNormal);
            faceType = setBit(faceType, 6, hasFaceColor);
            faceType = setBit(faceType, 7, hasFaceVertexColor);

            faces.push(faceType);
            faces.push(face.a, face.b, face.c);
            faces.push(face.materialIndex);

            if (hasFaceVertexUv) {
                const faceVertexUvs = this.faceVertexUvs[0][i];
                faces.push(
                    getUvIndex(faceVertexUvs[0]),
                    getUvIndex(faceVertexUvs[1]),
                    getUvIndex(faceVertexUvs[2])
                );
            }

            if (hasFaceNormal) {
                faces.push(getNormalIndex(face.normal));
            }

            if (hasFaceVertexNormal) {
                const vertexNormals = face.vertexNormals;
                faces.push(
                    getNormalIndex(vertexNormals[0]),
                    getNormalIndex(vertexNormals[1]),
                    getNormalIndex(vertexNormals[2])
                );
            }

            if (hasFaceColor) {
                faces.push(getColorIndex(face.color));
            }

            if (hasFaceVertexColor) {
                const vertexColors = face.vertexColors;
                faces.push(
                    getColorIndex(vertexColors[0]),
                    getColorIndex(vertexColors[1]),
                    getColorIndex(vertexColors[2])
                );
            }
        }

        function setBit(value: number, position: number, enabled: boolean) {
            return enabled ? value | (1 << position) : value & (~(1 << position));
        }

        function getNormalIndex(normal: Vector3) {
            const hash = normal.x.toString() + normal.y.toString() + normal.z.toString();
            if (normalsHash[hash] !== undefined) {
                return normalsHash[hash];
            }

            normalsHash[hash] = normals.length / 3;
            normals.push(normal.x, normal.y, normal.z);

            return normalsHash[hash];
        }

        function getColorIndex(color: Color) {
            const hash = color.r.toString() + color.g.toString() + color.b.toString();
            if (colorsHash[hash] !== undefined) {
                return colorsHash[hash];
            }

            colorsHash[hash] = colors.length;
            colors.push(color.getHex());

            return colorsHash[hash];
        }

        function getUvIndex(uv: Vector2) {
            const hash = uv.x.toString() + uv.y.toString();
            if (uvsHash[hash] !== undefined) {
                return uvsHash[hash];
            }
            uvsHash[hash] = uvs.length / 2;
            uvs.push(uv.x, uv.y);
            return uvsHash[hash];
        }
        const data: any = {};

        data.vertices = vertices;
        data.normals = normals;
        if (colors.length > 0) {
            data.colors = colors;
        }
        if (uvs.length > 0) {
            data.uvs = [uvs]; // temporal backward compatibility
        }
        data.faces = faces;
        ctx.putRaw('data', data);
    }
    /**
     * Creates a new clone of this Geometry.
     */
    clone(): Geometry {
        return new Geometry().copy(this);
    }
    /**
     * Copy the data to this object from source.
     * This method need override in derived classes to copy extended data.
     * @param {Geometry} source the data source.
     */
    copy(source: Geometry): Geometry {
        let i, il, j, jl, k, kl;

        // reset
        this.vertices = [];
        this.colors = [];
        this.faces = [];
        this.faceVertexUvs = [[]];
        this.lineDistances = [];

        // name
        this.name = source.name;

        // vertices
        const vertices = source.vertices;

        for (i = 0, il = vertices.length; i < il; i++) {
            this.vertices.push(vertices[i].clone());
        }

        // colors
        const colors = source.colors;
        for (i = 0, il = colors.length; i < il; i++) {
            this.colors.push(colors[i].clone());
        }

        // faces
        const faces = source.faces;
        for (i = 0, il = faces.length; i < il; i++) {
            this.faces.push(faces[i].clone());
        }

        // face vertex uvs
        for (i = 0, il = source.faceVertexUvs.length; i < il; i++) {
            const faceVertexUvs = source.faceVertexUvs[i];
            if (this.faceVertexUvs[i] === undefined) {
                this.faceVertexUvs[i] = [];
            }

            for (j = 0, jl = faceVertexUvs.length; j < jl; j++) {
                const uvs = faceVertexUvs[j];
                const uvsCopy: Vector2[] = [];
                for (k = 0, kl = uvs.length; k < kl; k++) {
                    const uv = uvs[k];
                    uvsCopy.push(uv.clone());
                }
                this.faceVertexUvs[i].push(uvsCopy);
            }
        }

        // line distances
        const lineDistances = source.lineDistances;
        for (i = 0, il = lineDistances.length; i < il; i++) {
            this.lineDistances.push(lineDistances[i]);
        }

        return this;
    }
    // from origin json loader
    parseGeometryFromJSON(json: any, geometry: Geometry) {
        parseModel(json, geometry);
    }
}

function parseModel(json: any, geometry: Geometry) {
    let i, j, fi,
        offset, zLength,
        colorIndex, normalIndex, uvIndex, materialIndex,
        type,
        isQuad,
        hasMaterial,
        hasFaceVertexUv,
        hasFaceNormal, hasFaceVertexNormal,
        hasFaceColor, hasFaceVertexColor,
        vertex, face, faceA, faceB, hex, normal,
        uvLayer, uv, u, v,
        nUvLayers = 0;

    const faces = json.faces,
        vertices = json.vertices,
        normals = json.normals,
        colors = json.colors;

    if (json.uvs !== undefined) {
        // disregard empty arrays
        for (i = 0; i < json.uvs.length; i++) {
            if (json.uvs[i].length) {
                nUvLayers++;
            }
        }

        for (i = 0; i < nUvLayers; i++) {
            geometry.faceVertexUvs[i] = [];
        }
    }

    offset = 0;
    zLength = vertices.length;

    function isBitSet(value: number, position: number) {
        return value & (1 << position);
    }

    while (offset < zLength) {
        vertex = new Vector3();
        vertex.x = vertices[offset++];
        vertex.y = vertices[offset++];
        vertex.z = vertices[offset++];
        geometry.vertices.push(vertex);
    }

    offset = 0;
    zLength = faces.length;

    while (offset < zLength) {
        type = faces[offset++];
        isQuad = isBitSet(type, 0);
        hasMaterial = isBitSet(type, 1);
        hasFaceVertexUv = isBitSet(type, 3);
        hasFaceNormal = isBitSet(type, 4);
        hasFaceVertexNormal = isBitSet(type, 5);
        hasFaceColor = isBitSet(type, 6);
        hasFaceVertexColor = isBitSet(type, 7);

        if (isQuad) {
            faceA = new Face3();
            faceA.a = faces[offset];
            faceA.b = faces[offset + 1];
            faceA.c = faces[offset + 3];

            faceB = new Face3();
            faceB.a = faces[offset + 1];
            faceB.b = faces[offset + 2];
            faceB.c = faces[offset + 3];

            offset += 4;

            if (hasMaterial) {
                materialIndex = faces[offset++];
                faceA.materialIndex = materialIndex;
                faceB.materialIndex = materialIndex;
            }

            // to get face <=> uv index correspondence
            fi = geometry.faces.length;
            if (hasFaceVertexUv) {
                for (i = 0; i < nUvLayers; i++) {
                    uvLayer = json.uvs[i];
                    geometry.faceVertexUvs[i][fi] = [];
                    geometry.faceVertexUvs[i][fi + 1] = [];

                    for (j = 0; j < 4; j++) {
                        uvIndex = faces[offset++];
                        u = uvLayer[uvIndex * 2];
                        v = uvLayer[uvIndex * 2 + 1];
                        uv = new Vector2(u, v);
                        if (j !== 2) {
                            geometry.faceVertexUvs[i][fi].push(uv);
                        }
                        if (j !== 0) {
                            geometry.faceVertexUvs[i][fi + 1].push(uv);
                        }
                    }
                }
            }

            if (hasFaceNormal) {
                normalIndex = faces[offset++] * 3;
                faceA.normal.set(
                    normals[normalIndex++],
                    normals[normalIndex++],
                    normals[normalIndex]
                );
                faceB.normal.copy(faceA.normal);
            }

            if (hasFaceVertexNormal) {
                for (i = 0; i < 4; i++) {
                    normalIndex = faces[offset++] * 3;
                    normal = new Vector3(
                        normals[normalIndex++],
                        normals[normalIndex++],
                        normals[normalIndex]
                    );

                    if (i !== 2) {
                        faceA.vertexNormals.push(normal);
                    }
                    if (i !== 0) {
                        faceB.vertexNormals.push(normal);
                    }
                }
            }

            if (hasFaceColor) {
                colorIndex = faces[offset++];
                hex = colors[colorIndex];
                faceA.color.setHex(hex);
                faceB.color.setHex(hex);
            }

            if (hasFaceVertexColor) {
                for (i = 0; i < 4; i++) {
                    colorIndex = faces[offset++];
                    hex = colors[colorIndex];
                    if (i !== 2) {
                        faceA.vertexColors.push(new Color(hex));
                    }
                    if (i !== 0) {
                        faceB.vertexColors.push(new Color(hex));
                    }
                }
            }
            geometry.faces.push(faceA);
            geometry.faces.push(faceB);
        } else {
            face = new Face3();
            face.a = faces[offset++];
            face.b = faces[offset++];
            face.c = faces[offset++];

            if (hasMaterial) {
                materialIndex = faces[offset++];
                face.materialIndex = materialIndex;
            }

            // to get face <=> uv index correspondence
            fi = geometry.faces.length;
            if (hasFaceVertexUv) {
                for (i = 0; i < nUvLayers; i++) {
                    uvLayer = json.uvs[i];
                    geometry.faceVertexUvs[i][fi] = [];
                    for (j = 0; j < 3; j++) {
                        uvIndex = faces[offset++];
                        u = uvLayer[uvIndex * 2];
                        v = uvLayer[uvIndex * 2 + 1];
                        uv = new Vector2(u, v);
                        geometry.faceVertexUvs[i][fi].push(uv);
                    }
                }
            }

            if (hasFaceNormal) {
                normalIndex = faces[offset++] * 3;
                face.normal.set(
                    normals[normalIndex++],
                    normals[normalIndex++],
                    normals[normalIndex]
                );
            }

            if (hasFaceVertexNormal) {
                for (i = 0; i < 3; i++) {
                    normalIndex = faces[offset++] * 3;
                    normal = new Vector3(
                        normals[normalIndex++],
                        normals[normalIndex++],
                        normals[normalIndex]
                    );

                    face.vertexNormals.push(normal);
                }
            }

            if (hasFaceColor) {
                colorIndex = faces[offset++];
                face.color.setHex(colors[colorIndex]);

            }

            if (hasFaceVertexColor) {
                for (i = 0; i < 3; i++) {
                    colorIndex = faces[offset++];
                    face.vertexColors.push(new Color(colors[colorIndex]));
                }
            }
            geometry.faces.push(face);
        }
    }
}
