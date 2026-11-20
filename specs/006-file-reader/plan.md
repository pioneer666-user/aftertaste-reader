# Implementation Plan · 本地逐文件源码对照阅读

**Branch** codex/feat-file-reader | **Date** 2026-11-17 | **Spec** [spec.md](spec.md)

**Input** D011 @38b173f 的 W01—W06，已有固定源、块解析与 D010 资料。目标基线 bf15ac7。后置范围沿 spec Assumptions。

**D022 增量** codex/feat-reader-navigation 接续基线 @d93c9ee，试读后改版基线 @f21c503。依据 [FR-007—011](spec.md#functional-requirements)、[原任务](../../docs/work/2026/11/D022-reader-navigation/task.md)和[范围确认及调整](../../docs/work/2026/11/D022-reader-navigation/amendments.md)。

**D023 增量** codex/feat-reader-center @3edd452，产品基线 dev @6458be2。依据 [FR-012—014](spec.md#functional-requirements)、[原任务](../../docs/work/2026/11/D023-reader-center/task.md)及[试读调整](../../docs/work/2026/11/D023-reader-center/amendments.md)，2026-11-19。

**D026 增量** `codex/feat-dependency-canvas-selection` @`af08db4`，产品基线 dev @`6ca44d8`。[批准依据](../../docs/work/2026/11/D026-dependency-canvas-selection/task.md)。

**D028 增量** `codex/feat-reader-history-canvas-tools` @`f00becb`，产品基线 dev @`1be9d52`。[批准依据](../../docs/work/2026/11/D028-reader-history-canvas-tools/task.md)。

**D029 增量** `codex/feat-reader-continuous-corners` @`703ea8c`，产品基线 dev @`663c1e2`。[批准依据](../../docs/work/2026/11/D029-reader-continuous-corners/task.md)。

## Summary

单个 Node 本地服务提供预构建 Vue 页面和只读 JSON。DocumentService 在同次读取中完成解析、固定取源和覆盖检查，CLI 校验复用这条链。列表发现独立于 Git。页面仅在内存处理内容，以 code/params 翻译诊断。

D022 从现有讲解条目构建文件树，从当前对照结果派生本篇目录。使用现有书签、标注、笔记的读取、编辑与草稿流程，在块正文后提供记录入口并按回访来源展开落点。

D023 在同一阅读结果上呈现文件题头、块内源码停留和项目资料，并将有效块的 U73 定位交给剪贴板。当前文档、选文和反馈均沿阅读区生命周期管理。

D026 用共用顶栏左侧的轻量文字导航取代旧入口位置，沿用 App 的页态和明确的依赖图往返入口。中文和英文共用排列约定。沿现有技术栈、客户端页态与服务接口，研究见 [research](research.md#d026-共用顶栏)，图内方案见 [007 plan](../007-dependency-canvas/plan.md)。

D028 在共用顶栏接通两向访问历史。App 管理当次会话的访问顺序和恢复，调用现有的文档读取、记录与画布状态。依赖图浮层及闭环的布局独立性见 [007 plan](../007-dependency-canvas/plan.md#d028-浮层设计)。

D029 将连续角用于六页共用顶栏与文件讲解的操作表面。以同一阅读位置的前后实图复核尺寸和状态。沿用现有阅读数据与操作。

D030 在文件树切篇时即刻显示目的地。沿用 App 的导航序号处理取消和提交，在原阅读视口上铺延后出现的占位，保留原篇布局和块级记录实例供失败恢复。

## Technical Context

**Language/Version** TypeScript 5.9.3，Node 24.11.1 开发验证。

**Primary Dependencies** Fastify 5.12.8，Vue 3.5.45，Vite 8.3.8，@vitejs/plugin-vue 6.0.11，vue-tsc 3.3.14，markdown-it 15.0.3。沿单一 npm 锁文件，Playwright 1.65.1 仅验证。

**Storage** 读取目标项目 current 与 Git 对象。浏览器仅保存 aftertaste.language，侧栏状态和目录标签均为页面内存状态。记录读写仍经各自已有的项目资料入口。

D028 的访问顺序和位置留在标签页内存。继续使用现有依赖和接口。

**Testing** Node test 串行，真实 CLI/HTTP，Playwright 串行 Edge 主验及 Chrome/Firefox 适用检查。

**Target Platform** Windows 桌面。

**Project Type** 单包 CLI、本地服务、浏览器阅读页。

**Performance Goals** 本批无数值性能承诺。单篇按需读取，切换可取消过期请求。

**Constraints** 回环、单项目、讲解与源码只读、安全 Markdown、离线资源。Git 失败保留讲解阅读。D022 沿用顶栏五个入口及现有浅绿色。

**Scale/Scope** 一个文件阅读页。D011 覆盖 W01—W06。D022 增量覆盖侧栏、块目录与块内记录。D023 增量覆盖项目资料、源码与讲解的阅读排版、复制当前文档块定位，继续沿现有依赖。系统剪贴板是复制操作的唯一外部写入目标。

## Constitution Check

| 原则 | D011 设计依据 | D022 研究前与设计后复核 |
| --- | --- | --- |
| I 已确认需求 | FR-001—006 映射 W01—W06 | FR-007—011 对应原任务、范围确认和试读调整，项目名落在阅读侧栏，紧凑顶栏限于阅读页 |
| II 固定源与资产 | 文档头提交取 Git，失败保留原文，读取接口与语言持久化 | 目录运行时派生，个人资料路径和写入者沿各记录契约，失败沿用原件和草稿保护 |
| III 共用最少机制 | DocumentService 共用 CLI/HTTP 校验 | 复用 Markdown 解析器、阅读请求、翻译字典、记录组件与保存流程 |
| IV 分层验证 | 单元、真实 HTTP/CLI、浏览器及独审 | 隔离项目按 quickstart 串行实测，固定候选独审，作者入口单独试读 |
| V 官方结构 | 已有 006 原版模板结构 | 沿同目录维护生效模板，使用 analyze 核对覆盖并由 implement 读取 checklist |

研究前及设计后均无原则违例。D022 对现有依赖和接口的复用依据见 [research](research.md#d022-增量研究)，导航状态见 [data-model](data-model.md#d022-导航与回访状态)。

D023 研究前与设计后复核同一原则。I 以 D023 批准场景和 U73 为界。II 由当前读到的文档提取身份与固定提交，用户记录与 Git 引用由原机制负责。III 沿 D022 的选文、侧栏和诊断，新增状态限定在当前页。IV 先取隔离试读的现版及候选实图，再以串行真实操作及独审核滚动、浮窗和粘贴。V 依生效模板增量维护 006，进入实现前检查 checklist 与跨文档覆盖。两次门禁无原则违例。

D026 研究前与设计后复核 I—V。I 替换 FR-011 的入口位置，保持既定的六页与回访语义。II 页态留在前端，文件与记录读写沿原契约。III 使用共用顶栏与原侧栏、翻译、页态。IV 按 quickstart 实验英中文案、边界视口与图的阅读往返并交独审。V 使用原模板增量维护 006，与 007 各归主定义。未见原则冲突。

D028 研究前及设计后核对 I—V。FR-011、015—016 与授权一致（I）。访问位置仅在内存，文档按固定提交读取，保存沿现有资料契约（II）。共用顶栏和页态管理历史，各页负责自身的位置（III）。用隔离副本验证、中英文量测和独立实操（IV）。006、007 按生效模板增量维护，009 给出闭环右侧阅读及回访验收（V）。

D029 研究前及设计后按 I—V 复核。FR-017 以派单表面为界，继续按固定提交读取，记录及契约无变更。使用已有 Vue 控件和浏览器边线。隔离试读按 SC-016 对照与独审，按生效模板维护 006 的增量。

D030 规划前按 I—V 核对 [D030 派单](../../docs/work/2026/11/D030-reader-file-switch/task.md) 与 FR-018—019。设计完成复核：改动限阅读端，单次导航继续读同一固定版本，不改变资料所有权、访问历史契约或磁盘写入。沿用已有工具链和布局，固定副本做自然与阻断读取，送同候选独审。

## Project Structure

### Documentation (this feature)

spec.md、plan.md、research.md、data-model.md、contracts/cli-http.md、quickstart.md、tasks.md、checklists/requirements.md。

### Source Code (repository root)

~~~text
src/
  core/                 # 既有块、路径、诊断类型
  application/
    document-blocks.ts   # 单次读取与校验
    file-reader.ts       # 发现/阅读用例和传输模型
  adapters/
    reader-directory.ts  # 安全发现及启动项目检查
    document-store.ts    # 复用读取边界
  cli/main.ts            # serve 入口与关闭
  server/reader.ts       # Fastify、来源边界及构建资源
  web/                   # Vue 阅读页、Markdown、中英文文案和样式
tests/
  unit/                 # 翻译、Markdown、单次读取
  integration/          # CLI/HTTP、路径、只读、诊断
  browser/              # 真浏览器路径和状态
~~~

**Structure Decision** 沿 D011 已定单源码根和职责，构建输出 dist/cli、dist/server 与 dist/web。Vite 仅构建页面。

D022 页面涉及 src/web/ 的 App.vue、ReaderFileTree.vue、ReaderSidebarDivider.vue、ReaderDocument.vue、块记录组件、markdown.ts、i18n.ts 与 style.css。验证沿 tests/browser/，用户操作说明更新 docs/usage/file-reader.md。公共读取契约仍沿 [CLI/HTTP](contracts/cli-http.md)。

D023 同在 src/web/ 的 App.vue、ReaderDocument.vue、BlockLocationControl.vue、style.css 和 i18n.ts 内调整呈现与交互，沿现有 Markdown 工具保留单一讲解渲染树。tests/browser/reader-center.mjs 覆盖新增路径，相关阅读回归及 docs/usage/file-reader.md 按实际变化维护。

D026 顶栏位于 `src/web/App.vue`、`src/web/style.css` 与 `src/web/i18n.ts`，浏览器共用路径在 `tests/browser/dependency-canvas-selection.mjs`，受影响的导航与个人记录脚本按 quickstart 回归。面向读者更新 `docs/usage/file-reader.md`。

D028 在 `src/web/App.vue`、`style.css` 和 `i18n.ts` 维护顶栏和历史。接入 `ProjectNotes.vue`、`notes-editor.ts`、`ProjectMarks.vue` 和 `DependencyCanvas.vue` 的位置。实操覆盖 `tests/browser/reader-history.mjs` 和既有回访脚本，读者入口更新 `docs/usage/file-reader.md`。

## 页面设计

Read 模式。固定头部提供语言选择与刷新，主区呈现文件题头、题头下的讲解路径及影响阅读的问题，提交及正常校验见项目资料。对照块使用相邻双栏及水平分隔，源码浅绿灰底、等宽字和实际行号，正文白底、系统中文字体。纯讲解块独立居中。绿色用于当前选择与键盘焦点，错误和警告同时配文字。主内容独立滚动，长行在源码区域横向滚动，窄屏依次显示源码和讲解。

D011 已实际运行 Impeccable context。D022 按项目局部修改适配，沿用现有布局与色彩，核常规阅读、记录展开和窄屏真实视口。

### D022 阅读工作区

- D022 的阅读页桌面方案在视口宽度超过 850 CSS px 时使用单行高 48 CSS px 的顶栏，供侧栏验证复用。页面入口排列以 D026 段为准。右侧控件在较紧宽度使用语言选择器的当前值，保留其可访问名称。Windows 标题栏的含搜索框方案也是 48 px。[Windows 标题栏设计](https://learn.microsoft.com/en-us/windows/apps/design/basics/titlebar-design)
- 侧栏顶部显示项目名称并可查完整路径。固定时参与桌面布局，收起让出宽度。桌面鼠标可从左缘触发覆盖显示，移入侧栏可操作，离开且焦点在外后收合。临时显示保持正文宽度与焦点，固定和收起保存当前阅读块。窄屏通过图标打开覆盖面板，选文件或跳块后关闭。键盘显式关闭回到图标，选文件回到阅读区，跳块聚焦目标块。
- 文件树和本篇目录分别滚动。目录可用时显示水平分隔线并允许拖动。键盘以上下方向键调整，Home 和 End 移到两端。文件树份额限定在可分配空间的 20%—80%。矮窗口按每区至少一条完整可选项所需的空间收紧范围。调节值留在页面内存，收栏或暂时没有目录后再显示时复用。
- 同时维护展开文件夹与当前文件。按选中的文档展开其祖先并标记叶项，使用完整路径定位。一般收栏与重开保留状态；布局变化维持读到的块。跳转与滚动共用当前项，只有显式跳转移动焦点。
- 在对照结果中按原序提取块目录。由现有 Markdown 解析器识别块首标题、可读内联文字或首句短摘，跳过代码块。其余采用真实行范围或文档内序号，UI 仅渲染纯文本标签。目录和正文取同一份通过请求序号核对的结果，普通 Markdown 降级页沿既有诊断。
- 理解状态与书签、批注入口位于每块正文后。普通阅读按需展开。回访先走原有文档和块校验，再展开目标记录并在渲染完成后定位。书签精确到记录 ID，标注显示已有批注，笔记继续回到原块。已有保存、错误、草稿及正文选文逻辑由原流程处理。

### D023 阅读中区与操作

- 项目名显式触发可选文的原生 popover，围绕项目名和可用视口布置。浮窗状态参与临时侧栏的收起判断，资料优先响应 Esc，返回项目名的焦点不改动阅读区。元数据来自同一个已接受结果，正常校验放在浮窗，警告及错误沿已有修复入口。
- 文件题头用真实源码相对路径拆目录和文件名，对长路径保留查阅完整值的方式。试读调整把同一读取结果的讲解项目相对路径移至主标题下，字号与断行见 SC-011。源码板使用块作为粘滞边界，以可读高度决定是否吸附，条件与分栏视口见 SC-011。用独立于横向内容的行号列及同节奏的文本行显示完整源码。调整 Markdown 行距与段距，以纯讲解及对照块的真实中文内容复核。保留同一 Markdown 正文和原有块尾记录流程。
- 从正文两端节点、当前块身份及非空选文判断浮条资格，依据指针端或键盘选区焦点端放置并限制在视口内。块首直接入口只带块身份。两种复制以 [U73](../001-first-release/05-reading-feedback.md#u73--复制文档块定位-v1作者授权-ai-定稿)生成标题与 JSON 围栏的纯文本，拒绝写入时以同一文本做只读手动复制。按 [data-model](data-model.md#d023-项目资料与复制状态) 清除过期目标。
- 复用 Impeccable 局部修改的 Read 与 Operate 参考，按 [quickstart](quickstart.md#d023-reader-center) 实看，按 [research](research.md#d023-增量研究) 的技术决定验证浏览器兼容。

### D026 共用顶栏

D026 的原设计记录。现行入口与历史按下节。

- 沿 [FR-011](spec.md#functional-requirements)排列固定的六页入口。讲解页侧栏开关独立于导航，位于同一顶栏左端；其他页按实际页面能力保留对应工具。当前位置随 App 接受的页态更新，并以语义状态及柔和底色表达。用独立焦点样式核键盘可达。
- 预留右侧工具空间，英文标签及窄视口可用收纳入口。当前页名称在收纳时直接可读；以实际横排和实窗临界宽度验证，测试预期由 [SC-013](spec.md#measurable-outcomes)维护。
- 从依赖图打开讲解时保留明确的返回路径，复用同一依赖图实例及其节点、视野。进入其他页面时清理图内临时框选，依赖图状态生命周期见 [007 data model](../007-dependency-canvas/data-model.md#d026-临时画布状态)。

### D028 顶栏与历史

- 左侧三个控件使用同样的尺寸与顺序。窄窗收纳六个页签，保留当前页名、三个位置固定的控件、刷新和语言。侧栏开关按当前页派生名称、展开和禁用状态。笔记仅在编辑区或选文草稿仍可用时收起列表，闭环步骤阅读区保持可读。
- 离开时把当前页的可恢复位置写入当前访问项。接受一次新导航后丢弃前进分支，成功的回退和前进仅移动当前项。文档请求与恢复步骤沿同一个最新意图判断，等当前目标渲染后恢复滚动或焦点。位置与有效性见 [data model](data-model.md#d028-站内访问位置)。
- 直接点击页签时继续使用目的页留在界面中的最近状态，书签、标注等仍按各自已有入口读取记录。历史箭头使用相应访问项的具体落点。
- 目标内容从原读接口和当前页面模型获得。覆盖失效文档／块、记录、节点和闭环的可用落点与提示，按 [quickstart](quickstart.md#d028-站内往返与顶栏) 执行。设计依据见 [research](research.md#d028-站内访问历史)。

### D029 连续圆角

`src/web/style.css` 定义行内、控件、整行和面板四档尺寸。Edge 和 Chrome 使用原生连续角。Firefox 159 使用 `src/web/reader-corners.ts`，按同一批样式选择器、实际盒子尺寸及状态生成页面内的 SVG，只作为底色、边线和焦点的图像。内容区、原生控件与滚动沿用既有盒子。强制色使用系统着色和原生描边。用现有顶栏与阅读区入口限定适用表面，选文浮条按读页专用类取样式。源码横滚区获得键盘焦点时在底板绘制完整描边。研究依据见 [research](research.md#d029-连续圆角)，验收见 [quickstart](quickstart.md#d029-连续圆角)。

### D030 文件树切篇

- `src/web/App.vue` 沿用请求取消与导航序号。只有从文件树打开不同篇才进入等待反馈。新导航与读取完成清除等待计时，晚返回不触碰当前反馈或焦点。已经显示占位时改点可直接替换目标提示。
- `src/web/ReaderFileTree.vue` 在原文件行显示独立的等待标记，保留当前行。阅读区外的简短状态在 busy 区域与窄窗侧栏之外宣布目标。`src/web/style.css` 复用题头、对照块和连续角的版式，在原滚动容器上面呈现占位。
- 占位内重复呈现浅色源码板和讲解段落，按当前视口裁切。沿共用分栏断点上下排时，保留首块源码板，其余空间连续显示讲解段落。
- 占位时保留原正文及滚动高度，屏蔽其交互、目录和文档元信息。现有读点捕获仍读取原正文布局。失败撤下占位并沿用现有定位提示区，成功沿原导航提交后从篇首阅读。双语文案归 `src/web/i18n.ts`。
- 数据沿 [页面状态](data-model.md#d030-文件切篇等待)，接口沿 [CLI/HTTP](contracts/cli-http.md)。验证见 [quickstart](quickstart.md#d030-文件树切篇)，依据见 [research](research.md#d030-文件树切篇)。

## Complexity Tracking

本批无需要豁免的原则违例。
