# Implementation Plan: 文件依赖图与布局保存

**Branch**: `codex/feat-dependency-canvas` | **Date**: 2026-11-18 | **Spec**: [spec.md](spec.md)

**Input**: [D012](../../docs/work/2026/11/D012-dependency-canvas/task.md) 与本功能规格

**D013 increment**: [F1—F4](../../docs/work/2026/11/D013-canvas-fixes/task.md)，分支 `codex/fix-canvas-layout-navigation`。

## Summary

沿 D004 用 Vue Flow 提供节点拖动及视野事件。共用布局规则由纯函数维护，读取 D009 图和 D011 的真实镜像入口。服务核对图快照、移除凭据和布局修订，串行发布当前项目的布局文件。响应丢失可安全重放同一次保存。

D013 将协调保存与画布手势初始化分开。图工具留存每路径最近一次确认移除的标记，布局服务记录当前布局已接受的标记，图快照纳入移除标记以拒绝旧页面写入。保存请求用坐标条目数组承载合法路径，磁盘坐标表继续可读。文件清单只在请求发出后没有新选篇时自动选篇。

## Technical Context

**Language/Version**: TypeScript 5.9.3、Node 24

**Primary Dependencies**: Vue 3、Vite 8、Fastify 5，新增与 D004 同版 Vue Flow 1.48.2

**Storage**: 项目内 UTF-8 布局文件与既有阅读资料

**Testing**: Node test、Playwright 和真实文件系统

**Target Platform**: Windows／Edge 主验，兼查 Chrome 与可用的 Firefox

**Project Type**: 现有 CLI、本地服务及预构建页面

**Performance Goals**: 局部操作直接更新画布，一次操作结束后提交一份布局

**Constraints**: 固定源码、本机边界、按项目写入、串行验证、小范围界面

**Scale/Scope**: 一次启动面向一个本地项目，交付文件节点画布，无大图规模承诺

## Constitution Check

研究前和设计后核对 I—V。D012 固定选中和阅读行为。图仅供读取，源码继续由 D011 从固定提交读取。布局纯规则、存储、服务与页面分层，图解析复用 D009。按 G01—G05 设计接口、真实重启、失败及独审检查。spec、plan、tasks 沿官方模板，实际结果由交付记录绑定候选。五条均有具体落点。

D013 沿 F1—F4 保持读者操作（I）。现有图工具写入移除凭据，布局服务继续只写项目内布局（II）。沿图凭据、布局协调、请求校验及阅读状态分层（III）。用真实 Edge、图命令和服务验证持久化、竞态和失败边界，再交独审（IV）。本目录按已装模板增量维护并在编码前做覆盖分析（V）。

## Project Structure

### Documentation (this feature)

```text
specs/007-dependency-canvas/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/graph-layout.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── core/canvas-layout.ts
├── application/{dependency-canvas,dependency-graph}.ts
├── adapters/layout-store.ts
├── adapters/graph-store.ts
├── server/reader.ts
└── web/
    ├── App.vue
    ├── DependencyCanvas.vue
    ├── DependencyEdge.vue
    ├── canvas.css
    ├── i18n.ts
    └── reader-api.ts
tests/
├── unit/canvas-layout.test.mjs
├── integration/dependency-canvas.test.mjs
├── fixtures/dependency-canvas.mjs
└── browser/{dependency-canvas,canvas-fixes}.mjs
```

**Structure Decision**: 在 D011 的单包内增量交付，保留原图工具和阅读入口的分层。
