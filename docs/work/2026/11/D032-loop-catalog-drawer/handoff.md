# D032 · 闭环目录抽屉与满幅点阵画布回执

## 当前结论与入口

[4341 共用试读](http://127.0.0.1:4341/) 运行固定候选 `19652cc688ff5d065e651f1f255391cb425af42e`。首次从「文件讲解」切到「闭环阅读」，点阵从顶栏下缘延伸至两侧和底边。左侧目录默认展开，右侧显示「回味」和「从左侧选择一个闭环，开始阅读。」[首屏实图](first.png)

点选订单闭环，目录自动收起，可在右侧读概览或选步骤。工具条常驻，当前图名和概览入口保留。阅读中可再打开目录查另一条路线，当前项高亮，Esc 收回并回焦顶栏。路线缩影取自真实步骤和有向边，步数和去重文件数来自同次列表读取。[阅读器说明](../../../../usage/file-reader.md)

2026-11-21，作者指示「合并到dev」。本地 `dev` 以 `d9ea618` 合入 D032，两个父提交为原 `dev` 基线 `34a357e` 和任务归档 `74021c4`。合并树与归档树一致，沿用候选 `19652cc` 的自测和独审结果。已安全删除本地功能分支，合并后复查 4341 首页、JS、CSS 均匹配受审构建。作者亲验尚待记录。

## 依据与验证

- [派单](task.md) `edf041d`，比较基线 `dev@34a357e`。首个行为候选 `05bbaea`，键盘修复候选 `19652cc`。沿 Spec Kit 的 specify、plan、tasks 技能和生效模板，对既有 [009 需求](../../../../../specs/009-loop-reader/spec.md)、[方案](../../../../../specs/009-loop-reader/plan.md)、[清单](../../../../../specs/009-loop-reader/tasks.md)及列表契约增量维护，同步 006 FR-011。编码前使用 analyze 核新增覆盖，按 implement 落地 T019–T023，需求质量清单 16/16。仓内无 `extensions.yml` 后置钩子。
- Windows、Node 24.11.1。`npm run typecheck`、TypeScript 编译及 Vite 生产构建通过。首轮全量 Node 100/100，Edge 闭环回归 8 组、历史 13 组通过。最终修复涉及两个 Vue 组件和定向浏览器回归，复用首轮服务端结果。[Node 日志](../../../../../.local/D032/node-tests.log) · [历史回归](../../../../../.local/D032/verified-reader-history-edge.log)
- 最终候选以固定试读输入副本运行 `node tests/browser/loop-catalog.mjs`，覆盖首屏与订单图四边、抽屉动画、读取失败重试、空项目、长目录高度与滚动、英文、键盘、减少动态、390 px 窄窗及固定源码叠放。`node tests/browser/loop-main-experience.mjs` 在 Edge、Chrome、Firefox 各通过 12 组，`node tests/browser/dependency-canvas-tools.mjs` 在 Edge 通过 4 组。[目录测试入口](../../../../../tests/browser/loop-catalog.mjs) · [目录自测](../../../../../.local/D032/catalog-LHWldQ/report.json) · [Edge](../../../../../.local/D032/main-R2-edge.log) · [Chrome](../../../../../.local/D032/main-R2-chrome.log) · [Firefox](../../../../../.local/D032/main-R2-firefox.log) · [工具](../../../../../.local/D032/tools-R2.log)
- 自测在 1440 × 900 CSS px 下取得相同的工作区 `(x=0, y=48, w=1440, h=852)`，覆盖未选、已选与同窗文件依赖图。订单图平移、缩放后选校验步并固定源码，开合两次共采集 85 帧。节点左上始终为 `(307.493, 147.782)`，小地图始终为 `(13, 758, 222, 88)`。开前抽屉 `x=-368`，滑动中经过 `-255.351`，完全打开为 `0`，关闭后回到 `-368`。右栏滚动始终为 88 px、选中步骤为 `check`，源码保持固定且内容和滚动相同。两次布局 PUT 均来自主动平移、缩放，目录开合与刷新新增写入 0 次。
- Ponytail Review 独审首轮发现目录末项 Tab 可误触布局写入，以及在目录内释放 Ctrl 后抓手仍反转。两项均经过一轮修复，末项 Tab 回到可见的顶栏目录按钮，覆盖的工具条退出键盘操作，Ctrl 松开能恢复抓手。[首轮与复核原文](review.md)
- 尚未覆盖实体触屏操作与屏幕阅读器实读；作者体验待验。

## 试读资源与交回

- 原审查者在最终固定构建上复验通过，77 帧中节点与小地图零位移，原两项键盘问题均已关闭，已交还写入。[抽屉逐帧横坐标与稳定读数](drawer-frames.json) · [独审原始量测](../../../../../.local/D032/catalog-Vsl5SL/report.json)
- 换版前实查 4341 无监听，直接启动受审固定构建 `.local/D032/build-19652cc`，监听 `127.0.0.1:4341`，启动 PID `16584`。共用项目为 `.local/2026-11-19-page-preview/project`，Git HEAD `4be951b2bf9aae434e0acc3e1aeab3e4e0cf0734`。首页、JS、CSS 响应哈希逐一匹配受审构建。Edge 在真实 4341 完成首屏、选订单、固定校验步源码、打开目录及 Esc 收回，记录写请求 0、页面错误 0。换版前后当场读取的全部 15 份资料（含个人布局）逐份 SHA-256 与项目 HEAD 一致。[换版记录](../../../../../.local/D032/preview.json) · [换版前](../../../../../.local/D032/before-switch.json) · [换版后](../../../../../.local/D032/after-switch.json)
- 隔离测试及独审服务已收束。保留原项目、固定构建和本机 4341 供作者验收。需要恢复试读时，从仓库根用 `.local/D009/runtime/node.exe` 运行 `.local/D032/build-19652cc/cli/main.js serve`，以原项目绝对路径作为 `--project`，端口为 `--port 4341`。
