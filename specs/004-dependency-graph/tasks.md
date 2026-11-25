---
description: "固定版本文件依赖图的依赖有序实施清单"
---

# Tasks: 固定版本文件依赖图维护

**Input**: D009 @ c4010db G01—G05；specs/004-dependency-graph/ 的真实 spec/plan/research/model/contracts。已有 002/003 与 D008 证据，后置范围不进入本清单。

**Prerequisites**: plan.md、spec.md、research.md、data-model.md、contracts/cli.md；编码前 analyze，implement 扫全部 checklist。

**Tests**: D009 明确要求性质、真实 Git/CLI、存储失败注入与受影响回归；测试文件串行运行。

**Organization**: 按用户故事组织；US4 是各写操作安全前提，在基础设施落实，独立场景集中核验。

## Format: `[ID] [P?] [Story] Description`

ID 为本能力实施记录，勾选仅代表实际完成；[P] 表示文件独立可写，非并行运行测试授权。

## Path Conventions

单项目 src/core、application、adapters、cli；正式 tests/unit、integration、fixtures；输出 .local/D009/。

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 在 specs/004-dependency-graph/ 完成需求/方案/契约/清单，运行 analyze 与 implement 真实前置并记结果到 docs/work/2026/11/D009-dependency-graph/handoff.md。
- [x] T002 在 tests/fixtures/dependency-graph.mjs 建合成 Git 子项目、显式输入文件与 CLI 调用器，输出仅 .local/D009/。

## Phase 2: Foundational (Blocking Prerequisites)

- [x] T003 在 src/core/source-path.ts 提取共用纯路径规则，src/application/fixed-source.ts、src/adapters/git-source.ts 增 verify 并复用实际 commit 身份检查；空图也核完整 40/64 小写 hex、完整映射且实际身份等于输入。
- [x] T004 在 src/adapters/data-directory.ts 提取现有逐层目录身份保护，src/adapters/document-store.ts 复用，保持 DOCUMENT_EXISTS 与排他新建语义；Windows 大小写别名允许，现存链接拒绝。
- [x] T005 在 src/core/dependency-graph.ts 实现图/输入类型和严格校验，格式/字段/路径/重复/引用诊断；analysis 仅 unreviewed/reviewed，reason 非空且 Unicode 完好，同文件对唯一，允许环。
- [x] T006 在 src/adapters/graph-store.ts 实现 GraphStore 的严格 UTF-8 读取与完整临时文件发布，只有 ENOENT 为缺图；wx 后才清理，首次 link、更新 rename，复查旧原文，异常报告 published。

**Checkpoint**: 共用基础具备，故事测试先写后实现，安全边界不后置。

## Phase 3: User Story 1 - 登记与查询 (Priority: P1) MVP

**Goal**: 真实批次节点、重复登记、三种状态与保存版本可查。

**Independent Test**: 缺图只读不建资料；登记后新节点未核对，重复不降级；异 cwd/子项目仍引用固定 A。

- [x] T007 [US1] 在 tests/unit/dependency-graph.test.mjs、tests/integration/dependency-graph.test.mjs 先写登记/查询测试并观察尚未实现失败。
- [x] T008 [US1] 在 src/core/dependency-graph.ts 实现只补节点与查询，未登记 analysis=null，无边不隐含 reviewed。
- [x] T009 [US1] 在 src/application/dependency-graph.ts、src/cli/main.ts 接 apply-graph/query-graph，所有图命令完整固定参数必填；查询不读 Git，写入核固定提交，缺图仅明确写操作初始化。

## Phase 4: User Story 2 - 完整依赖列表 (Priority: P1)

**Goal**: 按核对使用者局部替换，保留未提交者。

**Independent Test**: service 的 old_repo 换 new_repo，router 入边不变，重复幂等；显式空列表有效，未完成声明无效。

- [x] T010 [US2] 在 tests/unit/dependency-graph.test.mjs 先写局部替换、环、空列表、幂等与独立未提交者预期性质测试并观察失败。
- [x] T011 [US2] 在 src/core/dependency-graph.ts、src/application/dependency-graph.ts 实现 reviews：analysis 必须 reviewed、dependencies 显式完整且唯一路径；新引用节点 unreviewed，按使用者替换全部入边，稳定排序，不改原对象。

## Phase 5: User Story 4 - 检查与安全保存 (Priority: P1)

**Goal**: 手编可检查，坏图不覆盖；安全发布结果准确。

**Independent Test**: 错字段/悬空/缺对象定位，注入写/发布/清理失败核旧字节与 published，普通大小写别名与 junction 分开。

- [x] T012 [US4] 在 tests/integration/dependency-graph.test.mjs 先写空图身份/映射/缺对象、坏图、UTF-8、非法输入、碰撞/部分写/link/rename/清理注入及链接保护场景并观察未实现失败。
- [x] T013 [US4] 在 src/application/dependency-graph.ts、src/cli/main.ts 实现 validate-graph 共用检查与候选门禁，合法结构但源码失败标 unavailable，旧图损坏/版本不同拒写，输入只读。

## Phase 6: User Story 3 - 明确删除 (Priority: P2)

**Goal**: 只明确删除图节点，反馈移除边及受影响存续者。

**Independent Test**: 删除 schema 令 service 未核对、router 与无关资料保留；重复删除不变。

- [x] T014 [US3] 在 tests/unit/dependency-graph.test.mjs、tests/integration/dependency-graph.test.mjs 先写删除/失边状态/存续引用性质及资料保护测试并观察失败。
- [x] T015 [US3] 在 src/core/dependency-graph.ts 实现明确 remove，冲突删除/登记/核对/依赖引用拒绝；被动失边存续使用者 unreviewed，返回 removedEdges/affectedDependents，不动图外资产。

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T016 在 tests/fixtures/dependency-graph.mjs 完成 --demo 真实 CLI 路径，串行执行 specs/004-dependency-graph/quickstart.md；记录准确状态和落盘事实。
- [x] T017 在 docs/work/2026/11/D009-dependency-graph/handoff.md 记录 typecheck/build、本批测试与受影响固定取源/文档回归结果、失败轮次和未验证边界；核 README.md、tests/README.md 的工具入口。
- [x] T018 固定候选调用未参与实现审查子代理，将原文存 docs/work/2026/11/D009-dependency-graph/review.md，取得写入交还，处理并复核问题，完成 handoff，保留候选不合 dev。

## Dependencies & Execution Order

### Phase Dependencies

Setup → Foundational → US1 → US2 → US4 → US3 → Polish。US4 的存储保护在 T006 已落实；其完整诊断测试仍独立可跑。

### User Story Dependencies

US1 无其他故事前置；US2 复用登记/存储；US4 可用手编图独立验查；US3 复用局部应用与既有边。独立测试不要求其他测试产物。

### Within Each User Story

先写相关测试并记录失败，再实现；core→service→CLI。每个输入仓库由 fixture 独立创建。

### Parallel Opportunities

本批同一执行串行实现。US1 查询例与登记例、US2 纯规则与 CLI 例、US4 存储与结构反例、US3 纯规则与资料保护例可分开编写；测试运行始终串行，无实际并行写任务。

## Parallel Example: User Stories

US1：分开设计未登记查询与重复登记输入；US2：分开设计幂等与未提交者独立预期；US4：分开设计损坏结构与磁盘失败；US3：分开设计失边状态与无关资料。均在同一测试文件有序实现，不启动并行资源。

## Implementation Strategy

### MVP First (User Story 1 Only)

完成基础与登记查询后做定向验证；只作内部检查点，本单仍须 G01—G05 全完成再交回。

### Incremental Delivery

按阶段实现，每阶段受影响测试串行；最终固定候选、自测、独审、必要修复与归档。

### Parallel Team Strategy

Phase 0 只读研究已委派；实现由唯一执行写入，独审另用未参与实现子代理。没有并行实现者。

## Notes

不扩展产品范围，不伪造全量性能/页面/Skill 验收。真实失败遵两轮停点，检查完成后才勾对应任务。

## D053 · 从问句了解次要依赖

- [x] T019 [US5] 在 `src/core/dependency-graph.ts` 落实 FR-012，沿对应契约串行验证 SC-006。
