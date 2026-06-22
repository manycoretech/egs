# changelog

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
