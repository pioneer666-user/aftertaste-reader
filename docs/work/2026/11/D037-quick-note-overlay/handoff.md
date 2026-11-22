# D037 · 浅色选区浮条与右上角笔记列表回执

## 当前结论与入口

**已按作者指示合入 dev。** 阅读页划选讲解后点「加入笔记」，原页右上角会打开笔记并显示原句及来源。保存状态位于标题与眼睛之间。底部同一行从左到右是六点手柄、已有标签和「＋ 标签」。拖住手柄可拉宽、拉高，列表、正文和预览共用当前页调好的尺寸。右上角「笔记列表」可按名称找已有篇，也可在列表底部新建。编辑器顶行改标题，正文下方增删标签。两个编辑入口都能选中、复制、剪切和删除整块引用。[本机试读](http://127.0.0.1:4341/) · [列表实图](../../../../../.local/D037/list-reference/selftest/references-07npIw/list.png) · [引用选中实图](../../../../../.local/D037/list-reference/selftest/references-07npIw/capture.png) · [当前窄窗实图](../../../../../.local/D037/panel-detail/footer-selftest/references-UJ0OCl/note-footer.png)

原[批准任务](task.md)固定于 `106e170`，本轮[调整](amendments.md)来自作者于 2026-11-22 确认的「直接改产品并验证」。本地分支 `codex/feat-quick-note-overlay`，本轮比较基线 `3ac0677`，笔记改动 `8769f54`，可调尺寸的整合候选 `3999caf`，引用边界修复 `b256b8b` 通过 R5。本次试读微调以 `a99e969` 为基线，`6259bb6` 将保存状态放到顶行并换为六点手柄，`e9edc31` 将标签和手柄合并到同一行。独审 R7 结论为通过，4341 已提供最新固定构建，2026-11-22 作者指示「合并到dev」，以 `73a1fbc` 为第一父提交、`1ec30f8` 为第二父提交合入 `dev`，合并提交 `5775985`。作者的指示授权本次整合，界面体验未另行声明全部通过。任务分支暂保留供继续试读，未推送或发布。

作者可在任一页打开列表，选一篇查看标题、正文和标签，点眼睛预览，Esc 回到顶栏。若要体验实际写入，可以从文件讲解划选一句，点「加入笔记」，接着在引文下方写。要把下一句放入指定笔记，先在列表打开那一篇。切眼睛只改变呈现，预览时再加入选文仍追加于这篇。点引用后 Ctrl+C，切到另一篇 Ctrl+V，再试退格与 Ctrl+Z。对真实笔记的修改会自动保存，列表浏览及预览可只读体验。[使用说明](../../../../usage/file-reader.md#记录项目笔记)

## 依据与自测

- 本次微调在 Windows、Edge 和共用试读副本完成类型检查、生产构建、引用及工作台浏览器回归。390 px 窗口中保存状态位于标题和眼睛之间。手柄、标签和添加按钮的顶边均为 313 px，高度均为 32 px。四个长标签产生 143 px 内容，在 96 px 高的标签区滚动，删除后逐项核对磁盘。粗指针模拟命中仍为 44 × 44 px。[实际坐标与长标签](../../../../../.local/D037/panel-detail/footer-selftest/references-UJ0OCl/report.json) · [保存失败与重试](../../../../../.local/D037/panel-detail/footer-selftest/workbench-gwS6Fc/report.json)

- 本轮在 006、011 现有规格中增量维护 Spec Kit 的 spec、plan、tasks 及 011 契约和快验，沿用 D037 的模板、前置检查与分析流程，两个 requirements 清单分别核完 16/16。实现按 Ponytail full，列表、编辑、选中态及窄窗实图按 Impeccable 的项目适配核验。[文件讲解规格](../../../../../specs/006-file-reader/spec.md) · [项目笔记规格](../../../../../specs/011-project-notes/spec.md) · [存储契约](../../../../../specs/011-project-notes/contracts/notes.md)
- 正文磁盘格式沿用既有 Markdown 块链接。两处编辑器共享同一套原文识别和原子编辑，呈现原句及源文件和块 ID。标题作为可选字段与正文、标签一起按修订保存，旧记录无需迁移。列表无标题时取正文首个非空行。
- Windows、Node 24.11.1。`8769f54` 通过类型检查、生产构建和全部 100 项单元及集成测试。尺寸及引用边界修改均限于前端。`3999caf` 和 `b256b8b` 再跑类型检查、构建与受影响的浏览器脚本。最终构建的主 JS 约 850 kB，gzip 约 288 kB，Vite 有 500 kB 分块提示。编辑器运行时样式采用与本次 HTML 响应绑定的 nonce。实际长稿编辑及预览往返保留可滚动区域，集成用例比对样式策略、页面 nonce 及连续两次请求。[类型与构建、完整测试日志](../../../../../.local/D037/list-reference/selftest/)
- Edge 及 Chrome 实走选文建篇、现有篇改标题和标签、跨笔记原格式剪贴、退格/Delete 双向整删、替换后撤销、预览选中部分原句复制整引用。用含换行、emoji、编码路径的引用比对落盘原文，还验证同一块的普通链接保持普通链接，旁边的引用仍复制正确原文。重载后核篇数、标题与标签，原有篇目逐条一致。[Edge](../../../../../.local/D037/list-reference/selftest/references-07npIw/report.json) · [Chrome](../../../../../.local/D037/list-reference/selftest/references-v21gcM/report.json)
- 调整期间用隔离输入串行跑了六项 Edge 回归 `note-references`、`notes`、`record-workbench`、`reader-center`、`reader-history`、`reader-file-switch`。覆盖已选篇追加、真实写失败与重试、跨页面冲突、组合输入提交前零写入、工作台上下文、六页中英文、空开零写和错误提示前的按钮实点。选文双按钮在 1440 × 900 下为 64 × 32，在窄窗粗指针下每项命中 44 × 44。加入尺寸调整前另在 Firefox 159 走完阅读中区。[保存及冲突](../../../../../.local/D037/list-reference/selftest/edge-5hNn2G/evidence.json) · [工作台](../../../../../.local/D037/list-reference/selftest/workbench-bD50xg/report.json) · [历史与窄窗](../../../../../.local/D037/list-reference/selftest/history-edge-EMzoTu/report.json) · [浮条与命中](../../../../../.local/D037/list-reference/selftest/edge-UHOVdQ/report.json) · [Firefox](../../../../../.local/D037/list-reference/selftest/firefox-aPBMnU/report.json)
- 整合候选在 1440 × 900 的 Edge 拖动左下手柄，从 380 × 352 调至 540 × 472，右边界和顶边未移动，正文有效高度增加。实测两轴最小 300 × 220、最大 900 × 800。290 × 260 小窗收为 274 × 166。切眼睛、回列表、关闭重开沿用尺寸，方向键每次 16 px，Home 恢复默认。在 390 px 触屏模拟中实拖 44 × 44 的手柄，面板从 374 × 340 变为 322 × 414。修改尺寸不触发保存。[实测坐标](../../../../../.local/D037/list-reference/selftest/references-07npIw/report.json) · [放大预览实图](../../../../../.local/D037/list-reference/selftest/references-07npIw/resized-preview.png)
- 可复验。Node 24 下运行 `npm run typecheck`、`npm run build`、`npm test`。上述浏览器脚本均位于 `tests/browser/`，逐个用 Node 启动。`AFTERTASTE_BUILD` 取固定构建绝对路径，`AFTERTASTE_READER_INPUT`、`AFTERTASTE_D028_INPUT`、`AFTERTASTE_D035_INPUT` 指向 `.local/D037/list-reference/input/project`。通过 `AFTERTASTE_TEST_TASK` 指定独立输出，`notes.mjs` 使用其专有双文件样例。开发过程中长稿滚动回归发现 CSP 拦截编辑器样式，修复一次，在 Edge 长文保留编辑位置的场景通过。

## 独审、保留资源与验收边界

R6 在作者追加标签同行时结束，R7 用整合候选及隔离副本完成独立复核并交还写入。[本轮独审原文](review.md)

R1 的错误提示遮挡已于 R2 修复。R3 在作者新增尺寸要求时结束只读核查。R4 实走通过拖动、常态引用及保存恢复，另发现未闭合的 `<!-- TODO` 会导致后续引文失去整块保护。修复 1 轮，使引用识别与预览对 HTML 的解释一致。R5 在 `b256b8b` 的两个编辑入口逐项复核。选中一个字复制仍得完整原串，边界退格整删，撤销后磁盘逐字恢复，行内及围栏代码示例仍可逐字编辑。独审已确认候选、构建和输入，关闭资源并交还写入。[失败现场](../../../../../.local/D037/list-reference/independent-r4/edge-markdown-copy/) · [修复后 Edge 自测](../../../../../.local/D037/list-reference/selftest/references-3QOfAV/report.json) · [Chrome 自测](../../../../../.local/D037/list-reference/selftest/references-IU5mWZ/report.json) · [独立复核现场](../../../../../.local/D037/list-reference/independent-r5/edge/) · [独审原文](review.md)

本轮核实旧监听 PID 7640 运行 `b256b8b` 后，将 4341 切到同一原试读项目上的 `e9edc31`，当前服务 PID 为 18980。前后原项目 Git HEAD 均为 `4be951b2bf9aae434e0acc3e1aeab3e4e0cf0734`，15 份资料和布局逐份 SHA-256 相同（清单 `7fc90c6fe2f4f4283bc14f2ca5a0a892972d844ce72c7f28ea75e96c9c76260c`）。另比整个项目除 `.git` 外的全部 20 份文件，均相同。在线首页扣除每请求的防护 nonce 后与冻结资源一致，JS、CSS 逐字节相同。在原项目只读搜索并打开已有笔记、预览、核顶部「已保存」和底部手柄、标签添加处对齐，再实拖宽 125 px、高 85 px、Esc 关闭回焦。实测浮条 64 × 32，零写请求、零页面异常。[4341 实际拖动截图](../../../../../.local/D037/panel-detail/preview/live-resized.png) · [切换前](../../../../../.local/D037/panel-detail/preview/before.json) · [切换后](../../../../../.local/D037/panel-detail/preview/after.json) · [实际页面及静态资源](../../../../../.local/D037/panel-detail/preview/live.json)

作者已确认调整的功能范围并指示合入 dev。阈值、左下手柄位置及当前页内保留尺寸由执行选定，刷新恢复默认。列表的检索与切换手感、引用选中与粘贴的呈现仍待作者亲验。实体触屏、系统输入法候选窗和读屏器未实测。试读服务保持运行。自测与独审专用服务、浏览器均已收束。需重启专用试读时，在仓库根、4341 空闲的情况下运行以下命令。

```powershell
& ./.local/D009/runtime/node.exe ./.local/D037/panel-detail/build-e9edc31/cli/main.js serve --project (Resolve-Path -LiteralPath '.local/2026-11-19-page-preview/project').Path --port 4341
```
