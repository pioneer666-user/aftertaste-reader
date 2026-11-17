# 单篇文档可重跑验证

在本仓库根的 PowerShell 使用 Node 24、Git 及 npm。先安装锁定依赖并构建。

```powershell
npm.cmd ci --ignore-scripts
npm.cmd run build
node tests/fixtures/document-blocks.mjs --demo
```

最后一条创建 `.local/D008/run-*/` 合成 Git 子项目，在内存中调用真实 CLI 完成 pin A、创建两类混合骨架、填写合成讲解、校验、修改工作区及 HEAD、再次校验。输出只有样例位置、完整提交、各阶段状态与块 ID。每次使用新目录，可重复运行。预期 generated=true，骨架 contentStatus=unfilled，填写后 provided，修改后仍为原 A 且 mechanicallyValid=true。

单独操作时从示例返回的 projectRoot/repositoryRoot/projectPrefix/commit 组成参数，调用 [CLI 契约](contracts/cli.md) 中两条命令。创建输入包含完整固定映射，校验提交从头取。重复创建应 DOCUMENT_EXISTS/1，覆盖缺口校验退出 1 并保留原文，所有过程不保存取源正文。

正式检查按顺序执行。

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd test
```

命令契约及行数、填写状态详见 [模型](data-model.md)。测试使用合成材料，不在开发仓库根写 docs/aftertaste，不声称判断教学质量或页面体验。
