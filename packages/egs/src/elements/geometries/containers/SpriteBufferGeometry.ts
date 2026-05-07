import { BufferGeometry } from './BufferGeometry';
import { BufferAttribute } from '../../attributes/BufferAttribute';
import { Box3 } from '../../../math/Box3';
import { Sphere } from '../../../math/Sphere';
import { ContentBridge } from '../../../ContentAPI';

const HALF_SQRT_2 = Math.SQRT2 / 2.0;

export class SpriteBufferGeometry extends BufferGeometry {
    isSpriteBufferGeometry = true;

    constructor() {
        super();
        const position = new BufferAttribute(new Float32Array([- 0.5, - 0.5, 0, 0.5, - 0.5, 0, 0.5, 0.5, 0, - 0.5, 0.5, 0]), 3);
        const uv = new BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2);
        this.setIndex([0, 1, 2, 0, 2, 3]);
        this.setAttribute('position', position);
        this.setAttribute('uv', uv);
        ContentBridge.bufferGeometrySetIsSprite(this);
    }

    computeBoundingBox(): void {
        if (this.checkRefreshBoundingBoxFast()) {
            return;
        }
        if (this.boundingBox === null) {
            this.boundingBox = new Box3();
        }
        this.boundingBox.min.set(-HALF_SQRT_2, -HALF_SQRT_2, -HALF_SQRT_2);
        this.boundingBox.max.set(HALF_SQRT_2, HALF_SQRT_2, HALF_SQRT_2);
    }

    computeBoundingSphere(): void {
        if (this.checkRefreshBoundingSphereFast()) {
            return;
        }
        if (this.boundingSphere === null) {
            this.boundingSphere = new Sphere();
        }
        this.boundingSphere.center.set(0, 0, 0);
        this.boundingSphere.radius = HALF_SQRT_2;
    }
}
