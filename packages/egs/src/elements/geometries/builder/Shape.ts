import { Shape } from '../../../math/shape/plane/Shape';
import { BufferAttribute } from '../../attributes/BufferAttribute';
import { BufferGeometry } from '../../geometries/containers/BufferGeometry';

export interface ShapeShapeParameter {
    shapes: Shape | Shape[];
    curveSegments?: number;
    flipY?: boolean;
}

export function shape(param: ShapeShapeParameter): BufferGeometry {
    return new ShapeBufferGeometry(...(Object.values(param) as any));
}

class ShapeBufferGeometry extends BufferGeometry {
    parameters: {
        shapes: Shape | Shape[];
        curveSegments: number;
        flipY?: boolean;
    };
    /**
     * @param shapes Array of shapes or a single shape.
     * @param curveSegments Number of segments per shape. Default is 12.
     * @param flipY is only used for loading text font in 2D case since we use different.
     */
    constructor(shapes: Shape | Shape[] = [], curveSegments: number = 12, flipY?: boolean) {
        super();
        this.type = 'ShapeBufferGeometry';

        this.parameters = {
            shapes,
            curveSegments,
        };

        // buffers
        const indices: number[] = [];
        const vertices: number[] = [];
        const normals: number[] = [];
        const uvs: number[] = [];

        // helper variables
        let groupStart = 0;
        let groupCount = 0;

        // allow single and array values for "shapes" parameter
        if (!Array.isArray(shapes)) {
            groupCount = this.addShape(shapes as Shape, vertices, normals, uvs, indices, curveSegments, groupCount);
        } else {
            for (let i = 0; i < shapes.length; i++) {
                groupCount = this.addShape(shapes[i], vertices, normals, uvs, indices, curveSegments, groupCount);
                this.addGroup(groupStart, groupCount, i); // enables MultiMaterial support
                groupStart += groupCount;
                groupCount = 0;
            }
        }

        if (flipY) {
            for (let i = 0, n = vertices.length; i < n; i += 3) {
                vertices[i + 1] = -vertices[i + 1];
            }
        }

        // build geometry
        this.setIndex(indices);
        this.addAttribute('position', new BufferAttribute(new Float32Array(vertices), 3));
        this.addAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
        this.addAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
    }

    private addShape(
        shape: Shape,
        vertices: number[],
        normals: number[],
        uvs: number[],
        indices: number[],
        curveSegments: number,
        groupCount: number,
    ): number {
        let i, l, shapeHole;
        const indexOffset = vertices.length / 3;
        const points = shape.extractPoints(curveSegments);
        let shapeVertices = points.shape;
        const shapeHoles = points.holes;

        // check direction of vertices
        if (Shape.isClockWise(shapeVertices) === false) {
            shapeVertices = shapeVertices.reverse();
        }

        for (i = 0, l = shapeHoles.length; i < l; i++) {
            shapeHole = shapeHoles[i];
            if (Shape.isClockWise(shapeHole) === true) {
                shapeHoles[i] = shapeHole.reverse();
            }
        }
        const faces = Shape.triangulateShape(shapeVertices, shapeHoles);
        // join vertices of inner and outer paths to a single array
        for (i = 0, l = shapeHoles.length; i < l; i++) {
            shapeHole = shapeHoles[i];
            shapeVertices = shapeVertices.concat(shapeHole);
        }

        // vertices, normals, uvs
        for (i = 0, l = shapeVertices.length; i < l; i++) {
            const vertex = shapeVertices[i];
            vertices.push(vertex.x, vertex.y, 0);
            normals.push(0, 0, 1);
            uvs.push(vertex.x, vertex.y); // world uvs
        }

        // indices
        for (i = 0, l = faces.length; i < l; i++) {
            const face = faces[i];
            const a = face[0] + indexOffset;
            const b = face[1] + indexOffset;
            const c = face[2] + indexOffset;
            indices.push(a, b, c);
            groupCount += 3;
        }
        return groupCount;
    }
}
