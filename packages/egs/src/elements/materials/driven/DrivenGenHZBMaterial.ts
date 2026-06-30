import { materialProperty } from '../../../ContentAPI.js';
import type { RenderAttachment } from '../../textures/RenderTarget.js';
import { DrivenMaterial } from './DrivenMaterial.js';

export class DrivenGenHZBMaterial extends DrivenMaterial {
    @materialProperty()
    depth: RenderAttachment | null;
    @materialProperty()
    depthPyramid: RenderAttachment | null = null;

    className(): string {
        return 'DrivenGenHZBMaterial';
    }
}
