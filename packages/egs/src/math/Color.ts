/* eslint-disable no-cond-assign */
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
        this.r = (hex >> 16 & 255) / 255;
        this.g = (hex >> 8 & 255) / 255;
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
            const p = l <= 0.5 ? l * (1 + s) : l + s - (l * s);
            const q = (2 * l) - p;
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
        if (m = /^((?:rgb|hsl)a?)\(\s*([^\)]*)\)/.exec(style)) {
            // rgb / hsl
            let color;
            const name = m[1];
            const components = m[2];
            switch (name) {
                case 'rgb':
                case 'rgba':
                    if (color = /^(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(,\s*([0-9]*\.?[0-9]+)\s*)?$/.exec(components)) {
                        // rgb(255,0,0) rgba(255,0,0,0.5)
                        this.r = Math.min(255, parseInt(color[1], 10)) / 255;
                        this.g = Math.min(255, parseInt(color[2], 10)) / 255;
                        this.b = Math.min(255, parseInt(color[3], 10)) / 255;
                        handleAlpha(color[5]);
                        return this;
                    }
                    if (color = /^(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(,\s*([0-9]*\.?[0-9]+)\s*)?$/.exec(components)) {
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
                    if (color = /^([0-9]*\.?[0-9]+)\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(,\s*([0-9]*\.?[0-9]+)\s*)?$/.exec(components)) {
                        // hsl(120,50%,50%) hsla(120,50%,50%,0.5)
                        const h = parseFloat(color[1]) / 360;
                        const s = parseInt(color[2], 10) / 100;
                        const l = parseInt(color[3], 10) / 100;
                        handleAlpha(color[5]);
                        return this.setHSL(h, s, l);
                    }
                    break;
            }
        } else if (m = /^\#([A-Fa-f0-9]+)$/.exec(style)) {
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
        const safeInverse = (gammaFactor > 0) ? (1.0 / gammaFactor) : 1.0;
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
        return (c < 0.04045) ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4);
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
        return (c < 0.0031308) ? c * 12.92 : 1.055 * (Math.pow(c, 0.41666)) - 0.055;
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
        return (this.r * 255) << 16 ^ (this.g * 255) << 8 ^ (this.b * 255) << 0;
    }
    /**
     * Returns the hexadecimal value of this color as a string (for example, 'FFFFFF').
     */
    getHexString(): string {
        return ('000000' + this.getHex().toString(16)).slice(- 6);
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
        return (c.r === this.r) && (c.g === this.g) && (c.b === this.b);
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
        tmpAHSL.h += h; tmpAHSL.s += s; tmpAHSL.l += l;
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
        out[0] = ((hex >> 16) & 0xFF) / 255;
        out[1] = ((hex >> 8) & 0xFF) / 255;
        out[2] = (hex & 0xFF) / 255;

        return out;
    }

    /**
     * Converts a color as an [R, G, B] array to a hex number
     */
    static rgb2hex(rgb: number[] | Float32Array): number {
        return (((rgb[0] * 255) << 16) + ((rgb[1] * 255) << 8) + (rgb[2] * 255 | 0));
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
    aliceblue: 0xF0F8FF,
    antiquewhite: 0xFAEBD7,
    aqua: 0x00FFFF,
    aquamarine: 0x7FFFD4,
    azure: 0xF0FFFF,
    beige: 0xF5F5DC,
    bisque: 0xFFE4C4,
    black: 0x000000,
    blanchedalmond: 0xFFEBCD,
    blue: 0x0000FF,
    blueviolet: 0x8A2BE2,
    brown: 0xA52A2A,
    burlywood: 0xDEB887,
    cadetblue: 0x5F9EA0,
    chartreuse: 0x7FFF00,
    chocolate: 0xD2691E,
    coral: 0xFF7F50,
    cornflowerblue: 0x6495ED,
    cornsilk: 0xFFF8DC,
    crimson: 0xDC143C,
    cyan: 0x00FFFF,
    darkblue: 0x00008B,
    darkcyan: 0x008B8B,
    darkgoldenrod: 0xB8860B,
    darkgray: 0xA9A9A9,
    darkgreen: 0x006400,
    darkgrey: 0xA9A9A9,
    darkkhaki: 0xBDB76B,
    darkmagenta: 0x8B008B,
    darkolivegreen: 0x556B2F,
    darkorange: 0xFF8C00,
    darkorchid: 0x9932CC,
    darkred: 0x8B0000,
    darksalmon: 0xE9967A,
    darkseagreen: 0x8FBC8F,
    darkslateblue: 0x483D8B,
    darkslategray: 0x2F4F4F,
    darkslategrey: 0x2F4F4F,
    darkturquoise: 0x00CED1,
    darkviolet: 0x9400D3,
    deeppink: 0xFF1493,
    deepskyblue: 0x00BFFF,
    dimgray: 0x696969,
    dimgrey: 0x696969,
    dodgerblue: 0x1E90FF,
    firebrick: 0xB22222,
    floralwhite: 0xFFFAF0,
    forestgreen: 0x228B22,
    fuchsia: 0xFF00FF,
    gainsboro: 0xDCDCDC,
    ghostwhite: 0xF8F8FF,
    gold: 0xFFD700,
    goldenrod: 0xDAA520,
    gray: 0x808080,
    green: 0x008000,
    greenyellow: 0xADFF2F,
    grey: 0x808080,
    honeydew: 0xF0FFF0,
    hotpink: 0xFF69B4,
    indianred: 0xCD5C5C,
    indigo: 0x4B0082,
    ivory: 0xFFFFF0,
    khaki: 0xF0E68C,
    lavender: 0xE6E6FA,
    lavenderblush: 0xFFF0F5,
    lawngreen: 0x7CFC00,
    lemonchiffon: 0xFFFACD,
    lightblue: 0xADD8E6,
    lightcoral: 0xF08080,
    lightcyan: 0xE0FFFF,
    lightgoldenrodyellow: 0xFAFAD2,
    lightgray: 0xD3D3D3,
    lightgreen: 0x90EE90,
    lightgrey: 0xD3D3D3,
    lightpink: 0xFFB6C1,
    lightsalmon: 0xFFA07A,
    lightseagreen: 0x20B2AA,
    lightskyblue: 0x87CEFA,
    lightslategray: 0x778899,
    lightslategrey: 0x778899,
    lightsteelblue: 0xB0C4DE,
    lightyellow: 0xFFFFE0,
    lime: 0x00FF00,
    limegreen: 0x32CD32,
    linen: 0xFAF0E6,
    magenta: 0xFF00FF,
    maroon: 0x800000,
    mediumaquamarine: 0x66CDAA,
    mediumblue: 0x0000CD,
    mediumorchid: 0xBA55D3,
    mediumpurple: 0x9370DB,
    mediumseagreen: 0x3CB371,
    mediumslateblue: 0x7B68EE,
    mediumspringgreen: 0x00FA9A,
    mediumturquoise: 0x48D1CC,
    mediumvioletred: 0xC71585,
    midnightblue: 0x191970,
    mintcream: 0xF5FFFA,
    mistyrose: 0xFFE4E1,
    moccasin: 0xFFE4B5,
    navajowhite: 0xFFDEAD,
    navy: 0x000080,
    oldlace: 0xFDF5E6,
    olive: 0x808000,
    olivedrab: 0x6B8E23,
    orange: 0xFFA500,
    orangered: 0xFF4500,
    orchid: 0xDA70D6,
    palegoldenrod: 0xEEE8AA,
    palegreen: 0x98FB98,
    paleturquoise: 0xAFEEEE,
    palevioletred: 0xDB7093,
    papayawhip: 0xFFEFD5,
    peachpuff: 0xFFDAB9,
    peru: 0xCD853F,
    pink: 0xFFC0CB,
    plum: 0xDDA0DD,
    powderblue: 0xB0E0E6,
    purple: 0x800080,
    rebeccapurple: 0x663399,
    red: 0xFF0000,
    rosybrown: 0xBC8F8F,
    royalblue: 0x4169E1,
    saddlebrown: 0x8B4513,
    salmon: 0xFA8072,
    sandybrown: 0xF4A460,
    seagreen: 0x2E8B57,
    seashell: 0xFFF5EE,
    sienna: 0xA0522D,
    silver: 0xC0C0C0,
    skyblue: 0x87CEEB,
    slateblue: 0x6A5ACD,
    slategray: 0x708090,
    slategrey: 0x708090,
    snow: 0xFFFAFA,
    springgreen: 0x00FF7F,
    steelblue: 0x4682B4,
    tan: 0xD2B48C,
    teal: 0x008080,
    thistle: 0xD8BFD8,
    tomato: 0xFF6347,
    turquoise: 0x40E0D0,
    violet: 0xEE82EE,
    wheat: 0xF5DEB3,
    white: 0xFFFFFF,
    whitesmoke: 0xF5F5F5,
    yellow: 0xFFFF00,
    yellowgreen: 0x9ACD32
};

/**
 * Readonly view of the public Color API.
 */
export type ReadonlyColor = PickReadonly<Color,
    'g' | 'r' | 'b' | 'isColor' | 'equals' | 'getHex'>;
