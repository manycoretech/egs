import type { IRenderer } from '../../renderer/IRenderer';

export interface Renderable {
    /**
     * used to update render pass, such as clear.
     * @returns batchable
     */
    config(renderer: IRenderer): boolean;
    /**
     * do render
     */
    render(renderer: IRenderer): void;
}
