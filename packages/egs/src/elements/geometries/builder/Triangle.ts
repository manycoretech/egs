import { BufferGeometry } from '../containers/BufferGeometry.js';
import { BufferAttribute } from '../../attributes/BufferAttribute.js';

export const WEBGL_QUAD_UV = new Float32Array([0, 0, 2, 0, 0, 2]);

export const WEBGPU_QUAD_UV = new Float32Array([0, 1, 2, 1, 0, -1]);

export class FullScreenTriangleBufferGeometry extends BufferGeometry {
    constructor(
        private isTargetQuad: boolean,
        private isWebGPU: boolean,
    ) {
        super();
        this.type = 'FullScreenTriangleBufferGeometry';

        const vertices = [];
        const normals = [];

        vertices.push(-1, -1, 0);
        vertices.push(3, -1, 0);
        vertices.push(-1, 3, 0);
        normals.push(0, 0, 1);
        normals.push(0, 0, 1);
        normals.push(0, 0, 1);

        this.addAttribute('position', new BufferAttribute(new Float32Array(vertices), 3));
        this.addAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
        this.addAttribute(
            'uv',
            new BufferAttribute(new Float32Array(isTargetQuad && isWebGPU ? WEBGPU_QUAD_UV : WEBGL_QUAD_UV), 2),
        );
    }

    /**
     * @internal
     */
    updateUV(isWebGPU: boolean) {
        if (this.isTargetQuad && isWebGPU !== this.isWebGPU) {
            this.getAttribute('uv')!.array = isWebGPU ? WEBGPU_QUAD_UV : WEBGL_QUAD_UV;
        }
        this.isWebGPU = isWebGPU;
    }
}
