# Tasks · 单篇讲解文档骨架与校验

**Input** 本目录 spec/plan/research/data-model/contracts/quickstart，与 D008 @ 39a7fdf M01—M06、001 约束、002 已有能力、后置范围及允许材料相同。

**Prerequisites** plan.md、spec.md、research.md、data-model.md、contracts/cli.md。

**Tests** D008 明确要求正式边界、性质与真实 CLI 测试。

**Organization** 按三个用户场景及依赖顺序实施。

## Format

任务使用 checkbox、顺序 ID、场景标签和真实路径。[P] 仅标注独立文件的潜在机会，本单测试仍串行。

## Path Conventions

沿单工程 src/core、application、adapters、cli 与 tests/unit、integration、fixtures。

## Phase 1 · Setup (Shared Infrastructure)

- [x] T001 固定 Markdown 解析依赖并核 Node24 环境与 package.json/package-lock.json。

## Phase 2 · Foundational (Blocking Prerequisites)

- [x] T002 在 src/core/document-blocks.ts 建立单一 Block、Diagnostic、ValidationResult、物理行和码点规则，按 data-model 的 ID、范围及状态约束实现。

## Phase 3 · User Story 1 - 创建单篇骨架 (Priority P1)

**Goal** M01、M02 的新文档制作。

**Independent Test** 合成固定源码生成混排骨架，核镜像、ID、空正文及重复保护。

### Tests for User Story 1

- [x] T003 [US1] 在 tests/unit/document-blocks.test.mjs 编写清单、唯一 ID、碰撞及生成解析性质测试，先采集缺模块失败。
- [x] T004 [US1] 在 tests/integration/document-blocks.test.mjs 和 tests/fixtures/document-blocks.mjs 编写项目映射、镜像冲突、重复/并发、链接与写入失败保护测试。

### Implementation for User Story 1

- [x] T005 [US1] 在 src/core/document-blocks.ts 实现有序清单检查及 8 位 a-z0-9 随机 ID 骨架，空文件零行，碰撞重试有上限。
- [x] T006 [US1] 在 src/adapters/document-store.ts 实现逐段路径边界及完整临时 Markdown 排他发布，保护既有目标且失败不落源码。
- [x] T007 [US1] 在 src/application/document-blocks.ts 与 src/cli/main.ts 接入 create-document，复用固定取源并保持 pin/read 行为。

**Checkpoint** US1 可独立创建并拒绝无效清单。

## Phase 4 · User Story 2 - 解析并检查 (Priority P1)

**Goal** M03、M04 的解析与固定依据覆盖。

**Independent Test** 手写合法与畸形文档，检查原文、定位和源码依据。

### Tests for User Story 2

- [x] T008 [US2] 在 tests/unit/document-blocks.test.mjs 覆盖真正顶层、围栏/缩进/列表/引用/HTML 容器、字段与配对、正文保真及独立占用数组覆盖性质。
- [x] T009 [US2] 在 tests/integration/document-blocks.test.mjs 覆盖文档头 A、工作区/HEAD 变化、取源失败、只读和坏 CLI 输入。

### Implementation for User Story 2

- [x] T010 [US2] 在 src/core/document-blocks.ts 实现 CommonMark 顶层解析、完整头、配对/字段/ID/范围诊断及每行按序恰好一次校验。
- [x] T011 [US2] 在 src/application/document-blocks.ts、src/adapters/document-store.ts、src/cli/main.ts 接入 validate-document，只读返回原文及稳定问题，按头部 commit 取源。

**Checkpoint** US2 不依赖生成，可校验手写文档。

## Phase 5 · User Story 3 - 警告与未完成 (Priority P2)

**Goal** M05、M06 明确结果与完整路径。

**Independent Test** 60/61、1,200/1,201、空源码和不可读源码返回准确状态。

### Tests for User Story 3

- [x] T012 [US3] 在 tests/unit/document-blocks.test.mjs 测 Unicode White_Space/码点、LF/CRLF/CR、尾换行、零块及警告不降级。

### Implementation for User Story 3

- [x] T013 [US3] 在 src/core/document-blocks.ts 和 src/application/document-blocks.ts 完成 sourceCheck、contentStatus、teachingQuality 与 renderMode，源码 >60 行/正文 >1,200 非 White_Space 码点仅警告。
- [x] T014 [US3] 在 tests/fixtures/document-blocks.mjs 实现真实 CLI 完整演示并核 specs/003-document-blocks/quickstart.md 可重跑。

**Checkpoint** 三个场景均可观察且退出协议一致。

## Phase 6 · Polish & Cross-Cutting Concerns

- [x] T015 串行 typecheck、build、tests/unit 与 tests/integration 全部回归，核 README.md 和 tests/README.md 的实际入口。
- [x] T016 固定候选并独审，保存 docs/work/2026/11/D008-document-blocks/review.md 和 handoff.md，保留候选交回。

## Dependencies & Execution Order

Phase 1 → 2 → US1 → US2 → US3 → 收束。测试先编写并采集初始缺实现失败，再逐层补齐。US2 可用手写文档独立验证，US3 复用前两者结果。T002 与 T003 同阶段按先测试后实现串行落地。

### Parallel Opportunities / Examples

US1 的 unit 与 integration 测试定义可分文件准备。US2 的语法样例与 Git 样例可分文件准备。US3 的边界样例与 quickstart 可分文件准备。实际执行由同一执行者串行完成，独审在候选冻结后进行，所有测试串行。

## Implementation Strategy

先 US1 骨架作为阶段可检查成果，再用手写文档完成 US2，再落实 US3 结果与完整使用路径。最终 M01—M06 全部完成后交回候选，每阶段自行验证，独审与作者体验按任务职责分开。

## Notes

本单不做后置范围。技术细化只维护模型/契约，问题修复及两轮停点证据落 handoff。
