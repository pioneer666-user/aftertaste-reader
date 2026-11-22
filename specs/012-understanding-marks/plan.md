# Implementation Plan: 块级理解标注与批注

**Branch**: `codex/feat-understanding-marks` | **Date**: 2026-11-19 | **Spec**: [spec.md](spec.md)

**Input**: `specs/012-understanding-marks/spec.md`

## Summary

沿阅读器的当前块提供三态选择和可展开的批注。新增项目内标注列表，从文档路径与块 ID 回访原处。个人资料按字段操作，使用现有安全写入保护原件。

**D035 · 在标注详情读原话**　ProjectMarks.vue 沿用 markKey 和现有回访，按筛选后的记录保留选择或回到首项，窗口与历史沿 006。 个人资料格式、API 与写入方式沿用原契约。

## Technical Context

**Language/Version**: TypeScript、Node.js 24

**Primary Dependencies**: Vue、Fastify、Vite，复用现有锁定版本

**Storage**: 目标项目的 `docs/aftertaste/understanding-marks.json`

**Testing**: Node 单元与真实 HTTP、Playwright／Edge、Skill 只读场景

**Target Platform**: Windows／Edge 主验，受影响浏览器适用时复验

**Project Type**: 本机 CLI 启动的单项目阅读服务

**Performance Goals**: 每次只改一个块的一个字段，按项目读取列表，块内显示无需逐块请求

**Constraints**: 项目路径边界、固定 Git 源码、批注原文和同服务竞争保护

**Scale/Scope**: 当前文件阅读与简单列表，正式版本更新联验另行接入

## Constitution Check

- I：需求和待联验边界来自 D021、R15、A06、A16，无待澄清产品选择。
- II：可写范围只有独立个人文件。现有文档读取规则继续固定 Git 源码，失败不替换个人文件。
- III：复用文档路径校验、个人文件原子替换、HTTP 错误和块回访。讲解 AI 直接只读项目文件，无额外 CLI 写入口或依赖。
- IV：实际读写、竞争、文件锁、重开、原文和键盘路径均有验证入口，完成后冻结候选独审。
- V：采用 v1.4.0 模板，设计后复核同样的原则，具体边界见模型、接口和验证指南。

## Project Structure

### Documentation (this feature)

```text
specs/012-understanding-marks/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/reader-api.md
└── tasks.md
```

### Source Code (repository root)

```text
src/{core,application,adapters}/understanding-marks*.ts
src/server/reader.ts
src/web/{App.vue,ReaderDocument.vue,BlockUnderstandingMark.vue,ProjectMarks.vue,mark-drafts.ts,i18n.ts,style.css}
tests/{unit,integration}/understanding-marks.test.mjs
tests/browser/understanding-marks.mjs
tests/skills/understanding-marks.test.mjs
```

**Structure Decision**: 保留现有分层和阅读界面。块内控件及项目列表各有清晰入口，文件加载与焦点由 App 延用已有块回访。全局现行规则、阅读说明、Skill 只读参考各维护对应正文。
