import { BufferAttribute } from '../../../../elements/attributes/BufferAttribute';
import { BufferGeometry } from '../../../../elements/geometries/containers/BufferGeometry';
import { computeNormalsByPosition } from '../../../../elements/geometries/operators/Renormalize';
import { Vector3 } from '../../../../math/Vector3';

export interface TorusKnotShapeParameter {
    radius: number;
    tube: number;
    radialSegments: number;
    tubularSegments: number;
    p: number;
    q: number;
}

export function torusKnot(params: Partial<TorusKnotShapeParameter>): BufferGeometry {
    return new TorusKnotBufferGeometry(params.radius, params.tube, params.radialSegments, params.tubularSegments, params.p, params.q);
}

export class TorusKnotBufferGeometry extends BufferGeometry {
    declare parameters: {
        radius: number;
        tube: number;
        radialSegments: number;
        tubularSegments: number;
        p: number;
        q: number;
    };
    /**
     * @param radius Radius of the torus. Default is 1.
     * @param tube Radius of the tube. Default is 0.4.
     * @param tubularSegments The segments of tubular. Default is 64.
     * @param radialSegments The segments of radius. Default is 8.
     * @param p This value determines, how many times the geometry winds around its axis of rotational symmetry. Default is 2.
     * @param q This value determines, how many times the geometry winds around a circle in the interior of the torus. Default is 3.
     */
    constructor(radius: number = 1, tube: number = 0.4, tubularSegments: number = 64, radialSegments: number = 8, p: number = 2, q: number = 3) {
        super();

        tubularSegments = Math.floor(tubularSegments);
        radialSegments = Math.floor(radialSegments);

        // buffers
        const indices: number[] = [];
        const vertices: number[] = [];
        const normals: number[] = [];
        const uvs: number[] = [];

        // helper variables
        let i, j;
        const vertex = new Vector3();
        const normal = new Vector3();
        const P1 = new Vector3();
        const P2 = new Vector3();
        const B = new Vector3();
        const T = new Vector3();
        const N = new Vector3();

        // generate vertices, normals and uvs
        for (i = 0; i <= tubularSegments; ++i) {
            // the radian "u" is used to calculate the position on the torus curve of the current tubular segment
            const u = i / tubularSegments * p * Math.PI * 2;

            // now we calculate two points. P1 is our current position on the curve, P2 is a little farther ahead.
            // these points are used to create a special "coordinate space", which is necessary to calculate the correct vertex positions
            calculatePositionOnCurve(u, p, q, radius, P1);
            calculatePositionOnCurve(u + 0.01, p, q, radius, P2);

            // calculate orthonormal basis
            T.subVectors(P2, P1);
            N.addVectors(P2, P1);
            B.crossVectors(T, N);
            N.crossVectors(B, T);

            // normalize B, N. T can be ignored, we don't use it
            B.normalize();
            N.normalize();

            for (j = 0; j <= radialSegments; ++j) {
                // now calculate the vertices. they are nothing more than an extrusion of the torus curve.
                // because we extrude a shape in the xy-plane, there is no need to calculate a z-value.
                const v = j / radialSegments * Math.PI * 2;
                const cx = - tube * Math.cos(v);
                const cy = tube * Math.sin(v);

                // now calculate the final vertex position.
                // first we orient the extrusion with our basis vectors, then we add it to the current position on the curve
                vertex.x = P1.x + (cx * N.x + cy * B.x);
                vertex.y = P1.y + (cx * N.y + cy * B.y);
                vertex.z = P1.z + (cx * N.z + cy * B.z);
                vertices.push(vertex.x, vertex.y, vertex.z);

                // normal (P1 is always the center/origin of the extrusion, thus we can use it to calculate the normal)
                normal.subVectors(vertex, P1).normalize();
                normals.push(normal.x, normal.y, normal.z);

                // uv
                uvs.push(i / tubularSegments);
                uvs.push(j / radialSegments);
            }
        }

        // generate indices
        for (j = 1; j <= tubularSegments; j++) {
            for (i = 1; i <= radialSegments; i++) {
                // indices
                const a = (radialSegments + 1) * (j - 1) + (i - 1);
                const b = (radialSegments + 1) * j + (i - 1);
                const c = (radialSegments + 1) * j + i;
                const d = (radialSegments + 1) * (j - 1) + i;

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
        computeNormalsByPosition(this);

        // this function calculates the current position on the torus curve
        function calculatePositionOnCurve(u: number, _p: number, _q: number, _radius: number, position: Vector3) {
            const cu = Math.cos(u);
            const su = Math.sin(u);
            const quOverP = _q / _p * u;
            const cs = Math.cos(quOverP);
            position.x = _radius * (2 + cs) * 0.5 * cu;
            position.y = _radius * (2 + cs) * su * 0.5;
            position.z = _radius * Math.sin(quOverP) * 0.5;
        }
    }
}
