# 文件图验证 quickstart

从仓库根用 Node 24，已有依赖时无需安装。默认 Node 非 24 时可在当前 PowerShell 临时将已有 .local/D008/runtime 加入 PATH（本机验证沿用此副本）；不改全局 Node。开发构建与下列命令串行执行：

```powershell
npm.cmd run typecheck
npm.cmd run build
node --test --test-concurrency=1 tests/unit/dependency-graph.test.mjs
node --test --test-concurrency=1 tests/integration/dependency-graph.test.mjs
node tests/fixtures/dependency-graph.mjs --demo
```

fixture 在 .local/D009/run-*/ 建合成 Git 仓库与子项目，从不同 cwd 调真实 CLI，按 A 提交登记、更新 service、重复提交、删除、检查，并故意提交非法输入和制造目标不可写。每步输出真实 status 与判定，最终输出样例目录；不在开发仓库根创建 docs/aftertaste。

正式测试验证 G01—G05：空图版本身份、项目映射、未登记与未核对/已核对无依赖、局部替换与循环、删除及降级、坏图保留、固定 A 不受 HEAD/工作区影响、缺对象仍可查询且检查失败。存储注入覆盖碰撞、部分写入、link/rename 失败、发布后清理失败和链接绕界；断言原图字节、输入和无关资料。

受共用目录/取源改动影响，另串行运行现有 tests/unit/fixed-source.test.mjs、tests/integration/fixed-source.test.mjs、tests/integration/document-blocks.test.mjs。不涉及服务/浏览器，作者体验不适用。实际执行与未验证平台以 D009 handoff 为准，不将本指南当成功记录。
