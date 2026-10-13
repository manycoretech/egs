import { type SplatFileInput, prepareSplatFiles, readSplatFiles } from '../helper.js';
import { type IFile, type IData, SplatFileType } from '../types.js';
import { type FileContext, openZipEntry, resolveFilePath } from '../utils/zip.js';

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

export function getLcc2References(meta: Metadata): string[] {
    const type = (meta.splatType ?? '.sog').replace(/^\./, '');
    return (meta.root.splatFiles ?? meta.root.files ?? []).map(path => {
        if (!meta.root.splatFiles) {
            path = path.replace(/^[\\/]+/, '');
            if (!path.endsWith(`.${type}`)) {
                path += `.${type}`;
            }
        }
        return path;
    });
}

// https://github.com/xgrids/LCC2Whitepaper
export class Lcc2File implements IFile {
    private splatType: SplatFileType;
    private meta: Metadata;

    constructor(private readonly lodLevel: number = 0) {}

    private load(meta: Metadata) {
        if (meta.version !== undefined && !/^0\.0\.[1-3]$/.test(meta.version)) {
            throw new Error(`Unsupported LCC2 version: ${meta.version}`);
        }
        const totalLevels = meta.totalLevels ?? meta.lod_level ?? 0;
        if (!Number.isInteger(this.lodLevel) || this.lodLevel < 0 || this.lodLevel >= totalLevels) {
            throw new Error(`LCC2 LOD level must be between 0 and ${totalLevels - 1}: ${this.lodLevel}`);
        }

        meta.totalLevels = totalLevels;
        meta.splatType = (meta.splatType ?? '.sog').replace(/^\./, '');
        const type = SplatFileType[meta.splatType.toUpperCase() as keyof typeof SplatFileType];
        if (type === undefined) {
            throw new Error(`Unsupported LCC2 splat type: ${meta.splatType}`);
        }
        this.splatType = type;
        this.meta = meta;
    }

    private collectFiles(meta: Metadata, context: FileContext): string[] {
        const targetDepth = meta.totalLevels! - this.lodLevel;
        const files = getLcc2References(meta);
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

        const indices = [...selected].sort((a, b) => a - b);
        if (envIndex !== undefined) {
            indices.push(envIndex);
        }
        const paths = new Set<string>();
        for (const index of indices) {
            const path = files[index] === undefined ? '' : resolveFilePath(context.path, files[index]);
            if (Object.hasOwn(context.files, path)) {
                paths.add(path);
            } else if (index !== envIndex) {
                throw new Error(`LCC2 splat file not found: ${files[index]}`);
            }
        }
        return [...paths];
    }

    async read(stream: ReadableStream<Uint8Array>, _contentLength: number, data: IData, context?: FileContext) {
        if (!context) {
            throw new Error('LCC2 metadata requires a file index.');
        }
        this.load(await new Response(stream).json());
        const paths = this.collectFiles(this.meta, context);
        const inputs: SplatFileInput[] = [];
        for (const path of paths) {
            const entry = context.files[path];
            inputs.push(
                ...(await prepareSplatFiles(this.splatType, openZipEntry(entry), entry.byteLength, false, {
                    path,
                    files: context.files,
                })),
            );
        }
        await readSplatFiles(inputs, data, this.lodLevel);
    }

    async write(_stream: WritableStream<Uint8Array>, _data: IData) {
        throw new Error('Method not implemented.');
    }
}
