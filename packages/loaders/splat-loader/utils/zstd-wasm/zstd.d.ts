/* tslint:disable */
/* eslint-disable */

export class ZstdDecompressor {
    free(): void;
    [Symbol.dispose](): void;
    feed(input: Uint8Array): Array<any>;
    feedView(input: Uint8Array, callback: Function): void;
    finish(): Array<any>;
    finishView(callback: Function): void;
    constructor();
    static withOutputChunkSize(output_chunk_size: number): ZstdDecompressor;
}

export function setWasmModule(val: any): void;
