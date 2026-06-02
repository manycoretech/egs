import { unzipSync } from 'fflate';
import { decodeImage, extractFromRootDir, IData, IFile, ISingleSplat, isUrl, SH_C0, SH_MAPS } from './utils';

interface Metadata {
    version: number;
    counts: number;
    shDegree: number;
    box: {
        min: [number, number, number];
        max: [number, number, number];
    };
    resources: {
        means_l: string;
        means_u: string;
        scales: string;
        quats: string;
        sh0: string;
        shN?: string;
    };
}

const TEMP_ROT: number[] = new Array(4);
const PERM_TABLE = [  // original quat idx ---> actual storage idx
    [0, 1, 2, 3],
    [3, 1, 2, 0],
    [1, 3, 2, 0],
    [1, 2, 3, 0],
];
const COLOR_SCALE = SH_C0 / 0.15;
function logTransform(value: number) {
    return Math.sign(value) * Math.log(Math.abs(value) + 1);
};

export class EszFile implements IFile {
    private counts: number = 0;
    private shDegree: number = 0;
    /**
     * @internal
     */
    version: number;
    /**
     * @internal
     */
    meta: Metadata;
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

        this.refs = extractFromRootDir(unzipSync(buffer));
        const metaBuffer = this.refs['meta.json'];
        if (!metaBuffer) {
            throw new Error('SOG meta.json not found in the zip archive.');
        }

        const meta = this.meta = JSON.parse(new TextDecoder().decode(metaBuffer)) as Metadata;
        this.version = meta.version;
        this.counts = meta.counts;
        this.shDegree = meta.shDegree;
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

        const offset = await data.initBlock(this.counts, this.shDegree);
        const { resources } = this.meta;
        this.cached = await Promise.all([
            resources.means_l, resources.means_u,
            resources.scales, resources.quats,
            resources.sh0, resources.shN,
        ].filter(path => !!path).map(path => this.loadTexture(path!)));

        const setFn = data.set.bind(data) as IData['set'];
        const setShFn = data.setShN.bind(data) as IData['setShN'];
        const SCALE_LUT = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
            SCALE_LUT[i] = Math.exp(i / 16 - 10);
        }
        const COLOR_LUT = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
            COLOR_LUT[i] = (i / 255 - 0.5) * COLOR_SCALE + 0.5;
        }

        const { meta: { box }, counts, shDegree, cached } = this;
        const [means_l, means_u, scales, quats, color, shN] = cached.map(v => v.data);

        const { min, max } = box;
        const minX = logTransform(min[0]);
        const minY = logTransform(min[1]);
        const minZ = logTransform(min[2]);
        const maxX = logTransform(max[0]);
        const maxY = logTransform(max[1]);
        const maxZ = logTransform(max[2]);
        const rangeX = (maxX - minX) / 65535;
        const rangeY = (maxY - minY) / 65535;
        const rangeZ = (maxZ - minZ) / 65535;

        const single: ISingleSplat = {
            x: 0, y: 0, z: 0,
            sx: 0, sy: 0, sz: 0,
            qx: 0, qy: 0, qz: 0, qw: 0,
            r: 0, g: 0, b: 0, a: 0,
            shN: [],
        };
        for (let i = 0; i < counts; i++) {
            const i4 = i * 4;

            const x = minX + rangeX * (means_l[i4 + 0] + (means_u[i4 + 0] << 8));
            const y = minY + rangeY * (means_l[i4 + 1] + (means_u[i4 + 1] << 8));
            const z = minZ + rangeZ * (means_l[i4 + 2] + (means_u[i4 + 2] << 8));
            single.x = Math.sign(x) * (Math.exp(Math.abs(x)) - 1);
            single.y = Math.sign(y) * (Math.exp(Math.abs(y)) - 1);
            single.z = Math.sign(z) * (Math.exp(Math.abs(z)) - 1);

            single.sx = SCALE_LUT[scales[i4 + 0]];
            single.sy = SCALE_LUT[scales[i4 + 1]];
            single.sz = SCALE_LUT[scales[i4 + 2]];

            TEMP_ROT[0] = (quats[i4 + 0] / 255 - 0.5) * Math.SQRT2;
            TEMP_ROT[1] = (quats[i4 + 1] / 255 - 0.5) * Math.SQRT2;
            TEMP_ROT[2] = (quats[i4 + 2] / 255 - 0.5) * Math.SQRT2;
            TEMP_ROT[3] = Math.sqrt(Math.max(0, 1.0 - TEMP_ROT[0] * TEMP_ROT[0] - TEMP_ROT[1] * TEMP_ROT[1] - TEMP_ROT[2] * TEMP_ROT[2]));
            const PERM = PERM_TABLE[quats[i4 + 3] - 252];
            single.qx = TEMP_ROT[PERM[0]];
            single.qy = TEMP_ROT[PERM[1]];
            single.qz = TEMP_ROT[PERM[2]];
            single.qw = TEMP_ROT[PERM[3]];

            single.r = COLOR_LUT[color[i4 + 0]];
            single.g = COLOR_LUT[color[i4 + 1]];
            single.b = COLOR_LUT[color[i4 + 2]];
            single.a = color[i4 + 3] / 255;

            setFn(offset + i, single);
        }

        if (shN) {
            const shCounts = SH_MAPS[shDegree];
            const shCoeffs = shCounts / 3;
            const sh = new Array(shCounts).fill(0);
            for (let i = 0; i < counts; i++) {
                const o = i * shCoeffs;
                for (let j = 0; j < shCoeffs; j++) {
                    sh[j * 3 + 0] = (shN[(o + j) * 4 + 0] - 128) / 128;
                    sh[j * 3 + 1] = (shN[(o + j) * 4 + 1] - 128) / 128;
                    sh[j * 3 + 2] = (shN[(o + j) * 4 + 2] - 128) / 128;
                }
                setShFn(offset + i, sh);
            }
        }

        data.finishBlock();
    }

    async write(_stream: WritableStream<Uint8Array>, _data: IData) {
        throw new Error('Method not implemented.');
    }
}
