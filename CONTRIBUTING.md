# CHANGELOG 规范

代码递交的同时，应该维护 CHANGELOG.md 文件，好的变更记录是一份写给开发者和使用者的项目的编年史，记录了每个版本中包含值得注意的变更。
EGS 开发者可以快速追溯哪个版本发生了什么，并很快理解为什么和做了什么；
EGS 的使用者，可以知道新版本的摘要，应该使用哪个版本，有什么影响。
代码递交同时写好记录，填写到`DEV`版本，发布的时候填写适合的版本号。
发包时，要对比当前 master 和 tag 下的上一个版本代码，确认 CHANGELOG 内容，然后填写发布的版本号。

**任意修改**都需要添加修改日志

1. 版本号应当遵守语义规则：

   - 版本号由三部分构成: Major.Minor.Patch
   - 只有 Patch 号变动，应当 API 完全兼容。
   - Major/Minor 变化，则可能包含 API breaking change。

2. 记录按更新内容性质不同分以下分类：

   - 新功能：新增的的行为、特性、API 等
   - 修复: bug 修复、错误处理等。
   - 优化: 内部实现改进，性能优化等
   - Breaking Changes：存在破坏性改动，比如 接口改变，EGS 依赖的包有 API 变更（依赖传递）等

3. 示例

```markdown
## 1.0.0
1. 新功能
    - 增加`MeshPhongMaterial`
2. 修复
    - 修复`MeshBasicMaterial`无法正常使用的问题
3. 优化
    - 优化`Renderer`构建路径减少复杂度
4. **<font color="red">Breaking Changes</font>**
    - 移除`Raycaster.getPrecisionToleranceSq`
```

**一个 MR 中包含多条改动，需要填写多条**

**一条改动如果可以被分到多类上需要写在影响较大的分类下，例如存在破坏性改动的那么必须在 Breaking Changes 下**

3. "## DEV"版本号用法：
   - **未发布之前不修改正式版本号**
   - 这里写下一次发布里会包含的记录。
   - 发布时根据修改日志和版本号规则更新版本号，并将 `DEV` 条目内容移动到对应版本号上
   - 发新包的时候，填写适当的版本号，**额外需要注意先不填写新的`DEV`，等发包以后再写入**。

## 参考

- https://www.turnkeylinux.org/blog/changelog-writing
- https://keepachangelog.com/en/0.3.0/
- http://blog.clojurewerkz.org/blog/2013/09/07/how-to-write-a-useful-change-log/
