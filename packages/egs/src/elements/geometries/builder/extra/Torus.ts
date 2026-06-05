import { BufferGeometry } from '../../containers/BufferGeometry';
import { BufferAttribute } from '../../../attributes/BufferAttribute';
import { Vector3 } from '../../../../math/Vector3';
/**
 * @param radius Radius of the torus, from the center of the torus to the center of the tube. Default is 1.
 * @param tube Radius of the tube. Default is 0.4.
 * @param radialSegments The segments of radius. Default is 8
 * @param tubularSegments The segments of tubular. Default is 6.
 * @param arc — Central angle. Default is Math.PI * 2.
 */
export interface TorusShapeParameter {
    radius: number;
    tube: number;
    radialSegments: number;
    tubularSegments: number;
    arc: number;
}

const def = {
    radius: 1,
    tube: 0.4,
    radialSegments: 8,
    tubularSegments: 6,
    arc: Math.PI * 2,
};

export function torus(parameters: Partial<TorusShapeParameter>): BufferGeometry {
    // oxlint-disable-next-line prefer-const
    let { radius, tube, radialSegments, tubularSegments, arc } = { ...def, ...parameters };

    radialSegments = Math.floor(radialSegments);
    tubularSegments = Math.floor(tubularSegments);

    // buffers
    const indices = [];
    const vertices = [];
    const normals = [];
    const uvs = [];

    // helper variables
    const center = new Vector3();
    const vertex = new Vector3();
    const normal = new Vector3();

    let j, i;
    // generate vertices, normals and uvs
    for (j = 0; j <= radialSegments; j++) {
        for (i = 0; i <= tubularSegments; i++) {
            const u = (i / tubularSegments) * arc;
            const v = (j / radialSegments) * Math.PI * 2;

            // vertex
            vertex.x = (radius + tube * Math.cos(v)) * Math.cos(u);
            vertex.y = (radius + tube * Math.cos(v)) * Math.sin(u);
            vertex.z = tube * Math.sin(v);
            vertices.push(vertex.x, vertex.y, vertex.z);

            // normal
            center.x = radius * Math.cos(u);
            center.y = radius * Math.sin(u);
            normal.subVectors(vertex, center).normalize();
            normals.push(normal.x, normal.y, normal.z);

            // uv
            uvs.push(i / tubularSegments);
            uvs.push(j / radialSegments);
        }
    }

    // generate indices
    for (j = 1; j <= radialSegments; j++) {
        for (i = 1; i <= tubularSegments; i++) {
            // indices
            const a = (tubularSegments + 1) * j + i - 1;
            const b = (tubularSegments + 1) * (j - 1) + i - 1;
            const c = (tubularSegments + 1) * (j - 1) + i;
            const d = (tubularSegments + 1) * j + i;

            // faces
            indices.push(a, b, d);
            indices.push(b, c, d);
        }
    }

    // build geometry

    return new BufferGeometry()
        .setIndex(indices)
        .addAttribute('position', new BufferAttribute(new Float32Array(vertices), 3))
        .addAttribute('normal', new BufferAttribute(new Float32Array(normals), 3))
        .addAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
}
