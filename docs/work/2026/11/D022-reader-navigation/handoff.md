# D022 · 回执

## 当前结论与入口

- 2026-11-19 已将 [本机试读](http://127.0.0.1:4341/) 切到行为候选 `72e0f16bc44612408627e3070ad41ffd78d136aa`。沿用四篇讲解所在的原试读项目，切换与烟测前后 13 个资料文件的 SHA-256 一致。
- 已交付可收起的文件树、随当前讲解更新的本篇目录、正文后的书签和批注入口。窄屏选文件或跳块后回正文。书签回访定位所点收藏理由，标注回访展开对应批注。顶栏文件依赖图、闭环阅读、书签、标注、笔记沿用原有名称、顺序、位置、样式及打开行为。
- 最终候选自测通过，[独审 R2](review.md#r2--2026-11-19) 通过并交还写入。R1 确认的窄屏跳过焦点和折叠批注失败反馈各修复一轮并复核通过。作者体验待验。
- 成果保留在本地 `codex/feat-reader-navigation`，比较基线为接单版 `d93c9ee`，本地 `dev` 基线为 `c0d8ec8`。回执归档只更新任务和审查材料。候选供作者试读并交回主脑，后续 Git 整合与发布等待授权。

### 作者试读

1. 展开 `src`，打开 `service.mjs`，从「本篇目录」跳到第二、第三块。收栏和重开，感受阅读宽度并核当前文件与块。
2. 打开 `support/audit.mjs`，从「辅助文件拼接日志路径」和「从已有名字构建路径」分别回到对照块和纯讲解块。也可把窗口缩窄，用键盘走一次文件和块跳转。
3. 从顶栏「书签」选择数量规则的收藏理由，再从「标注 → 不理解」选择数量规则的疑问。看日常阅读的正文顺序和两种回访的落点。

## 依据与验证

采用 [原任务](task.md) `46b0341` 和 [范围确认](amendments.md) `d93c9ee`。正式要求增量在 [006 阅读规格](../../../../../specs/006-file-reader/spec.md) FR-007—011、SC-006—008，操作和复验见 [006 quickstart](../../../../../specs/006-file-reader/quickstart.md) 与 [阅读说明](../../../../usage/file-reader.md)。首候选 `59f4e23`，修复候选 `72e0f16`。

### 执行自测

- Windows 11 `10.0.26200`、Node `24.11.1` 和 Git `2.50.1.windows.1`。两次候选均通过 `npm run typecheck`、`npm run build` 和 Git 差异检查。先用 Playwright 在隔离副本逐项操作固定样例，从目录跳转到服务和路径工具的五个块，验证宽窄布局、准确焦点和记录回访。最终构建在 `.local/D022/manual-PH9Q2o/` 留桌面、窄屏和回访截图，执行入口为 `.local/D022/manual-smoke.mjs`。
- 最终候选串行运行 `node tests/browser/reader-navigation.mjs`，Edge `157.0.4341.60`、Chrome `157.0.8103.79`、Firefox `159.0` 均通过。验证长文件树与独立目录滚动、同名路径、重名块、短摘和行范围／序号回退、普通 Markdown 降级、请求乱序、切换语言、窄屏键盘及精确回访。三份个人记录在只读导航测试前后保持字节一致。报告依次为 `.local/D022/browser-E98Iel/`、`browser-SlCPGJ/`、`browser-dKJ5JU/`。
- 最终候选的 Edge `node tests/browser/understanding-marks.mjs` 验证三态、批注编辑和清空、冲突、保 ID 回访及真实 Windows 文件锁下返回 422。延迟失败响应后先收起批注，错误可见，原件字节和草稿完整，解锁后重试成功。报告为 `.local/D022/edge-oBWzAh/`。
- 首候选串行通过 `node tests/browser/file-reader.mjs` 的 Edge、Chrome、Firefox，以及 `bookmarks.mjs`、`notes.mjs`、`dependency-canvas.mjs` 的 Edge 回归。覆盖同块多书签、跨文件笔记定位、编辑、真实写失败与重试，以及图页进入阅读。证据为 `.local/D022/browser-jwxspy/`、`edge-mvpbhV/`、`edge-EBwExA/` 和 `browser-edge-N3bUQq/`。最终修改限于窄屏跳过链接、批注失败提示及对应测试，保留其余回归证据。两个旧脚本各有一次定位前置失败，经限定顶栏或等待桌面侧栏后一轮复跑通过，见 `.local/D022/check-log.md`。
- Impeccable 按局部修改适配检查现有浅绿色、阅读顺序、桌面和窄屏实际渲染、滚动与键盘焦点。Spec Kit v1.4.0 按 006 原结构增量使用 specify、plan、tasks、analyze、implement，解析生效的 spec、checklist、plan、tasks 模板。使用 `SPECIFY_FEATURE_DIRECTORY=specs/006-file-reader` 和 `SPECIFY_FEATURE_NO_PERSIST=1` 运行路径、`setup-plan.ps1`、`setup-tasks.ps1`、analyze 与 implement 前置检查。需求质量清单 16/16，本批 5 项功能要求和 3 项成功条件均有任务对应。检查无扩展 hooks。规格和 UI 初稿并行，一致性分析在初稿出现后、浏览器验证前完成。增量任务 T018—T027 见 [实施清单](../../../../../specs/006-file-reader/tasks.md)。

### 独审与验证边界

- [独审原文](review.md) 留存两轮结论和写入交还。R1 在隔离 Edge 实际触发两个边界问题。R2 复现原操作路径，确认窄屏跳过后焦点进正文且滚动位置保留，折叠后的批注失败可见且重新展开可重试。原证据分别在 `.local/D022/review-r1-W5qtyQ/` 和 `review-r2-tXjFHT/`。
- 待验范围包括作者对阅读呈现和交互的体验、其他操作系统、全量 `npm test` 和源码版本更新联验。技术检查以本批受影响的 Windows 页面流程为范围。

## 资源与交回

4341 现由本机进程 `10448` 监听 `127.0.0.1`。切换前核对旧 PID `17080` 的命令与原项目路径。冻结构建位于 `.local/D022/author-72e0f16/dist/`，71 个文件与受审构建哈希一致。启动后核对了首页实际脚本和样式，Edge 从 4341 打开服务讲解、跳转第二块及依次打开五个顶栏入口。烟测只发起读取请求，13 个资料文件校验值一致。版本、运行和烟测原件在该目录的 `candidate.json`、`runtime.json`、`smoke.json`。自测和独审启动的隔离服务、浏览器及文件锁均已关闭，本地运行材料可按仓内固定样例重建。

4341 停止后，可在本机 Windows PowerShell 用下方命令重开同一候选和试读项目。看到 `"status":"ready"` 即可访问入口。前台启动时用 Ctrl+C 关闭。保留的后台实例在作者试读交回前继续提供入口，后续关闭或切换前核对监听 PID、候选构建与项目目录。

```powershell
& 'D:/project/SpecDev Harness/aftertaste-reader/.local/D009/runtime/node.exe' 'D:/project/SpecDev Harness/aftertaste-reader/.local/D022/author-72e0f16/dist/cli/main.js' serve --project 'D:/project/SpecDev Harness/aftertaste-reader/.local/2026-11-19-page-preview/project' --port 4341
```
