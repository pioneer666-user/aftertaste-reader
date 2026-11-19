# D022 · 回执

## 当前结论与入口

- 2026-11-19 已将 [本机试读](http://127.0.0.1:4341/) 更新为试读调整候选 `431398b63fe50c32ee0372045fa5e4808ca37bb0`。沿用原项目的四篇讲解，切换与只读烟测前后 13 个资料文件的 SHA-256 一致。
- 阅读页桌面顶栏由 76 降到 48 CSS px，品牌区改成左上角的侧栏图标。收栏可从左缘临时唤出侧栏，点图标固定。文件树和本篇目录的分隔线可拖动或用键盘调节，收栏重开保留本页比例。右侧五个入口沿原名称、顺序和打开行为。正文后的书签及批注继续按所选记录回访。
- 试读调整已自测并通过 [独审 R4](review.md#r4--2026-11-19)，两项边界问题各修复一轮。2026-11-19，作者在 D022 执行会话明确授权「合并到 dev」。首次试读反馈见 [调整](amendments.md)，新版的进一步体验反馈待记录。
- 已合入本地 `dev`，合并提交为 `50f69f6306fc1ec8e978938399288bfe2a0f5b59`。来源分支 `codex/feat-reader-navigation` 已安全删除，工作区停在 `dev`。本次整合限于本地，试读继续由 4341 提供。

### 作者试读

1. 打开 `src/service.mjs`，上下拖动文件树和「本篇目录」之间的横线，再点本篇第二块。
2. 点左上角图标收栏。鼠标在阅读区左缘停一下，移入浮现的侧栏选文件或跳块。也可移走鼠标让它自动收回，或点左上角图标固定。
3. 看顶栏高度和按钮是否顺手。可把窗口缩窄，用左上角的图标再走一次开栏、选取和回正文。

## 依据与验证

采用 [原任务](task.md) `46b0341`、[范围确认及试读反馈](amendments.md) 和已确认的 [006 阅读规格](../../../../../specs/006-file-reader/spec.md) FR-007—011、SC-006—009。操作和复验见 [006 quickstart](../../../../../specs/006-file-reader/quickstart.md) 与 [阅读说明](../../../../usage/file-reader.md)。初次交回为 `59f4e23` 经修复后的 `72e0f16`。试读反馈调整为 `f372986` 经修复后的 `431398b`。

合并的第一父提交为 `dev@c0d8ec8`，第二父提交为来源分支末端 `de2b472`。合并树与来源分支末端一致，包含受审候选 `431398b`，沿用自测及 R4 证据。合并后核对 4341 首页为 HTTP 200、清单仍指向同一项目的四篇讲解、冻结构建 71 个文件的哈希一致。

### 初次交回的自测

- Windows 11 `10.0.26200`、Node `24.11.1` 和 Git `2.50.1.windows.1`。两次候选均通过 `npm run typecheck`、`npm run build` 和 Git 差异检查。先用 Playwright 在隔离副本逐项操作固定样例，从目录跳转到服务和路径工具的五个块，验证宽窄布局、准确焦点和记录回访。最终构建在 `.local/D022/manual-PH9Q2o/` 留桌面、窄屏和回访截图，执行入口为 `.local/D022/manual-smoke.mjs`。
- 最终候选串行运行 `node tests/browser/reader-navigation.mjs`，Edge `157.0.4341.60`、Chrome `157.0.8103.79`、Firefox `159.0` 均通过。验证长文件树与独立目录滚动、同名路径、重名块、短摘和行范围／序号回退、普通 Markdown 降级、请求乱序、切换语言、窄屏键盘及精确回访。三份个人记录在只读导航测试前后保持字节一致。报告依次为 `.local/D022/browser-E98Iel/`、`browser-SlCPGJ/`、`browser-dKJ5JU/`。
- 最终候选的 Edge `node tests/browser/understanding-marks.mjs` 验证三态、批注编辑和清空、冲突、保 ID 回访及真实 Windows 文件锁下返回 422。延迟失败响应后先收起批注，错误可见，原件字节和草稿完整，解锁后重试成功。报告为 `.local/D022/edge-oBWzAh/`。
- 首候选串行通过 `node tests/browser/file-reader.mjs` 的 Edge、Chrome、Firefox，以及 `bookmarks.mjs`、`notes.mjs`、`dependency-canvas.mjs` 的 Edge 回归。覆盖同块多书签、跨文件笔记定位、编辑、真实写失败与重试，以及图页进入阅读。证据为 `.local/D022/browser-jwxspy/`、`edge-mvpbhV/`、`edge-EBwExA/` 和 `browser-edge-N3bUQq/`。最终修改限于窄屏跳过链接、批注失败提示及对应测试，保留其余回归证据。两个旧脚本各有一次定位前置失败，经限定顶栏或等待桌面侧栏后一轮复跑通过，见 `.local/D022/check-log.md`。
- Impeccable 按局部修改适配检查现有浅绿色、阅读顺序、桌面和窄屏实际渲染、滚动与键盘焦点。Spec Kit v1.4.0 按 006 原结构增量使用 specify、plan、tasks、analyze、implement，解析生效的 spec、checklist、plan、tasks 模板。使用 `SPECIFY_FEATURE_DIRECTORY=specs/006-file-reader` 和 `SPECIFY_FEATURE_NO_PERSIST=1` 运行路径、`setup-plan.ps1`、`setup-tasks.ps1`、analyze 与 implement 前置检查。需求质量清单 16/16，本批 5 项功能要求和 3 项成功条件均有任务对应。检查无扩展 hooks。规格和 UI 初稿并行，一致性分析在初稿出现后、浏览器验证前完成。增量任务 T018—T027 见 [实施清单](../../../../../specs/006-file-reader/tasks.md)。

### 试读调整自测

- Windows 11 与 Node `24.11.1`。首版调整与修复候选的 `npm run typecheck`、`npm run build` 均通过。隔离项目实际操作截图在 `.local/D022/compact-A0NJWW/`，覆盖顶栏、固定侧栏、拖动后比例、左缘浮层和 390 px 的基本操作。
- `f372986` 的 `node tests/browser/reader-navigation.mjs` 在 Edge、Chrome、Firefox 均通过，见 `.local/D022/browser-CVjF4p/`、`browser-aMqtwL/`、`browser-WKPsgF/`。Edge 串行复跑既有逐文件阅读、书签、标注及笔记用例，见 `browser-hNWGRB/`、`edge-Mz8rVy/`、`edge-PDMc0Y/`、`edge-MZO329/`。
- `431398b` 的 Edge 完整导航回归通过，见 `.local/D022/browser-nonJX6/`。新增断言覆盖 851／900 px 英文单行 48 px、1440×320 的鼠标拖动和 Home／End 极限下仍可见完整条目。Chrome、Firefox 用已备好的同一合成项目运行 `.local/D022/check-short-layout.mjs`，在 851—1280 px 所测六个宽度下中英文均为 48 px，1440×320／390 的两端均可见完整条目。报告为 `short-chrome-BtK0yd/` 和 `short-firefox-6ArDKl/`。Firefox 初版完整回归及修复版 Chrome 完整回归在准备独立闭环样例时遇既有 `EPERM`。前者同构建新副本复跑通过，后者两次样例准备失败后采用现成样例验证受影响路径。原件见 `.local/D022/check-log.md`。
- 本次反馈按 006 原结构增量应用 Spec Kit v1.4.0 的 spec、plan、tasks 模板，路径前置与三份模板解析成功。需求质量清单 16/16，US4／US5、FR-008／009／011 与 SC-009 对应 T028—031。局部 UI 按 Impeccable 检查真实固定、收栏、浮层及窄屏。48 CSS px 参考 Windows 有交互控件的标题栏尺寸。[Windows 标题栏设计](https://learn.microsoft.com/en-us/windows/apps/design/basics/titlebar-design)

### 独审与验证边界

- [独审原文](review.md) 留存两轮结论和写入交还。R1 在隔离 Edge 实际触发两个边界问题。R2 复现原操作路径，确认窄屏跳过后焦点进正文且滚动位置保留，折叠后的批注失败可见且重新展开可重试。原证据分别在 `.local/D022/review-r1-W5qtyQ/` 和 `review-r2-tXjFHT/`。
- [独审 R3](review.md#r3--2026-11-19) 实测矮窗口挤掉一侧条目和英文桌面临界宽度顶栏换行。[独审 R4](review.md#r4--2026-11-19) 复现并关闭两项，核实 1440×320 两区的首项可点击、恢复高度后保留比例、851—1280 px 中英文单行及语言控件键盘操作。原证据在 `.local/D022/review-r3-dPIoPg/` 和 `review-r4-dZ1P5X/`。
- 待验范围包括作者对本版本的阅读体验、实体手机、其他操作系统、全量 `npm test` 和源码版本更新联验。窄屏进行了 Windows 浏览器模拟下的基本操作验证。

## 资源与交回

4341 现由本机进程 `36108` 监听 `127.0.0.1`。切换前核对旧 PID `10448` 的冻结构建及项目路径。冻结构建位于 `.local/D022/author-431398b/dist/`，71 个文件与受审构建哈希一致。启动后核对了首页实际脚本和样式，Edge 用 4341 实测 48 px 顶栏、块目录跳转、分隔线、从左缘浮现及固定，并依次打开五个顶栏入口。烟测只发起读取请求，13 个资料文件校验值一致。版本、运行和烟测原件在该目录的 `candidate.json`、`runtime.json`、`smoke.json`。自测和独审启动的隔离服务、浏览器及文件锁均已关闭，本地运行材料可按仓内固定样例重建。

4341 停止后，可在本机 Windows PowerShell 用下方命令重开同一候选和试读项目。看到 `"status":"ready"` 即可访问入口。前台启动时用 Ctrl+C 关闭。保留的后台实例继续提供共用试读，后续关闭或切换前核对监听 PID、候选构建与项目目录。

```powershell
& 'D:/project/SpecDev Harness/aftertaste-reader/.local/D009/runtime/node.exe' 'D:/project/SpecDev Harness/aftertaste-reader/.local/D022/author-431398b/dist/cli/main.js' serve --project 'D:/project/SpecDev Harness/aftertaste-reader/.local/2026-11-19-page-preview/project' --port 4341
```
