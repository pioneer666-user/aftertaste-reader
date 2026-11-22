---
description: "块级注解书签与回访实施清单"
---

# Tasks: 块级注解书签与回访

**Input**：[010 设计材料](plan.md)

**Prerequisites**：[spec](spec.md)、[research](research.md)、[data model](data-model.md)、[contract](contracts/bookmarks.md)、[quickstart](quickstart.md)

**Tests**：按 D019 增加单元、真实 HTTP 和浏览器验证，先写检查再实现。

**Organization**：各阶段沿读者场景组织。

## Format: `[ID] [P?] [Story] Description`

`[P]` 允许独立编辑。用户故事任务标记 `[US1]` 至 `[US3]`。

## Path Conventions

路径相对仓库根。运行资料放 `.local/D019/<run-id>/`。

## Phase 1: Setup

- [X] T001 核 Git、Node 24、锁定依赖和既有忽略规则，使用 `package.json` 与 `.gitignore`。

## Phase 2: Foundational

- [X] T002 [P] 准备可重建试读样例，复用 `tests/fixtures/reader-project.mjs`，在 `tests/fixtures/bookmark-project.mjs` 建立非首块、纯讲解及重名块。
- [X] T003 [P] 在 `tests/unit/bookmarks.test.mjs` 写字段、备注原文与 ID 唯一检查。
- [X] T004 在 `src/core/bookmarks.ts` 定义记录、命令和格式检查，在 `src/core/document-blocks.ts` 共享块 ID 验证。
- [X] T005 在 `src/adapters/bookmark-store.ts` 落实项目归属、严格 UTF-8、原件比对与安全替换。

## Phase 3: User Story 1 — 在讲解旁收藏（P1）

**Goal**：添加、查看、编辑与移除同块的独立书签。

**Independent Test**：在非首源码对照块添加有备注和空备注两条，编辑一条、移除一条，再在纯讲解块添加。

- [X] T006 [P] [US1] 在 `tests/integration/bookmarks.test.mjs` 写逐条操作、磁盘一致和真实接口写入边界测试。
- [X] T007 [P] [US1] 在 `tests/browser/bookmarks.mjs` 写实际两种块的新增、编辑、移除与键盘流程检查。
- [X] T008 [US1] 在 `src/application/bookmarks.ts` 与 `src/server/reader.ts` 实现单项目读写和来源限制（FR-001、FR-002、FR-006、FR-007）。
- [X] T009 [US1] 在 `src/web/App.vue`、`src/web/ReaderDocument.vue`、`src/web/BlockBookmarks.vue`、`src/web/i18n.ts` 和 `src/web/style.css` 接入块级交互及中英反馈（FR-001、FR-002、FR-008）。

## Phase 4: User Story 2 — 从同一项目回访（P2）

**Goal**：从顶栏定位当前讲解中的准确记录，暂缺可恢复。

**Independent Test**：从预存书签重开服务，跳转同篇及跨文件的重名块，暂时移走或损坏文件后恢复。

- [X] T010 [US2] 在 `tests/browser/bookmarks.mjs` 覆盖服务重开、准确滚动和焦点、ID 稳定与暂时失效。
- [X] T011 [US2] 在 `src/web/App.vue`、`src/web/BlockBookmarks.vue`、`src/web/i18n.ts` 和 `src/web/style.css` 增加项目列表、渲染后跳转、所选提示及失效后重试（FR-003、FR-004、FR-005、FR-008）。

## Phase 5: User Story 3 — 保存失败后重试（P3）

**Goal**：保护失败草稿、既有磁盘内容和两页累计变更。

**Independent Test**：两页发送交错保存，阻断一次真实替换，核原件、输入与重试。

- [X] T012 [US3] 在 `tests/integration/bookmarks.test.mjs` 与 `tests/browser/bookmarks.mjs` 写并发、同记录冲突、写失败及重试检查。
- [X] T013 [US3] 在 `src/application/bookmarks.ts`、`src/web/App.vue`、`src/web/BlockBookmarks.vue` 和 `src/web/bookmark-drafts.ts` 收口写入队列、成功确认、刷新后草稿保留与冲突恢复（FR-007）。

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T014 [P] 定稿现行范围和说明，更新 `specs/001-first-release/05-reading-feedback.md`、`specs/001-first-release/08-current-spec-and-acceptance.md`、`docs/usage/file-reader.md`、`skills/aftertaste-reader/references/feedback.md`（FR-005、FR-006）。
- [X] T015 按 `specs/010-block-bookmarks/quickstart.md` 串行运行单元、集成、浏览器和相关回归，核 SC-001 至 SC-004。

## D035 · 从收藏理由回访

- [x] T016 [US2] src/web/App.vue 和 tests/browser/bookmarks.mjs 验证同块多理由、无备注及两处回访入口。

## Dependencies & Execution Order

### Phase Dependencies

T001 → T002/T003 → T004/T005 → US1 → US2 → US3 → T014/T015。测试先验证触发条件及预期失败，再实施并确认通过。

### User Story Dependencies

US1 用共享存储和读页。US2 可用预置项目书签独立验收，复用 US1 的原块显示。US3 可用预置记录及单块编辑入口独立验收。

### Parallel Opportunities

T002/T003 可分开准备。T006/T007 可分开编写，T014 可独立维护。实际测试和运行资源串行。

## Parallel Examples

- US1 的 T006 与 T007 使用不同文件。
- US2 的回访检查与 US3 的并发接口用例可独立编写。两者在浏览器文件中的改动按顺序合并。
- US3 的接口验证与 UI 交互写入不同文件。执行按现有测试工具逐项运行。

## Implementation Strategy

先完成收藏 MVP，再接通项目回访与失败恢复。各故事按独立验收验通，最后对真实服务及试读入口做串行验证。
