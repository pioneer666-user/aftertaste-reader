---
description: "D020 项目内全局笔记与跨文件回访"
---

# Tasks: 项目内全局笔记与跨文件回访

**Input**: [D020 实施方案](plan.md)

**Prerequisites**: [spec](spec.md)、[research](research.md)、[data model](data-model.md)、[contract](contracts/notes.md)、[quickstart](quickstart.md)

**Tests**: 按 D020 增加单元、真实 HTTP 和浏览器用例，先固定可观察的失败条件。

**Organization**: 按读者场景推进实现与验证。

## Format: `[ID] [P?] [Story] Description`

用户故事任务标记 `[US1]` 至 `[US3]`。依赖相同文件和测试资源的任务串行。

## Path Conventions

路径相对仓库根。运行材料放在 `.local/D020/<run-id>/`。

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 核实已存在的开发环境和样例。

- [X] T001 核分支、Node 24、既有依赖、忽略配置和 `tests/fixtures/bookmark-project.mjs` 样例。

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 先具备读写、修订比较和资料边界。

- [X] T002 在 `tests/unit/notes.test.mjs`、`tests/integration/notes.test.mjs` 建立格式、文件保护、HTTP 与并发的失败前验证。
- [X] T003 在 `src/core/notes.ts` 校验格式 1、唯一小写 UUID v4、修订 UUID v4、合法 Unicode 正文、互异非空白 Unicode 标签数组。
- [X] T004 从 `src/adapters/bookmark-store.ts` 提取 `src/adapters/personal-file.ts`，在 `src/adapters/notes-store.ts` 落实受限的 UTF-8 原子保存。
- [X] T005 在 `src/application/notes.ts`、`src/server/reader.ts` 实现逐条比较修订、重试、写入边界及状态映射。

## Phase 3: User Story 1 - 随手记与标签过滤 (Priority: P1)

**Goal**: 提供项目内独立笔记和自由标签。

**Independent Test**: 创建两条无来源笔记，重开用两标签分别找回一条，删除另一条。

### Tests for User Story 1

- [X] T006 [US1] 在 `tests/browser/notes.mjs` 固定独立创建、多个标签、重开过滤和删除场景。

### Implementation for User Story 1

- [X] T007 [US1] 在 `src/web/App.vue`、`src/web/ProjectNotes.vue`、`src/web/notes-editor.ts` 提供入口、列表、筛选、编辑器、标签和删除。

## Phase 4: User Story 2 - 选文加入与跨文件回访 (Priority: P2)

**Goal**: 从当前讲解追加选文链接并定位当前块。

**Independent Test**: 两个文件同 ID 的一块对照、一块纯讲解，分别加入同一条笔记并回访。

### Tests for User Story 2

- [X] T008 [US2] 在 `tests/unit/notes.test.mjs`、`tests/browser/notes.mjs` 核选文编码、加入、两处焦点、目标变更和恢复。

### Implementation for User Story 2

- [X] T009 [US2] 在 `src/web/ReaderDocument.vue`、`src/web/ProjectNotes.vue`、`src/web/markdown.ts` 实现讲解选文、Markdown 链接插入及预览区点击。
- [X] T010 [US2] 在 `src/web/App.vue` 复用浏览器文档加载，定位块并报告不同失败原因。

## Phase 5: User Story 3 - 自动保存和故障恢复 (Priority: P3)

**Goal**: 输入不中断，保存与竞争状态准确，失败可重试。

**Independent Test**: 延迟响应、撤销、实际写失败与两页竞争。

### Tests for User Story 3

- [X] T011 [US3] 在 `tests/browser/notes.mjs` 覆盖保存后 Ctrl+Z、较早响应迟到、锁文件、失败重试及两页冲突。

### Implementation for User Story 3

- [X] T012 [US3] 在 `src/web/notes-editor.ts`、`src/web/ProjectNotes.vue` 完成节流、单条在途请求、错误保留、重试和状态。保持原生编辑器历史。

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 完成呈现、文档和交付验证。

- [X] T013 完善 `src/web/i18n.ts`、`src/web/style.css` 的中英文、焦点和窄屏，浏览器核对真实渲染。
- [X] T014 同步 `docs/usage/file-reader.md`、`skills/aftertaste-reader/references/feedback.md` 与 `specs/001-first-release/05-reading-feedback.md`、`08-current-spec-and-acceptance.md`。
- [X] T015 串行执行 [quickstart.md](quickstart.md) 和受影响的既有回归，固定受审候选和证据。

## Dependencies & Execution Order

### Phase Dependencies

Setup → Foundational → US1 → US2 → US3 → Polish。各阶段测试先固定期望，共用同一文件的任务按顺序执行。

### User Story Dependencies

US1 使用笔记契约。US2 用 US1 的编辑器与 D019 文档样例。US3 用 US1 的编辑与存储通道独立验证。

### Within Each User Story

用例先确认为失败，再落地相应行为，最后复验保存与页面。浏览器、服务与构建依次运行。

### Parallel Opportunities

US1 的列表验收可独立于选文编解码单测设计。US2 的链接测试可独立于故障注入设计。US3 的测试数据准备可独立于文案核对。实际验证串行。

## Parallel Example: User Stories 1–3

同一阶段的用例设计可独立进行，如 US1 的标签断言、US2 的编解码输入、US3 的磁盘锁预期。均合入各自对应的测试阶段后运行。

## Implementation Strategy

### MVP First (User Story 1 Only)

基础存储和 HTTP 通过后先确认独立笔记和标签可以完成重开。D020 交付包含三个场景。

### Incremental Delivery

在现有阅读器上依次接入项目笔记、块回访和失败恢复，逐阶段核对。完成功能后固定候选，交独审及作者体验。

## Notes

本批重用正式双文件样例。正式更新的确认删除信号随对应更新任务测试。
