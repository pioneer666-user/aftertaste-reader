# D020 · 回执

## 当前结论与入口

- [打开本机试读](http://127.0.0.1:4339/)。顶栏点「笔记」，按「待回访」筛选，打开「数量校验怎么影响订单创建？」。正文预览中的两段选文可分别回到 `src/rules.mjs` 和 `src/service.mjs` 的同 ID 块。
- 已交付项目内独立笔记、增删改查、多个自由标签、从讲解选文入笔记与跨文件回访、自动保存和失败恢复。正文使用 Markdown 编辑，链接在预览中打开。标签按当前所选的单个标签精确筛选。
- 最终行为候选是 `27c87cb3a18ade137cae1e2491faadff58b507a6`。执行自测和[独审 R2](review.md#r2--2026-11-19)通过，审查者已交还写入。作者体验待验，正式版本更新的确认删除场景随更新任务联验。
- 候选保留在 `codex/feat-project-notes` 供作者体验。回执与 R2 原文归档属于文档提交。`dev` 仍在本单基线，合入等待作者确认。

## 依据与交付内容

依据[派单](task.md)提交 `087c1db`，产品基线 `dev@a213b7d00c844b016bf1fe5a3276a8c71b0cf67f`，本单无有效调整。初次行为候选 `03c57dd879ef077fcd2dec52565c9193eb1222b6`，断线删除修复候选 `27c87cb`。

笔记保存于所选项目的 `docs/aftertaste/notes.json`。单条修订检查保护同一服务内的多页写入，临时文件写完并同步后替换原件。写失败时页面保留草稿，读者可继续编辑并重试。讲解块链接保存选文、项目相对文档路径和块 ID。文件缺失、解析失败和当前缺块有各自提示，恢复后原链接可继续用。

按 Spec Kit v1.4.0 完成 specify、plan、tasks、编码前 analyze 和 implement。使用实际解析的 spec、plan、tasks 模板和项目阶段脚本。需求质量清单 16 项通过，编码前分析覆盖 8 项功能要求及 4 项验收指标，歧义、重复和阻断项均为零。原 15 项实施任务完成，R1 修复沿已定结构增补 T016，16 项均完成。各阶段前后无扩展 hooks。界面按 Impeccable 局部适配检查实际三项呈现，包括跨文件链接、写失败与英文窄屏。使用入口和资料权限已同步。 [011 规格](../../../../../specs/011-project-notes/spec.md) · [阅读说明](../../../../usage/file-reader.md) · [讲解 AI 只读参考](../../../../../skills/aftertaste-reader/references/feedback.md)

## 执行自测与独审

- Windows 11 `10.0.26200`、Node `24.11.1`。最终候选串行通过 `npm run typecheck` 和 `npm run build`。D020 的 `tests/unit/notes.test.mjs` 与真实 HTTP `tests/integration/notes.test.mjs` 分别通过 2、1 项，覆盖模型、选文编码、空项目、同服务并发与陈旧操作、请求来源、损坏存档、硬链接及 junction 边界。
- 首次完整 `npm test` 有 91 项通过。既有文件阅读单元入口直接读取 Markdown 渲染器源码，新增运行时导入导致该文件加载失败。去除该运行时依赖后，`node --test tests/unit/file-reader.test.mjs` 的 7 项通过。同次构建的 Skill 静态检查 `tests/skills/generation-static.test.mjs` 2 项通过。修复后对受影响项专项复验，完整集未重跑。R2 构建和上一轮相比只有首页及其脚本哈希变化，服务和核心层结果继续适用。
- 最终候选串行运行 `node tests/browser/notes.mjs`，Edge `157.0.4341.60`、Chrome `157.0.8103.79` 和 Firefox `159.0` 均通过。用同块 ID 隔离双文件验证从两种块选文、同笔记加入两个链接、重开筛选与删除、回到正确文件的滚动与焦点、同 ID 改写、讲解缺失／畸形／缺块后的保留与恢复。正文预览区验证普通网址、特殊字符和未闭合围栏后的链接。实测 Ctrl+Z 跨已完成保存并再次落盘，延迟较早响应时最新内容和状态正确。Edge 使用实际 Windows 文件锁触发 422，原件字节完整，草稿可继续编辑，重试只有一条结果。
- [独审原文](review.md)保留 R1 和 R2。R1 另建项目和真实 Edge 会话，用鼠标选文并回访两个文件，也复验了撤销、文件锁和陈旧写入。R1 发现断线时保存请求未抵达服务，连接恢复后删除会误报冲突。第一次修复和复验通过。R2 独立验证请求未到达、写入成功但响应丢失、另一页已保存第三修订三种情况，前两种可删除，第三种继续拒绝删除并保留输入和磁盘原件。
- 执行命令和失败记录见 `.local/D020/self/`，最终浏览器证据见 `edge-GaVO7o/`、`chrome-6UAH3C/` 和 `firefox-2LNRCX/`，独审证据见 `review-r1/` 与 `review-r2/` 下的原始日志及隔离项目。忽略目录的运行材料不随克隆恢复。用 [quickstart](../../../../../specs/011-project-notes/quickstart.md) 和仓内样例可重跑。
- 待验包括作者个人操作体验、正式版本更新发出的确认删除信号、讲解 AI 宿主实际读取。正式更新待验与本次已复现的当前文档缺失、解析失败和缺块不同。服务的多页保证绑定同一实例，跨实例同时写入和其他操作系统未验证。

## 作者试读与重启

试读服务监听 `127.0.0.1:4339`，PID `31240`，由 D020 执行会话保留。构建与隔离项目在 `.local/D020/author-27c87cb/`，合成源码提交为 `5394d8f86c961ce1b327674235525f57bf0b982c`。65 个构建文件与候选清单逐一核哈希，首页返回 200。实际 Edge 打开入口后，按「待回访」找到预置笔记，两个链接均聚焦对应文件的块。证据见同目录 `candidate.json`、`runtime.json` 和 `smoke.log`。D019 试读同时在 `4338` 可用。自测和独审的临时服务、浏览器与文件锁均已关闭。

可以先试这三处。

1. 按「待回访」找预置笔记，从预览分别回到两个文件。
2. 在任一讲解块选段文字，加入一条已有笔记，或当场新建。
3. 等到「已保存」再按 Ctrl+Z，观察撤销结果再次保存，刷新确认内容。

如果试读已停，在本机 Windows PowerShell 中运行下面命令。出现 `"status":"ready"` 后，[打开同一试读入口](http://127.0.0.1:4339/)。该命令运行期间保留终端，按 Ctrl+C 可停止服务。想停止当前试读时，先确认页面已保存并核对 4339 的监听进程指向下方试读构建。停止服务后隔离项目及笔记保留。

```powershell
& 'D:/project/SpecDev Harness/aftertaste-reader/.local/D009/runtime/node.exe' 'D:/project/SpecDev Harness/aftertaste-reader/.local/D020/author-27c87cb/dist/cli/main.js' serve --project 'D:/project/SpecDev Harness/aftertaste-reader/.local/D020/author-27c87cb/project' --port 4339
```
