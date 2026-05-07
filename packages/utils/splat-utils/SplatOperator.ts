import { Splat, SplatState, Vector3, WGLCapabilities, Quaternion, Matrix4, __INNER__ } from '@qunhe/egs';
import { SplatData, ISingleSplat } from '@qunhe/egs-splat-loader';

interface IVector3 {
    set(x: number, y: number, z: number): void;
}

const tempVec = new Vector3();
const tempQuat = new Quaternion();
const tempMat = new Matrix4();
export class SplatOperator {
    splat: Splat;
    /**
     * @internal
     */
    data: SplatData;
    private counts: number;
    private centers: Float32Array;

    constructor(splat: Splat, data: SplatData) {
        this.splat = splat;
        this.data = data;
        this.counts = splat.counts;
        this.centers = new Float32Array(this.counts * 3);
        this.data.fillCenters(this.centers);
    }

    getActiveCounts(): number {
        const { counts, splat: { stateTex } } = this;
        if (!stateTex) {
            return counts;
        }
        const stateBuffer = stateTex.getLevelLayerSource(0) as Uint8Array;
        let result = 0;
        for (let i = 0; i < counts; i++) {
            if ((stateBuffer[i] & SplatState.Deleted) !== 0) {
                continue;
            }
            result++;
        }
        return result;
    }

    readSplatCenter<T extends IVector3>(index: number, result: T): T {
        const { centers, splat: { groupTex, groupTransformTex } } = this;
        const groupBuffer = groupTex ? (groupTex.getLevelLayerSource(0) as Uint16Array) : undefined;
        const groupTransformBuffer = groupTransformTex ? (groupTransformTex.getLevelLayerSource(0) as Float32Array) : undefined;

        const i3 = index * 3;
        tempVec.set(centers[i3], centers[i3 + 1], centers[i3 + 2]);
        if (groupBuffer && groupTransformBuffer) {
            const groupIdx = groupBuffer[index];
            if (groupIdx !== 0) {
                const offset = groupIdx * 12;
                tempMat.elements.set(groupTransformBuffer.subarray(offset, offset + 12));
                tempVec.applyMatrix4(tempMat.transpose());
            }
        }
        result.set(tempVec.x, tempVec.y, tempVec.z);
        return result;
    }

    foreachSplatCenter(callback: (i: number, x: number, y: number, z: number) => void) {
        const { counts, centers, splat: { stateTex, groupTex, groupTransformTex } } = this;
        const stateBuffer = stateTex ? (stateTex.getLevelLayerSource(0) as Uint8Array) : undefined;
        const groupBuffer = groupTex ? (groupTex.getLevelLayerSource(0) as Uint16Array) : undefined;
        const groupTransformBuffer = groupTransformTex ? (groupTransformTex.getLevelLayerSource(0) as Float32Array) : undefined;
        const transforms: Matrix4[] = [];

        for (let i = 0; i < counts; i++) {
            if (stateBuffer && (stateBuffer[i] & SplatState.Deleted) !== 0) {
                continue;
            }
            tempVec.set(centers[i * 3], centers[i * 3 + 1], centers[i * 3 + 2]);
            if (groupBuffer && groupTransformBuffer) {
                const groupIdx = groupBuffer[i];
                if (groupIdx !== 0) {
                    let mat = transforms[groupIdx];
                    if (!mat) {
                        mat = transforms[groupIdx] = new Matrix4();
                        const offset = groupIdx * 12;
                        tempMat.elements.set(groupTransformBuffer.subarray(offset, offset + 12));
                        mat.transpose();
                    }
                    tempVec.applyMatrix4(mat);
                }
            }
            callback(i, tempVec.x, tempVec.y, tempVec.z);
        }
    }

    readSplat(index: number): ISingleSplat {
        const { splat: { groupTex, groupTransformTex }, data } = this;
        const groupBuffer = groupTex ? (groupTex.getLevelLayerSource(0) as Uint16Array) : undefined;
        const groupTransformBuffer = groupTransformTex ? (groupTransformTex.getLevelLayerSource(0) as Float32Array) : undefined;

        const single: ISingleSplat = {
            x: 0, y: 0, z: 0,
            sx: 0, sy: 0, sz: 0,
            qx: 0, qy: 0, qz: 0, qw: 0,
            r: 0, g: 0, b: 0, a: 0,
        };
        data.get(index, single);
        if (groupBuffer && groupTransformBuffer) {
            const groupIdx = groupBuffer[index];
            if (groupIdx !== 0) {
                const offset = groupIdx * 12;
                tempMat.elements.set(groupTransformBuffer.subarray(offset, offset + 12));
                tempMat.transpose();
                const scale = new Vector3();
                const quat = new Quaternion();
                tempMat.decompose(tempVec, quat, scale);
                tempVec.set(single.x, single.y, single.z).applyMatrix4(tempMat);
                single.x = tempVec.x;
                single.y = tempVec.y;
                single.z = tempVec.z;
                tempVec.set(single.sx, single.sy, single.sz).multiply(scale);
                single.sx = tempVec.x;
                single.sy = tempVec.y;
                single.sz = tempVec.z;
                tempQuat.set(single.qx, single.qy, single.qz, single.qw).premultiply(quat);
                single.qx = tempQuat.x;
                single.qy = tempQuat.y;
                single.qz = tempQuat.z;
                single.qw = tempQuat.w;
            }
        }

        return single;
    }

    foreachSplat(callback: (i: number, single: ISingleSplat) => void) {
        const { counts, splat: { stateTex, groupTex, groupTransformTex }, data } = this;
        const stateBuffer = stateTex ? (stateTex.getLevelLayerSource(0) as Uint8Array) : undefined;
        const groupBuffer = groupTex ? (groupTex.getLevelLayerSource(0) as Uint16Array) : undefined;
        const groupTransformBuffer = groupTransformTex ? (groupTransformTex.getLevelLayerSource(0) as Float32Array) : undefined;

        const transforms: Array<{
            mat: Matrix4;
            scale: Vector3;
            quat: Quaternion;
        }> = [];
        const single: ISingleSplat = {
            x: 0, y: 0, z: 0,
            sx: 0, sy: 0, sz: 0,
            qx: 0, qy: 0, qz: 0, qw: 0,
            r: 0, g: 0, b: 0, a: 0,
        };
        for (let i = 0; i < counts; i++) {
            if (stateBuffer && (stateBuffer[i] & SplatState.Deleted) !== 0) {
                continue;
            }
            data.get(i, single);
            if (groupBuffer && groupTransformBuffer) {
                const groupIdx = groupBuffer[i];
                if (groupIdx !== 0) {
                    let transform = transforms[groupIdx];
                    if (!transform) {
                        transform = transforms[groupIdx] = {
                            mat: new Matrix4(),
                            scale: new Vector3(),
                            quat: new Quaternion(),
                        };
                        const offset = groupIdx * 12;
                        transform.mat.elements.set(groupTransformBuffer.subarray(offset, offset + 12));
                        transform.mat.transpose();
                        transform.mat.decompose(tempVec, transform.quat, transform.scale);
                    }
                    tempVec.set(single.x, single.y, single.z).applyMatrix4(transform.mat);
                    single.x = tempVec.x;
                    single.y = tempVec.y;
                    single.z = tempVec.z;
                    tempVec.set(single.sx, single.sy, single.sz).multiply(transform.scale);
                    single.sx = tempVec.x;
                    single.sy = tempVec.y;
                    single.sz = tempVec.z;
                    tempQuat.set(single.qx, single.qy, single.qz, single.qw).premultiply(transform.quat);
                    single.qx = tempQuat.x;
                    single.qy = tempQuat.y;
                    single.qz = tempQuat.z;
                    single.qw = tempQuat.w;
                }
            }
            callback(i, single);
        }
    }

    private initState() {
        const { splat } = this;
        if (splat.stateTex) {
            return;
        }
        const MAX_TEXTURE_SIZE = WGLCapabilities.MAX_TEXTURE_SIZE;
        const pixels = splat.counts;
        const width = Math.min(Math.ceil(Math.sqrt(pixels) / 2) * 2, MAX_TEXTURE_SIZE);
        const height = Math.ceil(pixels / width);
        splat.stateTex = new __INNER__.SourceTexture(
            __INNER__.TextureDimension.D2, __INNER__.TextureViewDimension.D2, __INNER__.TextureFormat.R32Uint,
            width, height, 1, false, false)
            .configAsDataTexture()
            .setLevelData(new Uint8Array(width * height), 0);
    }

    setState(indices: number[], state: SplatState, invert: boolean = false) {
        if (!indices.length) {
            return;
        }
        this.initState();
        const { splat } = this;
        const stateBuffer = splat.stateTex!.getLevelLayerSource(0) as Uint8Array;
        for (let i = 0; i < indices.length; i++) {
            const idx = indices[i];
            const v = stateBuffer[idx];
            stateBuffer[idx] = invert ? (v & ~state) : (v | state);
        }
        splat.stateTex!.setLevelData(new Uint8Array(stateBuffer.buffer, stateBuffer.byteOffset, stateBuffer.length), 0);
        splat.notifySceneChange();
    }

    clearState() {
        const { splat } = this;
        if (!splat.stateTex) {
            return;
        }
        splat.stateTex.freeGPU();
        splat.stateTex = undefined;
        splat.notifySceneChange();
    }
}
