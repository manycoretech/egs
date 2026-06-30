import {
    Group,
    Object3D,
    Matrix4,
    LineSegments,
    Line,
    Mesh,
    Points,
    SkinnedMesh,
    TypeAssert,
    type BufferAttribute,
} from '@qunhe/egs';
import type { ResourceManager } from './resource.js';
import {
    type IScene,
    type INode,
    type IMesh,
    type ISkin,
    type IAnimation,
    type Animation,
    type AnimationTrack,
    type GLTF,
    PrimitiveMode,
    type ISkeleton,
} from './type.js';
import { DEFAULT_MATERIAL, INTERPOLATION } from './const.js';
import { normalizedAttributeBuffer } from './utils.js';
import { AnimationPointerExtension } from './extensions/index.js';

export interface ParseCtx {
    scenes: IScene[];
    nodes: INode[];
    meshes: IMesh[];
    skins: ISkin[];

    source: GLTF;
    resource: ResourceManager;
    extensions: Record<string, any>;
    skinnedMeshFlags: Record<number, boolean>;
    skeletons: Map<ISkeleton, SkinnedMesh[]>;

    nodeMap: Map<number, Promise<Object3D>>;
    meshMap: Map<number, Promise<Object3D>>;
    skinMap: Map<number, Promise<ISkeleton>>;

    componentMap: Map<Object3D, Object3D>;
    boneSet: Set<Object3D>;
}

export async function parseScene(meta: IScene, ctx: ParseCtx) {
    const scene = new Group();
    if (!meta) {
        console.warn('EGS.GLTFLoader: Scene not found.');
        return scene;
    }

    if (meta.name) {
        scene.name = meta.name;
    }

    const nodes = await Promise.all((meta.nodes || []).map(node => parseNode(node, ctx)));
    scene.add(nodes);

    return scene;
}

async function parseNode(index: number, ctx: ParseCtx): Promise<Object3D> {
    const { nodes, nodeMap, skeletons } = ctx;

    let result = nodeMap.get(index);
    if (result) {
        return result;
    }

    const meta = nodes[index];

    if (meta.mesh !== undefined) {
        result = parseMesh(meta.mesh, ctx);
    } else if (meta.camera !== undefined) {
        console.warn('EGS.GLTFLoader: Camera not supported.');
        result = Promise.resolve(new Object3D());
    }

    if (!result) {
        result = Promise.resolve(new Object3D());
    }

    const children = (meta.children || []).map(child => parseNode(child, ctx));
    const skeleton = meta.skin !== undefined ? parseSkin(meta.skin, ctx) : undefined;

    result = Promise.all([result, Promise.all(children), skeleton]).then(([node, children, skeleton]) => {
        if (meta.name) {
            node.name = meta.name;
        }

        if (meta.matrix) {
            const matrix = new Matrix4();
            matrix.fromArray(meta.matrix);
            node.applyMatrix(matrix);
        } else {
            if (meta.translation) {
                node.position.fromArray(meta.translation);
            }
            if (meta.rotation) {
                node.quaternion.fromArray(meta.rotation);
            }
            if (meta.scale) {
                node.scale.fromArray(meta.scale);
            }
        }

        if (skeleton) {
            if (TypeAssert.isSkinnedMesh(node)) {
                const skinnedMeshes = skeletons.get(skeleton);
                if (skinnedMeshes !== undefined) {
                    skinnedMeshes.push(node);
                } else {
                    skeletons.set(skeleton, [node]);
                }
                // to opt
            } else if (node.children.length > 0) {
                const skinnedMeshes = skeletons.get(skeleton) ?? [];
                node.children.forEach(child => {
                    if (TypeAssert.isSkinnedMesh(child)) {
                        skinnedMeshes.push(child);
                    }
                });
                skeletons.set(skeleton, skinnedMeshes);
            } else {
                console.warn('EGS.GLTFLoader: skeleton invalid.');
            }
        }

        node.add(children);

        return node;
    });

    nodeMap.set(index, result);

    return result;
}

function parseMesh(index: number, ctx: ParseCtx): Promise<Object3D> {
    const { meshes, meshMap, skinnedMeshFlags, resource, componentMap } = ctx;
    // TODO: As one mesh in gltf can be shared by different nodes, it should not cached as Object3D directly.
    // let result = meshMap.get(index);
    // if (result) {
    //     return result;
    // }

    const meta = meshes[index];
    if (!meta) {
        return Promise.resolve(new Object3D());
    }

    const isSkinnedMesh = skinnedMeshFlags[index];

    const meshList: Array<Promise<Object3D>> = [];
    const primitives = meta.primitives;
    for (let i = 0; i < primitives.length; i++) {
        const primitive = primitives[i];
        const geometry = resource.getGeometry(primitive);
        const material =
            primitive.material !== undefined
                ? resource.getMaterial(primitive.material)
                : Promise.resolve(DEFAULT_MATERIAL);
        const mesh = Promise.all([geometry, material]).then(([geometry, material]) => {
            const mode = primitive.mode ?? PrimitiveMode.TRIANGLES;
            let mesh: Object3D;
            if (mode === PrimitiveMode.TRIANGLES) {
                if (isSkinnedMesh) {
                    const skinnedMesh = new SkinnedMesh(geometry, material);
                    mesh = skinnedMesh;
                } else {
                    mesh = new Mesh(geometry, material);
                }
            } else if (mode === PrimitiveMode.LINE_STRIP) {
                mesh = new Line(geometry.forceCastTopology(), material);
            } else if (mode === PrimitiveMode.LINES) {
                mesh = new LineSegments(geometry.forceCastTopology(), material);
            } else if (mode === PrimitiveMode.POINTS) {
                mesh = new Points(geometry.forceCastTopology(), material);
            } else {
                console.warn('EGS.GLTFLoader: Unsupported primitive mode.');
                mesh = new Object3D();
            }
            if (meta.name) {
                mesh.name = meta.name;
            }

            return mesh;
        });
        meshList.push(mesh);
    }
    const result = Promise.all(meshList).then(list => {
        if (list.length === 1) {
            return list[0];
        }
        const res = new Object3D();
        res.add(list);
        list.forEach(component => {
            componentMap.set(component, res);
        });
        return res;
    });

    meshMap.set(index, result);

    return result;
}

function parseSkin(index: number, ctx: ParseCtx): Promise<ISkeleton> {
    const { skins, skinMap, resource, boneSet } = ctx;

    let result = skinMap.get(index);
    if (result) {
        return result;
    }

    const meta = skins[index];
    if (!meta) {
        console.warn(`EGS.GLTFLoader: Skin<${index}> not found.`);
        return Promise.resolve({ bones: [], inverseBindMatrices: [] });
    }

    const joints = Promise.all(meta.joints.map(joint => parseNode(joint, ctx)));
    const inverseBindMatrices =
        meta.inverseBindMatrices !== undefined ? resource.getAccessor(meta.inverseBindMatrices) : undefined;

    result = Promise.all([joints, inverseBindMatrices]).then(([joints, inverseBindMatrices]) => {
        const bones: Object3D[] = [];
        const boneInverses: Matrix4[] = [];
        for (let i = 0; i < joints.length; i++) {
            bones.push(joints[i]);
            boneSet.add(joints[i]);
            const inverseBindMatrix = new Matrix4();
            if (inverseBindMatrices) {
                inverseBindMatrix.fromArray(inverseBindMatrices.array, i * 16);
            }
            boneInverses.push(inverseBindMatrix);
        }
        return { bones, inverseBindMatrices: boneInverses };
    });

    skinMap.set(index, result);

    return result;
}

let animationCounts: number = 0;
export async function parseAnimation(meta: IAnimation, ctx: ParseCtx): Promise<Animation> {
    const { resource, nodes, source, extensions } = ctx;
    const animationPointerExtension = extensions[AnimationPointerExtension.EXTENSION_NAME] as
        | AnimationPointerExtension
        | undefined;
    const { channels, samplers } = meta;

    const targets: Array<Pick<AnimationTrack, 'path' | 'interpolation'>> = [];
    const pendingInputAccessors: Array<Promise<BufferAttribute>> = [];
    const pendingOutputAccessors: Array<Promise<BufferAttribute>> = [];
    for (let i = 0; i < channels.length; i++) {
        const channel = channels[i];
        const target = channel.target;

        let path: string | undefined;

        if (animationPointerExtension) {
            const pointer = animationPointerExtension.parse(target);
            if (pointer) {
                const material = (source.materials || [])[pointer.index];
                if (!material || !material.name) {
                    console.warn('EGS.GLTFLoader: AnimationChannel not found material.');
                    continue;
                }
                path = `Materials/${material.name}.${pointer.path}`;
            }
        }

        if (path === undefined) {
            if (target.node === undefined) {
                continue;
            }
            const node = nodes[target.node];
            if (!node) {
                console.warn('EGS.GLTFLoader: AnimationChannel not found target node.');
                continue;
            }
            switch (target.path) {
                case 'rotation':
                case 'scale':
                case 'translation':
                case 'weights':
                    path = `${node.name}.${target.path}`;
                    break;
                default:
                    break;
            }
        }

        if (!path) {
            console.warn('GLTFLoader: AnimationChannel path is unsupported.');
            continue;
        }

        const sampler = samplers[channel.sampler];
        const interpolation =
            sampler.interpolation !== undefined ? INTERPOLATION[sampler.interpolation] : INTERPOLATION.LINEAR;
        if (interpolation === undefined) {
            console.warn('GLTFLoader: interpolation type is unsupported.');
            continue;
        }

        targets.push({ path, interpolation });
        pendingInputAccessors.push(resource.getAccessor(sampler.input));
        pendingOutputAccessors.push(resource.getAccessor(sampler.output));
    }

    const [inputAccessors, outputAccessors] = await Promise.all([
        Promise.all(pendingInputAccessors),
        Promise.all(pendingOutputAccessors),
    ]);

    const tracks: AnimationTrack[] = [];
    for (let i = 0; i < targets.length; i++) {
        const { path, interpolation } = targets[i];
        const inputAccessor = inputAccessors[i];
        const outputAccessor = outputAccessors[i];
        tracks.push({
            path,
            times: inputAccessor.array,
            values: normalizedAttributeBuffer(outputAccessor),
            interpolation,
        });
    }

    return {
        name: meta.name ? meta.name : 'untitled_animation_' + animationCounts++,
        tracks,
    };
}
