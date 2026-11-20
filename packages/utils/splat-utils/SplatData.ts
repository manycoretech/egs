import {
    type Splat,
    Vector3,
    Quaternion,
    Matrix3,
    Matrix4,
    SplatState,
    TextureFormat,
    TextureDimension,
    SourceTexture,
    TextureViewDimension,
    __INTERNAL__,
} from '@qunhe/egs';
import {
    SplatFileType,
    PlyFile,
    SpzFile,
    SplatFile,
    type SplatData,
    RawSplatData,
    CompressedSplatData,
    SuperCompressedSplatData,
    SogSplatData,
    type ISampler,
    type SplatStreamChunk,
    ISamplerFormat,
    SH_MAPS,
    type IFile,
} from '@qunhe/egs-splat-loader';
import { createSHRotateFn } from './utils.js';

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
    const { counts, stateTex } = splat;
    const stateBuffer = stateTex ? (stateTex.getLevelLayerSource(0) as Uint8Array) : undefined;

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
    return { transform, deletedIndices, indicesTransforms: [] };
}

export function createSourceTextureFromSampler(sampler: ISampler, setData = true): SourceTexture {
    let format: TextureFormat;
    switch (sampler.format) {
        case ISamplerFormat.RG_UINT: {
            format = TextureFormat.Rg32Uint;
            break;
        }
        case ISamplerFormat.RGBA_UINT: {
            format = TextureFormat.Rgba32Uint;
            break;
        }
    }
    const texture = new SourceTexture(
        TextureDimension.D2,
        TextureViewDimension.D2,
        format,
        sampler.width,
        sampler.height,
        1,
        false,
        false,
    ).configAsDataTexture();
    if (setData) {
        const { source } = sampler;
        texture.setLevelData(new Uint32Array(source.buffer, source.byteOffset, source.byteLength / 4), 0);
    }
    return texture;
}

export async function createSplat(data: SplatData, renderer?: __INTERNAL__.IRenderer): Promise<Splat> {
    if (!renderer) {
        await data.collect();
    }

    const { counts, shDegree, samplers, extras = [] } = data.serialize();
    let splat: Splat;
    let images: ImageBitmap[] | undefined;
    if (data instanceof CompressedSplatData) {
        const textures = samplers.map(sampler => createSourceTextureFromSampler(sampler, !data.stream));
        splat = new __INTERNAL__.CompressedSplat(
            counts,
            shDegree,
            textures[0],
            textures[1],
            shDegree >= 1 ? textures[2] : undefined,
            shDegree >= 2 ? textures[3] : undefined,
            shDegree >= 3 ? textures[4] : undefined,
            shDegree >= 3 ? textures[5] : undefined,
        );
    } else if (data instanceof SuperCompressedSplatData) {
        const textures = samplers.map(sampler => createSourceTextureFromSampler(sampler, !data.stream));
        splat = new __INTERNAL__.SuperCompressedSplat(
            counts,
            shDegree,
            textures[0],
            shDegree >= 1 ? textures[1] : undefined,
            shDegree >= 3 ? textures[2] : undefined,
        );
    } else if (data instanceof SogSplatData) {
        const [meansL, meansU, scales, quats, sh0] = samplers;
        images = await Promise.all(
            [meansL, meansU, quats, scales, sh0].map(sampler =>
                createImageBitmap(new Blob([sampler.source as Uint8Array<ArrayBuffer>], { type: 'image/webp' }), {
                    premultiplyAlpha: 'none',
                    colorSpaceConversion: 'none',
                }),
            ),
        );
        const textures = images.map(image => {
            const texture = new SourceTexture(
                TextureDimension.D2,
                TextureViewDimension.D2,
                TextureFormat.Rgba8Unorm,
                image.width,
                image.height,
                1,
                false,
                false,
            ).configAsDataTexture();
            if (!data.stream) {
                texture.setLevelLayerData(image, 0, 0);
            }
            return texture;
        });
        splat = new __INTERNAL__.SogSplat(extras[0], textures[0], textures[1], textures[2], textures[3], textures[4]);
    } else {
        throw new Error('Unsupported splat data type.');
    }

    if (!!data.stream) {
        const { stream } = data;
        if (stream.chunks) {
            const target = new WritableStream<SplatStreamChunk>({
                write: ({ index, source, offset }) => {
                    const texture = splat.extrasTex[index];
                    const bytesPerRow = texture.width * __INTERNAL__.textureCopyInfo(texture.format).blockCopySize;
                    const y = offset / bytesPerRow;
                    const height = source.byteLength / bytesPerRow;
                    uploadTexture(renderer!, texture, source, y, height);
                },
            });
            await stream.chunks.pipeTo(target).catch(error => {
                splat.destroy();
                throw error;
            });
        } else {
            for (const [index, texture] of splat.extrasTex.entries()) {
                const source = images?.[index] ?? samplers[index].source;
                uploadTexture(renderer!, texture, source, 0, texture.height);
                images?.[index].close();
            }
        }
        splat.autoFreeResourceOnGpuPacked = false;
        data.stream = undefined;
        data.release();
    }

    return splat;
}

function uploadTexture(
    renderer: __INTERNAL__.IRenderer,
    texture: SourceTexture,
    source: Uint8Array | ImageBitmap,
    y: number,
    height: number,
) {
    const device = renderer.gpuDevice!;
    const handle = renderer.getGPUTextureHandle(texture);
    if ('queue' in device) {
        const destination = { texture: handle as GPUTexture, origin: [0, y] };
        const size = { width: texture.width, height };
        if (source instanceof ImageBitmap) {
            device.queue.copyExternalImageToTexture({ source }, destination, size);
        } else {
            device.queue.writeTexture(
                destination,
                source as Uint8Array<ArrayBuffer>,
                { bytesPerRow: source.byteLength / height },
                size,
            );
        }
        return;
    }
    const gl = device;
    const previous = gl.getParameter(gl.TEXTURE_BINDING_2D);
    gl.bindTexture(gl.TEXTURE_2D, handle as WebGLTexture);
    texture.storageDescriptor.sync_webgl(gl, false);
    if (source instanceof ImageBitmap) {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, y, gl.RGBA, gl.UNSIGNED_BYTE, source);
    } else {
        gl.texSubImage2D(
            gl.TEXTURE_2D,
            0,
            0,
            y,
            texture.width,
            height,
            texture.glFormat.external(renderer.backend),
            gl.UNSIGNED_INT,
            new Uint32Array(source.buffer, source.byteOffset, source.byteLength / 4),
        );
    }
    gl.bindTexture(gl.TEXTURE_2D, previous);
    gl.flush();
}

export function createSamplerFromSourceTexture(texture: SourceTexture): ISampler {
    const data = texture.getLevelLayerSource(0) as Uint32Array;
    let format: ISamplerFormat;
    switch (texture.format) {
        case TextureFormat.Rg32Uint: {
            format = ISamplerFormat.RG_UINT;
            break;
        }
        case TextureFormat.Rgba32Uint: {
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
        source: new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
    };
}

export function createSplatData(splat: Splat): SplatData {
    let splatData: SplatData | undefined;
    const samplers: ISampler[] = [];
    if (splat instanceof __INTERNAL__.CompressedSplat) {
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
    } else if (splat instanceof __INTERNAL__.SuperCompressedSplat) {
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
    const transforms = [new Matrix4(), ...indicesTransforms.map(v => v.transform.clone())];
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
            shRotateFn: createSHRotateFn(
                new Matrix3().setFromMatrix4(new Matrix4().compose(new Vector3(0, 0, 0), quat, new Vector3(1, 1, 1))),
            ),
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
        x: 0,
        y: 0,
        z: 0,
        sx: 0,
        sy: 0,
        sz: 0,
        qx: 0,
        qy: 0,
        qz: 0,
        qw: 0,
        r: 0,
        g: 0,
        b: 0,
        a: 0,
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

export function combineSplatData(source: SplatData[], target: SplatData = new RawSplatData()): SplatData {
    target.init(
        source.reduce<number>((p, c) => p + c.counts, 0),
        Math.max(...source.map(v => v.shDegree)),
    );
    const single: ISingleSplat = {
        x: 0,
        y: 0,
        z: 0,
        sx: 0,
        sy: 0,
        sz: 0,
        qx: 0,
        qy: 0,
        qz: 0,
        qw: 0,
        r: 0,
        g: 0,
        b: 0,
        a: 0,
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
