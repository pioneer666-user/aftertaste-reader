# Tasks · 本地逐文件源码对照阅读

**Input** specs/006-file-reader/，批准 D011 @38b173f，dev bf15ac7。W01—W06 及 SC-001—005 映射见各项。

**D022 增量** [原任务 @46b0341](../../docs/work/2026/11/D022-reader-navigation/task.md)和[范围确认 @d93c9ee](../../docs/work/2026/11/D022-reader-navigation/amendments.md)，沿现有实现完成 FR-007—011、SC-006—008。其余页面优化沿后续派单。T001—017 保留 D011 实施记录。

**D028 增量** [原任务 @f00becb](../../docs/work/2026/11/D028-reader-history-canvas-tools/task.md)。T049—054 覆盖 FR-011、015—016 和 SC-013—015，依赖图浮层与闭环的联验见 [007 tasks](../007-dependency-canvas/tasks.md)。

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

## Phase 14 · D023 Setup & Foundational

- [x] T032 按 tests/README.md 在 .local/D023/ 重建共用试读的隔离副本，使用现有 CLI、清单和当前讲解结果。固定改前构建和同组样例，依 specs/006-file-reader/quickstart.md 取得对照实图（FR-012—014，SC-010—012）。

## Phase 15 · User Story 7 - 留在当前讲解查项目资料 (Priority: P1)

**Goal** 资料可查可选，关闭后继续读当前位置。

**Independent Test** 从临时侧栏打开资料，移入选取长路径，从 Esc 与窗外两种方式关闭，换篇检查字段。

- [x] T033 [US7] 在 tests/browser/reader-center.mjs 验资料面板、临时侧栏、键盘焦点、原阅读位置、窗外关闭、换篇及诊断（SC-010）。
- [x] T034 [US7] 在 src/web/App.vue、src/web/style.css 和 src/web/i18n.ts 由项目名开启资料浮窗，显示清单的项目路径和已显示讲解的路径、实际提交、校验。在 src/web/ReaderDocument.vue 保留影响阅读的诊断和修复（FR-012）。

## Phase 16 · User Story 8 - 逐段对照同一块源码 (Priority: P1)

**Goal** 从文件题头进入原文，滚动时短源码随块停留，所有源码行可读。

**Independent Test** 从服务讲解首块滚到下一块，检查临界分栏与窄屏，再用长源码、长行、矮窗和纯讲解块核末行、行号及正文。

- [x] T035 [US8] 在 tests/browser/reader-center.mjs 加入主阅读区滚动、长行、长源码、纯讲解和不同视口的行为检查，保存同组内容的候选实图（SC-011）。
- [x] T036 [US8] 在 src/web/ReaderDocument.vue 和 src/web/style.css 呈现一行文件题头、原 Markdown 和同块内停留的固定源码。按 SC-011 响应可视高度及分栏，横向滚动保持行号（FR-013）。

## Phase 17 · User Story 9 - 复制块定位去 AI 会话提问 (Priority: P1)

**Goal** 用键盘或鼠标取得整块或带选文的 U73 文本。

**Independent Test** 实际复制粘贴后拆解服务首块、第二块及无标题纯讲解块的载荷，在拒绝访问剪贴板时手动复制，并比较相同文本。

- [x] T037 [US9] 在 tests/browser/reader-center.mjs 验选文与整块定位、文档提交独立于 HEAD、JSON 往返、反向与边缘、键盘、失效、手动复制、原生复制和加入笔记（SC-012）。
- [x] T038 [US9] 在 src/web/ReaderDocument.vue、src/web/BlockLocationControl.vue、src/web/style.css 与 src/web/i18n.ts 加整块入口、选文浮条、键盘操作、双语反馈及兜底。复用 U73 对实际文档路径、块 ID 与源码提交的必填约束。选文可缺省，存在时为同一讲解块内的非空渲染原文，保留原片段的引号与换行（FR-014）。

## Phase 18 · D023 Polish & Cross-Cutting Concerns

- [x] T039 更新 docs/usage/file-reader.md。按 specs/006-file-reader/quickstart.md 完成类型、构建、隔离操作和受影响的 D022 串行回归，查实际兼容及呈现（FR-012—014，SC-010—012）。
- [x] T040 冻结候选，按 docs/roles/审查.md 做独审，逐场景提供证据并请审查人复做关键操作，处理问题并保存 docs/work/2026/11/D023-reader-center/review.md（FR-012—014，SC-010—012）。
- [x] T041 核 4341 服务归属后启动受审构建，沿原项目仅做确认。在 docs/work/2026/11/D023-reader-center/handoff.md 交回试读与作者体验入口（SC-010—012）。

## Phase 19 · D023 试读调整 - User Story 7 与 User Story 8

**Goal** 让讲解路径在打开文件后可见，同时保留按需查项目资料的入口。

**Independent Test** 切换讲解，在源码文件标题下查找可选取的小号讲解路径。再打开项目资料，核项目路径、引用提交和正常校验结果。用窄屏长路径核断行。

- [x] T042 [US8] 在 src/web/ReaderDocument.vue 和 src/web/style.css 将 `documentPath` 放到主标题下，按 SC-011 核字号及长路径断行（FR-013）。
- [x] T043 [US7] 在 src/web/App.vue 调整资料浮窗字段，保有项目路径、引用提交和正常校验结果（FR-012）。

## Phase 20 · D023 试读调整收束

- [x] T044 同步 docs/usage/file-reader.md。用 tests/browser/reader-center.mjs 和 specs/006-file-reader/quickstart.md 复验题头、切篇、浮窗、窄屏及受影响的现有阅读行为（SC-010/011）。
- [x] T045 冻结调整候选并由未参与实现的审查者复核，按 docs/work/2026/11/D023-reader-center/amendments.md 更新独审、回执及共用试读，在回执登记生效候选（SC-010/011）。

## Phase 21 · D026 User Story 10 - 从左上切换页面 (P1)

**Goal** 左上同序切页，知道当前所在页并可从讲解返回刚才的图。

**Independent Test** 中文桌面及英文临界宽度实点导航，窄窗用键盘打开六页和讲解侧栏；从图打开讲解并返回。

- [x] T046 [US10] 在 `tests/browser/dependency-canvas-selection.mjs` 定义六页顺序、当前项、英文收纳及窄窗键盘入口的检查，复用既有试读资料（FR-011、SC-013）。
- [x] T047 [US10] 在 `src/web/App.vue`、`src/web/style.css` 与 `src/web/i18n.ts` 复用页态建立共用左上顶栏、侧栏开关、当前状态、窄窗收纳和明确的图返回入口（FR-011）。

## Phase 22 · D026 Polish & Cross-Cutting Concerns

- [x] T048 按 `specs/006-file-reader/quickstart.md` 实测顶栏视口、导航与受影响的既有回访。同步 `docs/usage/file-reader.md`，后续独审与交回见 `specs/007-dependency-canvas/tasks.md`（SC-013）。

## Phase 23 · D028 Setup & Foundational

- [x] T049 核对 006、007 及 009 的现行需求与实现入口。沿 `specs/006-file-reader/quickstart.md` 固定 D027 与候选共用副本及测试命令（SC-013—015）。

## Phase 24 · D028 User Story 10 - 从左上切换页面 (P1)

**Independent Test** 按 SC-013 用同一视口切六页及中英文，量测顶栏位置并走键盘路径。

- [x] T050 [US10] 在 `tests/browser/reader-history.mjs` 定义基线与候选的顶栏测量、窄窗和可达入口验证（SC-013）。
- [x] T051 [US10] 在 `src/web/App.vue`、`src/web/style.css`、`src/web/i18n.ts` 建固定顶栏、侧栏映射与窄窗收纳，保留键盘跳过导航（FR-011）。

## Phase 25 · D028 User Story 11 - 前进或后退到刚才的阅读位置 (P1)

**Independent Test** 按 SC-014—015 经过图、讲解和记录，并用失败或延迟的读取核分支与最后落点。

- [x] T052 [US11] 在 `tests/browser/reader-history.mjs` 覆盖讲解位置、全路径往返、记录筛选和草稿、失败或延迟后的结果（SC-014—015）。
- [x] T053 [US11] 在 `src/web/App.vue` 接入内存历史及最新请求校验。用 `src/web/ProjectNotes.vue`、`src/web/notes-editor.ts`、`src/web/ProjectMarks.vue` 与 `src/web/DependencyCanvas.vue` 提供对应页的位置。恢复按当前资料和身份进行（FR-015—016）。

## Phase 26 · D028 Polish & Cross-Cutting Concerns

- [x] T054 按 `specs/006-file-reader/quickstart.md` 串行验证，核受影响的旧阅读回访。同步 `docs/usage/file-reader.md`，并把证据交 007 的联合独审（SC-013—015）。

## Phase 27 · D029 User Story 12 - 沿同一套轮廓阅读与操作 (P1)

**Independent Test** 按 SC-016 在同一订单项目的 `src/service.mjs` 中复现小控件、整行和源码板，并操作有焦点的浮层与块后记录。

- [x] T055 [US12] 在 `src/web/style.css` 和 `src/web/reader-corners.ts` 按共用顶栏与文件讲解入口设置不同尺寸的连续转角、可见焦点与等效轮廓（FR-017）。
- [x] T056 [US12] 按 `specs/006-file-reader/quickstart.md` 固定副本、做三引擎视窗对照，串行复用 `tests/browser/reader-center.mjs`、`tests/browser/reader-history.mjs` 和记录回访（SC-016）。

## Phase 28 · D029 Polish & Cross-Cutting Concerns

- [x] T057 冻结候选，交独立审查者按 `docs/roles/审查.md` 实走桌面、窄窗和非常规状态，归档 `docs/work/2026/11/D029-reader-continuous-corners/review.md`（SC-016）。
- [x] T058 独审通过后用固定构建换版 4341，在 `docs/work/2026/11/D029-reader-continuous-corners/handoff.md` 提供原项目的待验入口与对照（SC-016）。

## Phase 29 · D030 User Story 4 - 文件树切篇反馈 (P1)

**Independent Test** 按 SC-017 从订单服务篇中段选另一篇，分别观察自然响应、受控等待和失败恢复。

- [x] T059 [US4] 在 `tests/browser/reader-file-switch.mjs` 固定共用试读副本，记录实速时序、受控等待、覆盖、离开与失败恢复（SC-017）。
- [x] T060 [US4] 在 `src/web/App.vue`、`src/web/ReaderFileTree.vue`、`src/web/i18n.ts` 和 `src/web/style.css` 加入目标反馈、阅读占位及导航收束（FR-018—019）。
- [x] T061 [US4] 按 `specs/006-file-reader/quickstart.md` 验证 [SC-017](spec.md#measurable-outcomes)，串行回归文件树、其他阅读入口和读点。

## Phase 30 · D030 Polish & Cross-Cutting Concerns

- [x] T062 固定构建及输入，交独审并归档 `docs/work/2026/11/D030-reader-file-switch/review.md`。
- [x] T063 独审通过后以固定构建换版 4341，在 `docs/work/2026/11/D030-reader-file-switch/handoff.md` 提供证据与作者验收入口。

## Phase 31 · D030 试读调整 - User Story 4 (P1)

- [x] T064 [US4] 按占位覆盖调整更新 `src/web/App.vue`、`src/web/style.css` 并用 `tests/browser/reader-file-switch.mjs` 核对桌面、增高和窄窗占位填充（FR-018、SC-017），交审查者复核受影响的视口及自然、受控切篇。
- [x] T065 [US4] 按块高调整在 `src/web/App.vue`、`src/web/style.css` 交错长短块，随视口补足组数。用 `tests/browser/reader-file-switch.mjs` 复验覆盖、不同块高与快慢交接，交审查者复核（FR-018、SC-017）。

## D035 · 个人记录的侧栏与返回

- [x] T066 [US10] src/web/App.vue、src/web/RecordWorkbench.vue 与 tests/browser/reader-history.mjs 完成三页的分栏、选择、双区位置恢复及窄屏键盘操作。

## D036 · 从讲解选文、定位和起笔

- [x] T067 [US9] 在 `src/web/ReaderDocument.vue`、`src/web/BlockLocationControl.vue` 与 `tests/browser/reader-center.mjs` 合并两项选文操作，核同窗零位移和键鼠目标。
- [x] T068 [US5] 在 `src/web/App.vue`、`src/web/style.css` 区分普通点击、显式块跳转与持续键盘焦点，在 `tests/browser/reader-navigation.mjs` 验证。
- [x] T069 [US10] 在 `src/web/App.vue` 和 `tests/browser/reader-history.mjs` 接入六页共用的新建入口、保留阅读历史并验证不同视口的可达性。

- [x] T070 [US10] 在 `src/web/style.css` 和 `tests/browser/reader-history.mjs` 核英文粗指针顶栏，320px 菜单及 851px 笔记页签边缘可独立点按，右侧工具仍可用。

## D037 · 浅色选区浮条与右上角随手记

- [x] T071 [US9] 在 `src/web/BlockLocationControl.vue`、`src/web/style.css` 调整浮条材质与两类命中区，用 `tests/browser/reader-center.mjs` 实测。
- [x] T072 [US10] 在 `src/web/App.vue` 共用顶栏挂载面板，在 `tests/browser/reader-history.mjs` 核六页、阅读现场、图与窄窗。

- [x] T073 [US10] 在 `src/web/style.css` 处理读取失败提示和随手记同开的层级，用 `tests/browser/reader-file-switch.mjs` 实点预览、关闭及原提示（D037 独审 R1）。

- [x] T074 [US10] 将顶栏切为笔记列表，验证六页、原页加入、历史与触屏。

## D039 · User Story 6 页边记录（P1）

- [x] T075 [US6] 在 `src/web/ReaderDocument.vue` 实现长块页边入口、只开一处的浮层、响应式命中区、关闭与焦点，沿 FR-014、017 保留选文及连续角。
- [x] T076 [US6] 在 `src/web/BlockBookmarks.vue`、`BlockUnderstandingMark.vue` 接入逐条书签、自评和独立批注，保留两类草稿和失败重试。
- [x] T077 [US6] 在 `src/web/App.vue` 接通 FR-015、016 的显式回访与返回，核同块多条的焦点。
- [x] T078 [US6] 更新 `docs/usage/file-reader.md`，在 `tests/browser/` 串行验证 SC-008、草稿、并发、写失败与正文选文。

## Dependencies & Execution Order

Setup → Foundational → US1 → US2 → US3 → 收尾。US2 的用例可独立验证共用结果，页面沿 US1 外壳。US3 在同一页面独立验证。T014—017 在全部故事后收束。

D022 沿用上述已实现基础。T018 为隔离验证前置，US4 先建立侧栏，US5 接入同一导航工作区。US6 可独立通过旧记录入口验证，集成到 US4/US5 后核复合焦点。T025—027 在三个场景具备后收束。

试读调整复用 D022 初版成果。T028、T029 在 App.vue 汇合，T030 验交互后再完成 T031。

D023 复用已有清单、单篇读取、侧栏、Markdown、选文和诊断。T032 准备隔离输入和基线证据，US7 可独立验证资料，US8/US9 共用同一正文结构，先完成 US8 的排版再集成 US9 的入口。三个独立场景自测后做 T039，T040 独审通过后再做 T041。

D023 试读调整在已审版本上接续。T042 与 T043 完成后用 T044 复验组合呈现，再冻结为 T045 的复核候选。

D026 顶栏依次 T046 → T047 → T048，图往返在 007 的依赖图详情工作完成后合验。复用已有配置和隔离试读，验证资源串行。

D028 在 T049 固定同一输入。T050 → T051、T052 → T053 可按场景先准备检查，App.vue 由同一执行者集成。T054 依赖图的回访接口与浮层就绪，与 007 同候选串行联验。

D029 先固定比较输入，再由 T055 实现、T056 串行验。T057 在固定候选上独立进行，随后 T058 用受审构建换版。

D030 复用 US4 和 US11 的现有实现。T059 固定输入和重现路径，T060 集成反馈，T061 串行自测。T062 独审后以 T063 组织试读。

D030 占位覆盖调整由 T064 在已审版本上补齐，复核通过后更新共用试读和回执。

## Parallel Example

US1 的 CLI 与页面文件理论可分工，本任务单执行实现，测试串行。US2 的安全 Markdown 与服务失败用例理论可独立阅读。US3 的字典与存储例子理论可并行编写，实际串行完成。独审发生在固定候选之后。

D022 可分别编写块内记录组件和文件树组件。汇合处 App.vue、style.css 按各责任范围协调。需要真实服务或浏览器的步骤串行。

D023 可并行准备隔离用例与阅读端的实现草案。US7 的项目资料和 US8/US9 的正文可分开设计，style.css 和翻译表的修改应协调合入，真实服务与浏览器验证串行执行。

D026 顶栏与依赖图可分别实现，共用测试脚本、App.vue 与翻译表的修改需协调。实窗验证使用同一候选串行执行。

## Implementation Strategy

先接通服务和最小阅读路径，再补齐错误与双语，逐阶段验证。US1 是技术上的 MVP，本单交付包含全部 W01—W06。固定候选独审，作者体验待验后交回，不自动整合 dev。

D022 先验证开讲解与收栏的独立路径，再验证本篇定位及记录往返。全范围自测、独审后使用固定试读项目交回，作者体验待验。

D023 最小可验的阅读核心为 US8，当前批准交付同时包含 US7 和 US9。使用同组实文逐项验证，独审通过后换版并交回作者体验。

D026 先形成可切页的 US10，随后与 007 的首屏及分组在同一隔离项目验收并交回。

D028 先让六页顶栏位置一致，再核访问历史与各页落点。完整访问与回归证据提交 007 的冻结候选及独审。

D029 以同一份文件讲解覆盖核心阅读场景。等主要轮廓、相关状态和原操作均验证后，交独审与试读。
