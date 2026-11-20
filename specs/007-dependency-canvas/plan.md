# Implementation Plan: 文件依赖图与布局保存

**Branch**: `codex/feat-dependency-canvas` | **Date**: 2026-11-18 | **Spec**: [spec.md](spec.md)

**Input**: [D012](../../docs/work/2026/11/D012-dependency-canvas/task.md) 与本功能规格

**D013 increment**: [F1—F4](../../docs/work/2026/11/D013-canvas-fixes/task.md)，分支 `codex/fix-canvas-layout-navigation`。

**D014 increment**: [L01—L04](../../docs/work/2026/11/D014-dependency-legends/task.md)，批准版本 `6b0d5be`，分支 `codex/feat-dependency-legends`。

**D026 增量** `codex/feat-dependency-canvas-selection` @`af08db4`，产品基线 dev @`6ca44d8`。[批准依据](../../docs/work/2026/11/D026-dependency-canvas-selection/task.md)。

**D027 增量** `codex/feat-dependency-canvas-polish` @`0d83d46`，产品基线 dev @`5298a10`。[批准依据](../../docs/work/2026/11/D027-dependency-canvas-polish/task.md)

**D028 增量** `codex/feat-reader-history-canvas-tools` @`f00becb`，产品基线 dev @`1be9d52`。[批准依据](../../docs/work/2026/11/D028-reader-history-canvas-tools/task.md)。

## Summary

沿 D004 用 Vue Flow 提供节点拖动及视野事件。共用布局规则由纯函数维护，读取 D009 图和 D011 的真实镜像入口。服务核对图快照、移除凭据和布局修订，串行发布当前项目的布局文件。响应丢失可安全重放同一次保存。

D013 将协调保存与画布手势初始化分开。图工具留存每路径最近一次确认移除的标记，布局服务记录当前布局已接受的标记，图快照纳入移除标记以拒绝旧页面写入。保存请求用坐标条目数组承载合法路径，磁盘坐标表继续可读。文件清单只在请求发出后没有新选篇时自动选篇。

F2 复核后补充两种证据的有效范围。项目内凭据保留已发布的正式重加身份，跨图文字编辑、暂时缺席和服务重启使用。只有与当前图发布匹配的缺席记录可以清理布局。图版本涵盖这两种状态，草稿对比新的正式登记身份。图发布期间用当前和候选记录核验实际文件，成功后固定已发布记录。

D014 在既有图 JSON 增加可选 `legends`，由 `apply-graph` 局部更新，通过 `query-legends` 单独读出。实例及其使用关系一并发布，布局与内容分开。文件路径和 `legend:<id>` 共用画布坐标、分组和正式移除凭据。使用连线进入同一画布，文件关系、查看源码和核对状态沿原入口。

D026 继续使用 Vue Flow 和原读写接口。依赖图区增加客户端框选及命名状态，确认调用既有显式成员规则和最新布局保存链。依据见 [research](research.md#d026-增量)。闭环仍使用原画布操作及独立布局，顶栏遵循 [006 plan](../006-file-reader/plan.md#d026-共用顶栏)。

D027 以依赖图的现有布局、端口和保存修订为依据，按读者视野绘制卡片、曲线、点阵和小地图。固定工具、当前拖动与一次性保存反馈都留在页面。依据见 [research](research.md#d027-增量)。

D028 将依赖图的工具、摘要、详情和组编辑叠在同一画布上。视野与对象交给 [006 站内历史](../006-file-reader/plan.md#d028-顶栏与历史) 回访，闭环沿用共用画布中的右侧阅读模式。

## Technical Context

**Language/Version**: TypeScript 5.9.3、Node 24

**Primary Dependencies**: Vue 3、Vite 8、Fastify 5，新增与 D004 同版 Vue Flow 1.48.2

**Storage**: 项目内 UTF-8 布局文件与既有阅读资料

**Testing**: Node test、Playwright 和真实文件系统

**Target Platform**: Windows／Edge 主验，兼查 Chrome 与可用的 Firefox

**Project Type**: 现有 CLI、本地服务及预构建页面

**Performance Goals**: 局部操作直接更新画布，一次操作结束后提交一份布局

**Constraints**: 固定源码、本机边界、按项目写入、串行验证、小范围界面

**Scale/Scope**: 一次启动面向一个本地项目，覆盖依赖图文件与库图例

## Constitution Check

研究前和设计后核对 I—V。D012 固定选中和阅读行为。图仅供读取，源码继续由 D011 从固定提交读取。布局纯规则、存储、服务与页面分层，图解析复用 D009。按 G01—G05 设计接口、真实重启、失败及独审检查。spec、plan、tasks 沿官方模板，实际结果由交付记录绑定候选。五条均有具体落点。

D013 沿 F1—F4 保持读者操作（I）。现有图工具写入移除凭据，布局服务继续只写项目内布局（II）。沿图凭据、布局协调、请求校验及阅读状态分层（III）。用真实 Edge、图命令和服务验证持久化、竞态和失败边界，再交独审（IV）。本目录按已装模板增量维护并在编码前做覆盖分析（V）。

D014 设计前后核对 I—V。内容权限依 04 的作者确认，覆盖本地依赖图（I）。库不参与 Git 取源，工具写内容与移除凭据，服务只发布局（II）。通过同一图解析、发布和布局协调覆盖两种节点，避免第二套存储（III）。用正式工具、真实 HTTP 与 Edge 追踪内容及布局落盘，并冻结候选独审（IV）。在 007 和 004 保持既有模板与实际契约（V）。

D026 研究前与设计后核对 I—V。I 以 FR-002、010—013 及批准场景限定依赖图操作。II 只沿既有项目布局写入与冲突保护，临时选区留在当前图。III 复用现行画布、节点测量、分组与保存链。IV 使用隔离的共用试读资料实测保存失败、重开和闭环独立性，冻结候选独审后切换试读。V 按生效模板增量维护本目录及 006。未见原则冲突。

D027 设计前后复核 I—V。I 以 US6 和 FR-011、014—018 限定操作及保存反馈。II 所有写入继续经项目布局接口，原始试读资料仅用于取副本与最终试读。III 复用已有坐标、分组和修订确认。IV 按 SC-014—016 在相同输入上实测，冻结候选后独审亲验延迟、失败及重试。V 增量沿用 007 的现行模板。方案与五条原则相符。

D028 研究前及设计后核对 I—V。FR-019—020 与批准浮层及闭环阅读边界一致（I）。界面状态在内存，读图与布局写入各循原契约（II）。共用画布复用关系、组表单和保存逻辑（III）。在固定输入量测画布与小地图，独审亲验文件、库、闭环及位置（IV）。007 维护正式结构，联验见 006、009（V）。

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
├── core/{canvas-layout,dependency-graph}.ts
├── application/{dependency-canvas,dependency-graph}.ts
├── adapters/layout-store.ts
├── adapters/graph-store.ts
├── cli/main.ts
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
├── integration/{dependency-canvas,dependency-legends}.test.mjs
├── fixtures/{dependency-canvas,dependency-legends}.mjs
└── browser/{dependency-canvas,canvas-fixes,dependency-legends,dependency-canvas-selection}.mjs
```

**Structure Decision**: 在 D011 的单包内增量交付，保留原图工具和阅读入口的分层。

D028 在 `src/web/DependencyCanvas.vue`、`canvas.css`、`canvas-position.ts` 和 `i18n.ts` 接入浮层与位置交接，用 `tests/browser/dependency-canvas-tools.mjs`、`tests/browser/dependency-canvas-selection.mjs` 及 [006 的往返验证](../006-file-reader/quickstart.md#d028-站内往返与顶栏) 检查两图模式。

## D026 页面设计

- `DependencyCanvas.vue`、`canvas.css` 和 `i18n.ts` 提供独立的依赖图首屏。未选中时用画布填充主区，文件或库详情可按需开合。缩放及重排直接提供，次级入口包含刷新、手势与原键盘分组表单。忙碌、待保存、错误或冲突走现有就近诊断与恢复路径。
- 在活动依赖图的平面或组框背景捕获 Ctrl 左键拖动，以屏幕坐标规格化矩形，判定完全落入范围的文件及库节点。普通平移与节点、组名的拖动沿现有机制。浮钮与命名区域沿讲解选文样式，由实际尺寸做边缘避让；支持鼠标与键盘。
- 选区、打开详情和待命名状态按 [data model](data-model.md#d026-临时画布状态)管理，确认后使用现有分组函数和 [HTTP 契约](contracts/graph-layout.md)。`active` 页态限制手势与快捷键作用域；关闭图页后清除临时选区。验证按 [quickstart](quickstart.md#d026-依赖图首屏与框选分组)。

## D027 页面设计

- 文件与库按钮采用同一连续圆角外形绘制卡面、边线与焦点层。文件从路径取文件名和目录展示，完整路径继续用于身份、详情与可访问名称。依赖边按两端当前坐标绘制曲线并依据所选节点突出直接关系，闭环继续用原有边与步骤选择。
- 将屏幕指针映射到同一份世界网格。格点位置随视野变换，屏幕附近的鼓胀范围按屏幕像素计算；组框只改变对应点的颜色。点阵层不接收指针，交互中、隐藏、静止和减少动态效果时停止不再需要的逐帧更新。
- 小地图从全图边界投影节点与主图视野，将点击或视野框拖动换算回主图坐标。只有实际定位、拖动或缩放调用既有视野变更和保存入口。抓手与选择共用拖动起点判定，按下时锁定本次动作，按键、固定工具和光标同步处理。
- 新建入口共用创建组和保存逻辑。通过同一页内的新组 ID 和获确认修订的布局快照判断播放；创建、排队、失败、重试与切页状态见 [数据模型](data-model.md#d027-依赖图临时状态)。外部接口沿用 [布局契约](contracts/graph-layout.md)，无新持久字段。

## D028 浮层设计

- 依赖图使用左侧浮条、按 FR-020 呈现的底部摘要和限宽可滚动面板。浮层定位以画布为准，为左下角小地图和工具留出空间。浮层控件接收指针与焦点，面板开合不进入画布测量。窄窗使用可关闭的同位详情或组编辑面板。重新布局、分组和刷新沿原入口的处理逻辑，错误与重试留在当前图。
- 摘要和完整详情取当前图的所选节点、直接边和介绍。相关文件可改变当前选择，打开讲解交给 App 记录一次访问。返回图时恢复当前有效对象和视野，按 [数据模型](data-model.md#d028-画布回访与浮层状态) 处理过时对象。
- 闭环沿相同渲染和布局核心呈现右侧内容，并保有窄窗读法。两图独立持有自己的选择、工具与布局。研究及验证见 [research](research.md#d028-画布浮层) 与 [quickstart](quickstart.md#d028-浮层与闭环联验)。
