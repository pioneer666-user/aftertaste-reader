# Phase 0 研究

2026-11-17 按 speckit-plan 调用只读研究代理，核现有工程与官方 npm registry，研究输入为 D011 @38b173f。无待澄清技术项。

## 依赖与构建

**Decision** 固定 plan 中兼容版本，沿用 TS 和 Node 类型；markdown-it 15 自带类型，界面两语言采用类型化字典。Playwright 仅开发验证，字体本地随构建提供。

**Rationale** Fastify 提供生命周期与请求边界，Vue/Vite 沿已定技术，既有 mdast 继续解析专用块，markdown-it 专管浏览器正文。单包构建页面。

**Alternatives considered** 现有 mdast 不直接提供 DOM 渲染，手写 Markdown 代价高。固定少量文案使用字典足够。预编译 Vue 可用严格 CSP。

官方核查 [Fastify LTS](https://fastify.dev/docs/latest/Reference/LTS/)、[Vite](https://vite.dev/guide/)、[Vue TypeScript](https://vuejs.org/guide/typescript/overview)。精确版本、engines、peerDependencies 经 npm view 逐包实读。查询环境沿用了已有 NODE_TLS_REJECT_UNAUTHORIZED=0，未改变系统设置。

## 安全与只读

**Decision** 明确路由白名单，回环监听，精确 Host 与 Origin，Fetch Metadata 辅助检查，全部 no-store，无访问日志。动态资源只从文档读取链获得。Markdown html:false，图片呈现替代文本，受限协议链接与安全 rel，CSP 禁外部资源和内联脚本。

**Rationale** 请求无需任意磁盘接口，静态资源只来自产品构建。源码只在内存，Git 不可用时独立返回已有讲解。原始文本插值显示源码和诊断。

**Alternatives considered** 通用静态项目目录、CLI 子进程、关闭所有失败阅读均不满足当前调用边界和降级要求。

官方依据 [Fastify Server](https://fastify.dev/docs/latest/Reference/Server/)、[Hooks](https://fastify.dev/docs/latest/Reference/Hooks/)、[markdown-it safety](https://github.com/markdown-it/markdown-it/blob/master/docs/safety.md)、[RFC 9111](https://www.rfc-editor.org/rfc/rfc9111.html#section-5.2.2.5)、[CSP3](https://www.w3.org/TR/CSP3/)、[Fetch Metadata](https://www.w3.org/TR/fetch-metadata/)。

## 验证

**Decision** Node test 串行覆盖共用用例与 HTTP，Playwright 依次启动 Edge/Chrome/Firefox。样例重建复制 D010 原件，截图及磁盘变更仅用合成项目。

**Rationale** 真实组件、浏览器存储、异步切换和脚本边界需要实际浏览器操作。浏览器版本及缺环境据实记录。

**Alternatives considered** 组件静态快照不足以证明连续操作，作者体验单独待验。

官方依据 [Playwright browsers](https://playwright.dev/docs/browsers)。

## D022 增量研究

技术栈沿 D011 及现有锁文件。已核 src/web/ 当前 Markdown 渲染、AbortController/序号、焦点回访及记录草稿；本批无新增依赖或外部集成，D019 与 D021 的保存、冲突与回访证据可复用作设计依据。局部呈现仍须在本批候选验收。证据见 [D019](../../docs/work/2026/11/D019-block-bookmarks/handoff.md)、[D021](../../docs/work/2026/11/D021-understanding-marks/handoff.md)。

| Decision | Rationale | Alternatives considered |
| --- | --- | --- |
| 现有源码相对路径派生文件树，以现有 Markdown 解析器派生块标签 | 真实路径区分同名项，解析上下文可区分标题和代码，标题内样式可转为纯文本 | 文档新增标题字段会改变资料格式。逐行匹配 Markdown 符号会把代码误当标题 |
| 桌面用固定栏或左缘临时浮层，窄屏通过图标打开覆盖面板 | 固定时能同时看目录和正文，临时浮层让收栏后的正文保持宽度，窄屏选取后接着阅读 | 以鼠标悬停直接恢复固定栏会使源码和讲解反复重排 |
| 同一侧栏用可调分隔线分配两个滚动区 | 长文件树和长块目录可以按当前阅读方向分配空间，选择和焦点各自有效 | 自适应固定比例只适合一类资料长度，单个总滚动区使长文件树把块目录推离视口 |
| 原来记录身份、接口与草稿继续使用，展现与焦点在阅读区处理 | 同块书签可精确落到所选记录，持久化仍由既有规则保护 | 为回访增加独立记录路由或改写资料不能改善本批的布局和定位 |

本批无待澄清技术项。

## D023 增量研究

沿已有 Vue、Markdown、固定源读取与 Playwright 环境。技术细节从基线 App.vue、ReaderDocument.vue、style.css、块选文及现有诊断复制用法核对，依赖与页面约束沿 D022。以下浏览器用法在本批隔离样例复核，Phase 0 无待澄清技术项。

| Decision | Rationale | Alternatives considered |
| --- | --- | --- |
| 用项目名开启浏览器原生 popover，显示已接受的读取元数据 | 浮窗进入浏览器顶层，避免被侧栏本身裁剪。临时侧栏的关闭判断纳入浮窗状态，Esc 按层关闭，正文滚动由原阅读区管理 | 把资料留在题头会占用每篇的阅读空间。独立层叠管理与新的服务端元数据接口均非必要 |
| 用块内 sticky 配合源码和阅读区高度测量，横向滚动只作用于代码列 | 块尾限制自然随文档流退出；长源码和矮窗时末行可通过主滚动到达，横移仍见行号 | 仅按行数估算不能适应字号、窗口和滚动条。独立纵向源码滚动让段落与源码较难在同一位置对照 |
| 从同一渲染正文树和已显示的阅读结果生成 U73 文本，再写浏览器剪贴板 | 复用选文判定与定位字段，整块和选文走同一格式。内建 JSON 序列化支持中文、引号和换行，权限失败用该次文本手动复制 | 浮条重写或接管原生 Ctrl+C 会妨碍普通选文复制。使用当前 HEAD 会让引用与已读源码不一致 |

## D026 共用顶栏

| Decision | Rationale | Alternatives considered |
| --- | --- | --- |
| 沿 App.vue 的页态、文件阅读返回路径、侧栏状态、翻译与视觉样式扩展共用顶栏 | D022 的紧凑桌面顶栏及 D013 F4 的文件选择和返回链已验证。D026 以同一套页面入口替换分视图位置，避免重复维护页态 | 各页分别排列入口会产生顺序和当前状态差异；单独引入路由器会扩大状态变更 |
| 在可用宽度不足时用可键盘操作的入口收纳导航，并显示当前页 | 英文标签、侧栏开关和右侧工具占宽不同，需在实窗核临界宽度。复用已有按钮与明确焦点样式 | 强制横滚会隐藏当前页或工具；换行会侵占首屏图空间 |

平台接口依据见 [Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API)、[Selection](https://developer.mozilla.org/en-US/docs/Web/API/Selection) 与 [Clipboard.writeText](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText)。

试读调整将现有讲解路径随题头显示，其余资料继续由浮窗提供。两个位置继续从同一读取结果取值，适用上述平台与验证依据。[作者调整](../../docs/work/2026/11/D023-reader-center/amendments.md)

## D028 站内访问历史

| 选择 | 依据 | 比较过的方案 |
| --- | --- | --- |
| 沿原 Vue 页态维护标签页内的一条访问顺序和游标 | [D026](../../docs/work/2026/11/D026-dependency-canvas-selection/handoff.md) 已验证共用顶栏和图往返。D028 需要六页统一且刷新重新起步，浏览器无需持久化访问记录 | 浏览器会话历史与路由需要同步前进分支、跳出站点以及刷新语义 |
| 复用单篇读取的取消与序号检查，各页提供标识和滚动位置 | 当前 D027 的 App 已有单篇请求取消，D019、D020、D021 已验证个人记录各自的资料和草稿生命周期。只用位置恢复可继续用当前内容 | 页面快照会保存过期文档和记录，滚动像素单独使用会被块上方的内容调整影响 |

继续使用现有 Vue、图组件、Fastify 接口和锁定版本。新增工作集中于同一阅读应用内部的交互，无外部集成或待定依赖。

## D029 连续圆角

| 选择 | 依据 | 比较过的方案 |
| --- | --- | --- |
| 按尺寸选半径，支持的浏览器用原生连续角，Firefox 使用页面内 SVG 绘制 | D027 节点曲线与直边平滑相接。Edge、Chrome 原生沿同一轮廓绘制。Firefox 159 则以自己实际的盒子尺寸绘制 D027 的曲线，并通过 `-moz-element()` 将页面内 SVG 用作边框图像，这样填充与焦点也能沿连续角。原生边框宽度、内容盒和点击区域保留 | R1 采用普通圆弧。独审在正对照中发现起弧差异。直接裁切控件会干涉点击、焦点或边缘内容。使用图像 URL 需要修改现有内容安全策略 |
| 将轮廓定义用在现有顶栏、文件导航和正文入口 | 文件阅读与其他页面共用按钮、Markdown 和选区浮条的基础样式。通过入口限定轮廓，可以沿用状态、事件、原生选择和浮层逻辑 | 全局按钮及 Markdown 覆盖会触及图、闭环和各管理页内部 |

原生接口依据见 [CSS Borders Level 4](https://drafts.csswg.org/css-borders-4/#corner-shaping)。数据模型与接口沿现行定义。

## D030 文件树切篇

- **选择** 沿用 D028 已走通的取消和导航序号。按当前有效请求提交结果，由本次树操作附带目标路径。**理由** 初载、刷新及历史恢复用原读取状态，文件切篇只补即时反馈和延后占位，不引入第二个导航控制器。
- **选择** 占位覆盖原阅读布局，在 SC-017 给定的时机出现。**理由** 原篇仍在相同的滚动容器，可保留读点和编辑状态。若将原篇卸载后另行恢复，须重建布局、选定块和编辑状态。
- **选择** 复用 D029 的样式、连续角和三引擎验证环境。**理由** 占位可沿阅读断点和面板样式，浏览器回归沿已有 Playwright 与订单样例方法。
