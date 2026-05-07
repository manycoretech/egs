import { Vector3 } from '../math/Vector3';
import { Matrix4 } from '../math/Matrix4';
import { OrthographicCamera } from '../scene/cameras/OrthographicCamera';
import { Box3 } from '../math/Box3';
import { Size } from '../utils/Utils';
import { RenderTarget, RenderAttachment } from '../elements/textures/RenderTarget';
import { SamplerDescriptor } from '../elements/textures/Texture';
import { WGLCapabilities } from '../renderer/webgl/WGLCapabilities';
import { TextureViewDimension, getDepthFormat, TextureFormat, TextureDimension } from '../elements/textures/types';
import { IRenderer } from '../renderer/IRenderer';

export enum SnapshotBoxPrecision {
    BoundingBox = 'BoundingBox',
    Vertex = 'Vertex',
}

export enum SnapshotAxisDirection {
    Top = 'top',
    Bottom = 'bottom',
    Left = 'left',
    Right = 'right',
    Front = 'front',
    Back = 'back',
}

export function computeProjectionSize(size: Vector3, type: SnapshotAxisDirection): Vector3 {
    // x, y represent the viewport width and height, z means the depth of view.
    switch (type) {
        case SnapshotAxisDirection.Front:
        case SnapshotAxisDirection.Back:
            return new Vector3(size.x, size.z, size.y);
        case SnapshotAxisDirection.Top:
        case SnapshotAxisDirection.Bottom:
            return new Vector3(size.x, size.y, size.z);
        case SnapshotAxisDirection.Left:
        case SnapshotAxisDirection.Right:
            return new Vector3(size.y, size.z, size.x);
    }
}

export function computeCameraPosition(size: Vector3, type: SnapshotAxisDirection): Vector3 {
    switch (type) {
        case SnapshotAxisDirection.Top:
            return new Vector3(0, 0, (size.z) / 2 + eps);
        case SnapshotAxisDirection.Bottom:
            return new Vector3(0, 0, -(size.z) / 2 - eps);
        case SnapshotAxisDirection.Front:
            return new Vector3(0, -(size.y) / 2 - eps, 0);
        case SnapshotAxisDirection.Back:
            return new Vector3(0, (size.y) / 2 + eps, 0);
        case SnapshotAxisDirection.Left:
            return new Vector3(-(size.x) / 2 - eps, 0, 0);
        case SnapshotAxisDirection.Right:
            return new Vector3((size.x) / 2 + eps, 0, 0);
    }
}

const eps = 0.001;
function computeCameraMatrix(size: Vector3, center: Vector3, type: SnapshotAxisDirection, camera: OrthographicCamera) {
    const tempMat = new Matrix4();
    const offset = (size.z / 2) + eps;
    //  we add 1 more offset here because of pop logic will cause the vertex run up to camera's near plane
    switch (type) {
        case SnapshotAxisDirection.Top:
            tempMat.set(1, 0, 0, center.x, 0, 1, 0, center.y, 0, 0, 1, center.z + offset, 0, 0, 0, 1);
            break;
        case SnapshotAxisDirection.Bottom:
            tempMat.set(-1, 0, 0, center.x, 0, 1, 0, center.y, 0, 0, -1, center.z - offset, 0, 0, 0, 1);
            break;
        case SnapshotAxisDirection.Front:
            tempMat.set(1, 0, 0, center.x, 0, 0, -1, center.y - offset, 0, 1, 0, center.z, 0, 0, 0, 1);
            break;
        case SnapshotAxisDirection.Back:
            tempMat.set(-1, 0, 0, center.x, 0, 0, 1, center.y + offset, 0, 1, 0, center.z, 0, 0, 0, 1);
            break;
        case SnapshotAxisDirection.Left:
            tempMat.set(0, 0, -1, center.x - offset, -1, 0, 0, center.y, 0, 1, 0, center.z, 0, 0, 0, 1);
            break;
        case SnapshotAxisDirection.Right:
            tempMat.set(0, 0, 1, center.x + offset, 1, 0, 0, center.y, 0, 1, 0, center.z, 0, 0, 0, 1);
            break;
    }
    camera.matrix = tempMat;
    camera.updateMatrixWorld(true);
}

// Setup camera here only for snapshot.
// extend the bounding of camera frustum to avoid precision issue;
export function setupCamera(camera: OrthographicCamera, worldBox: Box3, type: SnapshotAxisDirection): Size {
    const size = worldBox.getSize();
    const projectionSize = computeProjectionSize(size, type);
    const center = worldBox.getCenter(new Vector3());

    const halfX = projectionSize.x / 2;
    const halfY = projectionSize.y / 2;
    camera.left = -halfX;
    camera.right = halfX;
    camera.top = halfY;
    camera.bottom = -halfY;
    camera.near = 0.;
    camera.far = projectionSize.z + (2 * eps);
    camera.updateProjectionMatrix();
    computeCameraMatrix(projectionSize, center, type, camera);
    camera.up.set(0, 0, 1);
    if (type === SnapshotAxisDirection.Top || type === SnapshotAxisDirection.Bottom) {
        camera.up.set(0, 1, 0);
    }
    return {
        width: projectionSize.x,
        height: projectionSize.y,
    };
}

export function createRenderTarget(width: number, height: number, renderer: IRenderer, multiSample: boolean = false) {
    const target = new RenderTarget(width, height, 1, multiSample);
    const colorAttachment = new RenderAttachment(
        TextureDimension.D2, TextureViewDimension.D2,
        TextureFormat.Rgba8Unorm,
        width, height, 1,
        false, multiSample ? 4 : 1, false,
        SamplerDescriptor.CreateAttachmentSampler()
    );
    const depthFormat = getDepthFormat(true, renderer.backend);
    const depthAttachment = new RenderAttachment(
        TextureDimension.D2, TextureViewDimension.D2,
        depthFormat,
        width, height, 1,
        false, multiSample ? 4 : 1, !WGLCapabilities.IS_SUPPORT_DEPTH_TEXTURE,
        SamplerDescriptor.CreateDepthAttachmentSampler()
    );
    target.setAttachments([colorAttachment], depthAttachment);
    return target;
}
