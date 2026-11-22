# Implementation Plan: 块级注解书签与回访

**Branch**：`codex/feat-block-bookmarks` | **Date**：2026-11-19 | **Spec**：[spec.md](spec.md)

**Input**：[D019](../../docs/work/2026/11/D019-block-bookmarks/task.md)

## Summary

从现有阅读页保存和管理块级书签，顶栏提供项目书签列表。服务把逐条操作合并到磁盘最新资料，页面用文档路径打开当前讲解，再按块和记录定位。

**D035 · 从收藏理由回访**　App.vue 按书签 ID 选择记录，列表和详情复用 visitBookmark。只读双栏和历史沿 006。 个人资料格式、API 与写入方式沿用原契约。

## Technical Context

**Language/Version**：Node.js 24、TypeScript 5.9

**Primary Dependencies**：现有 Fastify、Vue、Playwright

**Storage**：项目内 `docs/aftertaste/bookmarks.json`，UTF-8

**Testing**：Node 单元及真实 HTTP 集成测试、Edge 与兼容浏览器回访

**Target Platform**：Windows／Edge 主验，相关浏览器补验

**Project Type**：本机阅读服务和浏览器页面

**Performance Goals**：书签加载独立于讲解加载，回访用现有的单文档请求

**Constraints**：本机请求、固定项目资料路径、单服务串行写入，保存前保护磁盘原件

**Scale/Scope**：一个项目一份个人书签列表，客户端操作以单条为单位

## Constitution Check

| 原则 | 研究前门禁与设计后复核 |
| --- | --- |
| I 已确认需求与授权 | D019、R14、A15 与 U44–U45。保留以后处理已确认删除的入口边界。 |
| II 固定源码与资料归属 | 原讲解读取沿用固定 Git 提交。写入固定书签资料，预检链接与文件类型，临时写后替换。 |
| III 共用规则与最少机制 | 复用块 ID、路径验证、资料目录检查、读页及本机服务限制。用例合并单条操作。 |
| IV 分层验证与独审 | [quickstart](quickstart.md) 定义重开、多页、暂时失效、实际写失败和恢复场景。候选提交冻结后独审。 |
| V 官方材料 | spec、plan、tasks 采用有效模板。字段、接口、实现和验证分别由相应材料维护。 |

门禁通过。研究与接口设计均落在 D019 范围。

## Project Structure

### Documentation (this feature)

```text
specs/010-block-bookmarks/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── contracts/bookmarks.md
├── quickstart.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── core/bookmarks.ts                 # 记录、命令和验证
├── core/document-blocks.ts           # 共用块 ID 判断
├── application/bookmarks.ts          # 读取、逐条变更、同服务串行
├── adapters/bookmark-store.ts        # 固定项目文件与安全替换
├── server/reader.ts                  # HTTP 组装
└── web/
    ├── App.vue                       # 列表及回访
    ├── ReaderDocument.vue            # 块级接入
    ├── BlockBookmarks.vue            # 单块交互
    ├── bookmark-drafts.ts            # 读页会话内的草稿类型
    ├── i18n.ts
    └── style.css
tests/
├── unit/bookmarks.test.mjs
├── integration/bookmarks.test.mjs
├── fixtures/bookmark-project.mjs
└── browser/bookmarks.mjs
```

**Structure Decision**：沿现有 TypeScript 分层与 Vue 阅读页。用法归 `docs/usage/file-reader.md`，AI 读取与权限归产品 Skill 的 `references/feedback.md`。

草稿在打开的页面内按文档路径和块 ID 保存，块重新渲染后可继续编辑。成功保存或读者取消时清除该草稿。
