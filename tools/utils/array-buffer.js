import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';

const dts = `
const data: ArrayBuffer;
export default data;
`;

export function writeArraybuffer(input, output, preserveInput) {
    const str = `
const buffer = (function(base64Data) {
    const binary = globalThis.atob(base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; ++i) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}('${readFileSync(input).toString('base64')}'));
export default buffer;
`;
    writeFileSync(output, str, 'utf-8');
    const parsed = path.parse(output);
    writeFileSync(path.join(parsed.dir, `${parsed.name}.d.ts`), dts, 'utf-8');
    if (!preserveInput) {
        rmSync(input);
    }
    return;
}
