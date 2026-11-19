# Implementation Plan · 本地逐文件源码对照阅读

**Branch** codex/feat-file-reader | **Date** 2026-11-17 | **Spec** [spec.md](spec.md)

**Input** D011 @38b173f 的 W01—W06，已有固定源、块解析与 D010 资料。目标基线 bf15ac7。后置范围沿 spec Assumptions。

**D022 增量** codex/feat-reader-navigation 接续基线 @d93c9ee，试读后改版基线 @f21c503。依据 [FR-007—011](spec.md#functional-requirements)、[原任务](../../docs/work/2026/11/D022-reader-navigation/task.md)和[范围确认及调整](../../docs/work/2026/11/D022-reader-navigation/amendments.md)。

**D023 增量** codex/feat-reader-center @3edd452，产品基线 dev @6458be2。依据 [FR-012—014](spec.md#functional-requirements)、[原任务](../../docs/work/2026/11/D023-reader-center/task.md)及[试读调整](../../docs/work/2026/11/D023-reader-center/amendments.md)，2026-11-19。

## Summary

单个 Node 本地服务提供预构建 Vue 页面和只读 JSON。DocumentService 在同次读取中完成解析、固定取源和覆盖检查，CLI 校验复用这条链。列表发现独立于 Git。页面仅在内存处理内容，以 code/params 翻译诊断。

D022 从现有讲解条目构建文件树，从当前对照结果派生本篇目录。使用现有书签、标注、笔记的读取、编辑与草稿流程，在块正文后提供记录入口并按回访来源展开落点。

D023 在同一阅读结果上呈现文件题头、块内源码停留和项目资料，并将有效块的 U73 定位交给剪贴板。当前文档、选文和反馈均沿阅读区生命周期管理。

## Technical Context

**Language/Version** TypeScript 5.9.3，Node 24.11.1 开发验证。

**Primary Dependencies** Fastify 5.12.8，Vue 3.5.45，Vite 8.3.8，@vitejs/plugin-vue 6.0.11，vue-tsc 3.3.14，markdown-it 15.0.3。沿单一 npm 锁文件，Playwright 1.65.1 仅验证。

**Storage** 读取目标项目 current 与 Git 对象。浏览器仅保存 aftertaste.language，侧栏状态和目录标签均为页面内存状态。记录读写仍经各自已有的项目资料入口。

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

## 页面设计

Read 模式。固定头部提供语言选择与刷新，主区呈现文件题头、题头下的讲解路径及影响阅读的问题，提交及正常校验见项目资料。对照块使用相邻双栏及水平分隔，源码浅绿灰底、等宽字和实际行号，正文白底、系统中文字体。纯讲解块独立居中。绿色用于当前选择与键盘焦点，错误和警告同时配文字。主内容独立滚动，长行在源码区域横向滚动，窄屏依次显示源码和讲解。

D011 已实际运行 Impeccable context。D022 按项目局部修改适配，沿用现有布局与色彩，核常规阅读、记录展开和窄屏真实视口。

### D022 阅读工作区

- 阅读页桌面布局在视口宽度超过 850 CSS px 时使用单行高 48 CSS px 的顶栏。左上角用一个有明确名称和状态的侧栏图标切换固定导航，右侧工具收紧控件和间距。较紧的宽度用语言选择器的当前值呈现语言设置，保留其可访问名称。Windows 标题栏设计给出标准 32 px、含搜索框 48 px，本页工具栏取 48 CSS px 作为带交互区域的参考尺寸。[Windows 标题栏设计](https://learn.microsoft.com/en-us/windows/apps/design/basics/titlebar-design)
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

## Complexity Tracking

本批无需要豁免的原则违例。
