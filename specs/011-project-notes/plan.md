# Implementation Plan: 项目内全局笔记与跨文件回访

**Branch**: `codex/feat-project-notes` | **Date**: 2026-11-19 | **Spec**: [spec.md](spec.md)

**Input**: [本功能规格](spec.md)

## Summary

为现有阅读器增加项目内笔记编辑和标签过滤。在讲解正文中选文并向一条笔记追加 Markdown 块链接。复用当前文档加载路径，落在讲解块。服务逐条检查版本、串行写入并替换 JSON，页面使用原生文本编辑器、隔开的草稿和保存确认状态。

**D035 · 查标签、读原句和编辑**　ProjectNotes.vue 分离阅读与编辑状态，同一个 textarea 保留原生撤销，复用 notes-editor.ts 的逐条草稿和保存队列。历史按所选笔记、已选标签、搜索词及正文内链接定位。 个人资料格式、API 与写入方式沿用原契约。

## Technical Context

**Language/Version**: TypeScript 5.9、Node.js 24 LTS

**Primary Dependencies**: 既有 Vue 3、Vite、Fastify、Markdown-it

**Storage**: 所选项目 `docs/aftertaste/notes.json`

**Testing**: node:test、真实本机 HTTP、Playwright

**Target Platform**: Windows / Edge 主验，Chrome / Firefox 检查使用到的浏览器能力

**Project Type**: CLI 启动本机 Web 服务

**Performance Goals**: 输入时先在编辑器响应，自动保存合并连续输入，无量化吞吐目标

**Constraints**: 源码和当前讲解只读，笔记写入限定项目，先写完整临时文件再替换

**Scale/Scope**: 单项目个人记录和同一服务的多个页面

## Constitution Check

规划前依据 I–V 检查，D020 批准当前项目内的独立笔记与跨文件回访，沿用项目根、固定源码、阅读服务与 Git 写负责人。设计完成后复核 [数据模型](data-model.md)、[契约](contracts/notes.md) 与[快验](quickstart.md)。个人记录由读者编辑，讲解 AI 只读。安全替换沿用 D019 机制，服务只负责单记录检查和提交。验收覆盖持久化、延迟、撤销、真实写失败和独审。满足五项原则。

## Project Structure

### Documentation (this feature)

```text
specs/011-project-notes/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/notes.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── core/notes.ts
├── application/notes.ts
├── adapters/{personal-file,bookmark-store,notes-store}.ts
├── server/reader.ts
└── web/{App,ProjectNotes,ReaderDocument}.vue
    web/{i18n,markdown,notes-editor}.ts
    web/style.css
tests/
├── unit/notes.test.mjs
├── integration/notes.test.mjs
└── browser/notes.mjs
```

**Structure Decision**: 单项目沿用正式层次和既有 [双文件样例](../../tests/fixtures/bookmark-project.mjs)。规则层校验资料和操作，服务比较记录修订，适配器处理磁盘。页面保持编辑草稿，阅读器沿用当前讲解定位。
