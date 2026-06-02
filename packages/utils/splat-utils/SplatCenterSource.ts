import { type BVHSource } from '@qunhe/egs-lib';
import { SplatOperator } from './SplatOperator';

export interface SplatCenterPrimitive {
    x: number;
    y: number;
    z: number;
}

export class SplatCenterPrimitiveSource implements BVHSource<SplatCenterPrimitive> {
    private operator: SplatOperator;
    private centers: Float32Array;

    constructor(operator: SplatOperator) {
        this.operator = operator;
    }

    build() {
        const { operator } = this;
        const count = operator.getActiveCounts();
        const indices = new Uint32Array(count);
        const centers = new Float32Array(count * 3);

        let offset = 0;
        operator.foreachSplatCenter((i, x, y, z) => {
            indices[offset] = i;
            const o = offset * 3;
            centers[o + 0] = x;
            centers[o + 1] = y;
            centers[o + 2] = z;
            offset++;
        });

        this.centers = centers;

        // Center primitives are point bounds, so min/max intentionally share the centers buffer
        // BVH treats buffers as read-only.
        return { count, indices, centers, boxMins: centers, boxMaxs: centers };
    }

    createEmpty(): SplatCenterPrimitive {
        return { x: 0, y: 0, z: 0 };
    }

    get(localIdx: number, primitive: SplatCenterPrimitive) {
        const { centers } = this;
        const o = localIdx * 3;
        primitive.x = centers[o + 0];
        primitive.y = centers[o + 1];
        primitive.z = centers[o + 2];
    }
}
