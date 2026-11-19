# D021 · 回执

## 当前结论与入口

- [打开本机试读](http://127.0.0.1:4340/)。顶栏选「标注」，筛「不理解」，打开 `src/rules.mjs` 的 `visit001`。块内预置了批注「为什么要先校验数量？」和独立书签备注「这个边界例子讲得巧」。
- 已交付源码对照块与纯讲解块的三态自评、独立批注、按当前状态筛选与跨文件回访。改到任意状态都保留批注原文，读者可以单独编辑或清空。讲解 AI 可按需只读自评和原话。
- 最终行为候选 `f5cc1ad0d63e3e64121ab2862f48d4dbbee5743e`，自测和[独审 R2](review.md#r2--2026-11-19)通过。2026-11-19，作者在 D021 执行会话授权「合并到dev」。作者亲自试读待验，正式源码版本更新的提醒触发、确认与保留随更新任务联验。
- 已合入本地 `dev`，合并提交 `688dcc25a5f05ebf91f3ed85eeb9144dbedcaee6`。合并树与来源分支末端 `23299a3` 一致，复用自测与独审 R2 证据。已安全删除合并后的来源分支，工作区停在 `dev`。

## 依据与实现

依据 [D021 派单](task.md) `d2eedc8280fec74a589e7fe0d5a3a087fd7b051a`，业务基线 `dev@f78db2024e79fceef724c9804fb0522b4fd2bdb8`，本单无有效调整。同步了 [05 的批注规则](../../../../../specs/001-first-release/05-reading-feedback.md)、[08 的 R15](../../../../../specs/001-first-release/08-current-spec-and-acceptance.md)、[阅读说明](../../../../usage/file-reader.md)和[讲解 AI 只读参考](../../../../../skills/aftertaste-reader/references/feedback.md)。

合并的第一父提交为派单基线 `f78db20`，第二父提交为 `codex/feat-understanding-marks@23299a3`，包含行为候选 `f5cc1ad`。试读仍由原监听进程提供同一冻结构建，合并后首页和标注接口均返回 HTTP 200。

个人资料采用项目内独立的 `docs/aftertaste/understanding-marks.json`，使用文档路径与块 ID 定位。同一服务按字段比较和串行写入，复用临时文件同步、校验旧文件和安全替换。批注可展开单独提交，改标即时保存。发生冲突时保留草稿并展示已存值，读者可放弃或明确提交自己的版本。同 ID 改写或重排继续回访，新 ID 默认未标记。原目标暂不可读时保留列表记录和定位。

按 Spec Kit v1.4.0 完成 specify、plan、tasks、编码前 analyze、implement。解析并使用生效的 spec、plan、tasks 模板，运行项目阶段脚本。需求质量清单 16/16。编码前核 8 项功能要求、4 项验收指标和 13 项任务，歧义、重复、原则冲突及覆盖缺口均为零。修复时沿原结构增量维护计划附属资料和契约，分析复核 T014 对 FR-002、FR-005 的覆盖，最终 14 项任务完成。各阶段无扩展 hooks。界面按项目的 Impeccable 局部适配核对列表、块内错误和英文窄屏。见 [012 规格](../../../../../specs/012-understanding-marks/spec.md)及[复验指南](../../../../../specs/012-understanding-marks/quickstart.md)。

## 自测和独审

- Windows 11 `10.0.26200`、Node `24.11.1`。最终候选依次通过 `npm run typecheck`、`npm run build` 和 D021 单元、真实 HTTP、Skill 读回三项测试。HTTP 检查路径与来源、并发、损坏资料和链接边界，并验证从同一份 540,000 字节批注追加一字后能完整落盘。两种自评与批注原话从项目实际文件读回，Skill 静态回归及 UTF-8 包校验通过。
- 最终候选在 Edge `157.0.4341.60`、Chrome `157.0.8103.79`、Firefox `159.0` 串行运行 `tests/browser/understanding-marks.mjs`。覆盖三态、书签共存、两次关页停服务后重开、当前状态筛选、双文件同 ID 的键盘回访与焦点、同 ID 改写和重排、新 ID、文档缺失或畸形、原文与英文窄屏。Edge 用实际 Windows 文件锁触发 422，原件和草稿完整，解锁后重试成功。仅 Edge 做了真实锁定注入。
- 初始候选 `0812f0b2713914312f5fa75fbb3262de6e6bbf36` 的完整 `npm test` 首跑 99/100。既有闭环用例在启动服务前准备合成项目时报 `LOOP_WRITE_FAILED`，系统码 `EPERM`，同一构建单独复跑 `tests/integration/loop-reader.test.mjs` 得 1/1。该候选的书签、笔记 Edge 回归通过。最终候选的变动限于标注接口相关模块和页面脚本，复跑受影响项并复用其余证据。首轮 Edge 脚本在刷新中的禁用按钮上提前发 Enter，修正脚本等待后通过。Skill 结构校验首试使用系统 GBK 失败，以 Python `-X utf8` 复验通过。原件和复验日志见 `.local/D021/self/`。
- [R1 独审原文](review.md#r1--2026-11-19)在独立 Edge 中完成「不理解→已理解→未标记」和两次停服务重开，也独立核了同 ID 回访、双页冲突、真实文件锁及 Skill 读回。R1 发现大批注编辑重复传输旧文和新文，导致已接受的约 540 KB 批注追加一字时返回 413。第 1 轮修复用固定长度原文摘要比较旧批注，保留磁盘格式。最终候选的 [R2 复核](review.md#r2--2026-11-19)实测新建、加字、停服务重开、旧摘要 409、空批注、状态独立及 Edge 双页冲突确认，关闭问题并交还写入。独审原件及环境证据分别见 `.local/D021/review-r1/` 和 `.local/D021/review-r2/`。
- 最终候选的构建、类型和专项日志见 `.local/D021/self/r2/`，浏览器记录分别为 `.local/D021/edge-nCnkwi/`、`.local/D021/chrome-1eXRFu/`、`.local/D021/firefox-iPEYBi/`。这些本地运行材料不随克隆恢复，可用仓内样例与复验指南重跑。
- 待验范围是作者个人体验、正式源码版本更新触发与历史联验，以及讲解 AI 的实际教学效果。当前块改写、新 ID、暂不可读及按 Skill 规定从项目文件读回均已复现。多页写入保证对应同一服务实例，其他操作系统未测。

## 作者试读与重启

本机试读监听 `127.0.0.1:4340`，PID `30152`，由 D021 的专用终端会话保留。试读构建的 71 个文件与受审清单逐一核过 SHA-256。隔离项目使用固定样例提交 `5394d8f86c961ce1b327674235525f57bf0b982c`。Edge 已从首页打开标注，按筛选分别回访并聚焦两份同 ID 文件，预置批注和书签均可读。实际入口、构建及烟测见 `.local/D021/author-f5cc1ad/` 内的 `candidate.json`、`runtime.json` 和 `smoke.log`。自测及独审浏览器和临时服务均已关闭。

1. 从「标注」的「不理解」回访 `src/rules.mjs` 的预置记录，改为「已理解」。打开「批注」可看到原问句，再去列表核对它已退出「不理解」筛选。
2. 写下自己的解释并改为「未标记」，刷新后从「全部标注」回访，查看解释与书签备注。
3. 另一个文件的 `visit001` 是纯讲解块，已标为「已理解」并保留旧问句。可从「全部标注」确认跳到另一份文件。

试读停后，在本机 Windows PowerShell 运行下列命令。看到 `"status":"ready"` 后，[打开同一试读入口](http://127.0.0.1:4340/)。手动启动时保留窗口，按 Ctrl+C 停止，隔离项目中的已存记录会保留。待作者体验和主脑接回后，可收束该专用服务。

```powershell
& 'D:/project/SpecDev Harness/aftertaste-reader/.local/D009/runtime/node.exe' 'D:/project/SpecDev Harness/aftertaste-reader/.local/D021/author-f5cc1ad/dist/cli/main.js' serve --project 'D:/project/SpecDev Harness/aftertaste-reader/.local/D021/author-f5cc1ad/project' --port 4340
```
