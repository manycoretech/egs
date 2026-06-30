# changelog

## DEV

- 改造为标准`ESM`

## 1.0.6

- 移除`sort`相关实现，`@qunhe/egs-splat-loader`只负责解析
- 调整内部文件结构
- 移除`@qunhe/egs`依赖

## 1.0.5

- 优化贴图尺寸计算
- 独立 sort worker 防止被解析长时间阻塞

## 1.0.4

- 改进编码风格开启`verbatimModuleSyntax` & `isolatedModules`，迁移至`OXC`
- `Worker`改进为`module`
- 排序 worker 支持 16-bit / 32-bit sort key
- 新增 32-bit radix sort 路径，用于高精度 splat 排序
- 排序接口字段统一为 `count` / `activeCount`

## 1.0.3

- 升级 `typescript: ^6.0.3` & `tslib: ^2.8.1` & `@qunhe/egs: ^1.2.88`
- 新增`spz v4`支持
- 新增`esz`格式支持，比`spz`体积小约 20%

## 1.0.2

- 修复`dts-rollup`

## 1.0.1

- 修复内部枚举命名

## 1.0.0

- init
