# Implementation Plan · 跨文件闭环讲解

**Branch** `codex/feat-loop-authoring` | **Date** 2026-11-18 | **Spec** [spec.md](spec.md)

**Input** [D015](../../docs/work/2026/11/D015-loop-authoring/task.md) 的 C01–C04。

## Summary

创建与读取沿用两类图共用的选填字段校验。步骤边、逐步库用法与所选文件用法快照分别读写。

**D050 增量** 选线和项目讲法都明确后才新建闭环，Skill 沿 [005 偏好模型](../005-generation-skill/data-model.md#讲解偏好)维护当前讲法。`loops.md` 用既有串讲、步骤正文和连线回答路线问题，讲法调节术语、例子与详略。原成果读回路径照常使用。

**D046 增量** 步骤可附 library_uses。制作输入和已存成品复用同一节点解析，检查步骤的库 ID 和本步文件在选定范围内，沿原成品冻结与读回流程传递。

Skill 引导选定有固定源码和有效讲解依据的路线。CLI 校验并一次发布闭环 current，随后独立从磁盘读回讲解，按原 Git 引用读取对应源码。

在输入和成品共用的节点解析中检查可选 annotation 字符串，沿已校验步骤保存。JSON 与 Markdown 读回都按步骤呈现；取源沿用该步骤的固定引用。

## Technical Context

**Language/Version** TypeScript 5.9、Node.js 24、Git 2.45+

**Primary Dependencies** 现有固定取源、文档块和依赖图模块，新增依赖为零

**Storage** 目标项目 `docs/aftertaste/loops/<loop-id>/current/loop.json`

**Testing** Node test runner、隔离的真实 Git 项目、真实 CLI、产品 Skill 订单试讲

**Target Platform** Windows 主验，沿现有 Node/Git 平台边界

**Project Type** AI Skill 与本地 CLI

**Performance Goals** 每个参与文件在一次生成或读回中只取对应固定源码一次，图例使用一次图快照

**Constraints** 源码只引用，闭环只创建，路线与讲法由 Skill 确认，教学偏好写入归 Skill 并遵循 005 的保护边界

**Scale/Scope** 一项从已有讲解中选定的跨文件过程，含主线、分支、汇合及可选图例

## Constitution Check

| 原则 | 研究前与设计后核对 |
| --- | --- |
| I · 授权 | [规格](spec.md)映射 C01–C04、U101 和 A19 current，业务范围一致。 |
| II · 资料归属 | [数据模型](data-model.md)只存源码引用，暂存发布保护旧成果，分项 Git 诊断保留讲解。 |
| III · 共用规则 | [协议](contracts/cli.md)组装既有文档、固定取源和图例校验，分层职责明确。 |
| IV · 验证 | [快速验证](quickstart.md)包含换会话、失败及试讲，独审绑定候选，作者判断讲解效果。 |
| V · 文档 | 使用已安装 Spec Kit 模板，技术决策与执行证据各归对应材料。 |

D050 前后检查沿原条件，新增的共同项目讲法和写入时点由任务批准。已存闭环结构与固定源码仍由原 CLI 核验，两条新生成入口共用 005 偏好模型。独审绑定真实首次、换会话和读回证据。

## Project Structure

### Documentation (this feature)

```text
specs/008-loop-authoring/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── contracts/cli.md
├── quickstart.md
└── tasks.md
```

### Source Code (repository root)

```text
src/core/loops.ts
src/core/dependency-graph.ts
src/core/document-blocks.ts
src/application/loops.ts
src/adapters/loop-store.ts
src/cli/main.ts
skills/aftertaste-reader/references/loops.md
tests/fixtures/loop-authoring.mjs
tests/integration/loops.test.mjs
```

**Structure Decision** 纯规则管结构及引用关系，用例负责校验与取源，适配器管目录和发布。CLI 提供 JSON 及无需持久源码的 Markdown 读回。

## D053 · 为闭环自拟一个问句

在 `src/core/loops.ts` 接入现有读写流程。开关包含 id、type=switch、question、nodes（步骤 id）、edges（{from,to} 对）。至少一个目标，库选择沿用 id、paths。 复用原固定源码、布局修订和候选验证机制。
