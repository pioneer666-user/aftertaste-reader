# Aftertaste Reader · 回甘

帮助项目作者对照源码与讲解，逐步读懂自己的项目。当前处于首版需求讨论阶段，尚无可安装产品。

## 当前文档

- [首版需求规格草稿](specs/001-first-release/spec.md)：已确认需求、候选名称、待讨论细则与验收场景。
- [需求质量检查](specs/001-first-release/checklists/requirements.md)：真实记录已覆盖和未解决部分。
- [作者原文与任务边界](../tasks/AR1-回甘首版需求设计/task.md)：保存在外层实验仓库的唯一原文。独立发布前需处理材料的可访问性。

## Spec Kit 使用依据

2026-11-14 通过 GitHub 官方仓库的 releases/latest 核实，最新稳定版为 [v1.4.0](https://github.com/github/spec-kit/releases/tag/v1.4.0)，发布于 2026-11-10。本轮固定引用该版本，不使用本机旧的 1.0.4 资料包。

采用官方的[需求规格模板](https://github.com/github/spec-kit/blob/v1.4.0/templates/spec-template.md)与[需求澄清方法](https://github.com/github/spec-kit/blob/v1.4.0/templates/commands/clarify.md)，以中文手工维护规格、澄清记录和质量检查。当前未安装 CLI、未初始化完整 Spec Kit 命令环境，也未执行其自动化命令；不将“参考模板完成记录”表述为“完整工作流已运行通过”。

作者 U1 要求优先于工具默认流程：

- 官方 specify 方法允许推测部分未明确需求；本项目涉及产品范围或体验的决定保留为待讨论，不推测为已确认。
- 澄清按具体场景逐步进行，不以模板问题数量限制为理由宣布其余缺口已经解决。
- 只有已确认的内容进入正式需求；AI 建议单独标记，作者原话不改写。
- 当前文档只覆盖已讨论部分，不为填满模板虚构性能数字、兼容范围、交互和功能。
- 需求未清楚、作者未决定进入实现前，不编写产品代码。
