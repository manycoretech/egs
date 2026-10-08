import { deferred } from '@qunhe/egs-lib';
import { unzipSync } from 'fflate';
import { createSplatFile } from '../helper.js';
import { RawSplatData } from '../splat/RawSplatData.js';
import { type IFile, type IData, createSingleSplat, extractFromRootDir, SH_MAPS, SplatFileType } from '../utils.js';

interface Lcc2Node {
    data?: {
        '3dgs'?: { name: number };
        env?: { name: number };
    };
    child?: Lcc2Node[] | Record<string, Lcc2Node>;
    splatFiles?: string[];
    files?: string[];
}

interface Metadata {
    version?: string;
    totalLevels?: number;
    lod_level?: number;
    splatType?: string;
    root: Lcc2Node;
}

const ZIP_MAGIC = 0x04034b50;

// https://github.com/xgrids/LCC2Whitepaper
export class Lcc2File implements IFile {
    private splatType: SplatFileType;

    constructor(private readonly lodLevel: number = 0) {}

    private load(buffer: Uint8Array) {
        const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
        if (view.getUint32(0, true) !== ZIP_MAGIC) {
            throw new Error('LCC2 file is not a valid zip archive.');
        }

        const entries = extractFromRootDir(unzipSync(buffer));
        const metaPath = Object.keys(entries).find(path => path.toLowerCase().endsWith('.lcc2'));
        if (!metaPath) {
            throw new Error('LCC2 metadata not found in the zip archive.');
        }
        const meta: Metadata = JSON.parse(new TextDecoder().decode(entries[metaPath]));
        if (meta.version !== undefined && !/^0\.0\.[1-3]$/.test(meta.version)) {
            throw new Error(`Unsupported LCC2 version: ${meta.version}`);
        }
        const totalLevels = meta.totalLevels ?? meta.lod_level ?? 0;
        if (!Number.isInteger(this.lodLevel) || this.lodLevel < 0 || this.lodLevel >= totalLevels) {
            throw new Error(`LCC2 LOD level must be between 0 and ${totalLevels - 1}: ${this.lodLevel}`);
        }

        meta.totalLevels = totalLevels;
        meta.splatType = (meta.splatType ?? '.sog').toLowerCase().replace(/^\./, '');
        const type = SplatFileType[meta.splatType.toUpperCase() as keyof typeof SplatFileType];
        if (type === undefined) {
            throw new Error(`Unsupported LCC2 splat type: ${meta.splatType}`);
        }
        this.splatType = type;
        return this.collectFiles(meta, entries, metaPath);
    }

    private collectFiles(meta: Metadata, refs: Record<string, Uint8Array>, metaPath: string): Uint8Array[] {
        const targetDepth = meta.totalLevels! - this.lodLevel;
        const files = meta.root.splatFiles ?? meta.root.files ?? [];
        const envIndex = meta.root.data?.env?.name;
        const selected = new Set<number>();
        const visit = (node: Lcc2Node, depth: number) => {
            const ref = node.data?.['3dgs'];
            if (depth === targetDepth && ref && ref.name !== envIndex) {
                selected.add(ref.name);
            }
            if (depth < targetDepth) {
                for (const child of Object.values(node.child ?? {})) {
                    visit(child, depth + 1);
                }
            }
        };
        visit(meta.root, 0);
        if (selected.size === 0) {
            throw new Error(`No splat files found for LCC2 LOD ${this.lodLevel}.`);
        }

        const baseDir = metaPath.slice(0, metaPath.lastIndexOf('/') + 1);
        const indices = [...selected].sort((a, b) => a - b);
        if (envIndex !== undefined) {
            indices.push(envIndex);
        }
        const buffers = new Set<Uint8Array>();
        for (const index of indices) {
            let name = files[index].replace(/\\/g, '/').replace(/^(\/|\.\/)+/, '');
            if (!meta.root.splatFiles && !name.toLowerCase().endsWith(`.${meta.splatType}`)) {
                name += `.${meta.splatType}`;
            }
            const buffer = refs[baseDir + name] ?? refs[baseDir + name.slice(name.lastIndexOf('/') + 1)];
            if (buffer) {
                buffers.add(buffer);
            } else if (index !== envIndex) {
                throw new Error(`LCC2 splat file not found: ${files[index]}`);
            }
        }
        return [...buffers];
    }

    async read(stream: ReadableStream<Uint8Array>, _contentLength: number, data: IData) {
        const files = this.load(new Uint8Array(await new Response(stream).arrayBuffer()));
        if (files.length === 0) {
            await data.initBlock(0, 0);
            data.finishBlock();
            return;
        }

        const initialized = deferred();
        initialized.promise.catch(() => {});
        let pending = files.length;
        let counts = 0;
        let shDegree = 0;
        let offset = 0;
        const setFn = data.set.bind(data) as IData['set'];
        const setShFn = data.setShN.bind(data) as IData['setShN'];
        const single = createSingleSplat();
        const sh: number[] = [];
        const reads: Promise<void>[] = files.map(async (buffer, index) => {
            const raw = new RawSplatData();
            raw.initBlock = async (blockCounts, blockShDegree) => {
                counts += blockCounts;
                shDegree = Math.max(shDegree, blockShDegree);
                // Scan every header before allocating the output, then decode one chunk at a time.
                if (--pending === 0) {
                    offset = await data.initBlock(counts, shDegree);
                    sh.length = SH_MAPS[shDegree];
                    initialized.resolve();
                }
                await initialized.promise;
                if (index > 0) {
                    await reads[index - 1];
                }
                raw.init(blockCounts, blockShDegree);
                return 0;
            };

            const source = new ReadableStream<Uint8Array>({
                start: controller => {
                    controller.enqueue(buffer);
                    controller.close();
                },
            });
            try {
                await createSplatFile(this.splatType).read(source, buffer.length, raw);
                sh.fill(0);
                for (let i = 0; i < raw.counts; i++, offset++) {
                    raw.get(i, single);
                    setFn(offset, single);
                    if (shDegree > 0) {
                        raw.getShN(i, sh);
                        setShFn(offset, sh);
                    }
                }
            } finally {
                raw.init(0, 0);
            }
        });
        try {
            await Promise.all(reads);
        } catch (error) {
            initialized.reject(error);
            await Promise.allSettled(reads);
            throw error;
        }
        data.finishBlock();
    }

    async write(_stream: WritableStream<Uint8Array>, _data: IData) {
        throw new Error('Method not implemented.');
    }
}
