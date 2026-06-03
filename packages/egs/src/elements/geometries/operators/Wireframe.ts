import { BufferAttribute } from '../../attributes/BufferAttribute';
import { Vector3 } from '../../../math/Vector3';
import { TypeAssert } from '../../../scene/tools/TypeAssert';
import type { GeometryBase } from '../containers/GeometryBase';
import { BufferGeometry, type LineList } from '../containers/BufferGeometry';

export function createWireframe(geometry: GeometryBase): BufferGeometry<LineList> {
    return new WireframeBufferGeometry(geometry);
}

/**
 * This can be used as a helper object to view a Geometry object as a wireframe.
 */
export class WireframeBufferGeometry extends BufferGeometry<LineList> {
    type = 'WireframeBufferGeometry';
    /**
     * @param geometry Any geometry object.
     */
    constructor(geometry: GeometryBase) {
        super();

        // buffer
        const vertices = [];

        // helper variables
        let i, j, l, o, ol, e, edge1, edge2, key, vertex;
        const edge = [0, 0];
        const edges: Record<string, { index1: number, index2: number }> = {};
        const keys = ['a', 'b', 'c'];

        // different logic for Geometry and BufferGeometry
        if (TypeAssert.isGeometry(geometry)) {
            // create a data structure that contains all edges without duplicates
            const faces = geometry.faces;

            for (i = 0, l = faces.length; i < l; i++) {
                const face = faces[i];
                for (j = 0; j < 3; j++) {
                    edge1 = (face as any)[keys[j]] as number;
                    edge2 = (face as any)[keys[(j + 1) % 3]] as number;
                    edge[0] = Math.min(edge1, edge2); // sorting prevents duplicates
                    edge[1] = Math.max(edge1, edge2);
                    key = edge[0] + ',' + edge[1];
                    if (edges[key] === undefined) {
                        edges[key] = { index1: edge[0], index2: edge[1] };
                    }
                }
            }

            // generate vertices
            for (key in edges) {
                e = edges[key];
                vertex = geometry.vertices[e.index1];
                vertices.push(vertex.x, vertex.y, vertex.z);
                vertex = geometry.vertices[e.index2];
                vertices.push(vertex.x, vertex.y, vertex.z);
            }
        } else if (TypeAssert.isBufferGeometry(geometry)) {
            let position, indices, groups,
                group, start, count,
                index1, index2;
            vertex = new Vector3();
            if (geometry.index !== null) {
                // indexed BufferGeometry
                position = geometry.position;
                indices = geometry.index;
                groups = geometry.getGroups();

                if (groups.length === 0) {
                    groups = [{ start: 0, count: indices.count, materialIndex: 0 }];
                }

                // create a data structure that contains all eges without duplicates
                for (o = 0, ol = groups.length; o < ol; ++o) {
                    group = groups[o];
                    start = group.start;
                    count = group.count;
                    for (i = start, l = (start + count); i < l; i += 3) {
                        for (j = 0; j < 3; j++) {
                            edge1 = indices.getX(i + j);
                            edge2 = indices.getX(i + (j + 1) % 3);
                            edge[0] = Math.min(edge1, edge2); // sorting prevents duplicates
                            edge[1] = Math.max(edge1, edge2);
                            key = edge[0] + ',' + edge[1];
                            if (edges[key] === undefined) {
                                edges[key] = { index1: edge[0], index2: edge[1] };
                            }
                        }
                    }
                }

                // generate vertices
                for (key in edges) {
                    e = edges[key];
                    vertex.fromBufferAttribute(position, e.index1);
                    vertices.push(vertex.x, vertex.y, vertex.z);
                    vertex.fromBufferAttribute(position, e.index2);
                    vertices.push(vertex.x, vertex.y, vertex.z);
                }
            } else {
                // non-indexed BufferGeometry
                position = geometry.position;
                for (i = 0, l = (position.count / 3); i < l; i++) {
                    for (j = 0; j < 3; j++) {
                        // three edges per triangle, an edge is represented as (index1, index2)
                        // e.g. the first triangle has the following edges: (0,1),(1,2),(2,0)
                        index1 = 3 * i + j;
                        vertex.fromBufferAttribute(position, index1);
                        vertices.push(vertex.x, vertex.y, vertex.z);
                        index2 = 3 * i + ((j + 1) % 3);
                        vertex.fromBufferAttribute(position, index2);
                        vertices.push(vertex.x, vertex.y, vertex.z);
                    }
                }
            }
        }
        // build geometry
        this.addAttribute('position', new BufferAttribute(new Float32Array(vertices), 3));
    }
}
