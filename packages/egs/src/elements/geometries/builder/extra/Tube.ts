import { BufferAttribute } from '../../../../elements/attributes/BufferAttribute';
import { computeNormalsByPosition } from '../../../../elements/geometries/operators/Renormalize';
import { BufferGeometry } from '../../../../elements/geometries/containers/BufferGeometry';
import { Vector3 } from '../../../../math/Vector3';
import type { Curve } from '../../../../math/shape/curves/Curve';
import { Vector2 } from '../../../../math/Vector2';
export interface TubeShapeParameter {
    path: Curve<Vector3>;
    tubularSegments: number;
    radius: number;
    radialSegments: number;
    closed: boolean;
}

export function tube(params: Partial<TubeShapeParameter>): BufferGeometry {
    return new TubeBufferGeometry(
        params.path!,
        params.tubularSegments,
        params.radius,
        params.radialSegments,
        params.closed,
    );
}

export class TubeBufferGeometry extends BufferGeometry {
    parameters: {
        path: Curve<Vector3>;
        tubularSegments: number;
        radius: number;
        radialSegments: number;
        closed: boolean;
    };
    tangents: Vector3[];
    normals: Vector3[];
    biNormals: Vector3[];
    /**
     * @param path A path that inherits from the Curve base class.
     * @param tubularSegments The number of segments that make up the tube, default is 64.
     * @param radius The radius of the tube, default is 1.
     * @param radialSegments The number of segments that make up the cross-section, default is 8.
     * @param closed Boolean Is the tube open or closed, default is false.
     */
    constructor(
        path: Curve<Vector3>,
        tubularSegments: number = 64,
        radius: number = 1,
        radialSegments: number = 8,
        closed: boolean = false,
    ) {
        super();
        this.parameters = {
            path,
            tubularSegments,
            radius,
            radialSegments,
            closed,
        };
        const frames = path.computeFrenetFrames(tubularSegments, closed);

        // expose internals
        this.tangents = frames.tangents;
        this.normals = frames.normals;
        this.biNormals = frames.biNormals;

        // helper variables
        const vertex = new Vector3();
        const normal = new Vector3();
        const uv = new Vector2();
        let P = new Vector3();

        let i, j;
        // buffer
        const vertices: number[] = [];
        const normals: number[] = [];
        const uvs: number[] = [];
        const indices: number[] = [];

        // create buffer data
        generateBufferData();

        // build geometry
        this.setIndex(indices);
        this.addAttribute('position', new BufferAttribute(new Float32Array(vertices), 3));
        this.addAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
        this.addAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
        computeNormalsByPosition(this);

        // functions
        function generateBufferData() {
            for (i = 0; i < tubularSegments; i++) {
                generateSegment(i);
            }
            // if the geometry is not closed, generate the last row of vertices and normals
            // at the regular position on the given path
            //
            // if the geometry is closed, duplicate the first row of vertices and normals (uvs will differ)
            generateSegment(closed === false ? tubularSegments : 0);

            // uvs are generated in a separate function.
            // this makes it easy compute correct values for closed geometries
            generateUVs();

            // finally create faces
            generateIndices();
        }

        function generateSegment(_i: number) {
            // we use getPointAt to sample evenly distributed points from the given path
            P = path.getPointAt(_i / tubularSegments, P);

            // retrieve corresponding normal and biNormal
            const N = frames.normals[_i];
            const B = frames.biNormals[_i];

            // generate normals and vertices for the current segment
            for (j = 0; j <= radialSegments; j++) {
                const v = (j / radialSegments) * Math.PI * 2;
                const sin = Math.sin(v);
                const cos = -Math.cos(v);

                // normal
                normal.x = cos * N.x + sin * B.x;
                normal.y = cos * N.y + sin * B.y;
                normal.z = cos * N.z + sin * B.z;
                normal.normalize();
                normals.push(normal.x, normal.y, normal.z);

                // vertex
                vertex.x = P.x + radius * normal.x;
                vertex.y = P.y + radius * normal.y;
                vertex.z = P.z + radius * normal.z;
                vertices.push(vertex.x, vertex.y, vertex.z);
            }
        }

        function generateIndices() {
            for (j = 1; j <= tubularSegments; j++) {
                for (i = 1; i <= radialSegments; i++) {
                    const a = (radialSegments + 1) * (j - 1) + (i - 1);
                    const b = (radialSegments + 1) * j + (i - 1);
                    const c = (radialSegments + 1) * j + i;
                    const d = (radialSegments + 1) * (j - 1) + i;

                    // faces
                    indices.push(a, b, d);
                    indices.push(b, c, d);
                }
            }
        }

        function generateUVs() {
            for (i = 0; i <= tubularSegments; i++) {
                for (j = 0; j <= radialSegments; j++) {
                    uv.x = i / tubularSegments;
                    uv.y = j / radialSegments;
                    uvs.push(uv.x, uv.y);
                }
            }
        }
    }
}
