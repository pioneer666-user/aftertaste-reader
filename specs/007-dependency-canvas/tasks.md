---
description: "文件依赖图与布局保存实施清单"
---

# Tasks: 文件依赖图与布局保存

**Input**: `specs/007-dependency-canvas/`

**D028 增量** [原任务 @f00becb](../../docs/work/2026/11/D028-reader-history-canvas-tools/task.md)。T041—046 覆盖 FR-002、010、013、019—020 与 SC-010、012、017—018，联验 [006](../006-file-reader/tasks.md) 的共用导航和 009 SC-005。

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

## Phase 11: D027 User Story 6 - 在已有排布中追踪关系、定位和成组 (P1)

**Goal** 在读者已有视野中追踪曲线、用两种工具整理图，并在成功落盘后认出刚建的组。

**Independent Test** 在固定的订单图副本执行 [SC-014—016](spec.md#measurable-outcomes)，对照实际保存结果和同视野的画面。

- [x] T034 [US6] 从 [共用试读项目](../../tests/README.md#页面改版共用试读)固定 79% 隔离输入和改前画面，在 `tests/browser/` 准备对应行为检查，覆盖新建时的延迟、失败、重试与切页（SC-014—016）。
- [x] T035 [US6] 在 `src/web/DependencyCanvas.vue`、`DependencyEdge.vue`、`canvas.css` 和 `i18n.ts` 接入文件／库卡、连续圆角、选中／焦点与直接关系曲线（FR-014、015）。
- [x] T036 [US6] 在 `src/web/` 的依赖图绘制层与 `DependencyCanvas.vue` 接通同相点阵、组范围色差、静止／收住／回弹和减少动态效果。将三种新建入口的组 ID 与保存尝试快照和确认修订对应，处理失败重试、切页清理及单次涟漪（FR-016、018）。
- [x] T037 [US6] 在 `src/web/DependencyCanvas.vue` 与图内中英文控件接通工具固定、Ctrl 反转和拖动锁定。用小地图双向定位及窄窗收起，复用主图视野保存和 D026 选区操作（FR-011—013、017）。

## Phase 12: D027 Polish & Cross-Cutting Concerns

- [x] T038 按 `specs/007-dependency-canvas/quickstart.md` 串行验证 SC-014—016 和受影响的 `tests/browser/` 图与闭环用例。检查 `docs/usage/file-reader.md` 的实际操作，记录同输入画面、帧序列、浏览器及实际保存结果至 `.local/D027/`。
- [x] T039 固定候选，提交独审亲自验证 79% 读图、Ctrl 提前松开、小地图定位及保存延迟／失败／重试。将独审原文归档于 `docs/work/2026/11/D027-dependency-canvas-polish/review.md`（SC-014—016）。
- [x] T040 独审通过后核服务归属，切换 4341 到固定构建及原共用项目，核个人资料与排布，交 `docs/work/2026/11/D027-dependency-canvas-polish/handoff.md`（SC-014—016）。

## Phase 13: D028 User Story 7 - 在同一视野内查关系并打开讲解 (P1)

**Independent Test** 按 SC-017—018 选文件和库，操作浮条与详情，核画布、小地图、视野、焦点及窄窗恢复入口。

- [x] T041 [US7] 在 `tests/browser/reader-history.mjs` 定义同窗量测、浮条、文件及库详情与闭环检查。复用 `tests/browser/dependency-canvas-selection.mjs` 和 `tests/browser/dependency-canvas-tools.mjs` 的受影响场景（SC-017—018）。
- [x] T042 [US7] 在 `src/web/DependencyCanvas.vue`、`src/web/canvas.css` 和 `src/web/i18n.ts` 接通左浮条、居中限宽摘要、可关闭详情及组编辑。保留小地图、工具和保存失败提示（FR-010、013、019—020）。
- [x] T043 [US7] 在 `src/web/DependencyCanvas.vue` 与 `src/web/canvas-position.ts` 将当前对象、视野与查看位置交给 006 的历史，按当前图恢复。保留闭环右侧读法与两图各自的布局（FR-002、020、009 FR-008）。

## Phase 14: D028 Polish & Cross-Cutting Concerns

- [x] T044 沿 `specs/007-dependency-canvas/quickstart.md` 串行核 SC-010、012、017—018 及 009 SC-005，联验 006 的导航与回访。核 `docs/usage/file-reader.md` 的实际入口，证据放 `.local/D028/`。
- [x] T045 固定候选与输入，请独立审查者亲手验证历史、文件与库详情、闭环及小地图位置。原文归 `docs/work/2026/11/D028-reader-history-canvas-tools/review.md`（SC-017—018、006 SC-013—015、009 SC-005）。
- [x] T046 独审通过后在原共用项目用固定受审构建换版 4341，核原资料及个人布局，并交 `docs/work/2026/11/D028-reader-history-canvas-tools/handoff.md`。

## Dependencies & Execution Order

T001 → T002 → US1 → US2 → US3 → T011—T012。每个故事先定义行为检查，再接通核心、服务和页面。US2 使用 US1 的项目图及页面，US3 使用 US2 的真实保存入口。测试与浏览器串行，无并行资源运行。

D013 使用已完成的 T001—T012。T013 → T014、T015 → T016、T017 → T018，各序列依托既有样例。三个故事完成后执行 T019。F2 复核所见两条失败链沿 T020 → T021 → T022 补测、修复及再次审查。

D014 复用 D013 已验证的布局和文件阅读；T023 → T024 → T025 串行验证，T026 随实际接口更新，T027 以冻结的行为候选收束。

D026 沿既有依赖和配置，T028 → T029 → T030 → T031 → T032 → T033。新增浏览器场景可与视觉方案准备并行，同一脚本与共用文件由双方协调，服务及浏览器验证串行。共用顶栏在 006 验收后合验图往返。

D027 从 T034 的同输入取证开始。T035 的卡片与边、T036 的绘制层、T037 的小地图可在独立文件中并行准备，由画布入口整合，随后 T038 → T039 → T040。服务与浏览器检查按顺序运行。

D028 复用 006 T049 的固定输入。T041 → T042 → T043，随后与 006 T054 在同候选串行完成 T044。完成独审 T045 才执行换版和交回 T046。

## Implementation Strategy

优先走通选中、关系及阅读返回，再接入保存恢复，最终验证更新与异常。使用同一隔离样例验证增量，另备试读原始项目。

D026 先验证可阅读的首屏与详情，再以同一试读副本验证框选和保存。交付含本批完整 US5 及 006 的 US10。

D027 先以同视野的 `service.mjs` 走通曲线阅读，再验证工具、定位和成组保存；本批交付完整 US6，并回归其承接的 US1、US2、US3、US5 路径。

D028 先在依赖图验证浮层与真实内容，再与 006 的顶栏和历史往返，联验 009 的闭环读法、各图状态及异常处理。
