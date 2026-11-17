# Tasks · 本地逐文件源码对照阅读

**Input** specs/006-file-reader/，批准 D011 @38b173f，dev bf15ac7。W01—W06 及 SC-001—005 映射见各项。

**Prerequisites** spec、plan、research、data-model、contracts 和 quickstart 已形成，实施前 analyze。

**Tests** D011 明确要求串行自测和真实浏览器。新测试先确认前置缺失，再实现相应能力。

**Organization** 按独立用户路径分组，本执行串行实现与验证。

## Format · [ID] [P?] [Story] Description

本批未标并行实现项，避免共享文件和运行资源冲突。

## Path Conventions

沿 src、tests、scripts 单包结构，输出 dist，临时运行资料仅 .local/D011。

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
- [ ] T016 固定候选提交，独立审查全链并保存 docs/work/2026/11/D011-file-reader/review.md，处理发现与复核（全部 FR）。
- [ ] T017 在 docs/work/2026/11/D011-file-reader/handoff.md 给作者入口、候选、验收/资源/Git 状态及不超过三点关注（全部 W）。

## Dependencies & Execution Order

Setup → Foundational → US1 → US2 → US3 → 收尾。US2 的用例可独立验证共用结果，页面沿 US1 外壳。US3 在同一页面独立验证。T014—017 在全部故事后收束。

## Parallel Example

US1 的 CLI 与页面文件理论可分工，本任务单执行实现，测试串行。US2 的安全 Markdown 与服务失败用例理论可独立阅读。US3 的字典与存储例子理论可并行编写，实际串行完成。独审发生在固定候选之后。

## Implementation Strategy

先接通服务和最小阅读路径，再补齐错误与双语，逐阶段验证。US1 是技术上的 MVP，本单交付包含全部 W01—W06。固定候选独审，作者体验待验后交回，不自动整合 dev。
