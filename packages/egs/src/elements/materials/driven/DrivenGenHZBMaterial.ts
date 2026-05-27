import { materialProperty } from '../../../ContentAPI';
import { RenderAttachment } from '../../textures/RenderTarget';
import { DrivenMaterial } from './DrivenMaterial';

export class DrivenGenHZBMaterial extends DrivenMaterial {
    @materialProperty()
    depth: RenderAttachment | null;
    @materialProperty()
    depthPyramid: RenderAttachment | null = null;

    className(): string {
        return 'DrivenGenHZBMaterial';
    }
}
