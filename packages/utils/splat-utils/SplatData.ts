import { deferred } from '@qunhe/egs-lib';
import { Splat, Vector3, Quaternion, Matrix3, Matrix4, SplatState, __INNER__ } from '@qunhe/egs';
import { SplatFileType, PlyFile, SpzFile, SplatFile, SplatData, RawSplatData, CompressedSplatData, SuperCompressedSplatData, SogSplatData, ISampler, ISamplerFormat, SH_MAPS, IFile } from '@qunhe/egs-splat-loader';
import { createSHRotateFn } from './utils';

type ISingleSplat = Parameters<SplatData['get']>[1];

export interface ISplatModifyData {
    transform: Matrix4;
    deletedIndices: number[];
    indicesTransforms: Array<{
        indices: number[];
        transform: Matrix4;
    }>;
}

export function createSplatModifyData(splat: Splat): ISplatModifyData {
    const { counts, stateTex, groupTex, groupTransformTex } = splat;
    const stateBuffer = stateTex ? (stateTex.getLevelLayerSource(0) as Uint8Array) : undefined;
    const groupBuffer = groupTex ? (groupTex.getLevelLayerSource(0) as Uint16Array) : undefined;
    const groupTransformBuffer = groupTransformTex ? (groupTransformTex.getLevelLayerSource(0) as Float32Array) : undefined;

    const transform = splat.matrixWorld.clone();
    const deletedIndices: number[] = [];
    if (stateBuffer) {
        for (let i = 0; i < counts; i++) {
            if ((stateBuffer[i] & SplatState.Deleted) !== 0) {
                continue;
            }
            deletedIndices.push(i);
        }
    }
    const indicesTransforms: ISplatModifyData['indicesTransforms'] = [];
    if (groupBuffer && groupTransformBuffer) {
        for (let i = 0; i < counts; i++) {
            const groupIdx = groupBuffer[i];
            if (groupIdx === 0) {
                continue;
            }
            let indicesTransform = indicesTransforms[groupIdx];
            if (!indicesTransform) {
                const mat = new Matrix4();
                mat.elements.set(groupTransformBuffer.subarray(groupIdx * 12, (groupIdx + 1) * 12));
                mat.transpose();
                indicesTransform = indicesTransforms[groupIdx] = {
                    indices: [],
                    transform: mat,
                };
            }
            indicesTransform.indices.push(i);
        }
    }

    return { transform, deletedIndices, indicesTransforms };
}

export function createSourceTextureFromSampler(sampler: ISampler): __INNER__.SourceTexture {
    let format: __INNER__.TextureFormat;
    switch (sampler.format) {
        case ISamplerFormat.RG_UINT: {
            format = __INNER__.TextureFormat.Rg32Uint;
            break;
        }
        case ISamplerFormat.RGBA_UINT: {
            format = __INNER__.TextureFormat.Rgba32Uint;
            break;
        }
    }
    return new __INNER__.SourceTexture(
        __INNER__.TextureDimension.D2, __INNER__.TextureViewDimension.D2, format,
        sampler.width, sampler.height, 1, false, false)
        .configAsDataTexture()
        .setLevelData(new Uint32Array(sampler.source.buffer), 0);
}

export function createSourceTextureFromImageSource(buffer: Uint8Array, type: string = 'image/webp') {
    const { promise, resolve } = deferred<__INNER__.SourceTexture>();
    const blob = new Blob([buffer], { type });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.src = url;
    img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(new __INNER__.SourceTexture(
            __INNER__.TextureDimension.D2, __INNER__.TextureViewDimension.D2, __INNER__.TextureFormat.Rgba8Unorm,
            img.width, img.height, 1, false, false)
            .configAsDataTexture()
            .setLevelLayerData(img, 0, 0)
        );
    };

    return promise;
}

export async function createSplat(data: SplatData): Promise<Splat> {
    let splat: Splat;
    if (data instanceof RawSplatData) {
        throw new Error('RawSplatData is not supported create splat.');
    } else if (data instanceof CompressedSplatData) {
        const { counts, shDegree, samplers } = data.serialize();
        const textures = samplers.map(sampler => createSourceTextureFromSampler(sampler));
        splat = new __INNER__.CompressedSplat(
            counts,
            shDegree,
            textures[0], textures[1],
            shDegree >= 1 ? textures[2] : undefined,
            shDegree >= 2 ? textures[3] : undefined,
            shDegree >= 3 ? textures[4] : undefined,
            shDegree >= 3 ? textures[5] : undefined,
        );
    } else if (data instanceof SuperCompressedSplatData) {
        const { counts, shDegree, samplers } = data.serialize();
        const textures = samplers.map(sampler => createSourceTextureFromSampler(sampler));
        splat = new __INNER__.SuperCompressedSplat(
            counts,
            shDegree,
            textures[0],
            shDegree >= 1 ? textures[1] : undefined,
            shDegree >= 3 ? textures[2] : undefined,
        );
    } else if (data instanceof SogSplatData) {
        const { samplers, extras = [] } = data.serialize();
        const [
            meansL, meansU, scales, quats,
            sh0, shNLabels, shNCentroids,
        ] = await Promise.all(samplers.map(v => createSourceTextureFromImageSource(v.source)));
        splat = new __INNER__.SogSplat(
            extras[0],
            meansL, meansU, quats, scales,
            sh0, shNLabels, shNCentroids,
        );
    } else {
        throw new Error('Unsupported splat data type.');
    }

    return splat;
}

export function createSamplerFromSourceTexture(texture: __INNER__.SourceTexture): ISampler {
    let format: ISamplerFormat;
    switch (texture.format) {
        case __INNER__.TextureFormat.Rg32Uint: {
            format = ISamplerFormat.RG_UINT;
            break;
        }
        case __INNER__.TextureFormat.Rgba32Uint: {
            format = ISamplerFormat.RGBA_UINT;
            break;
        }
        default: {
            throw new Error('Unsupported texture format for sampler creation');
        }
    }
    return {
        width: texture.width,
        height: texture.height,
        depth: 1,
        format,
        source: new Uint8Array((texture.getLevelLayerSource(0) as Uint32Array).buffer),
    };
}

export function createSplatData(splat: Splat): SplatData {
    let splatData: SplatData | undefined;
    const samplers: ISampler[] = [];
    if (splat instanceof __INNER__.CompressedSplat) {
        splatData = new CompressedSplatData();
        samplers.push(createSamplerFromSourceTexture(splat.splat1Tex));
        samplers.push(createSamplerFromSourceTexture(splat.splat2Tex));
        if (splat.sh1Tex) {
            samplers.push(createSamplerFromSourceTexture(splat.sh1Tex));
        }
        if (splat.sh2Tex) {
            samplers.push(createSamplerFromSourceTexture(splat.sh2Tex));
        }
        if (splat.sh3Tex) {
            samplers.push(createSamplerFromSourceTexture(splat.sh3Tex));
        }
        if (splat.sh4Tex) {
            samplers.push(createSamplerFromSourceTexture(splat.sh4Tex));
        }
    } else if (splat instanceof __INNER__.SuperCompressedSplat) {
        splatData = new SuperCompressedSplatData();
        samplers.push(createSamplerFromSourceTexture(splat.splatTex));
        if (splat.sh1Tex) {
            samplers.push(createSamplerFromSourceTexture(splat.sh1Tex));
        }
        if (splat.sh2Tex) {
            samplers.push(createSamplerFromSourceTexture(splat.sh2Tex));
        }
    }
    if (!splatData) {
        throw new Error('Unsupported splat type.');
    }

    splatData.deserialize({
        counts: splat.counts,
        shDegree: splat.shDegree,
        samplers,
    });

    return splatData;
}

const MATRIX_ONE = new Matrix4();
const QUAT_ONE = new Quaternion();
export function modifySplatData(source: SplatData, modifyData: ISplatModifyData) {
    const { transform: modelMatrix, deletedIndices, indicesTransforms } = modifyData;

    const shCounts = ({ 0: 0, 1: 9, 2: 24, 3: 45 } as Record<number, number>)[source.shDegree];
    const target = new RawSplatData();
    target.init(source.counts - deletedIndices.length, source.shDegree);

    const groupIndices = new Uint32Array(source.counts);
    const groupTransforms: Array<{
        isTransform: boolean;
        isRotate: boolean;
        matrix: Matrix4;
        scale: Vector3;
        quat: Quaternion;
        shRotateFn: (shN: number[]) => void;
    }> = [];
    const transforms = [
        new Matrix4(),
        ...indicesTransforms.map(v => v.transform.clone()),
    ];
    for (let i = 0; i < transforms.length; i++) {
        const matrix = transforms[i].multiply(modelMatrix);
        const scale = new Vector3(1, 1, 1);
        const quat = new Quaternion(0, 0, 0, 1);
        matrix.decompose(new Vector3(1, 1, 1), quat, scale);
        const isTransform = !matrix.equals(MATRIX_ONE);
        const isRotate = !quat.equals(QUAT_ONE);
        groupTransforms.push({
            isTransform,
            isRotate,
            matrix,
            scale,
            quat,
            shRotateFn: createSHRotateFn(new Matrix3().setFromMatrix4(new Matrix4().compose(new Vector3(0, 0, 0), quat, new Vector3(1, 1, 1)))),
        });
    }
    for (let i = 0; i < indicesTransforms.length; i++) {
        const indices = indicesTransforms[i].indices;
        const groupIdx = i + 1;
        for (let j = 0; j < indices.length; j++) {
            groupIndices[indices[j]] = groupIdx;
        }
    }

    const tempVec = new Vector3(0, 0, 0);
    const tempQuat = new Quaternion(0, 0, 0, 1);
    const single: ISingleSplat = {
        x: 0, y: 0, z: 0,
        sx: 0, sy: 0, sz: 0,
        qx: 0, qy: 0, qz: 0, qw: 0,
        r: 0, g: 0, b: 0, a: 0,
    };
    const shN = new Array(shCounts);
    const shCoeffs: number[] = new Array(shCounts / 3).fill(0);
    let index = 0;
    for (let i = 0; i < source.counts; i++) {
        if (deletedIndices.includes(i)) {
            continue;
        }
        source.get(i, single);
        const groupIdx = groupIndices[i];
        const { isTransform, isRotate, matrix, scale, quat, shRotateFn } = groupTransforms[groupIdx];
        if (isTransform) {
            tempVec.set(single.x, single.y, single.z).applyMatrix4(matrix);
            single.x = tempVec.x;
            single.y = tempVec.y;
            single.z = tempVec.z;
            tempVec.set(single.sx, single.sy, single.sz).multiply(scale);
            single.sx = tempVec.x;
            single.sy = tempVec.y;
            single.sz = tempVec.z;
            if (isRotate) {
                tempQuat.set(single.qx, single.qy, single.qz, single.qw).premultiply(quat);
                single.qx = tempQuat.x;
                single.qy = tempQuat.y;
                single.qz = tempQuat.z;
                single.qw = tempQuat.w;
                for (let m = 0; m < 3; m++) {
                    for (let n = 0; n < shCoeffs.length; n++) {
                        shCoeffs[n] = shN[n * 3 + m];
                    }
                    shRotateFn(shCoeffs);
                    for (let n = 0; n < shCoeffs.length; n++) {
                        shN[n * 3 + m] = shCoeffs[n];
                    }
                }
            }
        }
        target.set(index, single);
        target.setShN(index, shN);
        index++;
    }
}

export function combineSplatData(source: SplatData[]): SplatData {
    const target = new RawSplatData();
    target.init(
        source.reduce<number>((p, c) => p + c.counts, 0),
        Math.max(...source.map(v => v.shDegree)),
    );
    const single: ISingleSplat = {
        x: 0, y: 0, z: 0,
        sx: 0, sy: 0, sz: 0,
        qx: 0, qy: 0, qz: 0, qw: 0,
        r: 0, g: 0, b: 0, a: 0,
    };
    const shN = new Array(SH_MAPS[target.shDegree]);

    let index = 0;
    for (let i = 0; i < source.length; i++) {
        const splat = source[i];
        const { counts } = splat;
        for (let j = 0; j < counts; j++) {
            splat.get(j, single);
            splat.getShN(j, shN);
            target.set(index, single);
            target.setShN(index, shN);
            index++;
        }
    }

    return target;
}

export function transformSplatFile(source: SplatData, outType: SplatFileType) {
    let file: IFile;
    if (outType === SplatFileType.PLY) {
        file = new PlyFile();
    } else if (outType === SplatFileType.SPZ) {
        file = new SpzFile();
    } else if (outType === SplatFileType.SPLAT) {
        file = new SplatFile();
    } else {
        throw new Error(`Unsupported splat file type: ${SplatFileType[outType]}`);
    }
    const stream = new TransformStream<Uint8Array, Uint8Array>();
    file.write(stream.writable, source);
    return stream.readable;
}
