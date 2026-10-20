# changelog

## 1.1.1

- `LodSplat`新增`pixelLimitEnabled`，默认开启；关闭后不再因像素密度限制停止 LOD 细化，仍遵守点数预算等约束。
- `LodSplat`适配 WebGPU 帧内排序，替换节点不再等待 CPU 排序事件，并处理上下文丢失及渲染器重置。
- 修复 sampler 与`SourceTexture`相互转换时忽略 TypedArray 的`byteOffset`和`byteLength`，错误使用整个底层缓冲的问题。
- 图片数据纹理改用`createImageBitmap`解码，关闭颜色空间转换及预乘 Alpha，避免改变编码数据。

# 1.1.0

- `LodSplat`对齐`Camera & LodContainer`坐标系，修复剔除等计算异常
- 重构`LodSplat`
    - 优化任务调度逻辑
    - 优化`level`计算逻辑
    - 支持利用体素数据进行遮挡降级

## 1.0.11

- `LodSplat`新增`setModifiers`接口用以支持动画
- `LodSplat`优化调度逻辑，目前视锥外会彻底卸载 block 用以优化超大场景下的画面质量
- `LodSplat`移除无效的`outsidePenalty` & `behindPenalty`等参数

## 1.0.10

- 升级依赖版本`@qunhe/egs: ^1.2.93`
- 移除 subgroup transform 相关支持
- 优化`LodSplat`的`debuggerEnabled`行为

## 1.0.9

- 改造为标准`ESM`
- lod 修复最低 level 总数大于 maxBudget 时加载残缺的异常
- lod 新增`mergeNodeEnabled`参数控制节点合并是否开启，用于降低调度峰值

## 1.0.8

- 优化`lod`调度实现，防止调度过程出现实际高斯点数量过大
- 新增`sort`行为相关实现和自动初始化

## 1.0.7

- 优化贴图尺寸计算
- 修正`LodMeta.version`类型错误
- `lod`新增`proxy`用以减少实际场景中`Splat`数量
    - 对于`pack & precalculate`步骤`gpu`开销减少 50%-90%

## 1.0.6

- 改进编码风格开启`verbatimModuleSyntax` & `isolatedModules`，迁移至`OXC`
- `combineSplatData` 支持传入目标 `SplatData`。

## 1.0.5

- 现在会及时提交贴图上传命令
- 修复`stateTexture`类型异常
- 重构`bvh`部分目前支持`center`和`ellipsoid`两种

## 1.0.4

- 升级 `typescript: ^6.0.3` & `tslib: ^2.8.1` & `@qunhe/egs: ^1.2.88`

## 1.0.3

- 修复`Lod`中`minLevel`可能不生效的问题
- 优化`Lod`调度算法

## 1.0.2

- 修复`Lod`当相机在包围盒内权重计算问题
- 优化`Lod`调度，依照距离计算level步进(可配置)
- 修复`dts-rollup`

## 1.0.1

- 迁移至新材质结构

## 1.0.0

- init
