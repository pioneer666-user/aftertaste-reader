---
description: "文件依赖图与布局保存实施清单"
---

# Tasks: 文件依赖图与布局保存

**Input**: `specs/007-dependency-canvas/`

**Prerequisites**: spec、plan、research、data-model、contracts

**Tests**: D012 要求核心性质、真实服务与浏览器检查

**Organization**: 按用户故事交付

## Format: `[ID] [P?] [Story] Description`

本轮串行运行资源相关检查。路径以仓库根为基准。

## Phase 1: Setup

- [x] T001 添加 Vue Flow 固定依赖和画布验证脚本于 package.json、package-lock.json。

## Phase 2: Foundational

- [x] T002 在 tests/unit/canvas-layout.test.mjs 先定义显式成员、缩放下统一位移、原位协调及保组重排；在 src/core/canvas-layout.ts 实现共用规则（FR-003、FR-005）。

## Phase 3: User Story 1 - 沿关系进入逐文件讲解 (P1)

**Goal**: 在画布确认文件依赖及实际讲解入口。

**Independent Test**: D010 样例选 service，查看两条直接关系、阅读再返回并选择 audit。

- [x] T003 [US1] 为图与讲解读取、环和缺图／空图／损坏图准备 tests/fixtures/dependency-canvas.mjs、tests/integration/dependency-canvas.test.mjs 与 tests/browser/dependency-canvas.mjs（FR-001、002）。
- [x] T004 [US1] 在 src/application/dependency-canvas.ts、src/server/reader.ts 接入 D009 图和 D011 讲解清单（FR-001、002）。
- [x] T005 [US1] 在 src/web/App.vue、DependencyCanvas.vue、DependencyEdge.vue、i18n.ts 与 canvas.css 呈现关系、选中、阅读返回及诊断（FR-001、002）。
- [x] T013 [US1] 在 tests/browser/canvas-fixes.mjs 暂扣真实文件清单，检查打开新讲解后的标题正文、返回视野、默认首篇与刷新切篇（FR-002、SC-006、F4）。
- [x] T014 [US1] 用 src/web/App.vue 的选篇序号保护较晚的阅读动作（FR-002、F4）。

## Phase 4: User Story 2 - 自由摆放并恢复 (P1)

**Goal**: 操作后保存完整布局，按项目恢复。

**Independent Test**: 以两个组和框内非成员验证缩放拖组、重排及真实重启。

- [x] T006 [US2] 扩展 tests/integration/dependency-canvas.test.mjs 和 tests/browser/dependency-canvas.mjs 覆盖真实项目文件、两个组、视野与重启（FR-003、004）。
- [x] T007 [US2] 在 src/adapters/layout-store.ts、src/application/dependency-canvas.ts、src/server/reader.ts 接入布局读写和确认（FR-004）。
- [x] T008 [US2] 在 src/web/DependencyCanvas.vue、canvas.css 和 reader-api.ts 接入画布操作、显式分组及最新布局自动保存（FR-003、004）。
- [x] T015 [US2] 在 tests/browser/canvas-fixes.mjs 通过真实拖动、HTTP 向服务保存含合法特殊名的已有布局，重开核对坐标，并在 tests/integration/dependency-canvas.test.mjs 核格式和修订（FR-004、006、SC-006、F3）。
- [x] T016 [US2] 在 src/web/DependencyCanvas.vue、src/core/canvas-layout.ts 与 src/application/dependency-canvas.ts 接通坐标条目编码和严格解析，兼容磁盘旧布局（FR-004、006、F3）。

## Phase 5: User Story 3 - 图变化和失败时保全排布 (P1)

**Goal**: 保留有效排布，协调完整图增删并处理保存失败。

**Independent Test**: 正式图工具增删后比较坐标和成员，模拟写入失败与旧修订。

- [x] T009 [US3] 扩展 tests/integration/dependency-canvas.test.mjs 和 tests/browser/dependency-canvas.mjs，验证正式图更新、临时缺图、损坏、写失败重试与旧修订（FR-005、006）。
- [x] T010 [US3] 在 src/application/dependency-canvas.ts、src/adapters/layout-store.ts、src/server/reader.ts 与 src/web/DependencyCanvas.vue 接通协调、失败及冲突保护（FR-005、006）。
- [x] T017 [US3] 在 tests/browser/canvas-fixes.mjs 验正式删空、恢复、同路径重加对照及旧页，在 tests/integration/dependency-canvas.test.mjs 核凭据保护，在 tests/unit/canvas-layout.test.mjs 比较重加时仍有其他删除的摆放结果（FR-005、006、SC-005、F1、F2）。
- [x] T018 [US3] 在 src/application/dependency-graph.ts、src/adapters/graph-store.ts、src/core/canvas-layout.ts、src/application/dependency-canvas.ts 与 src/web/DependencyCanvas.vue 实施移除标记、协调写回和旧页保护（FR-005、006、F1、F2）。
- [x] T020 [US3] 在 tests/browser/canvas-fixes.mjs 与 tests/integration/dependency-canvas.test.mjs 复核重加后草稿跨临时缺席保存、无关文字编辑和撤销后的旧页拒写（F2、FR-005、006）。
- [x] T021 [US3] 在 src/adapters/graph-store.ts 与 src/application/dependency-{canvas,graph}.ts 分别传递正式登记身份和当前缺席凭据，保护草稿、磁盘布局和过期拒绝（F2）。

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T011 更新 docs/usage/file-reader.md 及 specs/001-first-release/08-current-spec-and-acceptance.md 的交付范围。
- [x] T012 运行 quickstart.md 检查，核 G01—G05，与证据一起固定候选并交执行侧独审，形成 D012 handoff。
- [x] T019 运行 quickstart.md 中受影响检查，固定 D013 候选、提交独审并在 docs/work/2026/11/D013-canvas-fixes/ 归档回执和原文（F1—F4）。
- [x] T022 在 docs/work/2026/11/D013-canvas-fixes/ 记录 T020、T021 的真实服务与页面结果，固定补修候选并归档执行侧复核。

## Phase 7: User Story 4 - 读懂一个库在本项目里的用途 (P1)

**Goal**: 讲解 AI 可维护本图的库介绍和逐文件理由，读者可查阅和摆放。

**Independent Test**: 在旧文件布局上登记标准库及第三方库，使用正式 CLI、阅读服务和浏览器，核对内容、原位、权限、故障和重启。

- [x] T023 [US4] 在 src/core/dependency-graph.ts、src/application/dependency-graph.ts、src/adapters/graph-store.ts 和 src/cli/main.ts 接通查询、局部更新、删除凭据与端点校验（FR-007、L01、L04）。
- [x] T024 [US4] 在 src/core/canvas-layout.ts、src/application/dependency-canvas.ts、src/web/DependencyCanvas.vue、src/web/canvas.css 和 src/web/i18n.ts 接通库节点、双语详情、共用布局与恢复（FR-008、FR-009、L02—L04）。
- [x] T025 [US4] 在 tests/integration/dependency-legends.test.mjs 与 tests/browser/dependency-legends.mjs 复验正式工具、同名身份、读写边界、更新重开、故障恢复、旧页、文件移除和半发布重试（SC-007—SC-009、L01—L04）。

## Phase 8: D014 Polish & Cross-Cutting Concerns

- [x] T026 更新 skills/aftertaste-reader/references/generation.md、skills/aftertaste-reader/references/tools.md、docs/usage/file-reader.md 与 specs/001-first-release/08-current-spec-and-acceptance.md 的实际操作入口与交付范围（L01、L02）。
- [x] T027 在 docs/work/2026/11/D014-dependency-legends/ 固定候选、归档独审及回执并提供试读（L01—L04）。

## Phase 9: D026 User Story 5 - 在图上就近编组 (P1)

**Goal** 正常首屏以图为主，选中后查详情，框选后就近成组。

**Independent Test** 在共用试读副本从组背景框选文件与库，分别通过浮钮与按键编组，并确认旧组成员转移、取消、真实保存失败重试和重开。

- [x] T028 [US5] 在 `tests/browser/dependency-canvas-selection.mjs` 用共用试读副本定义首屏、详情往返、矩形命中与浮层、写盘边界及故障恢复场景（SC-010—013）。
- [x] T029 [US5] 在 `src/web/DependencyCanvas.vue`、`src/web/canvas.css` 与 `src/web/i18n.ts` 实现大画布首屏、可关闭详情、次级入口与可见诊断。沿 `src/web/App.vue` 保留图到讲解再返回的原节点、视野（FR-002、FR-010）。
- [x] T030 [US5] 在 `src/web/DependencyCanvas.vue`、`src/web/canvas.css` 与 `src/web/i18n.ts` 接入活动依赖图的 Ctrl 框选、边缘避让浮钮和同一命名路径。组名去除首尾空白后为 1—160 UTF-16 字符，允许重名；沿既有组成员转移、空组清理及保存逻辑。保留可键盘操作的原组编辑（FR-011—013）。

## Phase 10: D026 Polish & Cross-Cutting Concerns

- [x] T031 按 `specs/007-dependency-canvas/quickstart.md` 串行验证类型、构建、隔离实操及受影响的 `tests/browser/` 旧图和闭环路径；按实际入口更新 `docs/usage/file-reader.md`（SC-010—013）。
- [x] T032 固定候选，按 `docs/roles/审查.md` 委派独审及实操，保存原文至 `docs/work/2026/11/D026-dependency-canvas-selection/review.md`（SC-010—013）。
- [x] T033 独审通过后核 4341 服务归属，在原试读项目启动受审构建，核读者资料与排布，留 `docs/work/2026/11/D026-dependency-canvas-selection/handoff.md`（SC-010—013、006 SC-013）。

## Dependencies & Execution Order

T001 → T002 → US1 → US2 → US3 → T011—T012。每个故事先定义行为检查，再接通核心、服务和页面。US2 使用 US1 的项目图及页面，US3 使用 US2 的真实保存入口。测试与浏览器串行，无并行资源运行。

D013 使用已完成的 T001—T012。T013 → T014、T015 → T016、T017 → T018，各序列依托既有样例。三个故事完成后执行 T019。F2 复核所见两条失败链沿 T020 → T021 → T022 补测、修复及再次审查。

D014 复用 D013 已验证的布局和文件阅读；T023 → T024 → T025 串行验证，T026 随实际接口更新，T027 以冻结的行为候选收束。

D026 沿既有依赖和配置，T028 → T029 → T030 → T031 → T032 → T033。新增浏览器场景可与视觉方案准备并行，同一脚本与共用文件由双方协调，服务及浏览器验证串行。共用顶栏在 006 验收后合验图往返。

## Implementation Strategy

优先走通选中、关系及阅读返回，再接入保存恢复，最终验证更新与异常。使用同一隔离样例验证增量，另备试读原始项目。

D026 先验证可阅读的首屏与详情，再以同一试读副本验证框选和保存。交付含本批完整 US5 及 006 的 US10。
