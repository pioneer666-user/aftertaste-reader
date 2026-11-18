---
description: D016 已保存闭环的阅读与个人布局
---

# Tasks: 已保存闭环的本地阅读

**Input**: [设计材料](plan.md)

**Prerequisites**: [规格](spec.md)、[研究](research.md)、[模型](data-model.md)、[契约](contracts/reader-api.md)

**Tests**: D016 实际页面和真实磁盘验证。

**Organization**: 按阅读、图例、布局场景组织。

## Format

`[ID] [P?] [Story] Description`，本批串行执行。

## Path Conventions

使用根目录的 `src/`、`tests/` 与 `docs/`。

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 核基线、运行时和 `.gitignore`，准备 `.local/D016/` 隔离构建和试读路径。

## Phase 2: Foundational (Blocking Prerequisites)

- [x] T002 在 `tests/fixtures/loop-reader.mjs` 使用正式 CLI 制作 D015 订单及库图例成品。

## Phase 3: User Story 1 - 找到并阅读两条路线 (Priority: P1)

**Goal**：从标题导航读完分支。

**Independent Test**：订单两条结果及旧资料固定读取。

- [x] T003 [US1] 在 `tests/integration/loop-reader.test.mjs` 覆盖列表、诊断、方案契约及固定源码（FR-001、FR-003）。
- [x] T004 [US1] 接通 `src/adapters/loop-store.ts`、`src/application/loop-reader.ts`、`src/application/loops.ts` 和 `src/server/reader.ts` 列表、原成果读回。
- [x] T005 [US1] 在 `src/web/App.vue`、`LoopReading.vue`、`i18n.ts` 实现双语导航及两种阅读方式（FR-001–003、FR-007、SC-001、SC-004）。

## Phase 4: User Story 2 - 查看图例及文件用法 (Priority: P2)

**Goal**：保留文件粒度。

**Independent Test**：打开保存的库描述与各文件用法。

- [x] T006 [US2] 在 `tests/browser/loop-reader.mjs` 检查阅读入口、标题、原块和文件粒度图例及双语。
- [x] T007 [US2] 将图例的 `legend:<id>` 键和保存的文件用法接入 `src/web/DependencyCanvas.vue` 与闭环阅读区（FR-004、FR-007）。

## Phase 5: User Story 3 - 个人布局保存与恢复 (Priority: P3)

**Goal**：三张图的状态独立。

**Independent Test**：切图、关页重启、冲突与失败重试。

- [x] T008 [US3] 在 `tests/integration/loop-reader.test.mjs`、`tests/browser/loop-reader.mjs` 验证跨图、路径、同图冲突、保存失败和旧布局（FR-004–006、SC-002–003）。
- [x] T009 [US3] 更新 `src/core/canvas-layout.ts`、`src/application/canvas-layout.ts`、`src/application/dependency-canvas.ts`、`src/adapters/layout-store.ts` 及 `src/server/reader.ts`，复用 UUID v4 修订、精确坐标名单、各图路径和原子发布。
- [x] T010 [US3] 在 `src/web/DependencyCanvas.vue` 和 `App.vue` 复用画布并用稳定图身份绑定请求与草稿。

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T011 更新 `docs/usage/file-reader.md` 和 `specs/001-first-release/08-current-spec-and-acceptance.md` 导航。
- [x] T012 运行串行自测和 [quickstart](quickstart.md) 的浏览器验收，完成 `docs/work/2026/11/D016-loop-reader/handoff.md` 及候选独审归档。

## Dependencies & Execution Order

### Phase Dependencies

准备后落样例，故事按 US1 → US2 → US3，最后串行验收。

### User Story Dependencies

US2 在 US1 的已保存读回上增加图例。US3 复用已具备阅读与图例的画布。

### Within Each User Story

先记录测试预期及未实现结果，再实现读写与交互并复跑。

### Parallel Opportunities

本批按仓库资源规则串行检查，独审在候选固定后独立进行。

## Implementation Strategy

### MVP First

先完成闭环入口、推荐顺序与分支导航，再验证图例和个人布局。

### Incremental Delivery

兼容已有成品和依赖图，独审完成后交作者试读。
