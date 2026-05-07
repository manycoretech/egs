import { WGLCapabilities } from '../WGLCapabilities';
import { WGLExtensions, WebGLExtEnums } from '../WGLExtensions';

export class AttributeState {
    readonly gl: WebGL2RenderingContext | WebGLRenderingContext;
    private newAttributes: Uint8Array;
    private enabledAttributes: Uint8Array;
    private attributeDivisors: Uint8Array;
    private extensions: WGLExtensions;

    constructor(gl: WebGL2RenderingContext | WebGLRenderingContext, extensions: WGLExtensions) {
        this.gl = gl;
        const maxVertexAttributes = WGLCapabilities.MAX_ATTRIBUTES;
        this.newAttributes = new Uint8Array(maxVertexAttributes);
        this.enabledAttributes = new Uint8Array(maxVertexAttributes);
        this.attributeDivisors = new Uint8Array(maxVertexAttributes);
        this.extensions = extensions;
    }

    public initAttributes(): void {
        for (let i = 0, l = this.newAttributes.length; i < l; i++) {
            this.newAttributes[i] = 0;
        }
    }

    public enableAttribute(attributeLocation: number): void {
        this.enableAttributeAndDivisor(attributeLocation, 0);
    }

    public enableAttributeAndDivisor(attributeLocation: number, meshPerAttribute: number): void {
        // we don't need to set this when VAO is enabled, it's kind of local thing
        if (WGLCapabilities.IS_SUPPORT_VAO) {
            this.gl.enableVertexAttribArray(attributeLocation);
        } else {
            this.newAttributes[attributeLocation] = 1;
            if (this.enabledAttributes[attributeLocation] === 0) {
                this.gl.enableVertexAttribArray(attributeLocation);
                this.enabledAttributes[attributeLocation] = 1;
            }
        }

        if (WGLCapabilities.IS_SUPPORT_INSTANCE && meshPerAttribute > 0) {
            const extension = WGLCapabilities.IS_WEBGL2 ? this.gl : this.extensions.get(WebGLExtEnums.ANGLE_instanced_arrays);
            extension[WGLCapabilities.IS_WEBGL2 ? 'vertexAttribDivisor' : 'vertexAttribDivisorANGLE'](attributeLocation, meshPerAttribute);
            this.attributeDivisors[attributeLocation] = meshPerAttribute;
        }
    }

    public disableUnusedAttributes(): void {
        for (let i = 0, l = this.enabledAttributes.length; i !== l; ++i) {
            if (this.enabledAttributes[i] !== this.newAttributes[i]) {
                this.gl.disableVertexAttribArray(i);
                this.enabledAttributes[i] = 0;
            }
        }
    }

    public reset() {
        for (let i = 0; i < this.enabledAttributes.length; i++) {
            if (this.enabledAttributes[i] === 1) {
                this.gl.disableVertexAttribArray(i);
                this.enabledAttributes[i] = 0;
            }
        }
    }
}
