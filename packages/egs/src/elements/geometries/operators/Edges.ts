import { _Math } from '../../../math/Math';
import { BufferAttribute } from '../../attributes/BufferAttribute';
import { TypeAssert } from '../../../scene/tools/TypeAssert';
import { BufferGeometry, type BufferGroup, type LineList } from '../containers/BufferGeometry';
import { Geometry } from '../containers/Geometry';
import type { GeometryBase } from '../containers/GeometryBase';
import { Vector3 } from '../../../math/Vector3';
import { Face3 } from '../../../math/Face3';
import type { Mesh } from '../../../scene/drawables/Mesh';

export function createEdge(g: BufferGeometry | Geometry, thresholdAngle: number): BufferGeometry<LineList> {
    return new EdgesBufferGeometry(g, thresholdAngle).forceCastTopology();
}
export function needRebuild(object: Mesh, thresholdAngle: number): boolean {
    if (object._syncedEdgeThreshold !== thresholdAngle) {
        return true;
    }
    if (object.edges?.geometry instanceof EdgesBufferGeometry) {
        return object.edges.geometry.groupsNeedRebuild(object.geometry);
    }
    return false;
}
export function updateEdgesVisibility(object: Mesh) {
    if (!TypeAssert.isBufferGeometry(object.geometry)) {
        return;
    }
    if (!object.edges || !(object.edges.geometry instanceof EdgesBufferGeometry)) {
        return;
    }

    const materials = object.getMaterials();
    const objectGroups = object.geometry.getGroups();
    if (objectGroups.length <= 1) {
        return;
    }

    const edgeGeometry = object.edges.geometry as EdgesBufferGeometry;
    const edgeGroups = edgeGeometry.getGroups();

    for (let i = 0; i < objectGroups.length; i++) {
        const group = objectGroups[i];
        let objectMaterialIndex = group.materialIndex;
        if (materials.length <= 1) {
            objectMaterialIndex = 0;
        }
        const material = materials[objectMaterialIndex];
        const materialIndex = material && material.visible ? 0 : 1;

        if (edgeGroups[i].materialIndex !== materialIndex) {
            edgeGeometry.setGroup(
                {
                    start: edgeGroups[i].start,
                    count: edgeGroups[i].count,
                    materialIndex, // materialIndex: 0 - visible, 1 - invisible
                },
                i,
            );
        }
    }
}

class EdgesBufferGeometry extends BufferGeometry {
    private readonly geometryGroups: BufferGroup[];

    /**
     * @param { number } geometry Any geometry object.
     * @param { number } thresholdAngle An edge is only rendered if the angle (in degrees) between the face normals of the adjoining faces exceeds this value.
     * default = 1 degree.
     */
    constructor(geometry: BufferGeometry | Geometry, thresholdAngle: number) {
        super();
        this.type = 'EdgesBufferGeometry';
        this.parameters = {
            thresholdAngle,
        };
        thresholdAngle = thresholdAngle !== undefined ? thresholdAngle : 1;
        const thresholdDot = Math.cos(_Math.DEG2RAD * thresholdAngle);

        // out position buffer
        const vertices: number[] = [];

        let enableGroups: boolean = false;

        // prepare source geometry, split into multiple geometries if groups.length > 1
        let geometries: Geometry[];
        if (TypeAssert.isBufferGeometry(geometry)) {
            if (geometry.getGroups().length > 1) {
                geometries = this.splitBufferGeometry(geometry);
                enableGroups = true;
                // save current groups for needRebuild
                this.geometryGroups = geometry.getGroups().map(group => ({
                    start: group.start,
                    count: group.count,
                    materialIndex: group.materialIndex,
                }));
            } else {
                geometries = [new Geometry()];
                geometries[0].fromBufferGeometry(geometry);
                this.geometryGroups = [];
            }
        } else {
            geometries = [geometry.clone() as Geometry];
            this.geometryGroups = [];
        }

        // for each geometry
        //   collect edges
        //   generate line segments based on threshold
        //   save group
        for (let i = 0; i < geometries.length; i++) {
            const edge = [0, 0];
            const edges: Record<string, { index1: number; index2: number; face1: number; face2?: number }> = {};
            const keys = ['a', 'b', 'c'] as const;

            let edge1, edge2, key;

            const geometry2 = geometries[i];
            geometry2.mergeVertices();
            geometry2.computeFaceNormals();

            const sourceVertices = geometry2.vertices;
            const faces = geometry2.faces;

            // now create a data structure where each entry represents an edge with its adjoining faces
            for (let i = 0, l = faces.length; i < l; i++) {
                const face = faces[i];
                for (let j = 0; j < 3; j++) {
                    edge1 = face[keys[j]];
                    edge2 = face[keys[(j + 1) % 3]];
                    edge[0] = Math.min(edge1, edge2);
                    edge[1] = Math.max(edge1, edge2);

                    key = edge[0] + ',' + edge[1];
                    if (edges[key] === undefined) {
                        edges[key] = { index1: edge[0], index2: edge[1], face1: i, face2: undefined };
                    } else {
                        edges[key].face2 = i;
                    }
                }
            }

            const start = vertices.length / 3;

            // generate vertices
            for (key in edges) {
                const e = edges[key];
                // an edge is only rendered if the angle (in degrees) between the face normals of the adjoining faces exceeds this value. default = 1 degree.
                if (e.face2 === undefined || faces[e.face1].normal.dot(faces[e.face2].normal) <= thresholdDot) {
                    const vertex1 = sourceVertices[e.index1];
                    vertices.push(vertex1.x, vertex1.y, vertex1.z);
                    const vertex2 = sourceVertices[e.index2];
                    vertices.push(vertex2.x, vertex2.y, vertex2.z);
                }
            }

            const count = vertices.length / 3 - start;

            // save group for this geometry
            if (enableGroups) {
                this.addGroup(start, count, i);
            }
        }

        // build geometry
        this.addAttribute('position', new BufferAttribute(new Float32Array(vertices), 3));
    }

    groupsNeedRebuild(geometry: GeometryBase): boolean {
        // check groups
        if (TypeAssert.isBufferGeometry(geometry) && geometry.getGroups().length > 1) {
            const groups = geometry.getGroups();
            if (groups.length !== this.geometryGroups.length) {
                return true;
            }

            for (let i = 0; i < groups.length; i++) {
                const group1 = groups[i];
                const group2 = this.geometryGroups[i];
                if (group1.start !== group2.start || group1.count !== group2.count) {
                    // materialIndex changes are supported
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * split BufferGeometry into Geometry[] based on groups.
     * returned geometries have only vertices and no other attributes.
     * @private
     */
    private splitBufferGeometry(geometry: BufferGeometry): Geometry[] {
        // skip simple geometry
        if (geometry.getGroups().length === 0) {
            const g = new Geometry();
            g.fromBufferGeometry(geometry);
            return [g];
        }

        const result: Geometry[] = [];

        // process position only
        const attributes = geometry.attributes;
        const positions = attributes.position.array;
        const indices = geometry.index !== null ? geometry.index.array : undefined;

        let outV: Vector3[];
        let outI: Face3[];
        const vertexMap = new Map<number, number>();

        // push used vertices to new array and save mapping
        function getOutputIndex(index: number): number {
            const mapped = vertexMap.get(index);
            if (mapped !== undefined && mapped >= 0) {
                return mapped;
            } else {
                const newIndex = outV.length;
                vertexMap.set(index, newIndex);
                outV.push(new Vector3(positions[index * 3], positions[index * 3 + 1], positions[index * 3 + 2]));
                return newIndex;
            }
        }

        // create geometry for each group
        for (const group of geometry.getGroups()) {
            outV = [];
            outI = [];
            vertexMap.clear();

            const start = group.start;
            const count = group.count;

            for (let j = start, jl = start + count; j < jl; j += 3) {
                if (indices !== undefined) {
                    const a = getOutputIndex(indices[j]);
                    const b = getOutputIndex(indices[j + 1]);
                    const c = getOutputIndex(indices[j + 2]);
                    outI.push(new Face3(a, b, c));
                } else {
                    const a = getOutputIndex(j);
                    const b = getOutputIndex(j + 1);
                    const c = getOutputIndex(j + 2);
                    outI.push(new Face3(a, b, c));
                }
            }

            const g = new Geometry();
            g.vertices = outV;
            g.faces = outI;
            result.push(g);
        }

        return result;
    }
}
