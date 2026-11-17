# 开发规范 · 回执

## 当前结论（2026-11-17 任务资料归档已合 dev）

D001—D006 共 6 个目录、21 份任务材料已从 `docs/work/D编号-主题/` 移到 `docs/work/2026/11/D编号-主题/`，原目录移除，无副本或跳转目录。现行索引、根入口、规范、规格及实验说明的引用同步更新。批准内容和原审查结论保留，归档不代表关闭任务或已知问题。

- 规则：年月按任务创建时的 Asia/Shanghai 日期，编号跨年月连续；模板落入实际目录时重算链接。维护规范补充发现问题先处理、保留或延后须有具体理由及再处理条件；权限和修复停点不变。
- 自检：6 个旧目录及 21 个旧文件路径均已移除，新位置齐全；20 份原件除链接目标外正文一致，D001 回执的历史依据与证据段也保持一致。67 份自有 Markdown 的 351 个本地文件链接、31 个锚点检查通过，暂存全范围空白检查通过；无产品源码／测试／依赖或受管资产变化。本次只改文档，不重复产品测试。
- 独审：候选 `9504c1436551b86587435eb774a6a9d57c017ee3` 通过，无需修复；原文追加在 [review](review.md)。审查独立核迁移保真、57 个历史链接映射、所选 64 份 Markdown 的 336 个本地链接及 26 个锚点，规则与授权一致，开始／结束无漂移，已明确交还写入。其后只归档本回执与审查原文，复用该候选结论。
- Git：作者于 2026-11-17 追加“你先合并到dev，然后出这一单的任务”，主脑将 `codex/docs-task-archive@27640e4` 正常 `--no-ff` 合入 `dev`，合并提交为 `4ecb7ca36a68ae1909fec0ad52937b38b006107c`，两父分别为 `4d7d94e` 与 `27640e4`。合并树与候选完全一致，复用上述自检／独审；核无独有提交、工作树占用及忽略文件路径冲突后，以 `git branch -d` 删除归档分支。无 master／main 分支被改动，无远程配置，未推送／发布；原依赖、构建和实验数据未清理。本次收尾仅更新本回执，随后已从该 dev 建立 D007 分支派单，具体入口见[任务索引](../../../README.md)。
- 作者验收：无产品呈现或教学变化，不适用产品体验验收。D004 体验待验及 D006 后续发现的取源问题不因归档变为通过或已修复；修复仍另按批准范围执行。

## 2026-11-17 批准依据与迁移记录

当前作者与主脑会话，作者原话：

> 旧任务  归档，不保留，再开发规范里面写清楚，发现问题后逃避不是第一选择，如果确实该保留可以保留，但需要理由，这次我选择归档是因为项目初期，没那么多东西，现在归档正方便，以后代码多了反而不好弄了。
> 你看看怎么做的，是你来做还是除任务让执行来。

主脑按持续维护职责直接实施，不新建产品任务号。这里“不保留”落实为不留旧位置／重复副本；批准原文、审查及证据随唯一原件移动，不销毁历史。全部任务创建于 2026-11，目录映射为 `docs/work/<下表目录>/` → `docs/work/2026/11/<下表目录>/`：

| 目录 | 文件数 |
| --- | --- |
| D001-development-standards | 3 |
| D002-directory-layout | 3 |
| D003-speckit-check | 3 |
| D004-canvas-persistence | 4 |
| D005-development-cleanup | 4 |
| D006-fixed-source | 4 |

原件快照为本轮基线 `4d7d94e`，各任务原批准 SHA 和审查候选仍有效。核对这些历史提交时使用当时旧路径；当前链接使用归档新路径，不能以新路径在旧提交中不存在推断原件丢失。除本维护回执和新增独审记录，任务正文只机械修正 Markdown 链接目标，保留历史内联路径、命令、引用版本及判断。

沿用 writing-for-agents 整理主定义。正式 specs 仅机械更新资料入口，并修复检查中发现的 01 分册三条已失效 `.tools` 链接，指向同固定版本的已安装技能／模板；无需求、设计或实施状态改变，未运行产品 Spec Kit 规划流程。

迁移前核六个源目录均在本仓 `docs/work`，目标均在其 `2026/11` 下、尚不存在；无 reparse point、未跟踪或忽略内容。使用 PowerShell `Move-Item -LiteralPath` 移动，按迁移前文件快照机械重算相对链接，写入前逐文件校验摘要。可再生成检查脚本和输出放 `.local/2026-11-17-task-archive/`，关键映射、检查结果和独审原文在本目录保留。未搬移实验实现、证据、构建、依赖或旧沙盒；本轮未启动服务／浏览器。

## 2026-11-16 维护与整合记录（历史）

以下为当时范围及收束结果，不作为本轮状态。

已补齐 Git 收尾、唯一当前回执、审查交还、失败停点、资源与作者操作、主脑决策／换会话、Spec Kit 增量门槛；中文名改为“回味”。未新建 D007，沿本页保存持续维护依据。入口为[开发规范](../../../../../AGENTS.md)、[Git 收尾](../../../../development/git.md)和[验证细则](../../../../development/verification.md)。

- 自检：归档后的21份修改 Markdown 的165个本地链接和17个锚点通过；实验页类型检查与隔离构建通过；第三方及官方受管文件哈希检查通过。本次收束前再次核22个成果文件逐字节符合独审快照、24个待提交文件范围准确、dev 未前进。具体范围与限制见下文。
- 独审：工作区快照独审通过，无需修复；审查者独立核21份 Markdown 的165个本地链接及17个锚点、22个成果文件摘要、基线与索引，开始／结束无漂移，已明确交还写入。原文追加在 [review](review.md)。主脑已核成果提交 `3e53f5ef382a4740fe15286fa2c44d0063652831` 的22个成果文件与快照内容一致，仅经过 Git 既有换行规范化；合并结果树与成果提交完全一致，收尾仅更新本回执，复用原独审及自检，不冒称新一轮独审。
- 作者验收：2026-11-16 作者明确要求合并到 dev 并删除除 dev 外的分支，本轮按该授权接回收束；不扩写为作者已亲验浏览器交互或产品教学。
- Git：基线为 `dev@e2e73c37e60cedc4a053d12cd061512c69e15172`；成果提交为 `3e53f5ef382a4740fe15286fa2c44d0063652831`，普通 `--no-ff` 合并为 `2d1f6ac49a2d6159edef2377ea2a68c68fd99442`，两父提交及成果包含关系已核对。四条非 dev 本地分支均确认已合入后用 `git branch -d` 删除，当前仅保留 dev 和原项目一个工作树，完整提交历史仍可追溯。本次未清理忽略资源，依赖、构建及实验数据目录仍保留；无远程配置，未推送／发布。收尾归档只改本回执，其提交号以 Git 为准，不为引用自身再造提交。

## 本轮批准与边界

来源：2026-11-16，本次作者与主脑会话。作者关键原话：

> 行，你从dev开一个分支优化一下开发规范，这个不是新开的任务，不做D007这些东西。
> 然后项目aftertaste 翻译我觉得换成 回味 更好，回甘听着不好听，改名为回味。
> 做完等我验收，之后再合并到dev

2026-11-16，作者收到本轮交付后追加收束授权：

> 合并到dev，并且删除除dev的分支，保证git树符合开发规范

本次授权包含保存已交付改动、合入 dev，以及清理 `codex/docs-workflow-refinement`、`codex/docs-development-cleanup`、`codex/experiment-canvas-persistence`、`codex/feat-fixed-source` 四条本地分支，替代此前的待验保留安排；须先核成果包含关系再安全删除，不改写历史，不推送或发布。

主脑直接维护并负责唯一 Git 写入，不另建派单；保留 D001 原任务及所有既有审查原文。当前中文入口与实际页面显示用新名，英文标识、目录、CLI、协议与产品行为不变；旧任务／规格演进中的原话、历史称呼、外层路径和截图证据不倒改。仅实验页面两个显示字符串变化，未修改正式 `src`、测试、产品规格或第三方技能。

## 本轮检查与候选

- 采用 writing-for-agents 整理现有主定义与触发入口；名称替换采用 Ponytail full 的最小完整修改。没有新增角色、全局配置、运行依赖、自动化服务或新的任务编号。
- constitution 按已读取的 speckit-constitution 与实际解析的 constitution-template 做非语义增量：1.0.0 → 1.0.1，原则、结构、批准日期不变。Sync Impact Report 已核对并移除，没有待填项；未运行产品 specify／plan／implement 等整套流程。
- `pwsh` 在本会话 PATH 不可用；改用现有 Windows PowerShell 成功运行 `resolve-template.ps1 constitution-template -Json`。原来源检查脚本在该运行时因缺少 `Path.GetRelativePath` 失败，未修改脚本或安装环境；改用 Node 标准库核 sources.json 中 137 个导入文件的 SHA-256／字节数、9 个官方技能和 12 个共享受管文件的 manifest 哈希，并核无额外导入文件，全部通过。这不是官方 integration status 的运行结果。
- `git diff --check` 首次发现两处新增 EOF 空行，修正后通过；未改已有审查原文格式。Node 检查修改 Markdown 的本地目标与锚点、两处页面差异恰为中文名替换，以及构建 HTML／JS 含新名且无旧名，均通过。
- 在 D004 实验目录串行执行 `node node_modules/vue-tsc/bin/vue-tsc.js --noEmit` 和 `node node_modules/vite/bin/vite.js build --outDir ../../.local/2026-11-16-workflow-refinement/rename-build`，均通过（16 模块）。产物为本次独立可重建目录，未覆盖原实验 dist，也未启动服务或浏览器。
- 未重跑产品行为全套、浏览器交互或实际教学；名称替换无行为／布局变化，旧实验证据只证明其绑定的旧候选，不把旧截图描述为新名称的证据。规范执行的长期效果待后续实际开发检验。

独审当时以基线＋文件内容 SHA-256 固定未提交候选；实际提交后已完成与该快照的内容一致性复核，结果见顶部，不倒改为固定提交独审。以下保留审查时22个成果文件的原始字节哈希（不是 Git 换行规范化后的 blob 哈希）：按路径排序，将每行编码为 `路径 + NUL + SHA-256 + LF`（UTF-8），串联后的 SHA-256 为 `ef7585b453b93d9696303795f95e7dab2000da85d105f5dbf0f74be5e2380135`。本回执和审查归档单独记录，不纳入自引用摘要。

```text
.agents/README.md 6f3579200c8ff3c833eb6622b948c8f95bb8634146afa724fa5dfff9f94c93e7
.specify/memory/constitution.md 5104187ffbca2d1a4ea632e7c4738a875284323d52ab2c97c7e314ac08ce0f6c
AGENTS.md dfea287a7ae9f28a68e825a768eac6381b454e12fe64dd856313bec5b419f095
README.md 2923022286bef9639ccb41d66274c695ace4812ed71de67e06df720158fe45b0
docs/development/directories.md d21911ba9790d805b23080349f36219527c07a38a497b417f69ca7248fad0a21
docs/development/git.md e8f0e8d8270af8a224ab79a609888c1a94280afec10d3b80885284bff5550d87
docs/development/maintenance.md 147388426e972bd57200f968c11480f961d54bd4e8c2c9e4ebb151e6466ce896
docs/development/skills.md bc252672214a5201653f4ecb1fa779756e48b092bc42b8ac6afe5c416e9d51f9
docs/development/spec-kit.md bbf5155a15ab285496cf91b1136f12aad0f213c2413365456f31b3ed66302f2d
docs/development/verification.md 615df0a72dc7d45fe81afc8de9de2e42ae311524bacf9fa9651844b42d2725db
docs/development/workflow.md 13505796fed89f1ebe45f3e22fe80e19300918ad21213f1f6e98c73392f72648
docs/roles/主脑.md 277f88e258e7146ee6976fc895c7db9ff6157f9af696af42009696edf8d98f38
docs/roles/审查.md 4fe1bcd0392ba52245326caf8667a732b9afe7135c81411113aaa42738602852
docs/roles/执行.md bfed16c58ff798544e9cc1ef4140c36c0791c2deba359e619b0fc00c3f6df860
docs/work/README.md 44b3c473fcaabb2ff65142a107e633f2a4ef3ff2a4c7d12fd56861c9fdbbcf8f
docs/work/_templates/handoff.md e486bcde79dd2dd022fe8f836d9d1485792337bee9371def638a411d6e6f8956
docs/work/_templates/review.md fada1583a1b5f4e382e0a811278867510007562369b70a74d9c4dbcedfeb0744
docs/work/_templates/task.md 47d50bc6b659b5437c97510ba9dd422a5f60b82787d0f191ef18b69e5dc39525
docs/work/backlog.md fc9e49b6b965114a6c2249f96befbc9d4f03939617ed221ec5129b972e14120f
experiments/D004-canvas-persistence/index.html 1c9775a05f900a721b7e120b2c0af06a067ea62dec358e61fb5e71203b3ed59a
experiments/D004-canvas-persistence/src/App.vue e46810accab9d14b9d1a88c16e06de14a60514b3000b56319f68851e37e9e878
skills/aftertaste-reader/README.md eaa799c4ea77984e47b9a543855c4b5a5e6920d9d926591b53be570eb545b7c2
```

## D001 首版历史证据

以下仅为 D001 首版当时记录，非本轮当前状态；其后 D001—D003 整合见 [D003 回执](../D003-speckit-check/handoff.md)。本轮状态仅由顶部维护。

### 首版结果与入口

首版开发规范和项目内开发技能已完成，自检与独审通过。主入口为[根 AGENTS](../../../../../AGENTS.md)，技能选择见[技能入口](../../../../development/skills.md)。本项完成不自动启动下一项产品编码。

- 三角色：主脑派单与持续维护；作者转交执行会话；执行实现、自测、调用独审、交回；审查只读候选。
- 六项按需约定：任务流程、工程、验证、Git、技能及规范维护；配套任务与回执模板。
- 导入 Ponytail、Ponytail Review、writing-for-agents、Impeccable，以及 Trail of Bits 两个完整专项包；共 137 个来源文件，附清单与复核脚本。
- 当前已有 skill-creator 通过宿主入口使用；Spec Kit 仍为本地固定源码参考；Anthropic 评测方法仍为候选。

### 首版版本与验证

- 基线：`80ff6eb`；分支：`codex/docs-development-standards`；成果及独审候选：`eab8cd839f256c163159af69515e88ca022332b5`。后续提交仅保存本回执和审查原文，未改变已审规范、技能或脚本。
- 来源复制时逐文件与巧格选中路径比较 SHA-256 一致，选中来源路径工作区干净；上游版本依据巧格固定记录，未冒称本次联网逐文件重验。
- 自检：`pwsh -NoProfile -File .agents/verify-sources.ps1` 核 137 文件／2,564,325 字节通过；16 份新规范与来源说明中的 41 个本地链接目标存在。首次 `git diff --check` 仅检查当时已跟踪改动，不能覆盖新增文件。
- 暂存后全范围 `git diff --cached --check` 报出原版 Impeccable 的尾空白、EOF 空行及原样 CRLF 启动器；为保持来源字节不修上游。自有规则／脚本使用 `git diff 80ff6eb eab8cd8 --check -- . ':(exclude).agents/skills' ':(exclude).agents/vendor'` 检查通过；来源库用哈希一致性核验。
- 导入 Markdown 相对链接扫描：仅 sharp-edges README 的 3 个 Related Skills 指向未选包；核为可选推荐，不是所选流程必需依赖，已在来源说明披露。所选技能内部参考无缺失。
- 独立审查：R1 通过，无需修复；[原文](review.md)绑定 eab8cd8。检查角色交接、维护授权、产品边界、技能与新会话入口，并独立复核来源脚本、规范链接和自有差异。修复轮次为 0。
- 记录提交保留审查原文的三处 Markdown 双空格硬换行；普通 `diff --check` 会提示，核对为原文格式后保留，非规则或实现问题。其余记录差异检查通过。

### 首版验证边界与状态

- 未编写产品代码或产品 Skill，未安装产品依赖，未运行产品或 A01—A25 验收。
- 技能已落仓不等于客户端已自动发现；可按本地路径显式读取。Impeccable 引擎、两个专项包的实际业务效果均未运行验证。
- 无页面／教学成果，作者产品体验不适用；开发流程需后续实际任务继续验证和维护。
- 当前任务提交并保留分支；未合 dev、推送、发布或改全局环境。最终工作区与记录提交以交回时 Git 核对为准。
