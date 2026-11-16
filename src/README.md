# 产品源码

TypeScript、Vue 阅读器和本地服务的正式实现根。当前已实现固定提交取源，入口为 `application/fixed-source.ts`，Git 适配在 `adapters/git-source.ts`，命令入口在 `cli/main.ts`。调用约定见 [002](../specs/002-fixed-source/contracts/cli.md)。

内部按 `core/`、`application/`、`adapters/`、`cli/`、`server/`、`web/`、`export/` 分工；各子目录在对应任务实现时建立。职责和依赖方向统一见[目录规范](../docs/development/directories.md)，质量要求见[工程约定](../docs/development/engineering.md)。

产品不得依赖 experiments、.local、开发用 .agents 或本机 .tools。面向讲解 AI 的命令在本源码树实现，产品 Skill 只指导调用，不复制业务代码。
