import { Vector4 } from '../../../math/Vector4.js';

export class ColorState {
    private color = new Vector4();
    private currentColorMask: [boolean, boolean, boolean, boolean] = [true, true, true, true];
    currentColorClear = new Vector4(-1, 0, 0, 0); // Initialize with invalid state
    readonly gl: WebGLRenderingContext | WebGL2RenderingContext;

    constructor(gl: WebGLRenderingContext | WebGL2RenderingContext) {
        this.gl = gl;
        this.setClear(0, 0, 0, 1);
    }

    setMask(red: boolean, green: boolean = red, blue: boolean = red, alpha: boolean = red): void {
        const currentColorMask = this.currentColorMask;
        if (
            currentColorMask[0] !== red ||
            currentColorMask[1] !== green ||
            currentColorMask[2] !== blue ||
            currentColorMask[3] !== alpha
        ) {
            this.gl.colorMask(red, green, blue, alpha);
            currentColorMask[0] = red;
            currentColorMask[1] = green;
            currentColorMask[2] = blue;
            currentColorMask[3] = alpha;
        }
    }

    setClear(r: number, g: number, b: number, a: number, premultipliedAlpha?: boolean): void {
        if (premultipliedAlpha === true) {
            r *= a;
            g *= a;
            b *= a;
        }
        this.color.set(r, g, b, a);
        if (this.currentColorClear.equals(this.color) === false) {
            this.gl.clearColor(r, g, b, a);
            this.currentColorClear.copy(this.color);
        }
    }

    reset() {
        this.currentColorClear.set(-1, 0, 0, 0); // set to invalid state
    }
}
