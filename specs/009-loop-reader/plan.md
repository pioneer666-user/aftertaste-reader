# Implementation Plan: 已保存闭环的本地阅读

**Branch**: `codex/feat-loop-reader` | **Date**: 2026-11-18 | **Spec**: [spec.md](spec.md)

**Input**: D016 V01–V04、D031 主阅读与 [spec.md](spec.md)。

## Summary

复用 D015 固定源码读回与 D012/D014 画布，增加已保存闭环导航和步骤阅读区。共用布局编解码、修订校验、写入和画布交互，两类图各自提供节点和连线语义。D031 选中步骤后直接展示讲解与同行分支理由，以阅读栏左缘的临时浮层呈现桌面源码对照，窄窗改为步骤内展开；闭环接入共用图工具、点阵和小地图。悬停反馈只作用于节点内部卡面，不改 Vue Flow 节点几何。

## Technical Context

**Language/Version**: TypeScript 5.9，Node.js 24、Vue 3

**Primary Dependencies**: 现有 Fastify、Vue Flow、Markdown 渲染器

**Storage**: 目标项目中的 D015 成品和单图个人布局，源码从 Git 读

**Testing**: Node test 与 Playwright

**Target Platform**: Windows，Edge 主验；Chrome、Firefox 兼容走查

**Project Type**: 本地 CLI 启动 HTTP 服务及预构建网页

**Performance Goals**: 打开清单不读取 Git；一条闭环的代码按文件合并读取

**Constraints**: 本机单项目；只写布局；保留已有依赖图接口和磁盘格式

**Scale/Scope**: 两条闭环与一张依赖图的端到端验收，多标签修订冲突

## Constitution Check

*GATE: 研究前及设计后复核。*

- I：本批对应 V01–V04 和 R16–R18。界面沿用现有语言与阅读结构，暂无需产品裁决。
- II：成品和布局路径分别列在[数据模型](data-model.md)。读源码使用 D015 原提交，失败保留讲解。
- III：共用布局读写和 Vue Flow 控件；依赖图仍使用移除凭证，闭环使用自身成品身份。
- IV：[Quickstart](quickstart.md) 记录验收动作和结果条件。冻结候选后独审。
- V：保留官方需求、方案及任务结构。研究决策、模型和契约已覆盖接入范围。

## Project Structure

### Documentation (this feature)

```text
specs/009-loop-reader/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── reader-api.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── core/                   # 已有成品和布局校验
├── application/            # 布局发布和闭环读回
├── adapters/               # 已安全校验的成品与布局文件
├── server/reader.ts        # 本机 API
└── web/                    # 现有画布和闭环阅读区
tests/
├── fixtures/               # 正式 CLI 构建隔离试读项目
├── integration/            # 列表、固定源码、修订和写入边界
└── browser/                # 实际导航、连线、布局与保存时序
```

**Structure Decision**：维持单仓现有分层。通过应用层注入图身份和目标，使同一保存规则服务两个入口。
