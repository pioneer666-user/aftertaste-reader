---
description: "D021 块级理解标注与批注实施清单"
---

# Tasks: 块级理解标注与批注

**Input**: `specs/012-understanding-marks/` 的规格、计划、研究、数据模型、接口和验证指南。

**Prerequisites**: [spec](spec.md)、[plan](plan.md)、[research](research.md)、[data-model](data-model.md)、[contract](contracts/reader-api.md)。

**Tests**: 按 D021 先编写和验证新行为入口的红测，再实施。实际运行串行。

**Organization**: 按用户场景编号和先后依赖组织。

## Format: `[ID] [P?] [Story] Description`

故事阶段附 US 编号。可独立编辑的任务在并行示例中说明。

## Path Conventions

路径相对仓库根，项目资料运行于隔离目标项目。

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 核对 `package.json`、任务分支、工作区、运行环境和隔离验证路径。

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T002 核对 `src/adapters/personal-file.ts` 与 `src/application/document-blocks.ts` 的安全写入、路径和读块边界。

## Phase 3: User Story 1 - 原块标注与批注 (Priority: P1)

**Goal**：三态和可选批注能独立保存，失败可重试。

**Independent Test**：在原块全程改标、批注、重开，复验冲突和失败。

### Tests for User Story 1

- [X] T003 [P] [US1] 在 `tests/unit/understanding-marks.test.mjs` 和 `tests/integration/understanding-marks.test.mjs` 检查格式、两字段变更、安全边界和真实 HTTP 并发（FR-001、002、005）。
- [X] T004 [P] [US1] 在 `tests/browser/understanding-marks.mjs` 验证块内状态、批注、重开、键盘、真实保存失败、双页陈旧写入和其他资料独立（SC-001、003，FR-008）。

### Implementation for User Story 1

- [X] T005 [US1] 在 `src/core/understanding-marks.ts` 校验项目相对 current 镜像文档路径、8 位小写字母数字 ID、`unmarked`／`understood`／`not-understood` 和完整 Unicode 字符串批注。
- [X] T006 [US1] 在 `src/application/understanding-marks.ts`、`src/adapters/understanding-marks-store.ts` 和 `src/server/reader.ts` 接通项目读取、按字段比较、串行写入与语义明确的失败反馈（FR-005）。
- [X] T007 [US1] 在 `src/web/BlockUnderstandingMark.vue`、`src/web/mark-drafts.ts`、`src/web/ReaderDocument.vue`、`src/web/App.vue`、`src/web/i18n.ts` 和 `src/web/style.css` 接通块内改标、批注和重试（FR-001、002、008）。

## Phase 4: User Story 2 - 从项目标注回访 (Priority: P2)

**Goal**：当前自评筛选及跨文件定位。

**Independent Test**：给同 ID 双文件设置记录后从列表逐条回访。

### Tests for User Story 2

- [X] T008 [US2] 在 `tests/browser/understanding-marks.mjs` 核对筛选、原话、焦点、同 ID 改写、新 ID、暂不可读及重读（FR-003、004、007、008，SC-002）。

### Implementation for User Story 2

- [X] T009 [US2] 在 `src/web/ProjectMarks.vue`、`src/web/App.vue`、`src/web/i18n.ts` 和 `src/web/style.css` 接通标注入口、筛选、失败提示和按身份回访（FR-003、004、007、008）。

## Phase 5: User Story 3 - 讲解 AI 按需读回 (Priority: P3)

**Goal**：区分当前自评与批注原话。

**Independent Test**：从隔离项目读取有旧问句的已理解和有批注的未标记记录。

### Tests for User Story 3

- [X] T010 [US3] 在 `tests/skills/understanding-marks.test.mjs` 核对 [feedback 指南](../../skills/aftertaste-reader/references/feedback.md) 路径和实际落盘内容（FR-006，SC-004）。

### Implementation for User Story 3

- [X] T011 [US3] 更新 `skills/aftertaste-reader/references/feedback.md` 的只读入口和判读规则。

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T012 同步 `specs/001-first-release/05-reading-feedback.md`、`specs/001-first-release/08-current-spec-and-acceptance.md` 和 `docs/usage/file-reader.md`（FR-002、007）。
- [X] T013 用 [quickstart](quickstart.md) 串行验证，遵照 [D021 派单](../../docs/work/2026/11/D021-understanding-marks/task.md) 区分正式版本更新联验。
- [X] T014 复验独审发现的长批注编辑。先在 `tests/integration/understanding-marks.test.mjs` 固定首次写入 540,000 字节并追加一字的 HTTP 用例，再在 `src/core/understanding-marks.ts`、`src/application/understanding-marks.ts`、`src/web/App.vue`、`src/web/ReaderDocument.vue` 和 `src/web/BlockUnderstandingMark.vue` 接通固定长度摘要，保持陈旧编辑保护（FR-002、005）。

## D035 · 在标注详情读原话

- [x] T015 [US2] src/web/ProjectMarks.vue 和 tests/browser/understanding-marks.mjs 完成选中详情、筛选、一步回原文与改标后原话复验。

## Dependencies & Execution Order

### Phase Dependencies

Setup → Foundational → US1 → US2 → US3 → 收尾。US2/US3 可用 US1 产出的固定资料独立验证。

### User Story Dependencies

US1 使用基础文件和页面入口。US2 使用已存记录和文档读取。US3 依赖正式文件字段定义。

### Within Each User Story

先使验收入口失败，再交付并验证。模型先于服务，服务先于接口和页面。

## Parallel Example

US1 的 HTTP／模型检查和浏览器用例可独立编辑。US2 的筛选用例和 US3 的资料只读用例独立。按仓规所有运行串行。

## Implementation Strategy

### MVP First

先验证块内的两个独立字段与安全保存。

### Incremental Delivery

依次验证列表回访和资料只读，然后一起固定审查候选。

## Notes

正式版本更新提醒的触发、确认和保留按 D021 派单随更新任务联验。
