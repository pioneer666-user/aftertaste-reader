# D019 · 回执

## 当前结论与入口

- [打开本机试读](http://127.0.0.1:4338/)。顶栏点「书签」，可选 `src/rules.mjs` 的两条记录或 `src/service.mjs` 的纯讲解块。两个文件的目标块 ID 都是 `visit001`。
- 已交付块级收藏、可选备注、逐条修改与移除、项目列表及跨文件回访。正式版本更新确认删块或删文档后的绑定变更由更新任务接入并联验。
- 最终行为候选为 `14d7ea153562f36fd09939ecfbc2da199a7d8e9e`。执行自测通过，[独审 R2](review.md#r2--2026-11-19) 通过并已交还写入。R1 发现的刷新丢草稿已修复，实测一次修复通过。
- 2026-11-19，作者在 D019 执行会话授权「合并到dev」。作者亲自试读结果待记录，入口继续可用。
- 已合入本地 `dev`，合并提交 `0a6539e40ebc8673438d88a16540a42eafbcab5c`。合并树与来源分支 `codex/feat-block-bookmarks` 末端 `f73bc3a` 一致，自测与独审 R2 证据继续适用。已安全删除来源分支，工作区停在 `dev`。本次交付范围为本地合并和试读。

## 依据与交付范围

[任务原文](task.md)冻结于 `ab6c162a56e67d1b427fb7e44a47ac9c4f0df249`，产品基线 `dev@f306417e07733f403f8295a2bde74637577815e8`，本单无调整。初次实现 `30940dc19f8753b04d01f60518eaa27c9a0849c4`，最终候选为其后的 `14d7ea1`。

合并复核确认第一父提交为派单基线 `f306417`，第二父提交为 `f73bc3a`，包含行为候选 `14d7ea1`。切换分支和合并后，4338 的原监听进程仍使用冻结构建，书签接口返回成功。

书签保存在所选项目的 `docs/aftertaste/bookmarks.json`。同一服务合并逐条操作，编辑或移除时检查所选记录的已存备注。写失败保留原件和当前页面草稿。阅读器内刷新或切换讲解后，可回原块接着保存。未提交草稿存于当前页面会话。临时定位失败只提示读者，原路径、块 ID 和备注继续留在列表和磁盘。用法及讲解 AI 按需只读规则已同步到[阅读说明](../../../../usage/file-reader.md)和[产品 Skill 参考](../../../../../skills/aftertaste-reader/references/feedback.md)。

已更新 [05 U44–U45](../../../../../specs/001-first-release/05-reading-feedback.md#u44--书签与更新以及-ai-访问边界) 与 [08 R14、A15](../../../../../specs/001-first-release/08-current-spec-and-acceptance.md)。正式管理页面随 UI 优化。U45 的原文档级提示和未绑定记录依赖正式版本更新完成入口。A15 的这两项仍待联验。

## 执行自测与独审

- Windows `10.0.26200.0`、Node `24.11.1`，串行运行 `npm run typecheck`、`npm run build`，通过。逐个运行书签及块解析单元用例、书签及既有文件阅读真实 HTTP 用例，分别通过 2、12、1、7 项。覆盖同块多记录、跨文件同 ID、原文、重开、同服务并发、重复动作、非法项目及路径参数、来源、硬链接和 junction。现有 Skill 静态检查 2 项通过。最终构建的服务和核心文件与首候选逐项同哈希，复用这些检查。
- 串行运行 `node tests/browser/bookmarks.mjs`，Edge `157.0.4341.60`、Firefox `159.0` 和 Chrome `157.0.8103.79` 通过。Edge 真实锁定书签文件，确认收到 422、原件字节不变、错误和备注跨刷新保留、重试成功。三款都验证两页保留并发写入、关页停服务后回访、保 ID 改写重排、文件暂缺／解析失败／当前无块及恢复、键盘焦点、中英文和 390px 宽度。采用 Impeccable 局部流程，核对了回访、错误和窄屏列表的真实截图。既有 Edge `tests/browser/file-reader.mjs` 通过。
- [独审原文](review.md)保留 R1 和 R2。审查者独立建立隔离项目，完成重启回访、缺失恢复和同记录实际 409 冲突恢复，R2 再用 Windows 文件锁复核了刷新资料后的草稿及重试。R1 在首候选的回归触发过程及修复轮次见 `.local/D019/self/corrections.md` 和 `self/r1-refresh-before.log`。首轮自测中，最后一个页面断言匹配了隐藏阅读区与列表，限定到列表后通过，阶段报告保留在 `.local/D019/edge-xcYcSi/`。
- 最终执行日志在 `.local/D019/self-r2/`，此前有效的单元、HTTP、Skill 静态日志在 `.local/D019/self/`。最终浏览器证据依次在 `.local/D019/edge-7KZ7tM/`、`firefox-1V8Ld6/`、`chrome-LioatW/`、`browser-7FYhwU/`。脚本和合成输入可按 [quickstart](../../../../../specs/010-block-bookmarks/quickstart.md)重跑。忽略目录中的日志和截图不会随克隆恢复。
- 完成 Spec Kit v1.4.0 的 specify、plan、tasks、analyze、implement。使用实际解析的 spec／plan／tasks 模板，需求质量清单 16 项通过，15 项实施任务完成。编码前分析覆盖 8 项功能要求及 4 项验收指标，歧义、重复和阻断项均为零。各阶段前后无扩展 hooks。R1 修复按相同模板结构增量维护相应需求、方案、清单和快验。
- 待验为作者观感与操作、正式更新的两项 A15 场景。其他操作系统、多服务同写和讲解 AI 实际宿主行为未验证。

## 试读与重启

D019 试读服务监听 `127.0.0.1:4338`，启动进程 PID `45652`。构建和隔离项目分别在 `.local/D019/author-14d7ea1/dist` 与同级 `project`，合成源码提交为 `5394d8f86c961ce1b327674235525f57bf0b982c`。启动时核对 57 个构建文件与清单，首页返回 200，三条种子记录与磁盘一致，Edge 从实际入口回访三条均落到正确文件和所选记录。证据在该目录的 `candidate.json`、`runtime.json` 和 `smoke.log`。

如果试读服务已停止，在本机 Windows PowerShell、4338 空闲时运行下方命令。输出 `"status":"ready"` 后即可 [打开试读](http://127.0.0.1:4338/)。在该 PowerShell 中按 Ctrl+C 可停止这种前台启动的服务。

```powershell
& 'D:/project/SpecDev Harness/aftertaste-reader/.local/D009/runtime/node.exe' 'D:/project/SpecDev Harness/aftertaste-reader/.local/D019/author-14d7ea1/dist/cli/main.js' serve --project 'D:/project/SpecDev Harness/aftertaste-reader/.local/D019/author-14d7ea1/project' --port 4338
```

当前后台服务由 D019 持有，保留到作者试读。需停止后台服务时，先确认页面保存完毕，并核对 4338 的监听进程命令行仍指向这份试读构建。停止服务后保留试读项目及已存书签。测试与独审启动的浏览器、服务及文件锁均已关闭。
