
export function createShaderBlock(source: string) {
    return new ShaderBlock(source);
}

export class ShaderBlock {
    public source: string;
    constructor(str: string) {
        this.source = str;
    }
}
