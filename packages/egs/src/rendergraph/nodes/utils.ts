export interface Size {
    width: number;
    height: number;
    depthOrArrayLayers?: number;
}

export type ResizeFN = (size: Size) => Size;

export function bindRenderSize(xRatio: number, yRatio: number = xRatio): ResizeFN {
    return ({ width, height, depthOrArrayLayers }) => {
        const w = xRatio === 1 ? width : Math.round(width * xRatio * 0.5) * 2;
        const h = yRatio === 1 ? height : Math.round(height * yRatio * 0.5) * 2;
        return {
            width: Math.min(Math.max(5, w), 4096),
            height: Math.min(Math.max(5, h), 4096),
            depthOrArrayLayers
        };
    };
}

export const defaultResizeFN = bindRenderSize(1, 1);
