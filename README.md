# Aftertaste Reader · 回甘

帮助项目作者对照源码与讲解，逐步读懂自己的项目。当前处于首版需求讨论阶段，尚无可安装产品。

> **⚠ D-001 · 作者明确暂缓（2026-11-14，U10）**
>
> **网页运行方式尚未决定：单文件导出、本地服务，或服务兼导出。先讨论功能，再回来裁决。**
>
> 当前入口：[文档块与讲解组织](specs/001-first-release/06-document-blocks.md)，按 U13 先从块身份、源码映射等底层继续讨论。正式暂缓登记见[规格总入口](specs/001-first-release/spec.md)；没有作者明确指示，不新增待定项。

当前确认结果：[文档块与讲解组织](specs/001-first-release/06-document-blocks.md)。U12 已认可取消纯源码块、区分三种理解记录，并授权 AI 确定超大阈值：源码超过 60 行或讲解超过 1,200 个非空白字符，只警告并告知用户。

U14—U16 已认可连续源码范围、整文件完整覆盖，以及“文档路径＋块 ID”定位；块 ID 为 8 位随机小写字母和数字、同篇唯一，与阅读顺序分离。

## 当前文档

先读[规格总入口](specs/001-first-release/spec.md)。以下保留文档结构，当前按 U13 从文档块底层继续，D-001 仍暂缓：

1. [源码版本与更新依据](specs/001-first-release/01-source-version.md)：讲解对应哪一版源码、更新比较什么。
2. [资料目录与文件映射](specs/001-first-release/02-document-layout.md)：docs/aftertaste、命名、定位和资料归属。
3. [网页承载与技术选择](specs/001-first-release/03-web-delivery.md)：资料怎样进入阅读页，随后比较语言与框架。
4. [阅读模式](specs/001-first-release/04-reading-modes.md)：保留已确认的两种模式，基础讨论后继续完善。
5. [阅读记录与讲解反馈](specs/001-first-release/05-reading-feedback.md)：书签、注释与局部理解标记的方向和已确认部分。
6. [文档块与讲解组织](specs/001-first-release/06-document-blocks.md)：已认可的块规则与本轮明确提出的建议分开记录。

[需求质量检查](specs/001-first-release/checklists/requirements.md)记录未解决项。文档顺序表示讨论顺序，不代表技术方案已批准。

作者原文仍保存在外层实验仓库的[任务](../tasks/AR1-回甘首版需求设计/task.md)与[调整 U4—U16](../tasks/AR1-回甘首版需求设计/amendments.md)中，历史不搬移或重复抄写。这些链接在当前本机有效；独立克隆或发布前需处理原文交接。

## 仓库状态

2026-11-14 按作者 U4 初始化独立子 Git 仓库；初始提交 253c71a 保存此前的模式讨论文档。上层实验仓库忽略本目录，不使用 Git submodule。目前未配置远程或发布。首版仍在设计中，没有产品代码。

## Spec Kit 使用依据

2026-11-14 通过 GitHub 官方仓库的 releases/latest 核实，最新稳定版为 [v1.4.0](https://github.com/github/spec-kit/releases/tag/v1.4.0)，发布于 2026-11-10。本轮固定引用该版本，不使用本机旧的 1.0.4 资料包。

完整官方源码已下载到 [.tools/spec-kit/](.tools/spec-kit/)，来源、提交与压缩包校验值见[本地工具记录](.tools/README.md)。后续优先读取本地的[需求规格模板](.tools/spec-kit/templates/spec-template.md)、[需求澄清流程](.tools/spec-kit/templates/commands/clarify.md)和[技术设计模板](.tools/spec-kit/templates/plan-template.md)，无需反复联网查找。

当前采用官方结构，以中文手工维护需求、讨论记录和质量检查；未安装全局 CLI、未初始化自动化命令环境，也未运行实现工作流。完整工具源码是本地参考副本，不混入本产品实现，不把其内部 AGENTS.md 或示例当成本项目全局指令。

作者 U1 要求优先于工具默认流程：

- 官方 specify 方法允许推测部分未明确需求；本项目涉及产品范围或体验的决定保留为待讨论，不推测为已确认。
- 澄清按具体场景逐步进行，不以模板问题数量限制为理由宣布其余缺口已经解决。
- 只有已确认的内容进入正式需求；AI 建议单独标记，作者原话不改写。
- 当前文档只覆盖已讨论部分，不为填满模板虚构性能数字、兼容范围、交互和功能。
- 需求未清楚、作者未决定进入实现前，不编写产品代码。
- 按 U4 从底层约定开始讨论；所有设计决定与作者讨论或明确声明其性质，建议不能写成已批准要求。
