# 产品源码

TypeScript、Vue 阅读器和本地服务的正式实现根。当前固定提交取源入口为 `application/fixed-source.ts`，Git 适配在 `adapters/git-source.ts`。单篇文档的纯解析与校验在 `core/document-blocks.ts`，用例在 `application/document-blocks.ts`，磁盘读写在 `adapters/document-store.ts`。共用命令入口为 `cli/main.ts`，调用约定见 [002](../specs/002-fixed-source/contracts/cli.md) 和 [003](../specs/003-document-blocks/contracts/cli.md)。

内部按 `core/`、`application/`、`adapters/`、`cli/`、`server/`、`web/`、`export/` 分工；各子目录在对应任务实现时建立。职责和依赖方向统一见[目录规范](../docs/development/directories.md)，质量要求见[工程约定](../docs/development/engineering.md)。

产品不得依赖 experiments、.local、开发用 .agents 或本机 .tools。面向讲解 AI 的命令在本源码树实现，产品 Skill 只指导调用，不复制业务代码。
