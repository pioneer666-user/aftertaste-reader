# Tasks: 固定提交取源

**Input** | `specs/002-fixed-source/` 的 spec、plan、research、data-model、contracts、quickstart

**Prerequisites** | 官方 specify 和 plan 材料已完成，按 analyze 核一致性后实施。

**Tests** | D006 明确要求。先编写测试并观察未实现失败，再实现。测试文件与样例串行执行。

**Organization** | 按场景安排，同一目标完整交付。

## Format

任务使用 `T编号 [US编号] 描述及路径`。本批同文件有依赖，全部串行。

## Path Conventions

根单工程使用 `src/`、`tests/`，可重建输出使用 `.local/D006-fixed-source/` 和 `dist/`。

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 建立 package.json、package-lock.json、tsconfig.json，固定 TS/Node 类型，配置 strict、build、串行测试

## Phase 2: Foundational (Blocking Prerequisites)

- [x] T002 在 src/application/fixed-source.ts 定义 ProjectMapping、FixedSource、SourceFile、SourceError 和 SourceRepository，约束完整小写 40/64 位 commit、规范路径和固定映射
- [x] T003 在 tests/fixtures/fixed-source.mjs 建立 A/B/分叉提交、普通文本、控制字节、链接/gitlink 的可重建合成仓库

## Phase 3: User Story 1 - 固定并持续读取同一版本 (Priority: P1)

**Goal** | 独立固定一次，多次取回相同提交的整文件。

**Independent Test** | 固定 A 后移动 HEAD 和改删工作文件，两个文件仍为 A，历史/分叉均可读。

### Tests for User Story 1

- [x] T004 [US1] 在 tests/unit/fixed-source.test.mjs 验证 pin 默认版本与 read 固定对象端口调用，在 tests/integration/fixed-source.test.mjs 验证 A/B/分叉和文本保真，先观察缺实现失败

### Implementation for User Story 1

- [x] T005 [US1] 在 src/application/fixed-source.ts 实现 FixedSourceService.pin/read，read 校验完整固定引用且禁止重新解析 HEAD
- [x] T006 [US1] 在 src/adapters/git-source.ts 实现项目映射、完整提交解析、逐层 ls-tree 与 blob 读取、严格 UTF-8/BOM 保真

**Checkpoint** | US1 可独立调用并通过对应测试。

## Phase 4: User Story 2 - 明确项目范围并可靠诊断 (Priority: P1)

**Goal** | 项目边界、只读、安全参数、真实命令及可定位失败完整闭合。

**Independent Test** | 根/子项目从不同 cwd 命令取源一致，越界、类型、编码、缺对象、Git 不可用均准确诊断，目标前后快照一致。

### Tests for User Story 2

- [x] T007 [US2] 在 tests/integration/fixed-source.test.mjs 补真实 CLI、参数注入、特殊字符、子项目、链接/gitlink、Git/对象失败、环境干扰与只读快照测试，先观察对应缺实现失败

### Implementation for User Story 2

- [x] T008 [US2] 在 src/adapters/git-source.ts 完善诊断、链接目标检查、隔离 GIT_*、禁自动取源/replace、64 MiB 输出限制和不含源码的失败上下文
- [x] T009 [US2] 在 src/cli/main.ts 按 contracts/cli.md 实现 pin/read、JSON stdout/stderr、退出状态，复用同一用例

**Checkpoint** | US2 的命令、错误和只读证据满足 FR-001/004/005/006/007。

## Phase 5: Polish & Cross-Cutting Concerns

- [x] T010 核 README.md、src/README.md、tests/README.md 当前状态和 specs/002-fixed-source/quickstart.md 真实示例
- [x] T011 串行运行 typecheck/build/test 和 quickstart，在 docs/work/D006-fixed-source/handoff.md 记录环境、范围、命令、结果和未验项
- [ ] T012 固定成果候选提交，调用独立审查，保存 docs/work/D006-fixed-source/review.md，处理/复核发现并完成 handoff.md

## Dependencies & Execution Order

### Phase Dependencies

T001 → T002/T003 → T004 → T005/T006 → T007 → T008/T009 → T010/T011 → T012。

### User Story Dependencies

US2 复用 US1 的取源用例，两个场景各自有独立判据。FR-001 由 T002/T006/T007 覆盖，FR-002/003 由 T004—T006，FR-004 由 T004/T006/T007/T008，FR-005/006 由 T007/T008/T009，FR-007 由 T005/T007/T009。SC-001—004 由 T004/T007/T011 覆盖。

### Within Each User Story

先测试，再实现，验证后进入下一阶段。

### Parallel Opportunities

本批文件互有关联，测试和 Git 串行。独审在候选提交完成后独立开展。

## Parallel Example: User Story 1 / User Story 2

若将来多人参与，文档阅读可与单文件定位并行。本批 US1 和 US2 的实施与测试顺序执行。

## Implementation Strategy

### MVP First (User Story 1 Only)

先验证固定 A 的原文读取，本批仍须完成 US2 后交回。

### Incremental Delivery

基础工程 → 固定依据/内容 → 边界/诊断/CLI → 完整验证/独审，一份候选交回。

### Parallel Team Strategy

实现由执行负责，独审子代理只读固定候选。测试与 Git 无并行写入。

## Notes

A01 仅本批取源部分。独审和作者体验分别报告。成果与修复分别提交，保留候选分支。
