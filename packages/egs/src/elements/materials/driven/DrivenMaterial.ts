import { Material } from '../Material';

export abstract class DrivenMaterial extends Material {
    readonly isDrivenMaterial: boolean = true;

    extendShaderShape(): void { }
    extendShaderShading(): void { }
    updateShapeUniforms(): void { }
    updateShadingUniforms(): void { }
    computeShapeKey(): string { return this.className(); }
    clone(): Material { return this; }
    copy(_other: Material): void { }
}
