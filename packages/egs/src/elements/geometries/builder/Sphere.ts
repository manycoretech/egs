import { BufferGeometry } from '../containers/BufferGeometry';
import { Vector3 } from '../../../math/Vector3';
import { BufferAttribute } from '../../attributes/BufferAttribute';

export interface SphereShapeParameter {
    radius: number;
    widthSegments: number;
    heightSegments: number;
    phiStart: number;
    phiLength: number;
    thetaStart: number;
    thetaLength: number;
}

export function sphere(param: Partial<SphereShapeParameter>): BufferGeometry {
    return new SphereBufferGeometry(...Object.values(param) as any);
}

export class SphereBufferGeometry extends BufferGeometry {
    public parameters: {
        radius: number;
        widthSegments: number;
        heightSegments: number;
        phiStart: number;
        phiLength: number;
        thetaStart: number;
        thetaLength: number;
    };
    /**
     * The geometry is created by sweeping and calculating vertexes around the Y axis (horizontal sweep) and the Z axis (vertical sweep).
     * Thus, incomplete spheres (akin to 'sphere slices') can be created through the use of different values of phiStart, phiLength, thetaStart and thetaLength,
     * in order to define the points in which we start (or end) calculating those vertices.
     * @param radius Sphere radius. Default is 1.
     * @param widthSegments Number of horizontal segments. Minimum value is 3, and the default is 8.
     * @param heightSegments Number of vertical segments. Minimum value is 2, and the default is 6.
     * @param phiStart — specify horizontal starting angle. Default is 0.
     * @param phiLength — specify horizontal sweep angle size. Default is Math.PI * 2.
     * @param thetaStart — specify vertical starting angle. Default is 0.
     * @param thetaLength — specify vertical sweep angle size. Default is Math.PI.
     */
    constructor(radius: number = 1, widthSegments: number = 8, heightSegments: number = 6, phiStart: number = 0, phiLength: number = Math.PI * 2, thetaStart: number = 0, thetaLength: number = Math.PI) {
        super();
        this.type = 'SphereBufferGeometry';

        this.parameters = {
            radius,
            widthSegments,
            heightSegments,
            phiStart,
            phiLength,
            thetaStart,
            thetaLength
        };

        widthSegments = Math.max(3, Math.floor(widthSegments));
        heightSegments = Math.max(2, Math.floor(heightSegments));

        const thetaEnd = thetaStart + thetaLength;
        let ix: number;
        let iy: number;
        let index = 0;
        const grid = [];
        const vertex = new Vector3();
        const normal = new Vector3();

        // buffers
        const indices = [];
        const vertices = [];
        const normals = [];
        const uvs = [];

        // generate vertices, normals and uvs
        for (iy = 0; iy <= heightSegments; iy++) {
            const verticesRow = [];
            const v = iy / heightSegments;
            for (ix = 0; ix <= widthSegments; ix++) {
                const u = ix / widthSegments;
                // vertex
                vertex.x = - radius * Math.cos(phiStart + u * phiLength) * Math.sin(thetaStart + v * thetaLength);
                vertex.y = radius * Math.cos(thetaStart + v * thetaLength);
                vertex.z = radius * Math.sin(phiStart + u * phiLength) * Math.sin(thetaStart + v * thetaLength);
                vertices.push(vertex.x, vertex.y, vertex.z);

                // normal
                normal.set(vertex.x, vertex.y, vertex.z).normalize();
                normals.push(normal.x, normal.y, normal.z);

                // uv
                uvs.push(u, 1 - v);
                verticesRow.push(index++);
            }
            grid.push(verticesRow);
        }

        // indices
        for (iy = 0; iy < heightSegments; iy++) {
            for (ix = 0; ix < widthSegments; ix++) {
                const a = grid[iy][ix + 1];
                const b = grid[iy][ix];
                const c = grid[iy + 1][ix];
                const d = grid[iy + 1][ix + 1];
                if (iy !== 0 || thetaStart > 0) {
                    indices.push(a, b, d);
                }
                if (iy !== heightSegments - 1 || thetaEnd < Math.PI) {
                    indices.push(b, c, d);
                }
            }
        }

        // build geometry
        this.setIndex(indices);
        this.addAttribute('position', new BufferAttribute(new Float32Array(vertices), 3));
        this.addAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
        this.addAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
    }
}
