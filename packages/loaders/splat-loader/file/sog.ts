import { unzipSync } from 'fflate';
import { IFile, IData, ISingleSplat, SH_C0, SH_MAPS, isUrl, decodeImage, extractFromRootDir, NUM_F_REST_TO_SH_DEGREE } from './utils';

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

const ZIP_MAGIC = 0x04034b50;
const PERM_TABLE = [  // original quat idx ---> actual storage idx
    [0, 1, 2, 3],
    [3, 1, 2, 0],
    [1, 3, 2, 0],
    [1, 2, 3, 0],
];
const TEMP_ROT = new Float32Array(4);

export class SogFile implements IFile {
    private counts: number = 0;
    private shDegree: number = 0;
    /**
     * @internal
     */
    version: number;
    /**
     * @internal
     */
    meta: SogMetadata;
    /**
     * @internal
     */
    refs: Record<string, Uint8Array> = {};

    private cached: Array<{ width: number, height: number, data: Uint8Array }>;

    async load(stream: ReadableStream<Uint8Array>, contentLength: number) {
        const buffer = new Uint8Array(contentLength);
        const reader = stream.getReader();
        let offset = 0;
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            buffer.set(value!, offset);
            offset += value!.length;
        }

        let metaBuffer: Uint8Array = buffer;
        const view = new DataView(buffer.buffer);
        if (view.getUint32(0, true) === ZIP_MAGIC) {
            this.refs = extractFromRootDir(unzipSync(buffer));
            metaBuffer = this.refs['meta.json'];
            if (!metaBuffer) {
                throw new Error('SOG meta.json not found in the zip archive.');
            }
        }

        this.meta = JSON.parse(new TextDecoder().decode(metaBuffer));
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
    }

    private parse_v1(data: IData, offset: number) {
        const setFn = data.set.bind(data) as IData['set'];
        const setShFn = data.setShN.bind(data) as IData['setShN'];

        const { meta, counts, shDegree, cached } = this;
        const [mean0, mean1, scale0, quat0, color0, centroids, labels] = cached.map(v => v.data);
        const {
            means: { mins: [centerMinX, centerMinY, centerMinZ], maxs: [centerMaxX, centerMaxY, centerMaxZ] },
            scales: { mins: [scaleMinX, scaleMinY, scaleMinZ], maxs: [scaleMaxX, scaleMaxY, scaleMaxZ] },
            sh0: { mins: [colorMinR, colorMinG, colorMinB, colorMinA], maxs: [colorMaxR, colorMaxG, colorMaxB, colorMaxA], },
            shN,
        } = meta as SogMetadataV1;

        const rangeX = (centerMaxX - centerMinX) / 65535;
        const rangeY = (centerMaxY - centerMinY) / 65535;
        const rangeZ = (centerMaxZ - centerMinZ) / 65535;

        const SX_LUT = new Float32Array(256);
        const SY_LUT = new Float32Array(256);
        const SZ_LUT = new Float32Array(256);
        const scaleRangeX = (scaleMaxX - scaleMinX) / 255;
        const scaleRangeY = (scaleMaxY - scaleMinY) / 255;
        const scaleRangeZ = (scaleMaxZ - scaleMinZ) / 255;
        for (let i = 0; i < 256; i++) {
            SX_LUT[i] = Math.exp(scaleMinX + scaleRangeX * i);
            SY_LUT[i] = Math.exp(scaleMinY + scaleRangeY * i);
            SZ_LUT[i] = Math.exp(scaleMinZ + scaleRangeZ * i);
        }

        const A_LUT = new Float32Array(256);
        const colorRangeR = (colorMaxR - colorMinR) / 255;
        const colorRangeG = (colorMaxG - colorMinG) / 255;
        const colorRangeB = (colorMaxB - colorMinB) / 255;
        const colorRangeA = (colorMaxA - colorMinA) / 255;
        for (let i = 0; i < 256; i++) {
            A_LUT[i] = 1.0 / (1.0 + Math.exp(-(colorMinA + colorRangeA * i)));
        }

        const single: ISingleSplat = {
            x: 0, y: 0, z: 0,
            sx: 0, sy: 0, sz: 0,
            qx: 0, qy: 0, qz: 0, qw: 0,
            r: 0, g: 0, b: 0, a: 0,
            shN: [],
        };
        for (let i = 0; i < counts; i++) {
            const i4 = i * 4;

            const x = centerMinX + rangeX * (mean0[i4 + 0] + (mean1[i4 + 0] << 8));
            const y = centerMinY + rangeY * (mean0[i4 + 1] + (mean1[i4 + 1] << 8));
            const z = centerMinZ + rangeZ * (mean0[i4 + 2] + (mean1[i4 + 2] << 8));
            single.x = Math.sign(x) * (Math.exp(Math.abs(x)) - 1);
            single.y = Math.sign(y) * (Math.exp(Math.abs(y)) - 1);
            single.z = Math.sign(z) * (Math.exp(Math.abs(z)) - 1);

            single.sx = SX_LUT[scale0[i4 + 0]];
            single.sy = SY_LUT[scale0[i4 + 1]];
            single.sz = SZ_LUT[scale0[i4 + 2]];

            TEMP_ROT[0] = (quat0[i4 + 0] / 255 - 0.5) * Math.SQRT2;
            TEMP_ROT[1] = (quat0[i4 + 1] / 255 - 0.5) * Math.SQRT2;
            TEMP_ROT[2] = (quat0[i4 + 2] / 255 - 0.5) * Math.SQRT2;
            TEMP_ROT[3] = Math.sqrt(Math.max(0, 1.0 - TEMP_ROT[0] * TEMP_ROT[0] - TEMP_ROT[1] * TEMP_ROT[1] - TEMP_ROT[2] * TEMP_ROT[2]));
            const PERM = PERM_TABLE[quat0[i4 + 3] - 252];
            single.qx = TEMP_ROT[PERM[0]];
            single.qy = TEMP_ROT[PERM[1]];
            single.qz = TEMP_ROT[PERM[2]];
            single.qw = TEMP_ROT[PERM[3]];

            single.r = SH_C0 * (colorMinR + colorRangeR * color0[i4 + 0]) + 0.5;
            single.g = SH_C0 * (colorMinG + colorRangeG * color0[i4 + 1]) + 0.5;
            single.b = SH_C0 * (colorMinB + colorRangeB * color0[i4 + 2]) + 0.5;
            single.a = A_LUT[color0[i4 + 3]];

            setFn(offset + i, single);
        }

        if (shN) {
            const centroidTexWidth = cached[5].width;
            const { mins: min, maxs: max } = shN;
            const range = (max - min) / 255;
            const shCounts = SH_MAPS[shDegree];
            const sh = new Array(shCounts);
            const shCoeffs = shCounts / 3;
            for (let i = 0; i < counts; i++) {
                const i4 = i * 4;
                const label = labels[i4] + (labels[i4 + 1] << 8);
                const o = ((label >>> 6) * centroidTexWidth + (label & 63) * 15) * 4;
                for (let j = 0; j < shCoeffs; j++) {
                    sh[j * 3 + 0] = min + range * centroids[o + j * 4 + 0];
                    sh[j * 3 + 1] = min + range * centroids[o + j * 4 + 1];
                    sh[j * 3 + 2] = min + range * centroids[o + j * 4 + 2];
                }
                setShFn(offset + i, sh);
            }
        }
    }

    private parse_v2(data: IData, offset: number) {
        const setFn = data.set.bind(data) as IData['set'];
        const setShFn = data.setShN.bind(data) as IData['setShN'];

        const { meta, counts, shDegree, cached } = this;
        const { means, scales, sh0, shN } = meta as SogMetadataV2;
        const {
            mins: [centerMinX, centerMinY, centerMinZ],
            maxs: [centerMaxX, centerMaxY, centerMaxZ],
        } = means;
        const { codebook: scaleCodebook } = scales;
        const { codebook: sh0Codebook } = sh0;
        const [mean0, mean1, scale0, quat0, color0, centroids, labels] = cached.map(img => img.data);

        const rangeX = (centerMaxX - centerMinX) / 65535;
        const rangeY = (centerMaxY - centerMinY) / 65535;
        const rangeZ = (centerMaxZ - centerMinZ) / 65535;
        const SCALE_LUT = scaleCodebook.map(v => Math.exp(v));

        const single: ISingleSplat = {
            x: 0, y: 0, z: 0,
            sx: 0, sy: 0, sz: 0,
            qx: 0, qy: 0, qz: 0, qw: 0,
            r: 0, g: 0, b: 0, a: 0,
            shN: [],
        };
        for (let i = 0; i < counts; i++) {
            const i4 = i * 4;

            const x = centerMinX + rangeX * (mean0[i4 + 0] + (mean1[i4 + 0] << 8));
            const y = centerMinY + rangeY * (mean0[i4 + 1] + (mean1[i4 + 1] << 8));
            const z = centerMinZ + rangeZ * (mean0[i4 + 2] + (mean1[i4 + 2] << 8));
            single.x = Math.sign(x) * (Math.exp(Math.abs(x)) - 1);
            single.y = Math.sign(y) * (Math.exp(Math.abs(y)) - 1);
            single.z = Math.sign(z) * (Math.exp(Math.abs(z)) - 1);

            single.sx = SCALE_LUT[scale0[i4 + 0]];
            single.sy = SCALE_LUT[scale0[i4 + 1]];
            single.sz = SCALE_LUT[scale0[i4 + 2]];

            TEMP_ROT[0] = (quat0[i4 + 0] / 255 - 0.5) * Math.SQRT2;
            TEMP_ROT[1] = (quat0[i4 + 1] / 255 - 0.5) * Math.SQRT2;
            TEMP_ROT[2] = (quat0[i4 + 2] / 255 - 0.5) * Math.SQRT2;
            TEMP_ROT[3] = Math.sqrt(Math.max(0, 1.0 - TEMP_ROT[0] * TEMP_ROT[0] - TEMP_ROT[1] * TEMP_ROT[1] - TEMP_ROT[2] * TEMP_ROT[2]));
            const PERM = PERM_TABLE[quat0[i4 + 3] - 252];
            single.qx = TEMP_ROT[PERM[0]];
            single.qy = TEMP_ROT[PERM[1]];
            single.qz = TEMP_ROT[PERM[2]];
            single.qw = TEMP_ROT[PERM[3]];

            single.r = SH_C0 * sh0Codebook[color0[i4 + 0]] + 0.5;
            single.g = SH_C0 * sh0Codebook[color0[i4 + 1]] + 0.5;
            single.b = SH_C0 * sh0Codebook[color0[i4 + 2]] + 0.5;
            single.a = color0[i4 + 3] / 255;

            setFn(offset + i, single);
        }

        if (shN) {
            const { codebook } = shN;
            const shCounts = SH_MAPS[shDegree];
            const shCoeffs = shCounts / 3;
            const offsetItemSize = shCoeffs * 4;
            const sh = new Array(shCounts);
            for (let i = 0; i < counts; i++) {
                const i4 = i * 4;
                const o = (labels[i4 + 0] + (labels[i4 + 1] << 8)) * offsetItemSize;
                for (let j = 0; j < shCoeffs; j++) {
                    sh[j * 3] = codebook[centroids[o + j * 4 + 0]];
                    sh[j * 3 + 1] = codebook[centroids[o + j * 4 + 1]];
                    sh[j * 3 + 2] = codebook[centroids[o + j * 4 + 2]];
                }
                setShFn(offset + i, sh);
            }
        }
    }

    private async loadTexture(path: string) {
        let buffer: Uint8Array | undefined = this.refs[path];
        if (!buffer && isUrl(path)) {
            buffer = await fetch(path).then(res => res.arrayBuffer()).then(buf => new Uint8Array(buf));
        }
        if (!buffer) {
            throw new Error(`Cannot load texture: ${path}`);
        }
        return decodeImage(buffer.buffer as ArrayBuffer);
    }

    async read(stream: ReadableStream<Uint8Array>, contentLength: number, data: IData) {
        await this.load(stream, contentLength);
        const BlockOffset = await data.initBlock(this.counts, this.shDegree);

        const { means, scales, quats, sh0, shN } = this.meta;
        this.cached = await Promise.all([
            means.files[0], means.files[1],
            scales.files[0], quats.files[0],
            sh0.files[0], shN?.files[0], shN?.files[1],
        ].filter(path => !!path).map(path => this.loadTexture(path!)));

        if (this.version === 1) {
            this.parse_v1(data, BlockOffset);
        } else if (this.version === 2) {
            this.parse_v2(data, BlockOffset);
        } else {
            throw new Error(`Unsupported SOG version: ${this.version}`);
        }
        data.finishBlock();
    }

    async write(_stream: WritableStream<Uint8Array>, _data: IData) {
        throw new Error('Method not implemented.');
    }
}
