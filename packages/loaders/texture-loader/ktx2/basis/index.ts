import { Capabilities, type CompressTextureType } from '@qunhe/egs';
import { transcode as transcodeImpl } from './worker/index.js';
import type { TranscodeResult } from './constants.js';

export async function transcode(buffer: Uint8Array, supportedTypes?: CompressTextureType[]): Promise<TranscodeResult> {
    return transcodeImpl(buffer, supportedTypes || Capabilities.SUPPORTED_COMPRESS_TEXTURE_TYPES);
}
