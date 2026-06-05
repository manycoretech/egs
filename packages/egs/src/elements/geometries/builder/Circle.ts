import { BufferGeometry } from '../containers/BufferGeometry';
import { Vector3 } from '../../../math/Vector3';
import { Vector2 } from '../../../math/Vector2';
import { BufferAttribute } from '../../attributes/BufferAttribute';

export interface CircleShapeParameter {
    radius: number;
    segments: number;
    thetaStart: number;
    thetaLength: number;
}

export function circle(param: Partial<CircleShapeParameter>): BufferGeometry {
    return new CircleBufferGeometry(param.radius, param.segments, param.thetaStart, param.thetaLength);
}

class CircleBufferGeometry extends BufferGeometry {
    parameters: {
        radius: number;
        segments: number;
        thetaStart: number;
        thetaLength: number;
    };
    /**
     * @param { number } radius Radius of the circle, default = 1.
     * @param { number } segments Number of segments (triangles), minimum = 3, default = 8.
     * @param { number } thetaStart Start angle for first segment, default = 0 (three o'clock position).
     * @param { number } thetaLength The central angle, often called theta, of the circular sector.
     * The default is 2*Pi, which makes for a complete circle.
     */
    constructor(radius: number = 1, segments: number = 8, thetaStart: number = 0, thetaLength: number = Math.PI * 2) {
        super();
        this.type = 'CircleBufferGeometry';

        this.parameters = {
            radius,
            segments,
            thetaStart,
            thetaLength,
        };
        segments = Math.max(3, segments);

        // buffers
        const indices = [];
        const vertices = [];
        const normals = [];
        const uvs = [];

        // helper variables
        let i: number;
        let s: number;
        const vertex = new Vector3();
        const uv = new Vector2();

        // center point
        vertices.push(0, 0, 0);
        normals.push(0, 0, 1);
        uvs.push(0.5, 0.5);

        for (s = 0, i = 3; s <= segments; s++, i += 3) {
            const segment = thetaStart + (s / segments) * thetaLength;

            // vertex
            vertex.x = radius * Math.cos(segment);
            vertex.y = radius * Math.sin(segment);
            vertices.push(vertex.x, vertex.y, vertex.z);

            // normal
            normals.push(0, 0, 1);

            // uvs
            uv.x = (vertices[i] / radius + 1) / 2;
            uv.y = (vertices[i + 1] / radius + 1) / 2;
            uvs.push(uv.x, uv.y);
        }

        // indices
        for (i = 1; i <= segments; i++) {
            indices.push(i, i + 1, 0);
        }

        // build geometry
        this.setIndex(indices);
        this.addAttribute('position', new BufferAttribute(new Float32Array(vertices), 3));
        this.addAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
        this.addAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
    }
}
