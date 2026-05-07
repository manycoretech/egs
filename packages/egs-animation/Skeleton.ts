import { Application, Object3D, Matrix4, Texture2D, _Math, WebGLPixelFormat, TextureDataType, __INNER__, SkinnedMesh } from '@qunhe/egs';
import semver from 'semver';

import Object3DChangeEvent = __INNER__.Object3DChangeEvent;

const tempMat = new Matrix4();

const EGS_VERSION_1_2_X = semver.satisfies(Application.version, '1.2.x');

/**
 * A special class used by {@link SkinnedMesh} containing an array of bones.
 */
export class Skeleton {
    private bones: Object3D[]; // index 0 is root node
    private boneInverses: Matrix4[];

    private boneMatrices: Float32Array;
    private boneTexture: Texture2D;
    private needUpdate = true;

    get texture() {
        return this.boneTexture;
    }

    get rootBone() {
        return this.bones[0];
    }

    constructor(bones: Object3D[], boneInverses: Matrix4[]) {
        this.bones = bones;
        this.boneInverses = boneInverses;

        bones[0].updateMatrixWorld();

        // calculate inverse bone matrices if necessary
        if (bones.length !== boneInverses.length) {
            for (let i = 0; i < bones.length; i++) {
                this.boneInverses[i] = new Matrix4().getInverse(bones[i].matrixWorld);
            }
        }

        /**
         * layout (1 matrix = 4 pixels)
         *      RGBA RGBA RGBA RGBA (=> column1, column2, column3, column4)
         * with 8x8   pixel texture max   16 bones * 4 pixels = (8 * 8)
         *      16x16 pixel texture max   64 bones * 4 pixels = (16 * 16)
         *      32x32 pixel texture max  256 bones * 4 pixels = (32 * 32)
         *      64x64 pixel texture max 1024 bones * 4 pixels = (64 * 64)
         */
        const size = Math.max(_Math.ceilPowerOfTwo(Math.sqrt(bones.length * 4)), 4);
        this.boneMatrices = new Float32Array(size * size * 4);

        for (let i = 0; i < bones.length; i++) {
            const matrix = bones[i].matrixWorld;
            tempMat.multiplyMatrices(matrix, boneInverses[i]);
            tempMat.toArray(this.boneMatrices as any as number[], i * 16);
        }

        this.boneTexture = Texture2D.createByMainLayerSource(
            this.boneMatrices, WebGLPixelFormat.RGBA, TextureDataType.FloatType, size, size,
        ).configAsDataTexture();

        for (let i = 0; i < bones.length; i++) {
            const bone = bones[i];
            bone.on(Object3DChangeEvent, this.onBoneUpdate);
        }
    }

    private onBoneUpdate = () => {
        this.needUpdate = true;
    };

    /**
     * Update animation and sync bone matrix texture
     */
    update(isWASM: boolean = false) {
        const { bones, boneInverses, boneMatrices } = this;
        bones[0].updateMatrixWorld();

        const needUpdate = this.needUpdate;
        if (needUpdate) {
            this.needUpdate = false;
            for (let i = 0; i < bones.length; i++) {
                const matrix = bones[i].matrixWorld;
                tempMat.multiplyMatrices(matrix, boneInverses[i]);
                tempMat.toArray(boneMatrices as any as number[], i * 16);
            }
            if (isWASM && EGS_VERSION_1_2_X) {
                this.boneTexture.source.modifyMain(main => {
                    main.source = new Float32Array(this.boneMatrices.buffer);
                });
            } else {
                this.boneTexture.freeGPU();
            }
        }
        return needUpdate;
    }
}

/**
 * A special interface used for bound {@link SkinnedMesh}
 */
export interface ISkinnedMesh extends SkinnedMesh {
    skeleton?: Skeleton;
}
