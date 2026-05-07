import { BufferGeometry } from '../containers/BufferGeometry';
import { BufferAttribute } from '../../attributes/BufferAttribute';

export interface PlaneShapeParameter {
    width: number;
    height: number;
    widthSegments: number;
    heightSegments: number;
}

export function plane(param: Partial<PlaneShapeParameter>): BufferGeometry {
    return new PlaneBufferGeometry(...Object.values(param) as any);
}

class PlaneBufferGeometry extends BufferGeometry {
    public parameters: {
        width: number;
        height: number;
        widthSegments: number;
        heightSegments: number;
    };
    /**
     * @param width Width along the X axis. Default is 1.
     * @param height Height along the Y axis. Default is 1.
     * @param widthSegments The number of segments of width. Default is 1.
     * @param heightSegments The number of segments of height. Default is 1.
     */
    constructor(width: number = 1, height: number = 1, widthSegments: number = 1, heightSegments: number = 1) {
        super();
        this.type = 'PlaneBufferGeometry';

        this.parameters = {
            width,
            height,
            widthSegments,
            heightSegments
        };

        const width_half = width / 2;
        const height_half = height / 2;
        const gridX = Math.floor(widthSegments);
        const gridY = Math.floor(heightSegments);
        const gridX1 = gridX + 1;
        const gridY1 = gridY + 1;
        const segment_width = width / gridX;
        const segment_height = height / gridY;
        let ix: number;
        let iy: number;

        // buffers
        const indices = [];
        const vertices = [];
        const normals = [];
        const uvs = [];

        // generate vertices, normals and uvs
        for (iy = 0; iy < gridY1; iy++) {
            const y = iy * segment_height - height_half;
            for (ix = 0; ix < gridX1; ix++) {
                const x = ix * segment_width - width_half;
                vertices.push(x, - y, 0);
                normals.push(0, 0, 1);
                uvs.push(ix / gridX);
                uvs.push(1 - (iy / gridY));
            }
        }

        // indices
        for (iy = 0; iy < gridY; iy++) {
            for (ix = 0; ix < gridX; ix++) {
                const a = ix + gridX1 * iy;
                const b = ix + gridX1 * (iy + 1);
                const c = (ix + 1) + gridX1 * (iy + 1);
                const d = (ix + 1) + gridX1 * iy;

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
    }
}
