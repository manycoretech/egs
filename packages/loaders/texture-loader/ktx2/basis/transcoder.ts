import type { CompressTextureType } from '@qunhe/egs';
import { getTranscoderConfig, type TranscodeResult } from './constants';

let BasisModule: any = undefined;
let p: Promise<void>;

let wasmInitializingOrReady = false;

function waitForReady() {
    return p;
}

function init() {
    wasmInitializingOrReady = true;

    // const wasmBinary = (await import('./wasm/basis_transcoder.wasm')).default;

    BasisModule = {};

    p = Promise.all([
        import('./wasm/basis_transcoder.wasm'),
        // @ts-ignore
        import('./wasm/basis_transcoder'),
    ])
        .then(m => {
            BasisModule.wasmBinary = m[0].default;
            return m[1].default(BasisModule);
        })
        .then(_ => {
            BasisModule.initializeBasis();
        });
    return p;
}

export async function rebuildWasm(): Promise<void> {
    if (BasisModule) {
        console.log('KTX2BasisTranscoder: rebuilding', BasisModule.HEAP8.byteLength);
        await init();
        console.log('KTX2BasisTranscoder: rebuild success', BasisModule.HEAP8.byteLength);
        return;
    }
}

export interface TranscodeOptions {
    highQuality?: boolean;
    noETC1SChromaFiltering?: boolean;
}

export async function transcode(
    buffer: Uint8Array,
    supportedTypes: CompressTextureType[],
    options?: TranscodeOptions,
): Promise<TranscodeResult> {
    if (!wasmInitializingOrReady) {
        init();
    }
    await waitForReady();
    const file = new BasisModule.KTX2File(buffer);

    try {
        if (!file.isValid()) {
            throw new Error('EGS.KTX2Loader.transcode: Invalid KTX2 file');
        }

        const config = getTranscoderConfig(supportedTypes, file.getBasisTexFormat());
        if (!config) {
            throw new Error(`EGS.KTX2Loader.transcode: Unsupported basis format ${file.getBasisTexFormat()}`);
        }
        const hasAlpha = file.getHasAlpha();
        const levels = file.getLevels();
        const result: TranscodeResult = {
            data: [],
            width: file.getWidth(),
            height: file.getHeight(),
            format: config.ldr.to[hasAlpha ? 1 : 0],
            buffer: undefined!, // will assign later...
        };

        if (result.width % 4 !== 0 || result.height % 4 !== 0) {
            throw new Error(
                `EGS.KTX2Loader.transcode: width, height should be multiple-of-four, source size: (${result.width}, ${result.height})`,
            );
        }

        const transcoder = config.ldr.transcoder[hasAlpha ? 1 : 0];

        if (!file.startTranscoding()) {
            throw new Error('EGS.KTX2Loader.transcode: startTranscoding failed');
        }

        let totalSize = 0;

        const mipmapInfo: Array<{
            byteLength: number;
            byteOffset: number;
        }> = [];
        for (let i = 0; i < levels; i++) {
            const size = file.getImageTranscodedSizeInBytes(i, 0, 0, transcoder);
            mipmapInfo.push({
                byteOffset: totalSize,
                byteLength: size,
            });
            totalSize += size;
        }
        const resultBuffer = new ArrayBuffer(totalSize);
        let flags = 0;
        if (options?.highQuality) {
            flags |= BasisModule.basisu_decode_flags.cDecodeFlagsHighQuality.value;
        }

        if (options?.noETC1SChromaFiltering) {
            flags |= BasisModule.basisu_decode_flags.cDecodeFlagsNoETC1SChromaFiltering.value;
        }

        for (let i = 0; i < levels; i++) {
            const info = mipmapInfo[i];
            const current = new Uint8Array(resultBuffer, info.byteOffset, info.byteLength);
            if (!file.transcodeImageWithFlags(current, i, 0, 0, transcoder, flags, -1, -1)) {
                throw new Error(`EGS.KTX2Loader.transcode: failed during transcode level: ${i}`);
            }
            result.data.push([current]);
        }
        result.buffer = resultBuffer;
        return result;
    } finally {
        file.close();
        file.delete();
    }
}
