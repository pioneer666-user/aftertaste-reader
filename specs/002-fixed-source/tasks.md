# Tasks: 固定提交取源

**Input** | `specs/002-fixed-source/` 的 spec、plan、research、data-model、contracts、quickstart

**Prerequisites** | 官方 specify 和 plan 材料已完成，按 analyze 核一致性后实施。

**D007 User Input** | 批准为 docs/work/2026/11/D007-fixed-source-hardening/task.md@05daca6，范围 H01—H05。既有实现为 dev@4ecb7ca，D006 的 14 项测试与独审只覆盖当时场景，H01—H03 已由主脑补查复现。此次仅增量维护本目录材料和任务指定源码、测试、现有说明及 D007 回执/独审。后置文档解析、指南、HTTP、页面、画布、更新与导出继续留待后续派单。本段同时作为 tasks、analyze、implement 的输入。

**Tests** | D006 明确要求。先编写测试并观察未实现失败，再实现。测试文件与样例串行执行。

**Organization** | 按场景安排，同一目标完整交付。

## Format

任务使用 `T编号 [US编号] 描述及路径`。本批同文件有依赖，全部串行。

## Path Conventions

根单工程使用 `src/`、`tests/`，D006 的可重建输出使用 `.local/D006-fixed-source/`，D007 使用 `.local/D007/<run-id>/`，构建输出为 `dist/`。

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
- [x] T011 串行运行 typecheck/build/test 和 quickstart，在 docs/work/2026/11/D006-fixed-source/handoff.md 记录环境、范围、命令、结果和未验项
- [x] T012 固定成果候选提交，调用独立审查，保存 docs/work/2026/11/D006-fixed-source/review.md，处理/复核发现并完成 handoff.md

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

## Phase 6: D007 Setup & Foundational

- [x] T013 按实际 spec/plan/tasks 模板增量维护 specs/002-fixed-source/，执行 analyze，检查 implement 前置与全部 checklist，保留 T001—T012 的 D006 记录
- [x] T014 在 tests/fixtures/fixed-source.mjs 将本批输出隔离到 .local/D007/<run-id>/，建立独立系统临时样例并核无外层工作仓库

## Phase 7: D007 User Story 1 - 不可变身份与历史读取 (Priority: P1)

**Goal** | H01/H02，固定身份与历史子项目读取成立。

**Independent Test** | 移动同形别名两次均拒绝，有效 SHA-1/SHA-256 可读，移走整个子项目后原引用在用例与两个 cwd 的 CLI 仍读 A。

- [x] T015 [US1] 在 tests/integration/fixed-source.test.mjs 先以旧实现运行 H01/H02 回归，记录实际失败及输入到 docs/work/2026/11/D007-fixed-source-hardening/handoff.md
- [x] T016 [US1] 在 src/application/fixed-source.ts 校验完整固定字段、规范前缀与根组合，历史读取只核原仓库，保留旧 fixed 字段；在 src/adapters/git-source.ts 核实实际完整 commit 身份并沿不可变 ID 读取
- [x] T017 [US1] 在 tests/integration/fixed-source.test.mjs 验证有效完整对象、原仓库/对象不可用、映射篡改、越界、元数据和提交树链接/gitlink，核历史读取只读与诊断

## Phase 8: D007 User Story 2 - 诊断与共用入口 (Priority: P1)

**Goal** | H03/H04/H05，目标诊断真实、入口共用、平台路径有效。

**Independent Test** | 外层仓库之外的 bare 为 UNSUPPORTED_TARGET，普通目录为 NOT_REPOSITORY，共用用例同次 read 项目定位一次，平台路径样例及 Windows 专项保留。

- [x] T018 [US2] 在 tests/integration/fixed-source.test.mjs 先记录独立 bare 的旧实现失败，在 src/adapters/git-source.ts 将 bare 判定置于祖先搜索前，累计第 2 轮修复后串行验证，失败停写
- [x] T019 [US2] 在 src/application/fixed-source.ts 接收 projectRoot/commit 便捷输入并定位一次，src/cli/main.ts 仅传输参数，新增成对 --repository/--prefix 复用完整固定引用
- [x] T020 [US2] 在 tests/unit/fixed-source.test.mjs 使用当前平台绝对路径、核单次项目定位和固定映射校验，在 tests/integration/fixed-source.test.mjs 保留 Windows 无盘符/跨盘及新增参数前置拒绝

## Phase 9: D007 Polish & Cross-Cutting Concerns

- [x] T021 更新 README.md、tests/README.md 和 specs/002-fixed-source/quickstart.md 的兼容/历史读取示例与诊断，串行执行 typecheck/build/全套测试并在 docs/work/2026/11/D007-fixed-source-hardening/handoff.md 记录真实环境与轮次
- [x] T022 固定候选后调用 Ponytail Review 独立审查，取得写入交还并逐字保存 docs/work/2026/11/D007-fixed-source-hardening/review.md，处理/复核发现、完成 handoff.md 并保留分支待主脑接回

### D007 Dependencies & Execution Order

T013 → T014 → T015/T018 的失败采集 → T016/T019/T020 → T017/T018 的修复验证 → T021 → T022。实施和测试均串行，两个场景按各自独立判据验收，完整 D007 交回须 H01—H05 闭合。US1 相关任务覆盖 FR-003/008 与 SC-005/006，US2 覆盖 FR-001/005/007/009 与 SC-002/006，T017/T021 回归 FR-002/004/006 和 SC-001/003/004。没有同文件无依赖的并行写入机会。
