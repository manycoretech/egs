import { SplatData } from './SplatData';
import {
    type ISampler,
    type ISplatData,
    type ISingleSplat,
    ISamplerFormat,
    computeTextureSize,
    clamp,
    toHalf,
    fromHalf,
    encodeQuatOct,
    decodeQuatOct,
} from './utils';

function encode111011s(a: number, b: number, c: number) {
    return (
        (clamp(((a * 0.5 + 0.5) * 2047) | 0, 0, 2047) << 21) |
        (clamp(((b * 0.5 + 0.5) * 1023) | 0, 0, 1023) << 11) |
        clamp(((c * 0.5 + 0.5) * 2047) | 0, 0, 2047)
    );
}

function decode111011s(decode: number, out: number[], offset: number) {
    out[offset + 0] = (((decode >>> 21) & 2047) / 2047) * 2 - 1;
    out[offset + 1] = (((decode >>> 11) & 1023) / 1023) * 2 - 1;
    out[offset + 2] = ((decode & 2047) / 2047) * 2 - 1;
}

export class CompressedSplatData extends SplatData {
    counts: number = 0;
    shDegree: number = 0;

    private splat1Sampler: ISampler;
    private splat1Float32Buffer: Float32Array;
    private splat1Uint16Buffer: Uint16Array;
    private splat2Sampler: ISampler;
    private splat2Uint16Buffer: Uint16Array;
    private splat2Uint32Buffer: Uint32Array;

    private sh1Sampler: ISampler;
    private sh1Uint32Buffer: Uint32Array;
    private sh2Sampler: ISampler;
    private sh2Uint32Buffer: Uint32Array;
    private sh3Sampler: ISampler;
    private sh3Uint32Buffer: Uint32Array;
    private sh4Sampler: ISampler;
    private sh4Uint32Buffer: Uint32Array;

    init(counts: number, shDegree: number) {
        this.counts = counts;
        this.shDegree = Math.min(shDegree, this.maxShDegree);

        const { w: width, h: height, d: depth } = computeTextureSize(counts, this.maxTextureSize);
        const pixelCounts = width * height * depth;

        const splat1Sampler = (this.splat1Sampler = {
            width,
            height,
            depth,
            format: ISamplerFormat.RGBA_UINT,
            source: new Uint8Array(16 * pixelCounts),
        });
        this.splat1Float32Buffer = new Float32Array(splat1Sampler.source.buffer);
        this.splat1Uint16Buffer = new Uint16Array(splat1Sampler.source.buffer);
        const splat2Sampler = (this.splat2Sampler = {
            width,
            height,
            depth,
            format: ISamplerFormat.RGBA_UINT,
            source: new Uint8Array(16 * pixelCounts),
        });
        this.splat2Uint16Buffer = new Uint16Array(splat2Sampler.source.buffer);
        this.splat2Uint32Buffer = new Uint32Array(splat2Sampler.source.buffer);

        const sh1Sampler = (this.sh1Sampler = {
            width,
            height,
            depth,
            format: ISamplerFormat.RGBA_UINT,
            source: new Uint8Array((shDegree >= 1 ? 16 : 0) * pixelCounts),
        });
        this.sh1Uint32Buffer = new Uint32Array(sh1Sampler.source.buffer);
        const sh2Sampler = (this.sh2Sampler = {
            width,
            height,
            depth,
            format: ISamplerFormat.RGBA_UINT,
            source: new Uint8Array((shDegree >= 2 ? 16 : 0) * pixelCounts),
        });
        this.sh2Uint32Buffer = new Uint32Array(sh2Sampler.source.buffer);
        const sh3Sampler = (this.sh3Sampler = {
            width,
            height,
            depth,
            format: ISamplerFormat.RGBA_UINT,
            source: new Uint8Array((shDegree >= 3 ? 16 : 0) * pixelCounts),
        });
        this.sh3Uint32Buffer = new Uint32Array(sh3Sampler.source.buffer);
        const sh4Sampler = (this.sh4Sampler = {
            width,
            height,
            depth,
            format: ISamplerFormat.RGBA_UINT,
            source: new Uint8Array((shDegree >= 3 ? 16 : 0) * pixelCounts),
        });
        this.sh4Uint32Buffer = new Uint32Array(sh4Sampler.source.buffer);
    }

    set(i: number, single: ISingleSplat) {
        const { splat1Float32Buffer, splat1Uint16Buffer, splat2Uint16Buffer, splat2Uint32Buffer } = this;
        const i4 = i * 4;
        const i8 = i * 8;

        splat1Float32Buffer[i4 + 0] = single.x;
        splat1Float32Buffer[i4 + 1] = single.y;
        splat1Float32Buffer[i4 + 2] = single.z;
        splat1Uint16Buffer[i8 + 6] = toHalf(single.a);

        splat2Uint16Buffer[i8 + 0] = toHalf(single.r);
        splat2Uint16Buffer[i8 + 1] = toHalf(single.g);
        splat2Uint16Buffer[i8 + 2] = toHalf(single.b);
        splat2Uint16Buffer[i8 + 3] = toHalf(Math.log(single.sx));
        splat2Uint16Buffer[i8 + 4] = toHalf(Math.log(single.sy));
        splat2Uint16Buffer[i8 + 5] = toHalf(Math.log(single.sz));
        const oct = encodeQuatOct(single.qx, single.qy, single.qz, single.qw);
        const quantU = clamp(((oct[0] * 0.5 + 0.5) * 1023.0) | 0, 0.0, 1023);
        const quantV = clamp(((oct[1] * 0.5 + 0.5) * 1023.0) | 0, 0.0, 1023);
        const angleInt = clamp((oct[2] * 4095.0) | 0, 0, 4095);
        splat2Uint32Buffer[i4 + 3] = (angleInt << 20) | (quantV << 10) | quantU;
    }

    setCenter(i: number, x: number, y: number, z: number) {
        const { splat1Float32Buffer } = this;
        const i4 = i * 4;
        splat1Float32Buffer[i4 + 0] = x;
        splat1Float32Buffer[i4 + 1] = y;
        splat1Float32Buffer[i4 + 2] = z;
    }

    setScale(i: number, sx: number, sy: number, sz: number) {
        const { splat2Uint16Buffer } = this;
        const i8 = i * 8;
        splat2Uint16Buffer[i8 + 3] = toHalf(Math.log(sx));
        splat2Uint16Buffer[i8 + 4] = toHalf(Math.log(sy));
        splat2Uint16Buffer[i8 + 5] = toHalf(Math.log(sz));
    }

    setQuat(i: number, qx: number, qy: number, qz: number, qw: number) {
        const { splat2Uint32Buffer } = this;
        const i4 = i * 4;
        const oct = encodeQuatOct(qx, qy, qz, qw);
        const quantU = clamp(((oct[0] * 0.5 + 0.5) * 1023.0) | 0, 0.0, 1023);
        const quantV = clamp(((oct[1] * 0.5 + 0.5) * 1023.0) | 0, 0.0, 1023);
        const angleInt = clamp((oct[2] * 4095.0) | 0, 0, 4095);
        splat2Uint32Buffer[i4 + 3] = (angleInt << 20) | (quantV << 10) | quantU;
    }

    setColor(i: number, r: number, g: number, b: number) {
        const { splat2Uint16Buffer } = this;
        const i8 = i * 8;
        splat2Uint16Buffer[i8 + 0] = toHalf(r);
        splat2Uint16Buffer[i8 + 1] = toHalf(g);
        splat2Uint16Buffer[i8 + 2] = toHalf(b);
    }

    setAlpha(i: number, a: number) {
        const { splat1Uint16Buffer } = this;
        const i8 = i * 8;
        splat1Uint16Buffer[i8 + 6] = toHalf(a);
    }

    setShN(i: number, shN: number[]) {
        const { shDegree, sh1Uint32Buffer, sh2Uint32Buffer } = this;
        const o = i * 4;
        if (shDegree >= 1) {
            sh1Uint32Buffer[o + 0] = encode111011s(shN[0], shN[1], shN[2]);
            sh1Uint32Buffer[o + 1] = encode111011s(shN[3], shN[4], shN[5]);
            sh1Uint32Buffer[o + 2] = encode111011s(shN[6], shN[7], shN[8]);
        }
        if (shDegree >= 2) {
            sh1Uint32Buffer[o + 3] = encode111011s(shN[9], shN[10], shN[11]);
            sh2Uint32Buffer[o + 0] = encode111011s(shN[12], shN[13], shN[14]);
            sh2Uint32Buffer[o + 1] = encode111011s(shN[15], shN[16], shN[17]);
            sh2Uint32Buffer[o + 2] = encode111011s(shN[18], shN[19], shN[20]);
            sh2Uint32Buffer[o + 3] = encode111011s(shN[21], shN[22], shN[23]);
        }
        if (shDegree >= 3) {
            const { sh3Uint32Buffer, sh4Uint32Buffer } = this;
            sh3Uint32Buffer[o + 0] = encode111011s(shN[24], shN[25], shN[26]);
            sh3Uint32Buffer[o + 1] = encode111011s(shN[27], shN[28], shN[29]);
            sh3Uint32Buffer[o + 2] = encode111011s(shN[30], shN[31], shN[32]);
            sh3Uint32Buffer[o + 3] = encode111011s(shN[33], shN[34], shN[35]);
            sh4Uint32Buffer[o + 0] = encode111011s(shN[36], shN[37], shN[38]);
            sh4Uint32Buffer[o + 1] = encode111011s(shN[39], shN[40], shN[41]);
            sh4Uint32Buffer[o + 2] = encode111011s(shN[42], shN[43], shN[44]);
        }
    }

    get(i: number, single: ISingleSplat) {
        const { splat1Float32Buffer, splat1Uint16Buffer, splat2Uint16Buffer, splat2Uint32Buffer } = this;

        const i4 = i * 4;
        const i8 = i * 8;
        single.x = splat1Float32Buffer[i4 + 0];
        single.y = splat1Float32Buffer[i4 + 1];
        single.z = splat1Float32Buffer[i4 + 2];

        single.a = fromHalf(splat1Uint16Buffer[i8 + 6]);
        single.r = fromHalf(splat2Uint16Buffer[i8 + 0]);
        single.g = fromHalf(splat2Uint16Buffer[i8 + 1]);
        single.b = fromHalf(splat2Uint16Buffer[i8 + 2]);

        single.sx = Math.exp(fromHalf(splat2Uint16Buffer[i8 + 3]));
        single.sy = Math.exp(fromHalf(splat2Uint16Buffer[i8 + 4]));
        single.sz = Math.exp(fromHalf(splat2Uint16Buffer[i8 + 5]));

        const quatEncode = splat2Uint32Buffer[i4 + 3];
        const u = (quatEncode & (0x3ff / 1023)) * 2 - 1;
        const v = ((quatEncode >>> 10) & (0x3ff / 1023)) * 2 - 1;
        const angle = (quatEncode >>> 20) & (0xfff / 4095);
        const quat = decodeQuatOct(u, v, angle);
        single.qx = quat[0];
        single.qy = quat[1];
        single.qz = quat[2];
        single.qw = quat[3];
    }

    getCenter(i: number, single: ISingleSplat) {
        const { splat1Float32Buffer } = this;
        const i4 = i * 4;
        single.x = splat1Float32Buffer[i4 + 0];
        single.y = splat1Float32Buffer[i4 + 1];
        single.z = splat1Float32Buffer[i4 + 2];
    }

    getScale(i: number, single: ISingleSplat) {
        const { splat2Uint16Buffer } = this;
        const i8 = i * 8;
        single.sx = Math.exp(fromHalf(splat2Uint16Buffer[i8 + 3]));
        single.sy = Math.exp(fromHalf(splat2Uint16Buffer[i8 + 4]));
        single.sz = Math.exp(fromHalf(splat2Uint16Buffer[i8 + 5]));
    }

    getQuat(i: number, single: ISingleSplat) {
        const { splat2Uint32Buffer } = this;
        const i4 = i * 4;
        const quatEncode = splat2Uint32Buffer[i4 + 3];
        const u = (quatEncode & (0x3ff / 1023)) * 2 - 1;
        const v = ((quatEncode >>> 10) & (0x3ff / 1023)) * 2 - 1;
        const angle = (quatEncode >>> 20) & (0xfff / 4095);
        const quat = decodeQuatOct(u, v, angle);
        single.qx = quat[0];
        single.qy = quat[1];
        single.qz = quat[2];
        single.qw = quat[3];
    }

    getColor(i: number, single: ISingleSplat) {
        const { splat2Uint16Buffer } = this;
        const i8 = i * 8;
        single.r = fromHalf(splat2Uint16Buffer[i8 + 0]);
        single.g = fromHalf(splat2Uint16Buffer[i8 + 1]);
        single.b = fromHalf(splat2Uint16Buffer[i8 + 2]);
    }

    getAlpha(i: number, single: ISingleSplat) {
        const { splat1Uint16Buffer } = this;
        const i8 = i * 8;
        single.a = fromHalf(splat1Uint16Buffer[i8 + 6]);
    }

    getShN(i: number, shN: number[]) {
        const { shDegree, sh1Uint32Buffer, sh2Uint32Buffer } = this;
        const o = i * 4;
        if (shDegree >= 1) {
            decode111011s(sh1Uint32Buffer[o + 0], shN, 0);
            decode111011s(sh1Uint32Buffer[o + 1], shN, 3);
            decode111011s(sh1Uint32Buffer[o + 2], shN, 6);
        }
        if (shDegree >= 2) {
            decode111011s(sh1Uint32Buffer[o + 3], shN, 9);
            decode111011s(sh2Uint32Buffer[o + 0], shN, 12);
            decode111011s(sh2Uint32Buffer[o + 1], shN, 15);
            decode111011s(sh2Uint32Buffer[o + 2], shN, 18);
            decode111011s(sh2Uint32Buffer[o + 3], shN, 21);
        }
        if (shDegree >= 3) {
            const { sh3Uint32Buffer, sh4Uint32Buffer } = this;
            decode111011s(sh3Uint32Buffer[o + 0], shN, 24);
            decode111011s(sh3Uint32Buffer[o + 1], shN, 27);
            decode111011s(sh3Uint32Buffer[o + 2], shN, 30);
            decode111011s(sh3Uint32Buffer[o + 3], shN, 33);
            decode111011s(sh4Uint32Buffer[o + 0], shN, 36);
            decode111011s(sh4Uint32Buffer[o + 1], shN, 39);
            decode111011s(sh4Uint32Buffer[o + 2], shN, 42);
        }
    }

    fillCenters(centers: Float32Array) {
        const { counts, splat1Float32Buffer } = this;
        for (let i = 0; i < counts; i++) {
            const i3 = i * 3;
            const i4 = i * 4;
            centers[i3 + 0] = splat1Float32Buffer[i4 + 0];
            centers[i3 + 1] = splat1Float32Buffer[i4 + 1];
            centers[i3 + 2] = splat1Float32Buffer[i4 + 2];
        }
    }

    serialize(): ISplatData {
        return {
            counts: this.counts,
            shDegree: this.shDegree,
            samplers: [
                this.splat1Sampler,
                this.splat2Sampler,
                this.sh1Sampler,
                this.sh2Sampler,
                this.sh3Sampler,
                this.sh4Sampler,
            ],
        };
    }

    deserialize(data: ISplatData) {
        const { counts, shDegree, samplers } = data;
        this.counts = counts;
        this.shDegree = shDegree;

        const { w: width, h: height, d: depth } = computeTextureSize(counts, this.maxTextureSize);
        const pixelCounts = width * height * depth;

        const splat1Sampler = (this.splat1Sampler = samplers[0] ?? {
            width,
            height,
            depth,
            format: ISamplerFormat.RGBA_UINT,
            source: new Uint8Array(16 * pixelCounts),
        });
        this.splat1Float32Buffer = new Float32Array(splat1Sampler.source.buffer);
        this.splat1Uint16Buffer = new Uint16Array(splat1Sampler.source.buffer);
        const splat2Sampler = (this.splat2Sampler = samplers[1] ?? {
            width,
            height,
            depth,
            format: ISamplerFormat.RGBA_UINT,
            source: new Uint8Array(16 * pixelCounts),
        });
        this.splat2Uint16Buffer = new Uint16Array(splat2Sampler.source.buffer);
        this.splat2Uint32Buffer = new Uint32Array(splat2Sampler.source.buffer);

        const sh1Sampler = (this.sh1Sampler = samplers[2] ?? {
            width,
            height,
            depth,
            format: ISamplerFormat.RGBA_UINT,
            source: new Uint8Array((shDegree >= 1 ? 16 : 0) * pixelCounts),
        });
        this.sh1Uint32Buffer = new Uint32Array(sh1Sampler.source.buffer);
        const sh2Sampler = (this.sh2Sampler = samplers[3] ?? {
            width,
            height,
            depth,
            format: ISamplerFormat.RGBA_UINT,
            source: new Uint8Array((shDegree >= 2 ? 16 : 0) * pixelCounts),
        });
        this.sh2Uint32Buffer = new Uint32Array(sh2Sampler.source.buffer);
        const sh3Sampler = (this.sh3Sampler = samplers[4] ?? {
            width,
            height,
            depth,
            format: ISamplerFormat.RGBA_UINT,
            source: new Uint8Array((shDegree >= 3 ? 16 : 0) * pixelCounts),
        });
        this.sh3Uint32Buffer = new Uint32Array(sh3Sampler.source.buffer);
        const sh4Sampler = (this.sh4Sampler = samplers[5] ?? {
            width,
            height,
            depth,
            format: ISamplerFormat.RGBA_UINT,
            source: new Uint8Array((shDegree >= 3 ? 16 : 0) * pixelCounts),
        });
        this.sh4Uint32Buffer = new Uint32Array(sh4Sampler.source.buffer);
    }
}
