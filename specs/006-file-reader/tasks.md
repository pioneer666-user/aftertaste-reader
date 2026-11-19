# Tasks · 本地逐文件源码对照阅读

**Input** specs/006-file-reader/，批准 D011 @38b173f，dev bf15ac7。W01—W06 及 SC-001—005 映射见各项。

**D022 增量** [原任务 @46b0341](../../docs/work/2026/11/D022-reader-navigation/task.md)和[范围确认 @d93c9ee](../../docs/work/2026/11/D022-reader-navigation/amendments.md)，沿现有实现完成 FR-007—011、SC-006—008。其余页面优化沿后续派单。T001—017 保留 D011 实施记录。

**Prerequisites** spec、plan、research、data-model、contracts 和 quickstart 已形成，实施前 analyze。

**Tests** D011 明确要求串行自测和真实浏览器。D022 按批准任务先核实际阅读操作，再做补充回归，沿 quickstart 串行验证。

**Organization** 按独立用户路径分组，本执行串行实现与验证。

## Format · [ID] [P?] [Story] Description

本批未标并行实现项，避免共享文件和运行资源冲突。

## Path Conventions

沿 src、tests、scripts 单包结构，输出 dist。临时运行资料按批使用 .local/D011 或 .local/D022。

## Phase 1 · Setup (Shared Infrastructure)

- [x] T001 在 package.json、唯一 package-lock.json、tsconfig.web.json、vite.config.ts 接通固定依赖、Vue 类型与预构建（FR-001/006）。
- [x] T002 在 tests/fixtures/reader-project.mjs 重建 D010 合成首批，供真实路径验证（SC-001—005）。

## Phase 2 · Foundational (Blocking Prerequisites)

- [x] T003 在 tests/unit/file-reader.test.mjs 核单次读取、物理行与既有 CLI 语义，在 src/application/document-blocks.ts 共用读取/校验链（FR-003/004）。
- [x] T004 在 src/adapters/reader-directory.ts、src/application/file-reader.ts 建立启动项目检查、发现及只读模型。条目包含 documentPath/sourcePath，保留目录扩展名；无链接祖先（FR-001/002/006）。

## Phase 3 · User Story 1 - 逐块阅读 (Priority P1)

**Goal** 从任意 cwd 启动后选择讲解并完整对照固定源码。

**Independent Test** D010 两篇、工作区/HEAD 修改、刷新、停止重启。

- [x] T005 [US1] 在 tests/integration/file-reader.test.mjs 先核 CLI/HTTP 契约、文件发现、来源/路径、只读与固定源场景（FR-001/002/003/006，SC-001/002/005）。
- [x] T006 [US1] 在 src/server/reader.ts、src/cli/main.ts 提供回环服务、预构建资源、serve 参数与关闭诊断（FR-001/006）。
- [x] T007 [US1] 在 src/web/App.vue、ReaderDocument.vue、main.ts、style.css 呈现导航、两类块、行号、长行、原文 Markdown 及刷新请求防过期（FR-002/003）。
- [x] T008 [US1] 在 tests/browser/file-reader.mjs 串行核真实入口与正常阅读、固定提交、刷新、快速切换、响应式和键盘操作（SC-001/002）。

## Phase 4 · User Story 2 - 失败阅读 (Priority P1)

**Goal** 阅读失败状态真实可定位，已有讲解保留可读。

**Independent Test** 结构/范围/Git/文档读取四类失败。

- [x] T009 [US2] 在 tests/integration/file-reader.test.mjs 和 tests/unit/file-reader.test.mjs 覆盖降级、空源码/正文、大小边界及恶意 Markdown（FR-004/006，SC-003/005）。
- [x] T010 [US2] 在 src/web/markdown.ts、ReaderDocument.vue、App.vue 呈现安全降级、诊断、复制/手动复制和真实读取失败（FR-004/006）。
- [x] T011 [US2] 在 tests/browser/file-reader.mjs 核可见失败、无源码修复文本、无脚本/外部资源、空态和长内容（SC-003/005）。

## Phase 5 · User Story 3 - 语言切换 (Priority P2)

**Goal** 全部界面双语，正文和位置保留，浏览器仅记语言。

**Independent Test** 默认/保存/非法值/存储不可用和英文长文案。

- [x] T012 [US3] 在 src/web/i18n.ts、App.vue、ReaderDocument.vue 建立 zh-CN/en、code/params 诊断映射和中文回退（FR-005）。
- [x] T013 [US3] 在 tests/unit/file-reader.test.mjs、tests/browser/file-reader.mjs 核缺键回退、全部状态翻译、保存失败、刷新恢复及位置保留（SC-004）。

## Phase 6 · Polish & Cross-Cutting Concerns

- [x] T014 在 docs/usage/file-reader.md、generation-skill.md、README.md、skills/aftertaste-reader/references/tools.md 接通实际阅读入口，同步 08 与 B003 已实现语言范围（FR-001/005）。
- [x] T015 在 docs/work/2026/11/D011-file-reader/evidence.md 记录类型、构建、串行测试、Edge/Chrome/Firefox、Impeccable 及安全/只读证据（SC-001—005）。
- [x] T016 固定候选提交，独立审查全链并保存 docs/work/2026/11/D011-file-reader/review.md，处理发现与复核（全部 FR）。
- [x] T017 在 docs/work/2026/11/D011-file-reader/handoff.md 给作者入口、候选、验收/资源/Git 状态及不超过三点关注（全部 W）。

## Phase 7 · D022 Setup & Foundational

- [x] T018 依据 tests/README.md、tests/fixtures/loop-reader.mjs 和 tests/fixtures/page-preview/ 在 .local/D022/ 隔离试读资料，复用现有本地启动、文档清单和单篇阅读结果作为三条路径的共用前置（FR-007—011，SC-006—008）。

## Phase 8 · User Story 4 - 从项目文件树打开讲解 (Priority: P1)

**Goal** 按目录打开讲解并切换侧栏，重开保留阅读上下文。

**Independent Test** 键盘打开同名异目录讲解，收栏重开并核当前项，窄屏选文件和关闭。

- [x] T019 [US4] 在 src/web/ReaderFileTree.vue、src/web/App.vue、src/web/style.css 与 src/web/i18n.ts 建立文件树、目录展开、项目名与路径、当前项、工作区内开关及窄屏键盘操作，维持全局顶栏（FR-007/008/011）。
- [x] T020 [US4] 按 specs/006-file-reader/quickstart.md 操作隔离项目，再由 tests/browser/reader-navigation.mjs 检查文件树、收栏重开、长目录、同名项及窄屏文件选择和关闭（SC-006）。

## Phase 9 · User Story 5 - 从本篇目录跳到讲解块 (Priority: P1)

**Goal** 可从本篇块目录准确回跳，手动滚动时可识别当前块。

**Independent Test** 同一篇重名块分别可达，快速切换不显示过期目录，降级保留诊断。

- [x] T021 [US5] 在 src/web/markdown.ts、src/web/App.vue、src/web/style.css 与 src/web/i18n.ts 由当前有效块派生本篇原序目录和纯文本标签，按文档路径与块 ID 跳转，关联滚动状态并处理窄屏焦点和双语回退（FR-008/009）。
- [x] T022 [US5] 按 specs/006-file-reader/quickstart.md 操作隔离项目，再由 tests/browser/reader-navigation.mjs 验服务与路径工具五块、重名标题、仅代码、空正文、降级、快切和语言切换（SC-006/007）。

## Phase 10 · User Story 6 - 阅读正文并回访个人记录 (Priority: P1)

**Goal** 先读正文，按需展开记录，由项目入口直达所选记录。

**Independent Test** 分别回访同块两条书签、当前不理解批注和跨文件笔记，再核编辑和失败草稿。

- [x] T023 [US6] 在 src/web/ReaderDocument.vue、src/web/BlockBookmarks.vue、src/web/BlockUnderstandingMark.vue、src/web/App.vue 与 src/web/style.css 将记录操作放到正文后，沿现有草稿与保存复用，回访展开并定位当前块与具体记录（FR-010/011）。
- [x] T024 [US6] 按 specs/006-file-reader/quickstart.md 操作隔离项目，再在 tests/browser/reader-navigation.mjs 及受影响的书签、标注和笔记浏览器测试中验证精确回访、键盘、编辑状态及资料保护（SC-008）。

## Phase 11 · D022 Polish & Cross-Cutting Concerns

- [x] T025 更新 docs/usage/file-reader.md，按 specs/006-file-reader/quickstart.md 核真实渲染、顶栏、类型、构建及串行回归，在本次回执记录证据（FR-007—011，SC-006—008）。
- [x] T026 冻结候选，按 docs/roles/审查.md 委派独审并处理发现，保存 docs/work/2026/11/D022-reader-navigation/review.md（FR-007—011）。
- [x] T027 核实共用试读服务归属，向 4341 部署受审候选，沿同项目打开并烟测，将入口、验收待办及 Git 状态记入 docs/work/2026/11/D022-reader-navigation/handoff.md（SC-006—008）。

## Phase 12 · D022 试读调整 - User Story 4 与 User Story 5

**Goal** 让桌面读者更顺手地打开导航及分配文件树和本篇目录的空间，减少顶栏占用。

**Independent Test** 收栏、从左缘临时打开、用图标固定，拖动分隔线后收栏并重开。比较正文宽度、阅读位置和两区比例。

- [x] T028 [US4] 在 src/web/App.vue、src/web/style.css 和 src/web/i18n.ts 实现桌面紧凑顶栏、侧栏图标与左缘临时展开，保留窄屏和键盘路径（FR-008/011）。
- [x] T029 [US5] 在 src/web/ReaderSidebarDivider.vue、src/web/App.vue、src/web/style.css 和 src/web/i18n.ts 接通文件树与本篇目录的可拖分隔线及键盘入口，份额限制在 20%—80%（FR-009）。

## Phase 13 · D022 试读调整收束

- [x] T030 以 specs/006-file-reader/quickstart.md 和 tests/browser/reader-navigation.mjs 验左缘临时展开、拖动与键盘、顶栏高度和窄屏基本操作，同步 docs/usage/file-reader.md（SC-006/009）。
- [x] T031 冻结试读调整候选，独审后沿同项目更新 4341，归档 docs/work/2026/11/D022-reader-navigation/review.md 与 handoff.md（SC-009）。

## Dependencies & Execution Order

Setup → Foundational → US1 → US2 → US3 → 收尾。US2 的用例可独立验证共用结果，页面沿 US1 外壳。US3 在同一页面独立验证。T014—017 在全部故事后收束。

D022 沿用上述已实现基础。T018 为隔离验证前置，US4 先建立侧栏，US5 接入同一导航工作区。US6 可独立通过旧记录入口验证，集成到 US4/US5 后核复合焦点。T025—027 在三个场景具备后收束。

试读调整复用 D022 初版成果。T028、T029 在 App.vue 汇合，T030 验交互后再完成 T031。

## Parallel Example

US1 的 CLI 与页面文件理论可分工，本任务单执行实现，测试串行。US2 的安全 Markdown 与服务失败用例理论可独立阅读。US3 的字典与存储例子理论可并行编写，实际串行完成。独审发生在固定候选之后。

D022 可分别编写块内记录组件和文件树组件。汇合处 App.vue、style.css 按各责任范围协调。需要真实服务或浏览器的步骤串行。

## Implementation Strategy

先接通服务和最小阅读路径，再补齐错误与双语，逐阶段验证。US1 是技术上的 MVP，本单交付包含全部 W01—W06。固定候选独审，作者体验待验后交回，不自动整合 dev。

D022 先验证开讲解与收栏的独立路径，再验证本篇定位及记录往返。全范围自测、独审后使用固定试读项目交回，作者体验待验。
