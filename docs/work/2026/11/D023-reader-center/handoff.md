# D023 · 讲解中区阅读与复制块定位回执

## 当前结论与入口

- [打开 4341 试读](http://127.0.0.1:4341/)。正在提供已审候选 `8ec77c41414b8034121293fdbe658e4f58106297`，使用原共用试读项目 `.local/2026-11-19-page-preview/project`。切换和实点确认前后，项目的 13 项资料 SHA-256 相同，涵盖现有讲解、图、笔记、书签和批注。
- 文件主标题下以 11px 小字显示当前讲解的完整相对路径，切篇同步更新，窄屏可换行。桌面短源码随本块停留，长源码随阅读区滚动，横移时行号留在左缘。点项目名可查选完整项目路径、当前讲解的实际源码提交和校验结果。整块图标和同块选文浮条都可复制 U73 定位，自动复制失败可手动取同一文本。现有块尾记录与回访继续可用。
- 作者试读前版并指定题头调整，随后于 2026-11-19 在本会话说「合并到dev」，授权整合候选 `8ec77c4` 的交付。 [作者调整](amendments.md)
- D023 已合入本地 `dev`。合并提交为 `2676698`，两父为 `6458be2` 和 `5b4a12a`，包括任务单注明的派单原则和试读讨论祖先。合并树与来源分支一致。确认无独有提交、额外工作树或服务依赖后，已安全删除 `codex/feat-reader-center`。

## 依据与验证

[任务批准](task.md)在 `3edd4526cdddc786d05e577a1be4539ee30f0c2d`，产品基线为 `dev@6458be2`。按 [006 验收](../../../../../specs/006-file-reader/spec.md#measurable-outcomes)的 FR-012—014、SC-010—012 实现本批页面能力，对应 [08 R12 和 A11](../../../../../specs/001-first-release/08-current-spec-and-acceptance.md)及 [U73](../../../../../specs/001-first-release/05-reading-feedback.md#u73--复制文档块定位-v1作者授权-ai-定稿)。

在同一个 006 目录使用 Spec Kit 的 specify、plan、tasks 和生效模板做增量维护，再执行 analyze 和 implement。前置脚本定位到现有 006，唯一需求清单 16/16 项已勾，阶段检查均无扩展配置。编码前分析覆盖本批六项需求与验收定义，十项任务均有归属，无需解决规格冲突。已填写 [实施清单](../../../../../specs/006-file-reader/tasks.md)及[用户说明](../../../../usage/file-reader.md)。

以下表格记录试读反馈前的 D023 自测和回归。试读调整 `8ec77c4` 依原生效 Spec Kit 模板增量维护 006，复核现有前置与 16/16 需求清单，局部核对规格、方案和任务一致性。以 Node 24.11.1 完成 `npm run typecheck` 和 `npm run build`，串行运行 `tests/browser/reader-center.mjs`，三浏览器均通过。实页核对了题头位置、11px 字号、切篇、浮窗字段与窄屏长路径换行。 [Edge](../../../../../.local/D023/edge-iURRBH/report.json) · [Chrome](../../../../../.local/D023/chrome-ri0xeY/report.json) · [Firefox](../../../../../.local/D023/firefox-tx3ZYa/report.json) · [桌面题头](../../../../../.local/D023/edge-iURRBH/candidate-service-start.png) · [窄屏长路径](../../../../../.local/D023/edge-iURRBH/candidate-narrow-document-path.png)

| 检查 | 实测与证据 |
| --- | --- |
| 构建与读取 | Windows 11 25H2、Node 24.11.1。运行 `npm run typecheck`、`npm run build`，首轮和修复版均通过。当时的冻结目录 71 项 SHA 与修复版自测构建一致。单元与集成分别对 `tests/unit/file-reader.test.mjs` 和 `tests/integration/file-reader.test.mjs` 执行 `node --test --test-concurrency=1`，各通过 7 项。日志在 [回归目录](../../../../../.local/D023/regression/)。 |
| 三浏览器 D023 | `tests/browser/reader-center.mjs` 在 Edge 157.0.4341.60、Chrome 157.0.8103.79、Firefox 159.0 串行通过。资料窗通过鼠标拖选中文实页的长路径，Esc 保留原滚动点并返回项目名，换篇显示不同文档提交。短源码停留时顶边为阅读窗顶边加规定间距，首块越尾让位，长行与矮窗末行可达。 [Edge](../../../../../.local/D023/edge-40OXjh/report.json) · [Chrome](../../../../../.local/D023/chrome-ARZaKj/report.json) · [Firefox](../../../../../.local/D023/firefox-OFwOFi/report.json) |
| 定位与剪贴板 | 同组脚本实际粘贴解析首块 `zhidif44` 及原选文、第二块和无题纯讲解块。隔离项目 HEAD 已前进，定位仍取文档提交。含引号的原生换行在三浏览器逐字往返。反向 Tab、窗口边缘、跨块、跨源码、切篇、双语、普通 Ctrl+C 及加入笔记通过。三浏览器用 `NotAllowedError` 故障注入验证回退，另外在 Edge 用文档 `Permissions-Policy: clipboard-write=()` 实际拒绝，原生 Ctrl+C/V 手动粘贴后与完整文本逐字一致。 [Edge 原生拒绝](../../../../../.local/D023/native-denial-vQgeXF/report.json) |
| 阅读与记录回归 | `tests/browser/file-reader.mjs` 在三浏览器走现有 CLI，零页面错误、零外部请求。Edge 串行执行 `reader-navigation.mjs`、`bookmarks.mjs`、`understanding-marks.mjs`、`notes.mjs`，目录跳转、英文临界与窄屏、回访和保存语义通过。独审修复仅影响复制面板的定位，因此延用首轮读取和导航证据，并在新候选复跑 Edge 笔记回归。 [三浏览器](../../../../../.local/D023/browser-9Jnstx/report.json) · [Edge 回归日志](../../../../../.local/D023/regression/) · [修复版笔记回归](../../../../../.local/D023/edge-ssJgrV/evidence.json) |
| 实图 | 同一试读资料的物理副本，均为 Edge 1440×900。对照了题头和首块、正文中段、下一块、同一选句；另实看分栏临界、窄屏和矮窗。 [改前题头](../../../../../.local/D023/baseline-82Rc8m/baseline-service-start.png) · [改后题头](../../../../../.local/D023/native-denial-vQgeXF/candidate-service-start.png) · [改前正文中段](../../../../../.local/D023/baseline-82Rc8m/baseline-service-middle.png) · [改后源码停留](../../../../../.local/D023/native-denial-vQgeXF/candidate-service-middle.png) · [块间交接](../../../../../.local/D023/edge-40OXjh/candidate-service-handoff.png) · [选文浮条](../../../../../.local/D023/native-denial-vQgeXF/candidate-service-selection.png) · [项目资料窗](../../../../../.local/D023/edge-40OXjh/candidate-project-popover.png) |

第一次自测发现题头的无障碍名称因路径分段产生间隔，另一次发现反向划选后 Tab 落到源码。两项各一轮修复后复验通过。D022 导航初跑在闭环样例准备阶段遇既有 `EPERM`，同构建新副本重跑通过。旧浏览器回归的等待改用对照渲染、完整无障碍题头及实际资料窗，也覆盖机械有效的纯讲解。 [失败与复验原件](../../../../../.local/D023/failures.md) · [D022 前置失败日志](../../../../../.local/D023/regression/reader-navigation-preflight-eperm.log)

## 独审与未验证项

独审在 `e5e32df` 亲做源码过块尾、临时资料窗和剪贴板粘贴，另复现复制浮条遮挡笔记按钮和手动面板在缩窗后移出视口。`7ca2391` 让浮条避让笔记按钮，并在手动面板可见时随视口重定位。两项均经一轮修复，在新冻结构建上由原审查者复做，确认笔记收到完整选文、手动文本框在窄屏仍可见且可复制，R2 通过并交还写入。 后续的试读调整由原审查者在 `8ec77c4` 上复核题头、换篇、资料窗与窄屏，R3 通过并交还写入。 [独审原文](review.md)

已记录的作者体验反馈为题头调整，其余使用感受未逐项确认。浏览器实测为 Windows，窄屏使用浏览器视口，实体触屏和其他操作系统待验。AI 端提问和写回属于后续批次。

合并核对通过，`8ec77c4` 已包含于 `dev`，产品源文件、回归测试与使用说明和受审候选一致。复用既有构建、三浏览器自测和独审证据，另核 4341 首页资源哈希并在原项目实点题头与资料窗。 [合并后试读实点](../../../../../.local/D023/candidate-8ec77c4/merge-smoke.json)

## 运行资源与交回

4341 由当前候选独立目录提供，监听 `127.0.0.1`，进程 PID `35968`。切换前核对前版监听、CLI 和项目根，启动后核对已审清单及首页脚本、样式的响应 SHA，并用 Edge 在原项目上实点打开讲解及资料窗，核对主标题下的小号路径、浮窗项目路径与提交、Esc 回焦及可见的复制入口。隔离浏览器与其服务均已结束。 [运行记录](../../../../../.local/D023/candidate-8ec77c4/runtime.json) · [只读实点](../../../../../.local/D023/candidate-8ec77c4/smoke.json) · [构建清单](../../../../../.local/D023/candidate-8ec77c4/candidate.json)

如服务停止，在仓库根目录用 Windows PowerShell 重开同一构建，看到 `"status":"ready"` 即可访问。前台运行可用 Ctrl+C 结束，后续换版前核对监听进程与项目根。

```powershell
& '.local/D009/runtime/node.exe' '.local/D023/candidate-8ec77c4/dist/cli/main.js' serve --project '.local/2026-11-19-page-preview/project' --port 4341
```

本页是交回主脑的入口。大图、运行清单和日志位于本机 `.local`，随同受审构建保留供本次试读复核。
