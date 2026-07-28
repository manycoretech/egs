## Changelog

## DEV

- 新增`framebufferScaleFactor`用于控制`WebXR`投影分辨率
- 新增`pixelRatio`用于控制`Viewer`渲染分辨率
    - 注意: 最终实际`Viewer`渲染分辨率 = `NativeFramebufferSize * framebufferScaleFactor * pixelRatio`
- 改造为标准`ESM`

## 1.0.0

- 初始实现
