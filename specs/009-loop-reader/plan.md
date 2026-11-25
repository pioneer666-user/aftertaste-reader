# Implementation Plan: 已保存闭环的本地阅读

**Branch**: `codex/feat-loop-reader` | **Date**: 2026-11-18 | **Spec**: [spec.md](spec.md)

**Input**: D016 V01–V04、D031 主阅读与 [spec.md](spec.md)。

## Summary

沿用共用画布的边详情，当前边与所读步骤分别记录。只替换底部关系条内容，让阅读栏继续持有已固定的源码。

**D046 增量** 闭环由 entry 和 reading_order 提供稳定顺序，共用 007 的分层函数。服务与页面保留全量布局键，呈现时仅投影可见成员求组框；库的步骤虚线独立于业务边和导航。

复用 D015 固定源码读回与 D012/D014 画布，增加已保存闭环导航和步骤阅读区。共用布局编解码、修订校验、写入和画布交互，两类图各自提供节点和连线语义。D031 选中步骤后直接展示讲解与同行分支理由，以阅读栏左缘的临时浮层呈现桌面源码对照，窄窗改为步骤内展开；闭环接入共用图工具、点阵和小地图。悬停反馈只作用于节点内部卡面，不改 Vue Flow 节点几何。

D032 沿用单图实例与点阵，App 独立管理目录展开及选择。目录绝对定位，仅自身横向位移。列表在既有成品校验后投影轻量摘要，缩影使用步骤和有向边。未选时只挂点阵，选图读取期间底面持续可见。

D033 由单图实例维护阅读栏显隐。画布原点和小地图锚点独立于收展，把手与阅读顺序控件位于阅读区边缘。当前选择投影出入边，按需显示所有标题与理由。源码组件保留固定状态与滚动，随栏隐藏。画布分组菜单沿用布局提交、修订和重试。

D034 沿用每图常驻实例，首次收起右栏。绘图区始终填满工作区，右栏与边缘把手独立定位，按实际窗口宽度决定底部条排布。面板内顶部固定导航，正文顺序为标题、讲解、可选提示、源码入口、实际分支、原块全文。复用成品的边和阅读顺序，保留源码组件的引用身份与滚动。以订单副本逐帧采样、边界实点及两条路线核验。

D043 将文件页选区判定与浮条共用到闭环。步骤引文进入现有笔记编辑器；回访先读取目标，再通过站内历史展开对应步骤。CLI 在固定提交校验候选讲解，用原内容摘要做冲突检查，临时文件替换 current。

**D048 增量。** 闭环直接复用 [007 走线与拖动方案](../007-dependency-canvas/plan.md#summary)。D049 复用该方案的前景线和重排确认。仅有文件用法的库保留完整身份与个人位置，分列居中只计可见对象。只给当前闭环的可见步骤和库画线、产生对齐目标，按原闭环布局入口保存所有显式成员的最终坐标。

步骤卡下挂独立操作区，复用 Markdown 和固定源码面板。默认布局与确认重排按有注释的行留位；根据可用空间确定初始开合，读者选择仅存在当前闭环视图。在窗口下缘或底部关系条挡住正文时，显式打开的注释可贴同一卡片上缘显示；画布和右栏维持读者选择。

## Technical Context

**Language/Version**: TypeScript 5.9，Node.js 24、Vue 3

**Primary Dependencies**: 现有 Fastify、Vue Flow、Markdown 渲染器

**Storage**: 目标项目中的 D015 成品和单图个人布局，源码从 Git 读

**Testing**: Node test 与 Playwright

**Target Platform**: Windows，Edge 主验；Chrome、Firefox 兼容走查

**Project Type**: 本地 CLI 启动 HTTP 服务及预构建网页

**Performance Goals**: 打开清单不读取 Git；一条闭环的代码按文件合并读取

**Constraints**: 本机单项目；图操作只写布局，主动摘录经笔记保存；保留已有依赖图接口和磁盘格式

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

## D042 · 依赖图与闭环往返

底条与边缘把手共用 DependencyCanvas 的 panelOpen。右栏承载完整来路和出口；摘要保留直接换步。
