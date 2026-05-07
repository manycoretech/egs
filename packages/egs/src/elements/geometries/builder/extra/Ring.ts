import { BufferAttribute } from '../../../../elements/attributes/BufferAttribute';
import { BufferGeometry } from '../../../../elements/geometries/containers/BufferGeometry';
import { computeNormalsByPosition } from '../../../../elements/geometries/operators/Renormalize';
import { Vector2 } from '../../../../math/Vector2';
import { Vector3 } from '../../../../math/Vector3';

export interface RingParameter {
    innerRadius: number;
    outerRadius: number;
    thetaSegments: number;
    phiSegments: number;
    thetaStart: number;
    thetaLength: number;
}

export function ring(params: Partial<RingParameter>): BufferGeometry {
    return new RingBufferGeometry(params.innerRadius, params.outerRadius, params.thetaSegments, params.phiSegments, params.thetaStart, params.thetaLength);
}

export class RingBufferGeometry extends BufferGeometry {
    public parameters: {
        innerRadius: number;
        outerRadius: number;
        thetaSegments: number;
        phiSegments: number;
        thetaStart: number;
        thetaLength: number;
    };
    /**
     * @param innerRadius The radius of inner round. Default is 0.5.
     * @param outerRadius The radius of outter round. Default is 1.
     * @param thetaSegments Number of segments. A higher number means the ring will be more round. Minimum is 3. Default is 8.
     * @param phiSegments Minimum is 1. Default is 1.
     * @param thetaStart Starting angle. Default is 0.
     * @param thetaLength Central angle. Default is Math.PI * 2.
     */
    constructor(innerRadius: number = 0.5, outerRadius: number = 1, thetaSegments: number = 8, phiSegments: number = 1, thetaStart: number = 0, thetaLength: number = Math.PI * 2) {
        super();

        this.parameters = {
            innerRadius,
            outerRadius,
            thetaSegments,
            phiSegments,
            thetaStart,
            thetaLength
        };

        thetaSegments = Math.max(3, thetaSegments);
        phiSegments = Math.max(1, phiSegments);

        // buffers
        const indices: number[] = [];
        const vertices: number[] = [];
        const normals: number[] = [];
        const uvs: number[] = [];

        // some helper variables
        let segment: number;
        let radius = innerRadius;
        const radiusStep = ((outerRadius - innerRadius) / phiSegments);
        const vertex = new Vector3();
        const uv = new Vector2();
        let j: number;
        let i: number;

        // generate vertices, normals and uvs
        for (j = 0; j <= phiSegments; j++) {
            for (i = 0; i <= thetaSegments; i++) {
                // values are generate from the inside of the ring to the outside
                segment = thetaStart + i / thetaSegments * thetaLength;
                // vertex
                vertex.x = radius * Math.cos(segment);
                vertex.y = radius * Math.sin(segment);
                vertices.push(vertex.x, vertex.y, vertex.z);
                // normal
                normals.push(0, 0, 1);
                // uv
                uv.x = (vertex.x / outerRadius + 1) / 2;
                uv.y = (vertex.y / outerRadius + 1) / 2;
                uvs.push(uv.x, uv.y);
            }
            // increase the radius for next row of vertices
            radius += radiusStep;
        }

        // indices
        for (j = 0; j < phiSegments; j++) {
            const thetaSegmentLevel = j * (thetaSegments + 1);
            for (i = 0; i < thetaSegments; i++) {
                segment = i + thetaSegmentLevel;
                const a = segment;
                const b = segment + thetaSegments + 1;
                const c = segment + thetaSegments + 2;
                const d = segment + 1;

                // faces
                indices.push(a, b, d);
                indices.push(b, c, d);
            }
        }

        // build geometry
        this.setIndex(indices);
        this.addAttribute('position', new BufferAttribute(new Float32Array(vertices), 3));
        this.addAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
        this.addAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));

        // generate normals
        computeNormalsByPosition(this);
    }
}
