export const vertex = `#version 300 es
precision highp float;
precision highp int;

in vec3 position;

void main() {
    gl_Position = vec4(position, 1.0);
}
`;

export const fragment = `#version 300 es
precision highp float;
precision highp int;

uniform sampler2D map;

layout(location = 0) out vec4 fragOut0;

void main() {
    fragOut0 = texelFetch(map, ivec2(gl_FragCoord.xy), 0);
}
`;
