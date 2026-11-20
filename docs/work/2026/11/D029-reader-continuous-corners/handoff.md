# D029 · 文件讲解页与共用顶栏的连续圆角回执

## 当前结论与入口

[4341 共用试读](http://127.0.0.1:4341/) 运行受审候选 `138c401`，继续使用原订单项目。刷新后打开 `src/service.mjs`，在本篇目录选择「更新集合、调用辅助函数、返回同一对象」。可以同时看顶栏小按钮、整行选中与第 7—10 行的源码底板，再收窄到约 390 CSS px 检查页签菜单与上下阅读。选取首块的一段讲解、打开项目资料或块后的书签，能看到浮层、内层控件和键盘焦点。

六页共用顶栏与文件讲解表面已按控件尺度统一转角，覆盖导航、资料浮窗、代码块和行内代码、复制与诊断反馈、块后记录和编辑。Edge、Chrome 使用原生连续角，Firefox 按真实盒子尺寸绘制等效曲线。源码滚动、原生选择和读写路径沿原有操作。图节点、图上分组浮条和书签管理页内部的对照像素一致。

类型检查、构建、三浏览器阅读回归、桌面和窄窗对照通过。[R2 独立复核](review.md#r2--2026-11-20)通过，关闭了 [R1 的 Firefox 曲线问题](review.md#r1--2026-11-20)。

2026-11-20，作者在交回候选与试读入口后回复「合并到dev」，批准将本单候选本地整合。聊天中的批准未列举作者亲验的场景，体验与触屏证据沿下文实测范围记录。合并提交为 `e17e2bb`，两个父提交分别为 `663c1e2` 和任务分支 `codex/feat-reader-continuous-corners` 的归档 `919092e`。合并树与任务分支一致，程序及测试与受审候选一致。任务分支已安全删除，工作区停在 `dev`。合并前后 4341 由同一进程提供同一构建，首页、JS、CSS 与 15 份试读资料已复核哈希。 [合并核对记录](../../../../../.local/D029/preview-138c401/merge-check.json)

## 依据与验证

批准依据为 [任务单 `703ea8c`](task.md)，比较基线 `663c1e2`。实拍对照用 D028 受审构建 `01c1be2`，两者的 `src/` 相同。首候选 `c45f5db` 使用普通圆弧回退，R1 发现 Firefox 无法平滑转入直边。修复候选 `138c4019be1d892c9e6d583bfdc197a0bd0bae04` 用页面内 SVG 替换边线、底色和焦点的绘制，维持原控件盒和内容安全策略。强制色沿用原生描边。[冻结清单](../../../../../.local/D029/frozen-r2.json)记载 71 份构建文件及输入提交。13 份隔离输入资料哈希前后相同。

依据 [006 FR-017、SC-016](../../../../../specs/006-file-reader/spec.md#measurable-outcomes)，用 Spec Kit specify、plan、tasks 及生效模板增量维护现有章节。只读前置与模板解析、plan/tasks 定位与 16/16 需求检查项均核过，阶段前后无扩展 hooks。方案更新 [plan](../../../../../specs/006-file-reader/plan.md#d029-连续圆角)和研究依据，沿用现有数据模型与契约，验收入口见 [quickstart](../../../../../specs/006-file-reader/quickstart.md#d029-连续圆角)。Ponytail 与 Impeccable 按局部修改使用。

同一固定订单项目、同一篇 `src/service.mjs` 与块 `cj9208pf`。Windows、页面 100%、设备像素比 1。桌面 1440×900、窄窗 390×844 CSS px。各引擎在桌面、窄窗与窄窗菜单开合截图的前后滚动位置一致。链接为本机的实拍证据，运行材料均可按 quickstart 重建。

| 浏览器 | 原尺寸局部 | 同位置整窗及操作 |
| --- | --- | --- |
| Edge 157.0.4341.60 | [桌面三档](../../../../../.local/D029/comparisons-r2/edge-desktop.png) · [窄窗](../../../../../.local/D029/comparisons-r2/edge-narrow.png) | [桌面改前](../../../../../.local/D029/before-aligned/edge/desktop.png) · [桌面候选](../../../../../.local/D029/r2/edge/desktop.png) · [窄窗改前](../../../../../.local/D029/before-aligned/edge/narrow.png) · [窄窗候选](../../../../../.local/D029/r2/edge/narrow.png) · [强制色](../../../../../.local/D029/r2/edge/narrow-forced-colors.png) |
| Chrome 157.0.8103.79 | [桌面三档](../../../../../.local/D029/comparisons-r2/chrome-desktop.png) · [窄窗](../../../../../.local/D029/comparisons-r2/chrome-narrow.png) | [操作和坐标](../../../../../.local/D029/r2/chrome/report.json) |
| Firefox 159.0 | [桌面三档](../../../../../.local/D029/comparisons-r2/firefox-desktop.png) · [窄窗](../../../../../.local/D029/comparisons-r2/firefox-narrow.png) · [源码转角放大复验](../../../../../.local/D029/comparisons-r2/source-corner-8x.png) | [操作和坐标](../../../../../.local/D029/r2/firefox/report.json) · [源码焦点](../../../../../.local/D029/r2/firefox/desktop-source-focus.png) · [块后编辑](../../../../../.local/D029/r2/firefox/desktop-records.png) |

- Node 24.11.1 下执行 `npm run typecheck`、`npm run build` 通过。Edge、Chrome、Firefox 串行运行 `node tests/browser/reader-center.mjs`，验证源码吸附与块尾交接、固定行号与长行首末、普通 Markdown 降级诊断、选文和实际粘贴、剪贴板拒绝后的手动复制及加入笔记。各引擎真实窗口通过 1051/1050 CSS px 分栏临界和 390 CSS px 窄窗。 [Edge 报告](../../../../../.local/D029/edge-AsA8fx/report.json) · [Chrome 报告](../../../../../.local/D029/chrome-WybklE/report.json) · [Firefox 报告](../../../../../.local/D029/firefox-bCwrRb/report.json) · [窄窗手动复制](../../../../../.local/D029/firefox-bCwrRb/candidate-direct-copy-denied-narrow.png)
- Firefox 在最终构建串行通过 `reader-history`、`bookmarks`、`understanding-marks` 和 `notes`。窄窗走了 Tab、Enter、Esc 及强制色，Edge 同位置实图核共用控件焦点。触屏热区由浏览器模拟检查，实体触屏待验。Firefox 在 390 CSS px 的闭合菜单只见箭头、桌面项目短名省略，在 D028 同宽复现。展开后当前项仍可读、可键盘切换。 [顶栏与记录回归](../../../../../.local/D029/reader-history-r2-firefox.log) · [继承的 Firefox 文字行为](../../../../../.local/D029/independent-r2/firefox-labels-before-after.png)
- 首轮实图确认 D028 的外扩焦点直边被邻页签盖住，改为内收再实拍整圈。Firefox 的两次 `reader-center` 曾在创建隔离样例闭环时收到 `EPERM`，浏览器未启动，改用固定样例副本复验通过。Chrome 断点回归分开读取源码和正文盒子时断言失败，同一轮失败截图显示已正常上下排列。改为一次 DOM 读取同时取两盒子，原断言三引擎均通过。 [失败与修复记录](../../../../../.local/D029/rounds.md)

## 资源与交回

4341 的新 PID 为 `41688`，路径为 `.local/D029/build-r2/cli/main.js`，项目仍为 `.local/2026-11-19-page-preview/project`。首页与 JS、CSS 响应哈希匹配固定构建，实际打开服务讲解并跳块的烟测为零写入。换版前后 15 份原项目资料哈希逐份一致，覆盖讲解、个人记录与布局。 [换版记录](../../../../../.local/D029/preview-138c401/preview.json) · [4341 实图](../../../../../.local/D029/preview-138c401/4341-service.png)

测试与独审的临时浏览器和服务已收束。保留 4341、固定构建和证据供作者试读及主脑接回。若需重启，在仓库根使用 `.local/D009/runtime/node.exe` 运行上述固定 CLI 的 `serve --project`，传入原项目绝对路径与 `--port 4341`。
