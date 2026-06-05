/* oxlint-disable no-cond-assign */
import { _Math } from './Math';
import { logger } from '../utils/Logger';
import type { PickReadonly } from '../utils/Utils';

export interface HSL {
    h: number;
    s: number;
    l: number;
}
/**
 * Class representing a color.
 */
export class Color {
    /**
     * Red channel value between 0 and 1.
     * @defaultValue `1`.
     */
    r: number;
    /**
     * Green channel value between 0 and 1.
     * @defaultValue `1`.
     */
    g: number;
    /**
     * Blue channel value between 0 and 1.
     * @defaultValue `1`.
     */
    b: number;
    /**
     * Check the type whether it belongs to Color.
     * This value should not be changed by user.
     */
    isColor = true;

    get x() {
        return this.r;
    }
    get y() {
        return this.g;
    }
    get z() {
        return this.b;
    }

    constructor(color_or_r?: string | Color | number, g?: number, b?: number) {
        this.r = 1;
        this.g = 1;
        this.b = 1;

        if (color_or_r === undefined) {
            return;
        }

        if (color_or_r === undefined && g === undefined && b === undefined) {
            return;
        } else if (g === undefined && b === undefined) {
            this.set(color_or_r);
        } else if (color_or_r !== undefined && g !== undefined && b !== undefined) {
            this.setRGB(color_or_r as number, g, b);
        } else {
            logger.unsupported('Error setting color');
        }
    }

    /**
     * Sets this color from RGB values.
     * @param r Red channel value between 0.0 and 1.0.
     * @param g Green channel value between 0.0 and 1.0.
     * @param b Blue channel value between 0.0 and 1.0.
     */
    setRGB(r: number, g: number, b: number): Color {
        this.r = r;
        this.g = g;
        this.b = b;
        return this;
    }
    /**
     * Copies the {@link r| r}, {@link g| g} and {@link b| b} parameters from {@link Color| color} in to this color.
     */
    copy(color: Color): Color {
        this.r = color.r;
        this.g = color.g;
        this.b = color.b;
        return this;
    }
    /**
     * Sets this color from a hexadecimal value.
     * @param hex {@link https://en.wikipedia.org/wiki/Web_colors#Hex_triplet| hexadecimal triplet} format.
     */
    setHex(hex: number): Color {
        hex = Math.floor(hex);
        this.r = ((hex >> 16) & 255) / 255;
        this.g = ((hex >> 8) & 255) / 255;
        this.b = (hex & 255) / 255;
        return this;
    }

    private hue2rgb(p: number, q: number, t: number): number {
        if (t < 0) {
            t += 1;
        }
        if (t > 1) {
            t -= 1;
        }
        if (t < 1 / 6) {
            return p + (q - p) * 6 * t;
        }
        if (t < 1 / 2) {
            return q;
        }
        if (t < 2 / 3) {
            return p + (q - p) * 6 * (2 / 3 - t);
        }
        return p;
    }
    /**
     * Sets color from HSL values.
     * @param h hue value between 0.0 and 1.0.
     * @param s saturation value between 0.0 and 1.0.
     * @param l lightness value between 0.0 and 1.0.
     */
    setHSL(h: number, s: number, l: number): Color {
        // h,s,l ranges are in 0.0 - 1.0
        h = _Math.euclideanModulo(h, 1);
        s = _Math.clamp(s, 0, 1);
        l = _Math.clamp(l, 0, 1);
        if (s === 0) {
            this.r = this.g = this.b = l;
        } else {
            const p = l <= 0.5 ? l * (1 + s) : l + s - l * s;
            const q = 2 * l - p;
            this.r = this.hue2rgb(q, p, h + 1 / 3);
            this.g = this.hue2rgb(q, p, h);
            this.b = this.hue2rgb(q, p, h - 1 / 3);
        }
        return this;
    }

    /**
     * Translucent colors such as "rgba(255, 0, 0, 0.5)" and "hsla(0, 100%, 50%, 0.5)" are also accepted,
     * but the alpha-channel coordinate will be discarded.
     * @Note that for X11 color names, multiple words such as Dark Orange become the string 'darkorange' (all lowercase).
     * @param style color as a CSS-style string.
     * Sets this color from a CSS-style string. For example,
     * "rgb(250, 0,0)",
     * "rgb(100%, 0%, 0%)",
     * "hsl(0, 100%, 50%)",
     * "#ff0000",
     * "#f00", or
     * "red" ( or any {@link https://en.wikipedia.org/wiki/X11_color_names#Color_name_chart| X11 color name}
     * - all 140 color names are supported ).<br />
     */
    setStyle(style: string): Color {
        function handleAlpha(string: string) {
            if (string === undefined) {
                return;
            }
            if (parseFloat(string) < 1) {
                logger.warn('EGS.Color: Alpha component of ' + style + ' will be ignored.');
            }
        }

        let m;
        if ((m = /^((?:rgb|hsl)a?)\(\s*([^)]*)\)/.exec(style))) {
            // rgb / hsl
            let color;
            const name = m[1];
            const components = m[2];
            switch (name) {
                case 'rgb':
                case 'rgba':
                    if ((color = /^(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(,\s*([0-9]*\.?[0-9]+)\s*)?$/.exec(components))) {
                        // rgb(255,0,0) rgba(255,0,0,0.5)
                        this.r = Math.min(255, parseInt(color[1], 10)) / 255;
                        this.g = Math.min(255, parseInt(color[2], 10)) / 255;
                        this.b = Math.min(255, parseInt(color[3], 10)) / 255;
                        handleAlpha(color[5]);
                        return this;
                    }
                    if ((color = /^(\d+)%\s*,\s*(\d+)%\s*,\s*(\d+)%\s*(,\s*([0-9]*\.?[0-9]+)\s*)?$/.exec(components))) {
                        // rgb(100%,0%,0%) rgba(100%,0%,0%,0.5)
                        this.r = Math.min(100, parseInt(color[1], 10)) / 100;
                        this.g = Math.min(100, parseInt(color[2], 10)) / 100;
                        this.b = Math.min(100, parseInt(color[3], 10)) / 100;
                        handleAlpha(color[5]);
                        return this;
                    }
                    break;
                case 'hsl':
                case 'hsla':
                    if (
                        (color = /^([0-9]*\.?[0-9]+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*(,\s*([0-9]*\.?[0-9]+)\s*)?$/.exec(
                            components,
                        ))
                    ) {
                        // hsl(120,50%,50%) hsla(120,50%,50%,0.5)
                        const h = parseFloat(color[1]) / 360;
                        const s = parseInt(color[2], 10) / 100;
                        const l = parseInt(color[3], 10) / 100;
                        handleAlpha(color[5]);
                        return this.setHSL(h, s, l);
                    }
                    break;
            }
        } else if ((m = /^#([A-Fa-f0-9]+)$/.exec(style))) {
            // hex color
            const hex = m[1];
            const size = hex.length;
            if (size === 3) {
                // #ff0
                this.r = parseInt(hex.charAt(0) + hex.charAt(0), 16) / 255;
                this.g = parseInt(hex.charAt(1) + hex.charAt(1), 16) / 255;
                this.b = parseInt(hex.charAt(2) + hex.charAt(2), 16) / 255;
                return this;
            } else if (size === 6) {
                // #ff0000
                this.r = parseInt(hex.charAt(0) + hex.charAt(1), 16) / 255;
                this.g = parseInt(hex.charAt(2) + hex.charAt(3), 16) / 255;
                this.b = parseInt(hex.charAt(4) + hex.charAt(5), 16) / 255;
                return this;
            }
        }
        if (style && style.length > 0) {
            // color keywords
            const hex = (ColorKeywords as any)[style];
            if (hex !== undefined) {
                // red
                this.setHex(hex);
            } else {
                // unknown color
                logger.warn('EGS.Color: Unknown color ' + style);
            }
        }
        return this;
    }
    /**
     * See the Constructor above for full details of what {@link Color_Hex_or_String| value} can be.
     * Delegates to {@link .copy| .copy}, {@link .setStyle| .setStyle}, or {@link setHex| setHex} depending on input type.
     * @param value Value to set this color to.
     */
    set(value: string | Color | number): Color {
        if (value && (value as Color).isColor) {
            this.copy(value as Color);
        } else if (typeof value === 'number') {
            this.setHex(value);
        } else if (typeof value === 'string') {
            this.setStyle(value);
        }
        return this;
    }
    /**
     * Sets all three color components to the value {@link Float| scalar}.
     * @param scalar a value between 0.0 and 1.0.
     */
    setScalar(scalar: number): Color {
        this.r = scalar;
        this.g = scalar;
        this.b = scalar;
        return this;
    }
    /**
     * Return a new Color with the same {@link r| r}, {@link g| g} and {@link b| b} values as this clone.
     */
    clone(): Color {
        return new Color(this.r, this.g, this.b);
    }
    cloneReadonly() {
        return this.clone() as any as ReadonlyColor;
    }
    /**
     * Copies the given color into this color, and then converts this color from gamma space to linear space
     * by taking {@link r| r}, {@link g| g} and {@link b| b} to the power of {@link Float| gammaFactor}.
     * @param color Color to copy.
     * @param gammaFactor (optional).
     * @defaultValue `2.0`.
     */
    copyGammaToLinear(color: Color, gammaFactor?: number): Color {
        if (gammaFactor === undefined) {
            gammaFactor = 2.0;
        }
        this.r = Math.pow(color.r, gammaFactor);
        this.g = Math.pow(color.g, gammaFactor);
        this.b = Math.pow(color.b, gammaFactor);
        return this;
    }
    /**
     * Copies the given color into this color, and then converts this color from linear space to gamma space
     * by taking {@link r| r}, {@link g| g} and {@link b| b} to the power of 1 / {@link Float| gammaFactor}.
     * @param color Color to copy.
     * @param gammaFactor (optional).
     * @defaultValue `2.0`.
     */
    copyLinearToGamma(color: Color, gammaFactor?: number): Color {
        if (gammaFactor === undefined) {
            gammaFactor = 2.0;
        }
        const safeInverse = gammaFactor > 0 ? 1.0 / gammaFactor : 1.0;
        this.r = Math.pow(color.r, safeInverse);
        this.g = Math.pow(color.g, safeInverse);
        this.b = Math.pow(color.b, safeInverse);
        return this;
    }
    /**
     * Converts this color from gamma space to linear space by taking {@link .r| r}, {@link .g| g} and {@link .b| b} to the power of {@link Float| gammaFactor}.
     * @param gammaFactor (optional).
     * @defaultValue `2.0`.
     */
    convertGammaToLinear(gammaFactor?: number): Color {
        this.copyGammaToLinear(this, gammaFactor);
        return this;
    }
    /**
     * Converts this color from linear space to gamma space by taking {@link .r| r}, {@link .g| g} and {@link .b| b} to the power of 1 / {@link Float| gammaFactor}.
     * @param gammaFactor (optional).
     * @defaultValue `2.0`.
     */
    convertLinearToGamma(gammaFactor?: number): Color {
        this.copyLinearToGamma(this, gammaFactor);
        return this;
    }

    private SRGBToLinear(c: number): number {
        return c < 0.04045 ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4);
    }
    /**
     * Copies the given color into this color, and then converts this color from sRGB space to linear space.
     * @param color Color to copy.
     */
    copySRGBToLinear(color: Color): Color {
        this.r = this.SRGBToLinear(color.r);
        this.g = this.SRGBToLinear(color.g);
        this.b = this.SRGBToLinear(color.b);
        return this;
    }

    private LinearToSRGB(c: number): number {
        return c < 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 0.41666) - 0.055;
    }
    /**
     * Copies the given color into this color, and then converts this color from linear space to sRGB space.
     * @param color Color to copy.
     */
    copyLinearToSRGB(color: Color): Color {
        this.r = this.LinearToSRGB(color.r);
        this.g = this.LinearToSRGB(color.g);
        this.b = this.LinearToSRGB(color.b);
        return this;
    }
    /**
     * Converts this color from sRGB space to linear space.
     */
    convertSRGBToLinear(): Color {
        this.copySRGBToLinear(this);
        return this;
    }
    /**
     * Converts this color from linear space to sRGB space.
     */
    convertLinearToSRGB(): Color {
        this.copyLinearToSRGB(this);
        return this;
    }
    /**
     * Returns the hexadecimal value of this color.
     */
    getHex(): number {
        return ((this.r * 255) << 16) ^ ((this.g * 255) << 8) ^ ((this.b * 255) << 0);
    }
    /**
     * Returns the hexadecimal value of this color as a string (for example, 'FFFFFF').
     */
    getHexString(): string {
        return ('000000' + this.getHex().toString(16)).slice(-6);
    }
    // h,s,l ranges are in 0.0 - 1.0
    /**
     * Convert this Color's {@link .r| r}, {@link .g| g} and {@link .b| b} values to {@link https://en.wikipedia.org/wiki/HSL_and_HSV| HSL}
     * format and returns an object of the form:
     * `{ h: 0, s: 0, l: 0 }`
     * @param target the result will be copied into this Object. Adds h, s and l keys to the object (if not already present).
     */
    getHSL(target: HSL): HSL {
        const r = this.r;
        const g = this.g;
        const b = this.b;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let hue: number;
        let saturation;
        const lightness = (min + max) / 2.0;

        if (min === max) {
            hue = 0;
            saturation = 0;
        } else {
            const delta = max - min;
            saturation = lightness <= 0.5 ? delta / (max + min) : delta / (2 - max - min);
            switch (max) {
                case r:
                    hue = (g - b) / delta + (g < b ? 6 : 0);
                    break;
                case g:
                    hue = (b - r) / delta + 2;
                    break;
                case b:
                    hue = (r - g) / delta + 4;
                    break;
                default:
                    hue = 0;
                    break;
            }
            hue /= 6;
        }

        target.h = hue;
        target.s = saturation;
        target.l = lightness;
        return target;
    }
    /**
     * Returns the value of this color as a CSS style string. Example: `rgb(255,0,0)`.
     */
    getStyle(): string {
        return 'rgb(' + ((this.r * 255) | 0) + ',' + ((this.g * 255) | 0) + ',' + ((this.b * 255) | 0) + ')';
    }
    /**
     * Adds the RGB values of {@link Color| color} to the RGB values of this color.
     */
    add(color: Color): Color {
        this.r += color.r;
        this.g += color.g;
        this.b += color.b;
        return this;
    }
    /**
     * Sets this color's RGB values to the sum of the RGB values of color1 and color2.
     */
    addColors(color1: Color, color2: Color): Color {
        this.r = color1.r + color2.r;
        this.g = color1.g + color2.g;
        this.b = color1.b + color2.b;
        return this;
    }
    /**
     * Adds {@link Number| s} to the RGB values of this color.
     */
    addScalar(s: number): Color {
        this.r += s;
        this.g += s;
        this.b += s;
        return this;
    }
    /**
     * Subtracts the RGB components of the given color from the RGB components of this color.
     * If this results in a negative component, that component is set to zero.
     */
    sub(color: Color): Color {
        this.r = Math.max(0, this.r - color.r);
        this.g = Math.max(0, this.g - color.g);
        this.b = Math.max(0, this.b - color.b);
        return this;
    }
    /**
     * Multiplies this color's RGB values by the given {@link Color| color}'s RGB values.
     */
    multiply(color: Color): Color {
        this.r *= color.r;
        this.g *= color.g;
        this.b *= color.b;
        return this;
    }
    /**
     * Multiplies this color's RGB values by s.
     */
    multiplyScalar(s: number): Color {
        this.r *= s;
        this.g *= s;
        this.b *= s;
        return this;
    }
    /**
     * Linearly interpolates this color's RGB values toward the RGB values of the passed argument.
     * The alpha argument can be thought of as the ratio between the two colors, where 0.0 is this color and 1.0 is the first argument.
     * @param color color to converge on.
     * @param alpha interpolation factor in the closed interval [0, 1].
     */
    lerp(color: Color, alpha: number): Color {
        this.r += (color.r - this.r) * alpha;
        this.g += (color.g - this.g) * alpha;
        this.b += (color.b - this.b) * alpha;
        return this;
    }
    /**
     * Compares the RGB values of {@link Color| color} with those of this object. Returns true if they are the same, false otherwise.
     */
    equals(c: Color): boolean {
        return c.r === this.r && c.g === this.g && c.b === this.b;
    }
    /**
     * Sets this color's components based on an array formatted like [ r, g, b ].
     * @param array Array of floats in the form [ r, g, b ].
     * @param offset An optional offset into the array.
     */
    fromArray(array: ArrayLike<number>, offset?: number): Color {
        if (offset === undefined) {
            offset = 0;
        }
        this.r = array[offset];
        this.g = array[offset + 1];
        this.b = array[offset + 2];
        return this;
    }
    /**
     * r,g,b return 3
     */
    getNumberCount() {
        return 3;
    }
    /**
     * Returns an array of the form [ r, g, b ].
     * @param array An optional array to store the color to.
     * @param offset An optional offset into the array.
     */
    toArray(array?: number[], offset?: number): number[] {
        if (array === undefined) {
            array = [];
        }
        if (offset === undefined) {
            offset = 0;
        }
        array[offset] = this.r;
        array[offset + 1] = this.g;
        array[offset + 2] = this.b;
        return array;
    }
    /**
     * @internal
     */
    getSerializeData() {
        return this.getHex();
    }
    /**
     * @internal
     */
    setSerializeData(value: number) {
        this.setHex(value);
    }
    /**
     * Adds the given h, s, and l to this color's values.
     * Internally, this converts the color's r, g and b values to HSL,
     * adds h,s,l, and then converts the color back to RGB.
     */
    offsetHSL(h: number, s: number, l: number): Color {
        this.getHSL(tmpAHSL);
        tmpAHSL.h += h;
        tmpAHSL.s += s;
        tmpAHSL.l += l;
        this.setHSL(tmpAHSL.h, tmpAHSL.s, tmpAHSL.l);
        return this;
    }
    /**
     * Linearly interpolates this color's HSL values toward the HSL values of the passed argument.
     * It differs from the classic {@link lerp| lerp} by not interpolating straight from one color to the other,
     * but instead going through all the hues in between those two colors.
     * The alpha argument can be thought of as the ratio between the two colors, where 0.0 is this color and 1.0 is the first argument.
     */
    lerpHSL(color: Color, alpha: number) {
        this.getHSL(tmpAHSL);
        color.getHSL(tmpBHSL);
        const h = _Math.lerp(tmpAHSL.h, tmpBHSL.h, alpha);
        const s = _Math.lerp(tmpAHSL.s, tmpBHSL.s, alpha);
        const l = _Math.lerp(tmpAHSL.l, tmpBHSL.l, alpha);
        this.setHSL(h, s, l);
        return this;
    }
    /**
     * Converts a hexadecimal color number to a string.
     * `Color.hex2string(0xffffff);
     * -hex - Number in hex (e.g., `0xffffff`)
     * -return The string color (e.g., `"#ffffff"`).`
     */
    static hex2string(hex: number): string {
        let hexString = hex.toString(16);
        hexString = '000000'.substr(0, 6 - hexString.length) + hexString;
        return `#${hexString}`;
    }
    /**
     * Converts a hexadecimal color number to an [R, G, B] array of normalized floats (numbers from 0.0 to 1.0).
     * `Color.hex2rgb(0xffffff); // returns [1, 1, 1]
     * -hex The hexadecimal number to convert
     * -out If supplied, this array will be used rather than returning a new one
     * -return An array representing the [R, G, B] of the color where all values are floats.`
     */
    static hex2rgb(hex: number, out: number[] | Float32Array = []): number[] | Float32Array {
        out[0] = ((hex >> 16) & 0xff) / 255;
        out[1] = ((hex >> 8) & 0xff) / 255;
        out[2] = (hex & 0xff) / 255;

        return out;
    }

    /**
     * Converts a color as an [R, G, B] array to a hex number
     */
    static rgb2hex(rgb: number[] | Float32Array): number {
        return ((rgb[0] * 255) << 16) + ((rgb[1] * 255) << 8) + ((rgb[2] * 255) | 0);
    }

    /**
     * Converts a hexadecimal string to a hexadecimal color number.
     * `Color.string2hex("#ffffff"); // returns 0xffffff
     * -string - The string color (e.g., `"#ffffff"`)
     * -return Number in hexadecimal.`
     */
    static string2hex(string: string): number {
        if (typeof string === 'string' && string[0] === '#') {
            string = string.substr(1);
        }

        return parseInt(string, 16);
    }
}
const tmpAHSL = { h: 0, s: 0, l: 0 };
const tmpBHSL = { h: 0, s: 0, l: 0 };

export const ColorKeywords = {
    aliceblue: 0xf0f8ff,
    antiquewhite: 0xfaebd7,
    aqua: 0x00ffff,
    aquamarine: 0x7fffd4,
    azure: 0xf0ffff,
    beige: 0xf5f5dc,
    bisque: 0xffe4c4,
    black: 0x000000,
    blanchedalmond: 0xffebcd,
    blue: 0x0000ff,
    blueviolet: 0x8a2be2,
    brown: 0xa52a2a,
    burlywood: 0xdeb887,
    cadetblue: 0x5f9ea0,
    chartreuse: 0x7fff00,
    chocolate: 0xd2691e,
    coral: 0xff7f50,
    cornflowerblue: 0x6495ed,
    cornsilk: 0xfff8dc,
    crimson: 0xdc143c,
    cyan: 0x00ffff,
    darkblue: 0x00008b,
    darkcyan: 0x008b8b,
    darkgoldenrod: 0xb8860b,
    darkgray: 0xa9a9a9,
    darkgreen: 0x006400,
    darkgrey: 0xa9a9a9,
    darkkhaki: 0xbdb76b,
    darkmagenta: 0x8b008b,
    darkolivegreen: 0x556b2f,
    darkorange: 0xff8c00,
    darkorchid: 0x9932cc,
    darkred: 0x8b0000,
    darksalmon: 0xe9967a,
    darkseagreen: 0x8fbc8f,
    darkslateblue: 0x483d8b,
    darkslategray: 0x2f4f4f,
    darkslategrey: 0x2f4f4f,
    darkturquoise: 0x00ced1,
    darkviolet: 0x9400d3,
    deeppink: 0xff1493,
    deepskyblue: 0x00bfff,
    dimgray: 0x696969,
    dimgrey: 0x696969,
    dodgerblue: 0x1e90ff,
    firebrick: 0xb22222,
    floralwhite: 0xfffaf0,
    forestgreen: 0x228b22,
    fuchsia: 0xff00ff,
    gainsboro: 0xdcdcdc,
    ghostwhite: 0xf8f8ff,
    gold: 0xffd700,
    goldenrod: 0xdaa520,
    gray: 0x808080,
    green: 0x008000,
    greenyellow: 0xadff2f,
    grey: 0x808080,
    honeydew: 0xf0fff0,
    hotpink: 0xff69b4,
    indianred: 0xcd5c5c,
    indigo: 0x4b0082,
    ivory: 0xfffff0,
    khaki: 0xf0e68c,
    lavender: 0xe6e6fa,
    lavenderblush: 0xfff0f5,
    lawngreen: 0x7cfc00,
    lemonchiffon: 0xfffacd,
    lightblue: 0xadd8e6,
    lightcoral: 0xf08080,
    lightcyan: 0xe0ffff,
    lightgoldenrodyellow: 0xfafad2,
    lightgray: 0xd3d3d3,
    lightgreen: 0x90ee90,
    lightgrey: 0xd3d3d3,
    lightpink: 0xffb6c1,
    lightsalmon: 0xffa07a,
    lightseagreen: 0x20b2aa,
    lightskyblue: 0x87cefa,
    lightslategray: 0x778899,
    lightslategrey: 0x778899,
    lightsteelblue: 0xb0c4de,
    lightyellow: 0xffffe0,
    lime: 0x00ff00,
    limegreen: 0x32cd32,
    linen: 0xfaf0e6,
    magenta: 0xff00ff,
    maroon: 0x800000,
    mediumaquamarine: 0x66cdaa,
    mediumblue: 0x0000cd,
    mediumorchid: 0xba55d3,
    mediumpurple: 0x9370db,
    mediumseagreen: 0x3cb371,
    mediumslateblue: 0x7b68ee,
    mediumspringgreen: 0x00fa9a,
    mediumturquoise: 0x48d1cc,
    mediumvioletred: 0xc71585,
    midnightblue: 0x191970,
    mintcream: 0xf5fffa,
    mistyrose: 0xffe4e1,
    moccasin: 0xffe4b5,
    navajowhite: 0xffdead,
    navy: 0x000080,
    oldlace: 0xfdf5e6,
    olive: 0x808000,
    olivedrab: 0x6b8e23,
    orange: 0xffa500,
    orangered: 0xff4500,
    orchid: 0xda70d6,
    palegoldenrod: 0xeee8aa,
    palegreen: 0x98fb98,
    paleturquoise: 0xafeeee,
    palevioletred: 0xdb7093,
    papayawhip: 0xffefd5,
    peachpuff: 0xffdab9,
    peru: 0xcd853f,
    pink: 0xffc0cb,
    plum: 0xdda0dd,
    powderblue: 0xb0e0e6,
    purple: 0x800080,
    rebeccapurple: 0x663399,
    red: 0xff0000,
    rosybrown: 0xbc8f8f,
    royalblue: 0x4169e1,
    saddlebrown: 0x8b4513,
    salmon: 0xfa8072,
    sandybrown: 0xf4a460,
    seagreen: 0x2e8b57,
    seashell: 0xfff5ee,
    sienna: 0xa0522d,
    silver: 0xc0c0c0,
    skyblue: 0x87ceeb,
    slateblue: 0x6a5acd,
    slategray: 0x708090,
    slategrey: 0x708090,
    snow: 0xfffafa,
    springgreen: 0x00ff7f,
    steelblue: 0x4682b4,
    tan: 0xd2b48c,
    teal: 0x008080,
    thistle: 0xd8bfd8,
    tomato: 0xff6347,
    turquoise: 0x40e0d0,
    violet: 0xee82ee,
    wheat: 0xf5deb3,
    white: 0xffffff,
    whitesmoke: 0xf5f5f5,
    yellow: 0xffff00,
    yellowgreen: 0x9acd32,
};

/**
 * Readonly view of the public Color API.
 */
export type ReadonlyColor = PickReadonly<Color, 'g' | 'r' | 'b' | 'isColor' | 'equals' | 'getHex'>;
