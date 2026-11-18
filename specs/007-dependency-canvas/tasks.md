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

## Phase 4: User Story 2 - 自由摆放并恢复 (P1)

**Goal**: 操作后保存完整布局，按项目恢复。

**Independent Test**: 以两个组和框内非成员验证缩放拖组、重排及真实重启。

- [x] T006 [US2] 扩展 tests/integration/dependency-canvas.test.mjs 和 tests/browser/dependency-canvas.mjs 覆盖真实项目文件、两个组、视野与重启（FR-003、004）。
- [x] T007 [US2] 在 src/adapters/layout-store.ts、src/application/dependency-canvas.ts、src/server/reader.ts 接入布局读写和确认（FR-004）。
- [x] T008 [US2] 在 src/web/DependencyCanvas.vue、canvas.css 和 reader-api.ts 接入画布操作、显式分组及最新布局自动保存（FR-003、004）。

## Phase 5: User Story 3 - 图变化和失败时保全排布 (P1)

**Goal**: 保留有效排布，协调完整图增删并处理保存失败。

**Independent Test**: 正式图工具增删后比较坐标和成员，模拟写入失败与旧修订。

- [x] T009 [US3] 扩展 tests/integration/dependency-canvas.test.mjs 和 tests/browser/dependency-canvas.mjs，验证正式图更新、临时缺图、损坏、写失败重试与旧修订（FR-005、006）。
- [x] T010 [US3] 在 src/application/dependency-canvas.ts、src/adapters/layout-store.ts、src/server/reader.ts 与 src/web/DependencyCanvas.vue 接通协调、失败及冲突保护（FR-005、006）。

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T011 更新 docs/usage/file-reader.md 及 specs/001-first-release/08-current-spec-and-acceptance.md 的交付范围。
- [ ] T012 运行 quickstart.md 检查，核 G01—G05，与证据一起固定候选并交执行侧独审，形成 D012 handoff。

## Dependencies & Execution Order

T001 → T002 → US1 → US2 → US3 → T011—T012。每个故事先定义行为检查，再接通核心、服务和页面。US2 使用 US1 的项目图及页面，US3 使用 US2 的真实保存入口。测试与浏览器串行，无并行资源运行。

## Implementation Strategy

优先走通选中、关系及阅读返回，再接入保存恢复，最终验证更新与异常。使用同一隔离样例验证增量，另备试读原始项目。
