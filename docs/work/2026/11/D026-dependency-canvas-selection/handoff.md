# D026 · 回执

## 当前结论与入口

- [4341 共用试读](http://127.0.0.1:4341/) 已提供候选 `a09ecd4c687e13c6db14fde63319b0053820c2c6`。保留原共用项目，启动前后 13 份资料 SHA-256 一致，依赖图读取原修订、坐标、组及视野。四篇讲解、两条闭环、书签、标注和笔记可读。
- 六页统一在左上横排，当前页可辨。850 CSS px 及以下点击当前页名切换，右侧沿用语言和阅读页刷新。依赖图首屏以画布为主，详情、刷新、操作说明与编辑分组按需打开，保留重排、缩放及即时保存诊断。
- Ctrl + 左键拖动可从组框背景框选。松手可点鼠标旁的「分组」，也可按 Ctrl+G 命名。确认前可看选中数量和将移组成员。旧组编辑器同步移出的成员，仍有成员时保留未提交的改名，旧组移空时关闭。分组与重开沿用现有数据格式。
- 自测通过，独立复核通过并交还写入。[独审原文](review.md)
- 2026-11-20，作者在交付会话明确指示「合并到dev」，授权整合本候选。桌面及窄窗切页、文件关系往返和鼠标旁分组的作者体验尚无独立验收记录。
- 已合入本地 `dev`，合并提交为 `769107e`，两父为基线 `6ca44d8` 与任务归档 `b704665`。合并树与任务分支一致，沿用受审候选的验证证据。已安全删除任务分支，当前在 `dev`，工作区干净。本次未推送或发布。

## 依据和验证

[批准任务](task.md)固定于 `af08db4`，无生效调整。比较基线 `dev@6ca44d8c409ab3213e9576524cac7073a4180e87`，首轮候选 `85e5addc4ffa4e8e39c87fedcda8c9f017a6591d`，修复候选 `a09ecd4c687e13c6db14fde63319b0053820c2c6`。依 [006 FR-011／SC-013](../../../../../specs/006-file-reader/spec.md)、[007 FR-002、FR-010—013／SC-010—013](../../../../../specs/007-dependency-canvas/spec.md) 和 [08 R16／A17—A18](../../../../../specs/001-first-release/08-current-spec-and-acceptance.md#graph-layout-acceptance)核适用场景。

按 Spec Kit v1.4.0 的 specify、plan、tasks 和生效模板增量维护 006、007，08 保留验收入口。两套工件的 plan／tasks 设置检查、analyze 和 implement 前置通过，进程级指定功能目录并以 NO_PERSIST 复用现有分册。两个 requirements.md 各 16/16，阶段检查未发现扩展 hooks。analyze 映射 6 项需求、5 项验收至 9 项任务，无未映射项或阻塞冲突。UI 按 Impeccable 局部改造适配检查真实视口与操作状态，采用派单的桌面菜单说明与既有选文浮条样式。产品入口更新见[使用说明](../../../../usage/file-reader.md#dependency-canvas)。

环境为 Windows 11（26200）、Node 24.11.1、Git 2.50.1.windows.1。所有写入和故障注入使用共用试读重建副本，固定源码提交 `4be951b2bf9aae434e0acc3e1aeab3e4e0cf0734`。下列日志和报告除特别标注外相对 `.local/D026/`。

| 实际检查 | 结果与证据 |
| --- | --- |
| `npm run typecheck`、`npm run build`、`git diff --check` | 修复候选通过。受审前端 JS 为 `index-B5-nj_Am.js`，CSS 为 `index-D4_otMtm.css`。 |
| `node tests/browser/dependency-canvas-selection.mjs` 按浏览器串行 | 修复候选 Edge 157.0.4341.60、Chrome 157.0.8103.79、Firefox 159.0 均通过。报告及 Edge 真实截图分别在 `browser-edge-31ilwj/`、`browser-chrome-Gc4qVs/`、`browser-firefox-6Sj8Qf/`。核中文桌面、英文 851／850 边界及 390 窄窗，原视野回返、组内及反向边缘框选、移组、真实 Windows 文件锁失败与恢复、键盘组管理及依赖图和闭环分别保存重开。 |
| `node .local/D026/self-r2-empty.mjs` | 复验独审的单成员旧组输入，旧编辑面板关闭，重开新组后原组 ID 未恢复。见 `self-r2-empty-OhnkqB/report.json`。 |
| 串行 `node tests/browser/<名称>.mjs` | Edge 的 dependency-canvas、canvas-fixes、dependency-legends、loop-reader、reader-navigation、reader-center、file-reader、bookmarks、understanding-marks 和 notes 均通过。日志以 `*-edge.log`、`*-verified-edge.log` 或 `*-final-edge.log` 记录。旧用例沿用相同布局和读写代码的证据，受修复影响的分组、移组、失败及重开由上行三浏览器重验。 |
| `node --test tests/<名称>.test.mjs` 分文件串行 | canvas-layout 3 项、dependency-canvas 6 项、dependency-legends 3 项、loop-reader 1 项，合计 13 项通过。日志为 `unit-canvas-layout.log` 与对应 `integration-*.log`。 |

首轮独审触发同页旧组表单将已移走成员写回，含旧组仍有成员及移空两种。第一轮修复后复验通过。旧浏览器回归另调整了完整路径标题／文件树选择器和窄窗「标注」入口，保留原行为断言。取图脚本首次误等常驻语言提示消失，改为重新载入验证已保存语言并捕捉稳定画面。第一次失败记录仍留在本地日志中。

未执行全量 `npm test`，未测 macOS、Safari 或其他操作系统。

## 资源与交回

切换时 4341 无监听。首次启动用相对项目路径被 CLI 拒绝，改用解析后的绝对路径后启动成功。已校正共用试读说明中的同一命令。以 Node 24.11.1 在本机启动原项目 `.local/2026-11-19-page-preview/project`，监听 `127.0.0.1:4341`，PID `45512`，用 HTTP 对比前端构建字节，确认原布局和个人记录读取成功。进程、启动记录和核验在 `.local/D026/preview-a09ecd4/`。本批写入式自测和审查的浏览器、专用服务已关闭，隔离证据保留。4341 留待作者试读。后续交接可按[共用试读换版说明](../../../../../tests/README.md#页面改版共用试读)重启。

合并后 4341 仍由同一进程提供，首页 HTTP 200。JS、CSS 和原项目 13 份资料的哈希与合并前一致。合并核验见 `.local/D026/merge-dev-verification.json`。
