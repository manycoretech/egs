import { BufferAttribute } from '../../../../elements/attributes/BufferAttribute';
import { BufferGeometry } from '../../../../elements/geometries/containers/BufferGeometry';
import { computeNormalsByPosition } from '../../../../elements/geometries/operators/Renormalize';
import { _Math } from '../../../../math/Math';
import { Vector2 } from '../../../../math/Vector2';
import { Vector3 } from '../../../../math/Vector3';

export interface LatheShapeParameter {
    points: Vector2[];
    segments: number;
    phiStart: number;
    phiLength: number;
}

export function lathe(params: Partial<LatheShapeParameter>): BufferGeometry {
    return new LatheBufferGeometry(params.points ?? [], params.segments, params.phiStart, params.phiLength);
}

export class LatheBufferGeometry extends BufferGeometry {
    parameters: {
        points: Vector2[];
        segments: number;
        phiStart: number;
        phiLength: number;
    };
    /**
     * @param points Array of Vector2s. The x-coordinate of each point must be greater than zero.
     * @param segments — the number of circumference segments to generate. Default is 12.
     * @param phiStart — the starting angle in radians. Default is 0.
     * @param phiLength — the radian (0 to 2PI) range of the lathed section 2PI is a closed lathe, less than 2PI is a portion. Default is 2PI.
     * This creates a LatheBufferGeometry based on the parameters.
     */
    constructor(points: Vector2[], segments: number = 12, phiStart: number = 0, phiLength: number = Math.PI * 2) {
        super();

        this.parameters = {
            points,
            segments,
            phiStart,
            phiLength
        };

        segments = Math.floor(segments);
        // clamp phiLength so it's in range of [ 0, 2PI ]
        phiLength = _Math.clamp(phiLength, 0, Math.PI * 2);

        // buffers
        const indices: number[] = [];
        const vertices: number[] = [];
        const uvs: number[] = [];

        // helper variables
        const inverseSegments = 1.0 / segments;
        const vertex = new Vector3();
        const uv = new Vector2();
        let i, j, base;

        // generate vertices and uvs
        for (i = 0; i <= segments; i++) {
            const phi = phiStart + i * inverseSegments * phiLength;
            const sin = Math.sin(phi);
            const cos = Math.cos(phi);
            for (j = 0; j <= (points.length - 1); j++) {
                // vertex
                vertex.x = points[j].x * sin;
                vertex.y = points[j].y;
                vertex.z = points[j].x * cos;
                vertices.push(vertex.x, vertex.y, vertex.z);

                // uv
                uv.x = i / segments;
                uv.y = j / (points.length - 1);
                uvs.push(uv.x, uv.y);
            }
        }

        // indices
        for (i = 0; i < segments; i++) {
            for (j = 0; j < (points.length - 1); j++) {
                base = j + i * points.length;
                const a = base;
                const b = base + points.length;
                const c = base + points.length + 1;
                const d = base + 1;
                // faces
                indices.push(a, b, d);
                indices.push(b, c, d);
            }
        }

        // build geometry
        this.setIndex(indices);
        this.addAttribute('position', new BufferAttribute(new Float32Array(vertices), 3));
        this.addAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));

        // generate normals
        computeNormalsByPosition(this);

        // if the geometry is closed, we need to average the normals along the seam.
        // because the corresponding vertices are identical (but still have different UVs).
        if (phiLength === Math.PI * 2) {
            const normals = this.getAttribute('normal')!.array;
            const n1 = new Vector3();
            const n2 = new Vector3();
            const n = new Vector3();

            // this is the buffer offset for the last line of vertices
            base = segments * points.length * 3;

            for (i = 0, j = 0; i < points.length; i++ , j += 3) {
                // select the normal of the vertex in the first line
                n1.x = normals[j + 0];
                n1.y = normals[j + 1];
                n1.z = normals[j + 2];

                // select the normal of the vertex in the last line
                n2.x = normals[base + j + 0];
                n2.y = normals[base + j + 1];
                n2.z = normals[base + j + 2];

                // average normals
                n.addVectors(n1, n2).normalize();

                // assign the new values to both normals
                normals[j + 0] = normals[base + j + 0] = n.x;
                normals[j + 1] = normals[base + j + 1] = n.y;
                normals[j + 2] = normals[base + j + 2] = n.z;
            }
        }
    }
}
