import { materialProperty } from '../../../ContentAPI';
import { DrivenMaterial } from './DrivenMaterial';
import { RenderAttachment } from '../../../EGSInner';

export class DrivenGenHZBMaterial extends DrivenMaterial {
    @materialProperty()
    depth: RenderAttachment | null;
    @materialProperty()
    depthPyramid: RenderAttachment | null = null;

    className(): string {
        return 'DrivenGenHZBMaterial';
    }
}
