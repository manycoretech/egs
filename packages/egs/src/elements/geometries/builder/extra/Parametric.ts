import { BufferAttribute } from '../../../../elements/attributes/BufferAttribute';
import { Vector3 } from '../../../../math/Vector3';
import { BufferGeometry } from '../../../../elements/geometries/containers/BufferGeometry';
import { logger } from '../../../../utils/Logger';

export interface ParametricShapeParameter {
    func: (u: number, v: number, w: Vector3) => Vector3;
    slices: number;
    stacks: number;
}

export function Parametric(params: Partial<ParametricShapeParameter>): BufferGeometry {
    return new ParametricBufferGeometry(params.func!, params.slices!, params.stacks!);
}

export class ParametricBufferGeometry extends BufferGeometry {
    public parameters: {
        func: (u: number, v: number, w: Vector3) => Vector3;
        slices: number;
        stacks: number;
    };
    /**
     * @param func A function that takes in a u and v value each between 0 and 1 and modifies a third Vector3 argument.
     * @param slices The count of slices to use for the parametric function.
     * @param stacks The count of stacks to use for the parametric function.
     */
    constructor(func: (u: number, v: number, w: Vector3) => Vector3, slices: number, stacks: number) {
        super();
        BufferGeometry.call(this);
        this.parameters = {
            func,
            slices,
            stacks
        };

        // buffers
        const indices = [];
        const vertices = [];
        const normals = [];
        const uvs = [];
        const EPS = 0.00001;
        const normal = new Vector3();

        const p0 = new Vector3();
        const p1 = new Vector3();
        const pu = new Vector3();
        const pv = new Vector3();

        let i, j;
        if (func.length < 3) {
            logger.invalidInput('EGS.ParametricGeometry: Function must now modify a Vector3 as third parameter.');
        }

        // generate vertices, normals and uvs
        const sliceCount = slices + 1;
        for (i = 0; i <= stacks; i++) {
            const v = i / stacks;
            for (j = 0; j <= slices; j++) {
                const u = j / slices;
                // vertex
                func(u, v, p0);
                vertices.push(p0.x, p0.y, p0.z);
                // normal
                // approximate tangent vectors via finite differences
                if (u - EPS >= 0) {
                    func(u - EPS, v, p1);
                    pu.subVectors(p0, p1);
                } else {
                    func(u + EPS, v, p1);
                    pu.subVectors(p1, p0);
                }

                if (v - EPS >= 0) {
                    func(u, v - EPS, p1);
                    pv.subVectors(p0, p1);
                } else {
                    func(u, v + EPS, p1);
                    pv.subVectors(p1, p0);
                }

                // cross product of tangent vectors returns surface normal
                normal.crossVectors(pu, pv).normalize();
                normals.push(normal.x, normal.y, normal.z);

                // uv
                uvs.push(u, v);
            }
        }

        // generate indices
        for (i = 0; i < stacks; i++) {
            for (j = 0; j < slices; j++) {
                const a = i * sliceCount + j;
                const b = i * sliceCount + j + 1;
                const c = (i + 1) * sliceCount + j + 1;
                const d = (i + 1) * sliceCount + j;

                // faces one and two
                indices.push(a, b, d);
                indices.push(b, c, d);
            }
        }
        // build geometry
        this.setIndex(indices);
        this.addAttribute('position', new BufferAttribute(new Float32Array(vertices), 3));
        this.addAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
        this.addAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
    }
}
