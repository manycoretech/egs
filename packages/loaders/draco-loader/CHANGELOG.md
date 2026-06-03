## Changelog

## DEV

- 移除`arraybuffer-loader`
- 升级 `typescript: ^6.0.3` & `tslib: ^2.8.1`
- 改进编码风格开启`verbatimModuleSyntax` & `isolatedModules`

## 1.0.2

- 支持解析 POINT_CLOUD 类型，需要传入 enableParsePointCloud 配置

## 1.0.1

- 支持解析`color`属性

## 1.0.0

- 升级`typescript`到`3.8.3`
- 包进行整体重写，定位为 egs 用于解析 draco 生成 IGeometry 用以方便构造 EGS.BufferGeometry.
