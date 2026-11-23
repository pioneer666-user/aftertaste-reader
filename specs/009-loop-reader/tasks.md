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

## Phase 7: D031 主阅读与共用画布交接

**Goal**：点步骤直接读讲解和分支理由，按需对照源码；两类图共用稳定工具和卡面反馈。

**Independent Test**：在订单校验步固定第 1–7 行后选择失败分支，代码留在相同范围而讲解切换；窄窗、键盘和图例仍可读，原图视野与布局不变。

- [x] T013 增量维护 009 规格、方案、研究、模型、契约、复验步骤和检查清单，记录 D031 的画布提示调整并运行只读分析（US1、FR-003、FR-005、FR-008、SC-005）。
- [x] T014 [US1] 在 `tests/browser/loop-main-experience.mjs` 先记录旧构建的预期失败，再覆盖直读、同行分支、源码预览／固定／换步、空白关闭、提示、源码不写布局或历史（FR-003、FR-008、SC-005）。
- [x] T015 [US1] 更新 `src/web/LoopReading.vue`、`DependencyCanvas.vue`、`App.vue`、`i18n.ts` 和 `canvas.css`，接入右栏直读、桌面浮层／窄窗内联源码、共用图工具与固定提示（US1–US3、FR-002–005、FR-007–008）。
- [x] T016 [US3] 在共用卡面和聚焦浏览器回归中验证两类图的约 2 CSS px 轻抬、减少动态、键盘与拖动边界；节点／视口几何、图例、布局独立保存及冲突恢复不回退（US2–US3、FR-004–006、SC-002–003）。
- [x] T017 更新 `docs/usage/file-reader.md` 与 [quickstart](quickstart.md)，串行验证构建、全量 Node 测试、受影响 Edge／Chrome／Firefox 回归、390 CSS px、English、键盘、减少动态及仿真触摸，完成局部实图检查（SC-001–005）。
- [x] T018 固定候选、输入和证据，委派 Ponytail 独立审查并处理发现；通过后把 4341 换到受审构建和原共用项目，归档 D031 回执与未验项。

## Phase 8: D032 闭环目录（US1）

独立验收按 SC-006 从文件页首次进入、选图、读到一半查目录。

- [x] T019 [US1] 在 `tests/integration/loop-reader.test.mjs` 对照真实成品检查列表投影，并在 `src/application/loop-reader.ts` 提供目录数据（FR-001）。
- [x] T020 [US1] 在 `src/web/App.vue` 接入双语抽屉、刷新、焦点、快捷键和跳过导航，保留原切图回访（FR-001、007、008）。
- [x] T021 [US1] 更新 `src/web/DependencyCanvas.vue`、`DependencyDots.vue` 和 `canvas.css`，未选及已选共享满幅工作区、保留右栏与保存故障恢复（FR-008）。
- [x] T022 [US1] 更新 `tests/browser/` 旧入口，添加 `loop-catalog.mjs` 核对四边、连续帧、固定源码、刷新、键盘及窄窗，更新 `docs/usage/file-reader.md`（SC-005、006）。
- [x] T023 冻结构建与试读输入，独审并按结果换版，在 `docs/work/2026/11/D032-loop-catalog-drawer/handoff.md` 交回。

## Phase 9: D033 收栏阅读与画布分组

- [x] T024 [US1] 在 src/web/DependencyCanvas.vue、LoopReading.vue、canvas.css、i18n.ts 实现图名、收展和栏边导航，保留阅读位置与源码（FR-002、003、008）。
- [x] T025 [US1] 在 src/web/LoopRelations.vue 由实际出入边显示可展开、可选步的关系摘要（FR-002、008）。
- [x] T026 [US3] 在 src/web/DependencyCanvas.vue 把分组表单移到画布，「⋯」可改名、调整成员、解散并恢复焦点（FR-005、006）。
- [x] T027 [US1] 更新 docs/usage/file-reader.md 和 tests/browser/ 的阅读、分组及既有入口回归，按 quickstart.md 核原位与重开（SC-007）。
- [x] T028 冻结候选，独立审查并在 docs/work/2026/11/D033-loop-reading-panel/ 交回试读和证据。

## Phase 10: D034 满幅与步骤阅读

- [x] T029 [US1] 在 src/web/DependencyCanvas.vue、canvas.css 将两态绘图区固定为满幅，默认收栏，栏边淡把手与栏内顶部导航支持键盘和触屏（FR-002、008）。
- [x] T030 [US1] 在 src/web/LoopReading.vue、i18n.ts 由本步讲解、提示、一行源码、真实出口读到折叠原块，更新 docs/usage/file-reader.md（FR-002、003）。
- [x] T031 [US1] 在 tests/browser/ 验证开合逐帧几何、浮层命中、两条订单路线、长文导航、窄窗源码与跨图回访（SC-005—007）。
- [x] T032 冻结候选与输入，独审后按 docs/work/2026/11/D034-loop-step-reading/task.md 核资料、换版并交回。

## D042 · 依赖图与闭环往返

- [x] T033 [US1] 在 src/web/LoopRelations.vue、src/web/LoopReading.vue 与 src/web/DependencyCanvas.vue 将底条接入右栏并保全所有有向关系。
- [x] T034 [US1] 在 tests/browser/loop-reading-panel.mjs 及路线往返用例核步骤、显隐与分支。

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
