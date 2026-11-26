# Tasks: 普通文件讲解的分批生成

**Input**: `specs/005-generation-skill/` 的 spec、plan、research、data-model、contracts 与 quickstart。批准为 D010 @ `2a6f27d`，仅 S01—S06。

**Prerequisites**: 正式设计完整，实施前实际 analyze 和 checklist 门禁。

**Tests**: D010 要求静态检查、实际代理行为检查、工具输出复核与独审，测试串行。

**Organization**: 按用户场景组织，沿官方 tasks-template。

## Format: `[ID] [P?] [Story] Description`

任务使用顺序 ID、真实路径和用户场景标签。[P] 只代表可独立写作，运行验证仍串行。

## Path Conventions

产品原件在 skills/aftertaste-reader，正式输入在 tests/fixtures，行为说明在 tests/skills，证据在 D010，运行输出在 .local/D010。

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 核工具契约与环境，在 specs/005-generation-skill/research.md 落实技术细节和证据复用边界（FR-002、008）
- [x] T002 建立 tests/fixtures/generation-project.mjs 的排他合成项目生成器，固定树与变化工作区可复建（FR-009）

## Phase 2: Foundational (Blocking Prerequisites)

- [x] T003 创建 tests/skills/generation.md 行为场景和 tests/skills/generation-static.test.mjs 包检查，先观察入口缺失失败（FR-001—009）
- [x] T004 编写 skills/aftertaste-reader/references/tools.md，准确连接三份 CLI 契约，给绝对工具入口、完整映射及诊断判读（FR-002、008）

## Phase 3: User Story 1 - 选范围和节奏生成 (Priority: P1)

**Goal**: 完整小批次生成与节奏控制。
**Independent Test**: 缺范围／节奏无生成写入，明确后逐批停、连续完成范围。

- [x] T005 [US1] 创建 skills/aftertaste-reader/SKILL.md 和 references/generation.md，范围／节奏缺失等待，串起固定来源与七步生成（FR-001、002、008）
- [x] T006 [US1] 编写 skills/aftertaste-reader/references/authoring.md，骨架 ID 由工具生成，完整行覆盖、空正文与超大判读沿 003（FR-004）
- [x] T007 [US1] 真实使用代理按 tests/skills/generation.md 完成两种节奏，将输入、调用和结果归 docs/work/2026/11/D010-generation-skill/evidence.md（FR-009、SC-001、002、004）

## Phase 4: User Story 2 - 资料保护与失败 (Priority: P1)

**Goal**: 既有资料保护、依赖状态真实与失败可解释。
**Independent Test**: 版本冲突、已有文档、取源／校验失败保留资料，范围外依赖无讲解。

- [x] T008 [US2] 在 skills/aftertaste-reader/references/generation.md 落实实际 current／图检查、同版本次骨架续填边界和部分失败交付（FR-002、005、006）
- [x] T009 [US2] 用 tests/skills/generation.md 的保护与失败场景核实际字节、文档及图状态，证据写 docs/work/2026/11/D010-generation-skill/evidence.md（FR-005、006、SC-002、003）

## Phase 5: User Story 3 - 教法与阅读方向 (Priority: P2)

**Goal**: 资料指导真实讲解，维护依据可核。
**Independent Test**: 无资料可生成，真实反馈按来源合并，方向只记实际已讲。

- [x] T010 [US3] 创建 skills/aftertaste-reader/references/teaching.md，依代码、需要与前后联系组织重点，给具体正反例及分组理由（FR-003）
- [x] T011 [US3] 创建 skills/aftertaste-reader/assets/templates/preferences.md、reading-direction.md 及 references/feedback.md，落实两来源分区与项目路径，超过 8,000 非空白 Unicode 码点仅提醒整理（FR-007）
- [x] T012 [US3] 按 tests/skills/generation.md 实测已有偏好、无反馈、重复与冲突反馈及仅提问场景，记录 docs/work/2026/11/D010-generation-skill/evidence.md（FR-003、007）

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T013 同步 specs/001-first-release/04-reading-modes.md、07-skill-design-map.md、08-current-spec-and-acceptance.md 与 docs/development/directories.md 的模板／路径／能力状态，更新包 README 和根 README（FR-007、008）
- [x] T014 完成 docs/usage/generation-skill.md 和 specs/005-generation-skill/quickstart.md 的真实步骤，归档 sample/README.md、完整讲解、图／方向和校验摘要，以 tests/skills/generation-sample.test.mjs 在重建来源上复核（FR-008、009、SC-004）
- [x] T015 固定候选并派独立审查，保存 docs/work/2026/11/D010-generation-skill/review.md 原文，处理问题复核并交 handoff.md（FR-009）

## Phase 7: User Story 2 增量 · 写入前 Git 可见性（D057）

**Independent Test** 用安装包在隔离 Git 仓和用户配置中复跑首次与混合可见性。

- [x] T016 [US2] 由 `src/cli/main.ts` 接入 `src/adapters/project-privacy.ts` 的 Git 分类、本机忽略、记住及撤销（FR-013、FR-014）。
- [x] T017 [US2] 连接 `skills/aftertaste-reader/references/tools.md` 与四条写入流程，按 `tests/skills/project-privacy.md` 留实际提示及 Git 前后状态（SC-009）。
- [x] T018 [US2] 修复 `src/adapters/personal-file.ts` 共用权限保持，串行运行 `tests/integration/personal-access.test.mjs` 及原有回归，保存 D057 回执和独审。

## Dependencies & Execution Order

Setup → Foundational → US1 → US2 → US3 → 收尾。US2 的边界在 US1 实测前同时写入，保护作为所有写入的前提。T007、T009、T012 可用少量组合场景串行覆盖。

D057 的两条实现路径交互独立。T016 的工具结果先于 T017 的安装包行为实测。T018 的权限用例与全仓回归串行，归档前合看三条证据并派独审。

### Parallel Opportunities

US1 可在工具指导定稿后分别校核入口与制作约束。US2 的只读字节核对与资料状态阅读可独立准备。US3 的两模板可独立核原设计。各次运行、真实使用代理与独审依次进行，避免共享资料漂移。

## Parallel Example: User Story 1

T005 的入口路由与 T006 的块规则可分文件准备，本次由同一执行者串行落地。US2 在保护规则写完后测试，US3 在模板落定后测试。

## Implementation Strategy

先形成 US1 最小完整流程，再以保护／失败场景验证 US2，最后验证教学资料维护。每个场景有独立可观察结果。作者试读前完成客观检查和独审，本单保留候选交回。

## Notes

不新增依赖或产品程序，除非实际调用证据表明必要小缺口。自测、独审与作者验收分别记录，后置分支沿 D010。
