import type { Object3D, Texture, SkinnedMesh } from '@qunhe/egs';
import { TextureTransformExtension, MaterialsUnlitExtension, AnimationPointerExtension } from './extensions';
import { parseGLTF } from './parseGLTF';
import { ResourceManager } from './resource';
import { type ParseCtx, parseScene, parseAnimation } from './parse';
import type { GLTF, Animation, ISkeleton } from './type';

export interface LoaderConfig {
    textureLoader: (url: string) => Promise<Texture>;
}

export interface ParseResult {
    source: GLTF;
    scene: Object3D;
    scenes: Object3D[];
    animations: Animation[];
    skeletons: Map<ISkeleton, SkinnedMesh[]>;
    componentMap: Map<Object3D, Object3D>;
}

export async function loadGLTF(data: ArrayBuffer | string, config: LoaderConfig): Promise<ParseResult> {
    const { data: gltf, binaryBuffer } = parseGLTF(data);

    const { asset, extensionsUsed = [], extensionsRequired = [] } = gltf;
    if (!asset || parseInt(asset.version[0], 10) < 2) {
        throw new Error('EGS.GLTFLoader: Unsupported asset. glTF versions >=2.0 are supported.');
    }

    const extensions: Record<string, any> = {};
    for (let i = 0; i < extensionsUsed.length; ++i) {
        const extensionName = extensionsUsed[i];
        switch (extensionName) {
            case TextureTransformExtension.EXTENSION_NAME: {
                extensions[extensionName] = new TextureTransformExtension();
                break;
            }
            case MaterialsUnlitExtension.EXTENSION_NAME: {
                extensions[extensionName] = new MaterialsUnlitExtension();
                break;
            }
            case AnimationPointerExtension.EXTENSION_NAME: {
                extensions[extensionName] = new AnimationPointerExtension();
                break;
            }
            default: {
                if (extensionsRequired.indexOf(extensionName) >= 0) {
                    console.warn('EGS.GLTFLoader: Unknown extension "' + extensionName + '".');
                }
            }
        }
    }

    const skinnedMeshFlags: Record<number, boolean> = {};
    {
        const nodes = gltf.nodes || [];
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            if (node.mesh !== undefined && node.skin !== undefined) {
                skinnedMeshFlags[node.mesh] = true;
            }
        }
    }

    const resource = new ResourceManager(gltf, {
        binaryBuffer,
        extensions,
        textureLoader: config.textureLoader,
    });
    const ctx: ParseCtx = {
        scenes: gltf.scenes || [],
        nodes: gltf.nodes || [],
        meshes: gltf.meshes || [],
        skins: gltf.skins || [],

        source: gltf,
        resource,
        extensions,
        skinnedMeshFlags,

        skeletons: new Map(),
        nodeMap: new Map(),
        meshMap: new Map(),
        skinMap: new Map(),

        componentMap: new Map(),
        boneSet: new Set(),
    };

    const scenes = Promise.all(ctx.scenes.map(scene => parseScene(scene, ctx)));
    const animations = Promise.all((gltf.animations ?? []).map(animation => parseAnimation(animation, ctx)));

    return Promise.all([scenes, animations]).then(([scenes, animations]) => {
        // remove bone tree from scene
        const skeletons = Array.from(ctx.skeletons.keys());
        for (let i = 0; i < skeletons.length; i++) {
            const parentNode = skeletons[i].bones[0].parent;
            if (parentNode && !ctx.boneSet.has(parentNode)) {
                skeletons[i].bones[0].removeFromParent();
            }
        }
        return {
            source: gltf,
            scenes,
            scene: scenes[gltf.scene ?? 0],
            animations,
            skeletons: ctx.skeletons,
            componentMap: ctx.componentMap,
        };
    });
}
