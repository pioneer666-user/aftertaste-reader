# D038 · 笔记工作台回执

## 当前结论与入口

**4341 已运行通过独审的候选 `da10bbc`，仍指向原共用项目。** 2026-11-22，自测完成，R2 独审通过并交还写入。候选保留在 `codex/feat-note-workbench` 待作者体验。产品基线为 `dev@3894db8`，派单提交为 `02e5917`，版前试读为 D037 `e9edc31`。本次仅在任务分支提交，dev 沿用原基线，未推送或发布。[打开本机试读](http://127.0.0.1:4341/) · [独审原文](review.md)

作者可从顶栏「笔记」试三处：

1. 点「全部笔记 ▾」，输入「回」，选「回访」，打开《数量无效时，订单去哪了？》。第一眼可读到完整问题和标签。打开第一处引文后按顶栏后退，再按 Tab 可接到第二处。
2. 点「编辑」直接落到正文。可改问题首行，或用「另设标题」单独命名。标题、标签及正文实际改动会自动存入当前项目。单纯编辑／完成、开关控件和阅读原文均可只读体验。
3. 在桌面左右对照，收窄后用「编辑／预览」切换，看看篇首、侧栏选中行、正文边框和标签的轮廓与手感。[4341 阅读实图](../../../../../.local/D038/preview/4341-read.png) · [4341 编辑实图](../../../../../.local/D038/preview/4341-edit.png)

## 依据与验证

按[批准任务](task.md)增量维护 [011 规格](../../../../../specs/011-project-notes/spec.md)、[方案](../../../../../specs/011-project-notes/plan.md)、研究依据、快验及[清单 T027–T030](../../../../../specs/011-project-notes/tasks.md)。Spec Kit specify、plan、tasks 沿 011 既有目录和生效模板，编码前 analyze 对照 FR-006、FR-009～011 与 SC-005／006，四项实施任务覆盖篇首与标签、筛选和引用返回、轮廓与操作说明、跨场景验证，无阻塞或未映射的本批要求。implement 检查 requirements 16/16，核现有 Node/Vue 项目及忽略配置后执行。沿用[既有笔记契约](../../../../../specs/011-project-notes/contracts/notes.md)，无资料迁移。Ponytail full 与 Impeccable 按局部工作台改版适配。[使用说明](../../../../usage/file-reader.md#记录项目笔记)

执行采用整篇 Markdown 解析。只有首个非空源行本身构成一个独立纯文字段时才提升为篇首；自定义标题优先，其下保留原正文。列表继续用原有的百字缩略规则。普通多行段、标题、列表、代码、块引用和可回访链接保留原结构。侧栏输入只缩小可选标签，选择后才精确筛笔记。编辑态篇首可增删标签，「更多」收纳二次确认删除。保存与重试继续使用工作台和浮层共享的草稿队列。

### 自测

Windows、Node 24.11.1。运行 `npm run typecheck`、`npm run build` 通过，Vite 仍提示主 JS 分块超过 500 kB。共用试读的冻结种子包含当时实际存在的五篇笔记，功能测试均在副本写入，故障／冲突测试用独立生成的项目。浏览器脚本逐份串行运行。

| 范围 | 观察和证据 |
| --- | --- |
| 找回与返回 | 输入无结果保留当前篇，Esc 回焦。选「回访」后两处引用均可回访。长笔记第一处原句返回前后距视口顶均为 447.84375 px，侧栏保持 1118 px，Tab 到第二处。浏览时零笔记写请求。[工作台报告](../../../../../.local/D038/selftest/workbench-gjQPTB/report.json) |
| 改写与读回 | 副本上改长首行、另设并清空篇名、增删长标签、完成刷新，同篇在右上浮层读回，逐字核正文和磁盘。空篇、六类结构首块、首行链接定义、取消删除保住原篇、确认删除专设记录均验证。桌面左右分栏及 390 px 切换通过。[工作台回归](../../../../../.local/D038/r2-record-workbench.log) · [笔记回归](../../../../../.local/D038/selftest/edge-hl9dnS/evidence.json) |
| 失败、并发与引用 | `notes.mjs` 实走文件写失败后保留旧文件和可继续编辑的草稿、重试、断开请求和响应后的删除、两页陈旧修订冲突。`note-references.mjs` 在两处编辑器核原格式剪贴、跨篇粘贴、整块删除及撤销。`reader-history.mjs` 核历史、语言和窄窗操作。[引用报告](../../../../../.local/D038/selftest/references-jhnvcf/report.json) · [历史报告](../../../../../.local/D038/selftest/history-edge-y8tSMh/report.json) |
| 轮廓与视口 | Edge 158.0.4370.33 原生连续角、Firefox 159.0 实际 SVG 回退。实测行内 3.84、控件 9、整行 14、面板 21 CSS px，强制色键盘焦点为 3 px。长签换行留在窄窗内。150 行正文在 318 px 高的编辑区滚至 3652 px。[Edge 坐标和滚动](../../../../../.local/D038/r2/edge/report.json) · [Firefox 回退](../../../../../.local/D038/r2/firefox/report.json) · [系统描边](../../../../../.local/D038/r2/firefox/forced.png) |

同一订单笔记、同一资料和 100% 页面比例的实图。桌面为 1440 × 900，窄窗为 390 × 844 CSS px。

| 视图 | D037 版前 | D038 受审候选 |
| --- | --- | --- |
| 桌面阅读 | [整页](../../../../../.local/D038/before/edge/read.png) | [整页](../../../../../.local/D038/r2/edge/read.png) |
| 桌面编辑 | [整页](../../../../../.local/D038/before/edge/edit.png) | [整页](../../../../../.local/D038/r2/edge/edit.png) · [筛选、选中行、编辑框与标签原尺寸对照](../../../../../.local/D038/r2/comparison.png) |
| 窄窗 | [阅读](../../../../../.local/D038/before/edge/narrow-read.png) · [编辑](../../../../../.local/D038/before/edge/narrow-edit.png) | [阅读](../../../../../.local/D038/r2/edge/narrow-read.png) · [编辑](../../../../../.local/D038/r2/edge/narrow-edit.png) · [预览](../../../../../.local/D038/r2/edge/narrow-preview.png) |
| Firefox | 版前对照采用 Edge | [筛选和焦点](../../../../../.local/D038/r2/firefox/filter.png) · [编辑外框](../../../../../.local/D038/r2/firefox/editor.png) · [篇首控件](../../../../../.local/D038/r2/firefox/tags.png) |

### 独审与未验证项

未参与实现的 Ponytail Review 审查者在自己的试读副本上复核。`b202252` 首轮发现跨篇首复制丢失原始块链接、首行 Markdown 定义导致后段误升标题，以及关闭筛选器后再次 Esc 将焦点移至「更多」。各修复一轮，`da10bbc` 的工作台与引用两套回归重跑通过，复核在 Edge、Firefox 用实际剪贴操作核原失败，冻结构建与输入前后一致。自测另有一次窗口切窄后测量过早，改为等待长签可见后保留原断言并通过。[R1 与 R2 原文](review.md) · [失败与轮次](../../../../../.local/D038/rounds.md)

作者对阅读层级、圆角观感和键鼠手感的体验待验。实体触屏、读屏器、系统输入法候选窗及正式版本更新联验未实测。本批已跑上述影响范围，未重跑全库套件。试读可继续使用，后续整合由作者决定。

## 资源与交回

换版前核 PID 2512、D037 固定 CLI、原项目和旧在线资源；换版后 PID 3588 在 `127.0.0.1:4341` 运行 `.local/D038/build-da10bbc/cli/main.js`。原项目 Git HEAD 前后均为 `4be951b2bf9aae434e0acc3e1aeab3e4e0cf0734`。包括个人记录、讲解、依赖图和两条闭环布局在内的 15 份资料，以及项目其余 5 个文件，逐文件 SHA-256 相同。两份 20 文件清单 SHA-256 均为 `22add93f24f0b5ee0689bcae088bc8789c7fb1d662efd3bb0d733d4bbe0317d0`。[换版前](../../../../../.local/D038/preview/before.json) · [换版后](../../../../../.local/D038/preview/after.json)

71 份固定构建的清单 SHA-256 为 `7c9fb3dd2c3c5b27f1376965cb4eadd758fc67b27c93a6c7609e25133a75333b`。在线首页按本次响应的 nonce 核对，JS、CSS 与受审文件逐字节一致。实际从 4341 筛「回访」、打开订单篇、点编辑并完成，零写请求、零页面异常。[冻结清单](../../../../../.local/D038/r2/build-manifest.json) · [在线哈希](../../../../../.local/D038/preview/after-assets.json) · [只读烟测](../../../../../.local/D038/preview/readonly.json)

自测与独审临时服务、浏览器已收束。4341、冻结构建和本机实图保留供作者试读，运行证据在本机忽略目录。若专用进程退出，在仓库根、4341 空闲时可用以下命令恢复同一候选。

```powershell
& ./.local/D009/runtime/node.exe ./.local/D038/build-da10bbc/cli/main.js serve --project (Resolve-Path -LiteralPath '.local/2026-11-19-page-preview/project').Path --port 4341
```
