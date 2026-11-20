import { type IFile, type IData } from '../types.js';
import { SH_C0, SH_MAPS, NUM_F_REST_TO_SH_DEGREE } from '../utils/splat.js';
import { isUrl } from '../utils/file.js';
import { decodeImage } from '../utils/texture.js';
import { type FileContext, getFileEntry } from '../utils/zip.js';

export interface SogMetadataV1 {
    version: undefined;
    means: {
        shape: number[];
        dtype: string;
        mins: number[];
        maxs: number[];
        files: string[];
    };
    scales: {
        shape: number[];
        dtype: string;
        mins: number[];
        maxs: number[];
        files: string[];
    };
    quats: { shape: number[]; dtype: string; encoding?: string; files: string[] };
    sh0: {
        shape: number[];
        dtype: string;
        mins: number[];
        maxs: number[];
        files: string[];
    };
    shN?: {
        shape: number[];
        dtype: string;
        mins: number;
        maxs: number;
        quantization: number;
        files: string[];
    };
}

export interface SogMetadataV2 {
    version: number;
    count: number;
    means: {
        mins: number[];
        maxs: number[];
        files: string[];
    };
    scales: {
        codebook: number[];
        files: string[];
    };
    quats: { files: string[] };
    sh0: {
        codebook: number[];
        files: string[];
    };
    shN?: {
        count: number;
        bands: number;
        codebook: number[];
        files: string[];
    };
}

export type SogMetadata = SogMetadataV1 | SogMetadataV2;

const PERM_TABLE = [
    // original quat idx ---> actual storage idx
    [0, 1, 2, 3],
    [3, 1, 2, 0],
    [1, 3, 2, 0],
    [1, 2, 3, 0],
];
const TEMP_ROT = new Float32Array(4);

function createMeanLUT(min: number, max: number) {
    const range = (max - min) / 65535;
    const lut = new Float64Array(65536);
    for (let i = 0; i < lut.length; i++) {
        const v = min + range * i;
        lut[i] = Math.sign(v) * (Math.exp(Math.abs(v)) - 1);
    }
    return lut;
}

export class SogFile implements IFile {
    counts: number = 0;
    shDegree: number = 0;
    version: number;
    meta: SogMetadata;
    texturePaths: string[];

    async load(stream: ReadableStream<Uint8Array>) {
        this.meta = await new Response(stream).json();
        if (this.meta.version === undefined) {
            const { means, quats, shN } = this.meta as SogMetadataV1;
            if (quats.encoding !== 'quaternion_packed') {
                throw new Error('Unsupported quaternion encoding');
            }
            this.counts = means.shape[0];
            this.shDegree = shN ? NUM_F_REST_TO_SH_DEGREE[shN.shape[1]] : 0;
            this.version = 1;
        } else {
            const { version, count, shN } = this.meta as SogMetadataV2;
            if (version !== 2) {
                throw new Error(`Unsupported SOGS version: ${version}`);
            }
            this.counts = count;
            this.shDegree = shN?.bands ?? 0;
            this.version = version;
        }
        const { means, scales, quats, sh0, shN } = this.meta;
        this.texturePaths = [
            means.files[0],
            means.files[1],
            scales.files[0],
            quats.files[0],
            sh0.files[0],
            shN?.files[0],
            shN?.files[1],
        ].filter((path): path is string => !!path);
    }

    private async parse_v1(data: IData, blockOffset: number, attributes: Uint8Array[]) {
        const { meta, counts } = this;
        const [mean0, mean1, scale0, quat0, color0] = attributes;
        const {
            means: {
                mins: [centerMinX, centerMinY, centerMinZ],
                maxs: [centerMaxX, centerMaxY, centerMaxZ],
            },
            scales: {
                mins: [scaleMinX, scaleMinY, scaleMinZ],
                maxs: [scaleMaxX, scaleMaxY, scaleMaxZ],
            },
            sh0: {
                mins: [colorMinR, colorMinG, colorMinB, colorMinA],
                maxs: [colorMaxR, colorMaxG, colorMaxB, colorMaxA],
            },
        } = meta as SogMetadataV1;

        const X_LUT = createMeanLUT(centerMinX, centerMaxX);
        const Y_LUT = createMeanLUT(centerMinY, centerMaxY);
        const Z_LUT = createMeanLUT(centerMinZ, centerMaxZ);

        const SX_LOG_LUT = new Float64Array(256);
        const SY_LOG_LUT = new Float64Array(256);
        const SZ_LOG_LUT = new Float64Array(256);
        const scaleRangeX = (scaleMaxX - scaleMinX) / 255;
        const scaleRangeY = (scaleMaxY - scaleMinY) / 255;
        const scaleRangeZ = (scaleMaxZ - scaleMinZ) / 255;
        for (let i = 0; i < 256; i++) {
            SX_LOG_LUT[i] = Math.log(Math.fround(Math.exp(scaleMinX + scaleRangeX * i)));
            SY_LOG_LUT[i] = Math.log(Math.fround(Math.exp(scaleMinY + scaleRangeY * i)));
            SZ_LOG_LUT[i] = Math.log(Math.fround(Math.exp(scaleMinZ + scaleRangeZ * i)));
        }

        const A_LUT = new Float32Array(256);
        const colorRangeR = (colorMaxR - colorMinR) / 255;
        const colorRangeG = (colorMaxG - colorMinG) / 255;
        const colorRangeB = (colorMaxB - colorMinB) / 255;
        const colorRangeA = (colorMaxA - colorMinA) / 255;
        for (let i = 0; i < 256; i++) {
            A_LUT[i] = 1.0 / (1.0 + Math.exp(-(colorMinA + colorRangeA * i)));
        }

        for (let written = 0; written < counts;) {
            const offset = blockOffset + written;
            const size = data.initChunk(offset, counts - written, 'splat');
            for (let i = 0; i < size; i++) {
                const i4 = (written + i) * 4;
                data.setCenter(
                    offset + i,
                    X_LUT[mean0[i4 + 0] + (mean1[i4 + 0] << 8)],
                    Y_LUT[mean0[i4 + 1] + (mean1[i4 + 1] << 8)],
                    Z_LUT[mean0[i4 + 2] + (mean1[i4 + 2] << 8)],
                );
                data.setLogScale(
                    offset + i,
                    SX_LOG_LUT[scale0[i4 + 0]],
                    SY_LOG_LUT[scale0[i4 + 1]],
                    SZ_LOG_LUT[scale0[i4 + 2]],
                );
                TEMP_ROT[0] = (quat0[i4 + 0] / 255 - 0.5) * Math.SQRT2;
                TEMP_ROT[1] = (quat0[i4 + 1] / 255 - 0.5) * Math.SQRT2;
                TEMP_ROT[2] = (quat0[i4 + 2] / 255 - 0.5) * Math.SQRT2;
                TEMP_ROT[3] = Math.sqrt(
                    Math.max(
                        0,
                        1.0 - TEMP_ROT[0] * TEMP_ROT[0] - TEMP_ROT[1] * TEMP_ROT[1] - TEMP_ROT[2] * TEMP_ROT[2],
                    ),
                );
                const PERM = PERM_TABLE[quat0[i4 + 3] - 252];
                data.setQuat(offset + i, TEMP_ROT[PERM[0]], TEMP_ROT[PERM[1]], TEMP_ROT[PERM[2]], TEMP_ROT[PERM[3]]);
                data.setColor(
                    offset + i,
                    SH_C0 * (colorMinR + colorRangeR * color0[i4 + 0]) + 0.5,
                    SH_C0 * (colorMinG + colorRangeG * color0[i4 + 1]) + 0.5,
                    SH_C0 * (colorMinB + colorRangeB * color0[i4 + 2]) + 0.5,
                );
                data.setAlpha(offset + i, A_LUT[color0[i4 + 3]]);
            }
            await data.commitChunk();
            written += size;
        }
    }

    private async parse_v2(data: IData, blockOffset: number, attributes: Uint8Array[]) {
        const { meta, counts } = this;
        const { means, scales, sh0 } = meta as SogMetadataV2;
        const {
            mins: [centerMinX, centerMinY, centerMinZ],
            maxs: [centerMaxX, centerMaxY, centerMaxZ],
        } = means;
        const { codebook: scaleCodebook } = scales;
        const { codebook: sh0Codebook } = sh0;
        const [mean0, mean1, scale0, quat0, color0] = attributes;

        const X_LUT = createMeanLUT(centerMinX, centerMaxX);
        const Y_LUT = createMeanLUT(centerMinY, centerMaxY);
        const Z_LUT = createMeanLUT(centerMinZ, centerMaxZ);
        const LOG_SCALE_LUT = scaleCodebook.map(v => Math.log(Math.exp(v)));

        for (let written = 0; written < counts;) {
            const offset = blockOffset + written;
            const size = data.initChunk(offset, counts - written, 'splat');
            for (let i = 0; i < size; i++) {
                const i4 = (written + i) * 4;
                data.setCenter(
                    offset + i,
                    X_LUT[mean0[i4 + 0] + (mean1[i4 + 0] << 8)],
                    Y_LUT[mean0[i4 + 1] + (mean1[i4 + 1] << 8)],
                    Z_LUT[mean0[i4 + 2] + (mean1[i4 + 2] << 8)],
                );
                data.setLogScale(
                    offset + i,
                    LOG_SCALE_LUT[scale0[i4 + 0]],
                    LOG_SCALE_LUT[scale0[i4 + 1]],
                    LOG_SCALE_LUT[scale0[i4 + 2]],
                );
                TEMP_ROT[0] = (quat0[i4 + 0] / 255 - 0.5) * Math.SQRT2;
                TEMP_ROT[1] = (quat0[i4 + 1] / 255 - 0.5) * Math.SQRT2;
                TEMP_ROT[2] = (quat0[i4 + 2] / 255 - 0.5) * Math.SQRT2;
                TEMP_ROT[3] = Math.sqrt(
                    Math.max(
                        0,
                        1.0 - TEMP_ROT[0] * TEMP_ROT[0] - TEMP_ROT[1] * TEMP_ROT[1] - TEMP_ROT[2] * TEMP_ROT[2],
                    ),
                );
                const PERM = PERM_TABLE[quat0[i4 + 3] - 252];
                data.setQuat(offset + i, TEMP_ROT[PERM[0]], TEMP_ROT[PERM[1]], TEMP_ROT[PERM[2]], TEMP_ROT[PERM[3]]);
                data.setColor(
                    offset + i,
                    SH_C0 * sh0Codebook[color0[i4 + 0]] + 0.5,
                    SH_C0 * sh0Codebook[color0[i4 + 1]] + 0.5,
                    SH_C0 * sh0Codebook[color0[i4 + 2]] + 0.5,
                );
                data.setAlpha(offset + i, color0[i4 + 3] / 255);
            }
            await data.commitChunk();
            written += size;
        }
    }

    private async parseSh(data: IData, blockOffset: number, width: number, centroids: Uint8Array, labels: Uint8Array) {
        const { counts, shDegree, version } = this;
        const setSh = data.setShN.bind(data);
        const shCounts = SH_MAPS[shDegree];
        const shCoeffs = shCounts / 3;

        let codebook: number[];
        let centroidStride: number;
        let rowStride: number;
        if (version === 1) {
            const { mins, maxs } = (this.meta as SogMetadataV1).shN!;
            const range = (maxs - mins) / 255;
            codebook = Array.from({ length: 256 }, (_, i) => mins + range * i);
            centroidStride = 15 * 4;
            rowStride = width * 4;
        } else {
            codebook = (this.meta as SogMetadataV2).shN!.codebook;
            centroidStride = shCoeffs * 4;
            rowStride = 64 * centroidStride;
        }

        const sh = new Array(shCounts);
        for (let written = 0; written < counts;) {
            const offset = blockOffset + written;
            const size = data.initChunk(offset, counts - written, 'sh');
            for (let i = 0; i < size; i++) {
                const i4 = (written + i) * 4;
                const label = labels[i4] + (labels[i4 + 1] << 8);
                const row = label >>> 6;
                const column = label & 63;
                const sourceOffset = row * rowStride + column * centroidStride;
                for (let j = 0; j < shCoeffs; j++) {
                    sh[j * 3] = codebook[centroids[sourceOffset + j * 4]];
                    sh[j * 3 + 1] = codebook[centroids[sourceOffset + j * 4 + 1]];
                    sh[j * 3 + 2] = codebook[centroids[sourceOffset + j * 4 + 2]];
                }
                setSh(offset + i, sh);
            }
            await data.commitChunk();
            written += size;
        }
    }

    private async loadTexture(path: string, context?: FileContext) {
        let buffer: Uint8Array;
        if (isUrl(path)) {
            const response = await fetch(path);
            buffer = new Uint8Array(await response.arrayBuffer());
        } else if (context) {
            buffer = getFileEntry(context, path);
        } else {
            throw new Error(`Cannot load texture: ${path}`);
        }
        return decodeImage(buffer as Uint8Array<ArrayBuffer>);
    }

    async read(stream: ReadableStream<Uint8Array>, _contentLength: number, data: IData, context?: FileContext) {
        await this.load(stream);

        const attributePromises = Promise.all(
            this.texturePaths.slice(0, 5).map(path => this.loadTexture(path, context).then(v => v.data)),
        );
        const shPromises =
            this.shDegree > 0
                ? Promise.all(this.texturePaths.slice(5).map(path => this.loadTexture(path, context)))
                : undefined;
        const BlockOffset = await data.initBlock(this.counts, this.shDegree);

        const attributes = await attributePromises;
        if (this.version === 1) {
            await this.parse_v1(data, BlockOffset, attributes);
        } else if (this.version === 2) {
            await this.parse_v2(data, BlockOffset, attributes);
        } else {
            throw new Error(`Unsupported SOG version: ${this.version}`);
        }
        attributes.length = 0;

        if (shPromises) {
            const [centroids, labels] = await shPromises;
            await this.parseSh(data, BlockOffset, centroids.width, centroids.data, labels.data);
        }
        data.finishBlock();
    }

    async write(_stream: WritableStream<Uint8Array>, _data: IData) {
        throw new Error('Method not implemented.');
    }
}
