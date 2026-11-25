# Implementation Plan: 固定版本文件依赖图维护

**Branch**: `codex/feat-dependency-graph` | **Date**: 2026-11-17 | **Spec**: [spec.md](spec.md)

**Input**: D009 @ c4010db G01—G05，spec.md；已有 002/003 的取源、文档能力与 D008 handoff 证据。本批新增 004 材料与必要调用链，后置范围不进入实现。

## Summary

解析图和局部更新时共用连线标注校验，按使用者替换依赖时携带该条关系的完整字段。

提供 apply-graph、query-graph、validate-graph 三个 CLI 入口，共用图结构校验与使用者完整列表替换规则。沿既定 UTF-8 JSON 图与分层，先核固定依据、旧图及候选，再同目录完整发布。AI 判断依赖，工具不分析语义。

## Technical Context

**Language/Version**: TypeScript 5.9.3 / Node 24.11.1

**Primary Dependencies**: Node 标准库、现有 GitSourceRepository；不新增依赖

**Storage**: 目标项目 docs/aftertaste/dependency-graph.json；临时文件只含引用、状态与原因

**Testing**: node:test 串行；纯规则性质枚举、真实 Git/CLI、文件系统失败注入

**Target Platform**: Windows / NTFS 主验；其他平台按未验证交回

**Project Type**: 本地 CLI 与共用用例

**Performance Goals**: 本批不新增性能指标或负载实验

**Constraints**: 单固定提交、源码只引用；不改 cwd/HEAD 来源；不引入框架/数据库/运行服务

**Scale/Scope**: 小份增量输入、单文件项目图；不承诺任意规模和多进程协调

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 研究前 | Phase 1 后依据 |
| --- | --- | --- |
| I 已确认授权 | D009 G01—G05 明确，无业务澄清 | spec FR-001—010 全映射；不动后置功能 |
| II 固定源码/归属 | 复用完整引用，不缓存源码 | data-model 固定版本；契约写入边界与失败后状态 |
| III 共用/最少机制 | 单一 core/service/store | 仅提取两个已有与新增调用实际共用的路径/目录规则 |
| IV 验证/独审 | 真实 Git/CLI 与失败场景已确定 | quickstart 与 tasks 绑定场景；固定候选后另派未参与实现审查者 |
| V 官方结构 | 已读 specify/plan 与 resolver 模板 | 正式材料按模板；tasks/analyze/implement 依真实前置执行 |

无未解决门禁与待澄清。Phase 0 只读研究代理已返回代码事实，研究结果见 research.md。

## Project Structure

### Documentation (this feature)

```text
specs/004-dependency-graph/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/cli.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/core/source-path.ts              # 两类用例共用的纯路径谓词
src/core/dependency-graph.ts         # 图/输入结构、局部替换、删除、查询
src/application/fixed-source.ts      # 完整引用验证入口（含空图）
src/application/dependency-graph.ts  # 用例与 GraphStore 端口
src/adapters/git-source.ts           # 共用 commit 身份核验
src/adapters/data-directory.ts       # D008 目录保护的最小提取
src/adapters/document-store.ts       # 复用目录保护，新建语义保持
src/adapters/graph-store.ts          # 严格读图、安全创建/替换
src/cli/main.ts                      # 三个图入口
 tests/unit/dependency-graph.test.mjs
 tests/integration/dependency-graph.test.mjs
 tests/fixtures/dependency-graph.mjs
```

**Structure Decision**: 沿现有 core/application/adapters/CLI；现有文档创建行为不变，仅共用真实需要的目录遍历。无页面、Skill 或服务。本地输出归 .local/D009/。

## Complexity Tracking

无原则违反，不新增通用存储或图框架。
