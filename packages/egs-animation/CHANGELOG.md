## Changelog

## 1.1.0

- 升级 `typescript: ^6.0.3` & `tslib: ^2.8.1` & `@qunhe/egs: ^1.2.88`

## 1.0.5

- 修复类型名称
- 修复`DiscreteInterpolant`在关键帧区间内取值不符合STEP插值语义的问题

## 1.0.4

- 修复动画时间等于关键帧时间时更新异常的问题

## 1.0.3

- 修复 Uv 动画更新逻辑，使其正确触发场景更新

## 1.0.2

- `AnimationMixer`新增构建参数`useCache`,设置为 false 时`clipAction`不会使用缓存

## 1.0.1

- 优化 WebGPU 版本中的骨骼动画更新性能
- 优化`AnimationPlugin.registerToViewer`实现减少不必要的接口

## 1.0.0

- 提供 EGS 相关的动画包，可以支持 transform、skeleton 以及 uv 动画。
