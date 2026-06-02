# EGS 发布说明 Release Notes

## DEV

1. 修复
    - `SourceTexture`移除`internal`标记
    - 现在会及时提交贴图更新命令
    - 修复`MeshPhongMaterial.setValues`, `MeshBasicMaterial.setValues`类型不正确的问题
    - 移除`ShaderBlendParameter`泛型
    - `export type`被错误重写的问题
2. 优化
    - 改进`api`文档

## 1.2.88

1. 新功能
    - 升级 `typescript: ^6.0.3` & `tslib: ^2.8.1`
2. 修复
    - `ContentBridge`缺失`normalized`
3. 优化
    - `__INNER__`替换为`__INTERNAL__` (仅类型)

## 1.2.87

1. 修复
    - `SnapshotRenderV2`中监听`SplatSortedEvent`没有及时移除的问题

## 1.2.86

1. 修复
    - `SnapshotRenderV2`渲染异步的问题

## 1.2.85

1. 修复
    - `Splatting`排序可能出现报错的问题
    - `dts-rollup`缺失

## 1.2.84

1. 优化
    - 改进贴图类型兼容，支持新贴图结构
        - 部分内部类型移除旧贴图兼容
2. 修复
    - `SourceTexture`重建后`sampler`没有同步的问题

## 1.2.83

1. 新功能
    - `Background`,`Ground`支持修改`up`以兼容不同坐标系(默认+Z)
        - 增加`Background.up`配置
    - `EnvMapBackground`增加`reverseVertical`选项
    - 新增`3D Gaussian Splatting`支持
2. 优化
    - `readPixelsAsync/readPixels`移除`checkFramebufferStatus`
    - 移除部分导出，仅内部使用，意外导出类型，裁剪部分接口
    - 优化`Background`相关实现，移除`Camera`结构
    - `IRenderer`新增`queueFlushTexture`接口用于手动添加一个将材质更新到GPU的任务
    - 新增`TextureFormat`，对齐`GPUTextureFormat`，用于新的内部材质
    - 新增`SourceTexture`通用含数据贴图容器，支持修改重传，构造后不允许修改显存相关参数
    - 简化`RenderAttachment`，构造后不允许修改显存相关参数
    - 移除`arraybuffer-loader`
    - 内联小型图片资源
    - 标准化部分枚举名称

## 1.2.82

1. 修复
    - 修复`MeshBVH`构造异常

## 1.2.81

1. 修复
    - 修复`indexEdgeThickness`,`normalEdgeThickness`,`depthEdgeThickness`可能不生效的问题
2. 优化
    - 新增`SpriteBufferGeometry`用于内部处理

## 1.2.80

1. 新功能
    - 兼容WebXR
2. 修复
    - 修复在某些情况下`Sprite`未能在`transparentLine`模式下正确渲染的问题
3. 优化
    - 允许自定义内部使用的`raf`，用以兼容WebXR

## 1.2.79

1. 新功能
    - `stylizeFilter`支持`target`用以控制应用范围
        - `applyToBackgroundAndGround`已废弃
2. 优化
    - 移除`StylizePlugin`的`applyToBackgroundAndGround`配置
        - 使用`target`替代

## 1.2.78

1. 新功能
    - 添加`ToneMapping`相关资源
    - `FilterMaterial`添加`hue`支持
        - 优化`FilterMaterial`应用目标

## 1.2.75(alias: 1.2.76, 1.2.77)

1. 优化
    - 改进`ContentBridge.bufferAttributeSetData`入参

## 1.2.74

1. 新功能
    - `MeshBasicMaterial`支持通过`enableVertexColor`开启顶点颜色渲染
    - `Texture2D`添加`HTMLVideoElement`、`VideoFrame`、`OffscreenCanvas`支持
        - `VideoFrame`由于`ts3.8`类型缺失暂不对外
2. 优化
    - 移除`ShaderVaryingTypes`中`vertexColor4&vTextureId&v_maskUV`

## 1.2.73

1. 优化
    - 部分基础lib迁移至`@qunhe/egs-lib`

## 1.2.72

1. 新功能
    - 添加`BC7`,`ETC2`压缩纹理支持
    - 规范化`BCN`,`ASTC`系列压缩纹理格式命名
        - 旧格式标记为弃用，添加等价替换
        - `DXT1` -> `BC1`, `DXT3` -> `BC2`, `DXT5` -> `BC3`
        - `ASTC`系列添加`UNORM`结尾描述
    - 添加 WebGPU 管线 `BC7` 压缩支持
        - 目前默认使用 `BC7`（原为 `BC3HighQuality`）
    - 添加`SRGB`压缩纹理格式
2. 优化
    - 移除`WGLConstantsConvertor.convertCompressedPixelFormat`

## 1.2.71

1. 修复
    - 修复点 pick 计算屏幕空间 tolerance 不正确的问题
    - `RenderColorAttachmentNode.formatKey`未包含`mipmap`的问题
    - `clear`可能没有正确clear的问题
2. 新功能
    - `Intersection`添加标准化`primitiveIndex`
3. 优化
    - 移除`Renderer.resolveTargetContent`, 采用pass进行控制
    - 精简`IRenderer`接口
        - `beginPass`, `endPass`, `flushCommands`现在为必选接口
        - 移除`getClearColor`,`getClearAlpha`,`setClearAlpha`,`clearColor`,`clearDepth`,`clearStencil`,`setClearStencil`,`getViewport`
4. **<font color="red">Breaking Changes</font>**
    - 移除`Raycaster.getPrecisionToleranceSq`(未使用)

## 1.2.70

1. 优化
    - 重命名`TargetAttachment` -> `RenderAttachment`

## 1.2.69

1. 修复
    - `Outline`管线开启时在发生窗口 resize 造成大量错误 log 的问题

## 1.2.68

1. 修复
    - 修复`Material.colorWriteMasks`不能正确生效的问题
    - 修复`Viewport.snapshotRenderResult`默认大小不正确的问题
    - 修复`resolution`可能不正确的问题
2. 优化
    - `PassNode`支持完全自定义
    - `Texture`加入`dimension`和`viewDimension`
    - `RenderTarget`加入第三维度
    - `RenderAttachmentNode`与`RenderTargetNode`管理采用`TextureViewDimension`
    - 改进`TargetTexture`结构
        - 重命名`TargetTexture` -> `TargetAttachment`
        - `TargetAttachment`现在兼容所有类型(2D,3D,Cube,2DArray,Depth,Color)
3. **<font color="red">Breaking Changes</font>**
    - 移除`Viewer.enableGpuDrivenCompressedTexture`, `Viewer.enableGpuDrivenHighQualityCompression`(未使用)
    - 移除`RenderProxyManager.enableGpuDrivenCompressedTexture`, `RenderProxyManager.enableGpuDrivenHighQualityCompression`(未使用)
    - 移除`ViewerConfig.gpuDriven.compressedTextureEnabled`, `ViewerConfig.gpuDriven.highQualityCompressionEnabled`(未使用)

## 1.2.66(alias: 1.2.67)

1. 修复
    - `HighlightPlugin`在`RenderTarget`销毁后任然持有资源的问题

## 1.2.65

1. 新功能
    - `OIT`支持 MSAA(仅 WebGPU)
    - `viewport`支持独立修改`DrivenCullingConfig`
2. 修复
    - 正交相机默认关闭遮挡剔除
    - 修复`PopMerge`结果在移动端渲染异常
3. 优化
    - 上报持续性`validation`失败
    - 新增`ApplicationTimer`用于记录应用关键时间节点
    - 移除`enableMultiSample`中默认关闭`stencil`
        - `enableMultiSample`节点手动添加`disableStencil`
    - 优化`RenderTarget`重新实现`RenderTarget`和`TargetTexture`相关实现，重新实现`RenderTargetNode`
    - `viewer.readRenderResult`增加弃用相关错误信息
4. 其他
    - 同步`1.1.252`

## 1.2.64

1. 其他
    - 新增部分 WASM 移除功能
    - 同步`1.1.251`

## 1.2.62(alias: 1.2.63)

1. 改进
    - 增加`occlusionCullingBias`参数用于减少自遮挡问题

## 1.2.60(alias: 1.2.61)

1. 其他
    - 同步`1.1.250`

## 1.2.58(alias: 1.2.59)

1. 修复
    - 新建`Viewer`时`gpuDriven`没有按照标记启用的问题
2. 改进
    - `Bridge`动态初始化采用`Viewer.instances`

## 1.2.56(alias: 1.2.57)

1. 修复
    - 修复`Capabilities`部分参数可能不正确的问题
2. 其他
    - 新增`afterFrameRender`内部接口
    - `IRenderer.beforeFrameRender` & `IRenderer.afterFrameRender`增加`FrameId`参数
    - 新增`WebGPUUnstable`事件

## 1.2.55

1. 修复
    - 修复`Capabilities`初始化状态

## 1.2.54

1. 优化
    - 移除对 WebGLExtensions 的强依赖
    - 添加`data-engine`
2. 其他
    - 同步 1.1.247

## 1.2.51(alias: 1.2.52, 1.2.53)

1. 优化
    - 优化内部`frameId`记录时机

## 1.2.50

1. 优化
    - 优化内部`frameId`记录时机

## 1.2.49

1. 优化
    - 优化内部`frameId`，现在`frameId`仅与`requestAnimationFrame`相关
2. 修复
    - 在启用`WebGPU`时替换`HTMLCanvasElement.toDataURL`与`HTMLCanvasElement.toBlob`实现，以确保其能正常工作
3. 其他
    - 同步`1.1.246`

## 1.2.48

1. 修复
    - `WeakCollections`移除合并产生的异常对象
    - `Quad`可能没有正确更新 uv 的问题
2. 优化
    - 移除不必要的环境检测 log
    - 添加废弃标记

## 1.2.40

1. 新功能
    - HZB 支持多视图
2. 优化
    - 默认开启`gpuDriven`
    - 优化`hzb`生成渲染
3. 修复
    - 修复`MixOITMaterial`中`texelFetch`坐标不正确的问题
4. **<font color="red">Breaking Changes</font>**
    - 弃用`ArrayCamera`支持
5. 其他
    - 同步`1.1.245`

## 1.2.39

1. 优化
    - `Renderer`初始化完成后`requestRender`

## 1.2.38

1. 优化
    - 优化动态载入初始状态同步

## 1.2.37

1. 修复
    - 修复`PassNode.configRenderPass`没有去完全执行的问题

## 1.2.36

1. 修复
    - 修复多`viewport`系统下 config 获取报错的问题

## 1.2.33

1. 修复
    - 修复不明原因造成内存异常增长

## 1.1.243

1. 优化
    - `ViewerPlugin.beforeRendering` & `ViewerPlugin.afterRendering`标记为可选参数以保证兼容性

## 1.2.28

1. 其他
    - 同步`1.1.243`

## 1.2.27

1. 优化
    - 减少因为页面大小变化导致部分资源失效后产生异常的 log
2. 新功能
    - 同步`1.1.242`, 主要包括动画相关实现

## 1.2.25(alias: 1.2.26)

1. 其他
    - 同步`1.1.241`

## 1.2.22(alias: 1.2.23, 1.2.24)

1. 其他
    - 同步`1.1.240`

## 1.2.16(alias: 1.2.17, 1.2.18, 1.2.19, 1.1.20, 1.2.21)

1. 其他
    - 同步`1.1.239`

## 1.2.15

1. 修复
    - Rename `OIT` -> `oit`保持兼容

## 1.2.13(alias: 1.2.14)

1. 修复
    - 修复`skyPre`可能无渲染结果的问题

## 1.2.12

1. 新功能
    - `shadowmap`支持`GpuDriven`渲染生成
2. 其他
    - 同步`1.1.237`

## 1.2.11

1. 修复
    - 修正`planar shadow`在 culling 阶段的实现
    - 修复修改`highlight`设置可能不生效的问题

## 1.2.10

1. 其他
    - 同步`1.1.236`

## 1.2.9

1. 其他
    - 同步`1.1.235`

## 1.2.8

1. 其他
    - 同步`1.1.234`

## 1.2.7

1. 其他
    - 同步`1.1.232`

## 1.2.4

1. 新功能
    - 新增`WebGL1`渲染后端计数
    - 移除 mac workaround

## 1.2.3

1. 新功能
    - 同步 1.1.231
    - 空闲时尝试回收长时间未使用的 GPU 资源(仅 WASM)

## 1.2.2

1. 新功能
    - 导出`env`相关变量
2. 修复
    - 修复类型导出裁剪遗漏

## 1.2.0

1. 新功能
    - 新增 WebGPU 支持，新增 WebGPU 高级管线
2. **<font color="red">Breaking Changes</font>**
    - 同步截图接口已废弃，在 WebGPU 渲染器下不再工作
