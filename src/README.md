# 产品源码

TypeScript、Vue 阅读器和本地服务的正式实现根。当前只有目录说明，没有产品代码或构建配置。

内部按 `core/`、`application/`、`adapters/`、`cli/`、`server/`、`web/`、`export/` 分工；各子目录在对应任务实现时建立。职责和依赖方向统一见[目录规范](../docs/development/directories.md)，质量要求见[工程约定](../docs/development/engineering.md)。

产品不得依赖 experiments、.local、开发用 .agents 或本机 .tools。面向讲解 AI 的命令在本源码树实现，产品 Skill 只指导调用，不复制业务代码。
