# Tasks · 跨文件闭环讲解

**Input** [规格](spec.md)、[方案](plan.md)、[数据模型](data-model.md)、[命令契约](contracts/cli.md)、[快速验证](quickstart.md)。

**Tests** D015 要求的受控订单、独立重读与失败重试。

**Organization** 按 US1–US3 顺序完成，每项以回味开发仓库为相对路径根。

## Format

`- [ ] T### [P?] [US#?] 描述与路径`。各阶段依赖见末尾。

## Phase 1 · Setup

- [x] T001 核现有 `package.json`、`.gitignore` 与 Node/Git/TypeScript 工具入口，使用现有隔离样例、依赖和构建流程。

## Phase 2 · Foundational

- [x] T002 在 `src/core/loops.ts` 校验输入和成品的版本及字段。限定 ID 为 1–64 个小写字母、数字和单连字符组成的分段名称，闭环 ID 拒绝 Windows 设备名。要求非空教学字段、至少两个来源文件、有效块 ID、从入口可达、每节点在顺序中恰出现一次。创建输入拒绝未知字段。成品采用 1 起始且含末行的范围，纯讲解块无范围。复用 `src/core/dependency-graph.ts` 图例及 `src/core/document-blocks.ts` 行范围校验（FR-003、FR-004、FR-006）。

## Phase 3 · User Story 1 选一条路线并走完（P1）

**Goal** 用户选线后生成有分支的跨文件讲解。

**Independent Test** 订单入口至数量规则及两种结果听得懂，资料不足能找到断点。

- [x] T003 [US1] 在 `tests/fixtures/loop-authoring.mjs`、`tests/integration/loops.test.mjs` 写订单选线、分支、顺序、图例以及缺块创建用例（SC-001）。
- [x] T004 [US1] 在 `src/application/loops.ts` 复用固定取源和有效块校验，复制所选块正文及范围。所选图例只复制对应版本真实存在且明确选用的参与文件用法（FR-004、FR-006）。
- [x] T005 [US1] 在 `src/adapters/loop-store.ts`、`src/cli/main.ts` 接通 `create-loop` 和隔离的完整成品发布（FR-004、FR-006）。
- [x] T006 [US1] 接入 `skills/aftertaste-reader/SKILL.md`、`references/loops.md` 和 `references/tools.md`。使用偏好与已有讲解，等待选择，解释步骤关系和假设示例，说明断点（FR-001、FR-002、FR-003）。

## Phase 4 · User Story 2 换会话重读（P2）

**Goal** 讲解随成果保留，源码按原固定引用取得。

**Independent Test** 新进程用已存资料读取，同项目的原文、图和 HEAD 改变后结果稳定，Git 暂缺时降级。

- [x] T007 [US2] 在 `tests/integration/loops.test.mjs` 覆盖新进程、资料更新、固定对象不可用及无持久源码（SC-002、SC-003）。
- [x] T008 [US2] 在 `src/adapters/loop-store.ts`、`src/application/loops.ts`、`src/cli/main.ts` 实现 `read-loop`，校验成品、定位原范围、返回可用源码及分项诊断。Markdown 重读覆盖目标、节点、原讲解、关系、顺序、提示和图例（FR-004、FR-005）。

## Phase 5 · User Story 3 创建失败后恢复（P3）

**Goal** 占用的 ID、输入失败及中断不破坏资料。

**Independent Test** 查成品、个人资料、隔离暂存与重试的磁盘结果。

- [x] T009 [US3] 在 `tests/integration/loops.test.mjs` 验证失效块、悬空边、同名新建、并发竞争、路径及发布中断后的重试（SC-004）。
- [x] T010 [US3] 在 `src/adapters/loop-store.ts` 保证暂存名称不可读成品，已有 ID 拒绝覆盖，重试仅发布一份完整结果。检查归属及目录、文件的链接，失败保留原数据（FR-006）。

## Phase 6 · Polish & Cross-Cutting Concerns

- [x] T011 在 `docs/usage/generation-skill.md` 交付入口，按 `specs/008-loop-authoring/quickstart.md` 用真实 Skill 与 CLI 走通试讲。样例和重建入口归 `docs/work/2026/11/D015-loop-authoring/sample/`（SC-001）。
- [ ] T012 从 `package.json` 使用类型、构建及串行回归检查，固定候选后取得独审，把真实证据和作者试读入口归 `docs/work/2026/11/D015-loop-authoring/handoff.md`、`review.md`。

## Dependencies & Execution Order

### Phase Dependencies

Setup → 共同校验 → 可保存的选讲 → 独立读回 → 重试保护 → 交付。T010 的发布约束在 T005 建立时同步设计，US3 以完整的故障用例复核。各故事对应测试先编写，再完成实现。

### User Story Dependencies

US1 可验证完整成品写入。US2 可以读取 US1 的成品或同协议合成文件。US3 可独立以临时目录内既有成品和被注入故障的保存调用验证。

### Parallel Opportunities

Skill 文案和纯校验使用不同文件，等接口确定后可分别编辑。操作磁盘和 Git 的测试按仓库规则串行执行。

## Parallel Example · User Story 1

T006 编辑 Skill 路由和教学指导时，T004 可以单独编辑用例。两项在 T011 的真实试讲汇合。

## Implementation Strategy

### MVP First

选一条已有讲解支持的分支路线，保存讲解材料及源码引用。

### Incremental Delivery

接通独立读回与部分源码失败的降级，再补中断重试及个人资料保护证据。D015 候选一次交付三个故事。
