# D029 · 独立审查原文

## R1 · 2026-11-20

**结论：需修复。** Edge 与 Chrome 的主验轮廓、自测覆盖和已走查的阅读操作通过。Firefox 的圆弧回退仍缺少批准范围要求的等效连续轮廓。

- **审查版本。** D029 任务单 `703ea8c`，无有效调整。产品基线 `663c1e2`，对照构建 `01c1be2`，受审候选 `c45f5db161f5d4d0bcc84cbba9b2a63c52e6d127`。核对了 006 的 FR-007—014、FR-017、SC-009—013、SC-016，及样式对共用顶栏、讲解入口、依赖图、闭环和记录管理页的作用域。Spec Kit 材料沿原章节增量维护，需求、设计、任务与验收入口可互相追踪。复用执行提供的构建、测试日志和截图，独审另外启动固定构建和隔离订单项目副本。
- **独立实操。** Windows，Edge `157.0.4341.60` 与 Firefox `159.0` 串行运行。桌面 `1440×900` 从目录跳到 `src/service.mjs` 的 `cj9208pf`，检查小按钮焦点、文件行、收起的当前目录、多行块目录与源码板。资料浮窗 Esc 回到项目名，源码横滚区聚焦时底板的描边完整，书签编辑框取得焦点。拒绝剪贴板写入后，两引擎均能全选手动文本框的 215 个字符，Esc 回到复制入口。窄窗 `390×844` 通过 Tab、Enter 从讲解切到依赖图，经书签页回到讲解，强制色下菜单焦点可辨认。图节点与书签管理行的样式与基线一致，独审请求中无写入。图上框选浮条另外查了执行的配对截图。 [Edge 独审](</D:/project/SpecDev Harness/aftertaste-reader/.local/D029/independent-r1/candidate-edge-final/report.json>) · [Firefox 独审](</D:/project/SpecDev Harness/aftertaste-reader/.local/D029/independent-r1/candidate-firefox-final/report.json>)
- **发现 1 · Firefox 回退仅改变普通圆弧的半径。** 在同一服务讲解块查看宽源码底板，Edge 候选的连续轮廓平滑转入直边。Firefox 159 不支持 `corner-shape`，该控件只剩 `12px` 的普通 `border-radius`。放大同位置的左上角能辨别两种转入方式。共用的回退还影响小按钮和整行选中。派单允许兼容引擎使用原生能力或等效轮廓，当前方案保留了尺寸分档和可见焦点，缺少等效连续曲线。建议按实际盒子尺寸绘制连续边线、填充和焦点，保留原生内容区域及交互。如果保留近似圆弧，由主脑明确收束这一兼容取舍后再按调整后的范围复核。 [回退尺寸](</D:/project/SpecDev Harness/aftertaste-reader/src/web/style.css:9>) · [实际绘制](</D:/project/SpecDev Harness/aftertaste-reader/src/web/style.css:380>) · [独立左上角对照](</D:/project/SpecDev Harness/aftertaste-reader/.local/D029/independent-r1/wide-source-corner-8x.png>)
- **证据边界。** Chrome `157.0.8103.79` 的实图及三引擎源码吸附、长行横滚、选区实际复制和记录回访采用执行提供的同构建证据。执行的 Firefox 窄窗菜单配对中，底下的正文滚动位置不同，该配对仅支持比较菜单自身状态。独审未在实际触屏硬件上验证，未操作 4341 或原项目，也未代替作者验收。
- **写入交还。** 结束时复核 HEAD 仍为受审候选，固定构建与输入资料逐文件哈希一致，输入 Git 提交仍为 `4be951b2bf9aae434e0acc3e1aeab3e4e0cf0734`。独审浏览器和回环服务均已关闭，已核监听端口退出。采集结束，可以恢复写入。
