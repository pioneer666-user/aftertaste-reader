# D010 验证证据

## 输入与环境

批准为 task.md @ `2a6f27d`，dev 基线 `e331634`。Windows NT 10.0.26200.0、PowerShell 7.6.9、Git 2.50.1.windows.1，正式检查使用既有 `.local/D009/runtime/node.exe` 24.11.1，TypeScript 5.9.3。默认 PATH Node 是 22.23.2，构建时仅任务进程 PATH 前置 Node 24。无产品源码／依赖变更，D007—D009 原工具回归证据沿各自 handoff 复用。

## Spec Kit 实际阶段

按官方 v1.4.0 specify／spec-template 建 spec，实际 resolve-template。specify 质量检查 16/16。setup-plan、setup-tasks 实际执行，形成 plan、research、data-model、contracts、quickstart 和 15 项 tasks，其中 US1 三项、US2 两项、US3 三项、跨场景七项，检查顺序串行。MVP 是 US1 的完整主路径，整单交付同时要求 US2／US3。每阶段前后实际检查 extensions.yml 均不存在。

analyze 实际执行 RequireSpec／RequireTasks／IncludeTasks 前置。以下是只读分析报告的归档。

### Specification Analysis Report

| ID | Category | Severity | Location(s) | Summary | Recommendation |
| --- | --- | --- | --- | --- | --- |
| — | — | — | spec／plan／tasks | 无冲突、歧义、重复或覆盖缺口 | 进入本批 implement |

| Requirement Key | Has Task? | Task IDs | Notes |
| --- | --- | --- | --- |
| FR-001 | 有 | T003、005、007 | 范围、节奏 |
| FR-002 | 有 | T001、004、005、008 | 固定来源及既有版本 |
| FR-003 | 有 | T003、010、012 | 教学资料与重点 |
| FR-004 | 有 | T003、006、007 | 骨架、覆盖与检查 |
| FR-005 | 有 | T003、008、009 | 依赖边界和状态 |
| FR-006 | 有 | T003、008、009 | 资料保护与失败 |
| FR-007 | 有 | T003、011、012、013 | 模板及维护 |
| FR-008 | 有 | T001、004、005、013、014 | 可调用入口 |
| FR-009 | 有 | T002、003、007、014、015 | 行为证据、试读及独审 |
| SC-001 | 有 | T007 | 缺失选择和节奏 |
| SC-002 | 有 | T007、009 | 非空正文、图状态 |
| SC-003 | 有 | T009 | 失败保护 |
| SC-004 | 有 | T007、014、015 | 独立使用与试读 |

Constitution Alignment Issues 与 Unmapped Tasks 均无。Metrics 为 13 个可建设要求／条件、15 项任务、100% 覆盖，Ambiguity／Duplication／Critical 均 0。无待建议修复项，进入 implement。

implement 实际执行 RequireTasks／IncludeTasks，扫描 requirements.md 共 16 项、16 已勾、0 未勾，无自定义 checklist。实际 Git 项目检测成功。沿 Node／TypeScript 单锁与已覆盖 node_modules、dist、.local 的 ignore，未命中 Docker、ESLint、Prettier、Terraform、Helm，package private 且不发布，未新增对应配置。

## 静态与可复建样例

1. `node --test tests/skills/generation-static.test.mjs` 首次在 Skill 尚未创建时按预期 1/2，通过 fixture，入口报 ENOENT。随后入口和资源落地，Node 24 下 2/2 通过。
2. 进程 PATH 前置 Node 24 后 `npm run build` 通过。产品 src 未变，构建用于当前真实 CLI 调用。
3. `python .../skill-creator/scripts/quick_validate.py skills/aftertaste-reader` 首次因默认 GBK 解码中文 UTF-8 失败，属于工具环境前提。进程设 PYTHONUTF8=1 后返回 `Skill is valid!`，累计环境修正 1 轮成功，无产品修复。
4. fixture 两次创建得到相同完整提交，且已有路径排他拒绝，工作区特意与固定源码不同。fixture 使用合成内容，具体源码可从已提交生成器复建。

## 真实 Skill 行为

### 逐批、补问与仅提问（B01、B02、B06）

Skill 候选 `616dabcdc467c61bd9ed939c472b8ea1eee18a9c`。代理 `/root/skill_trial` 从 fresh context 启动，只给入口、目标、工具位置与用户请求，未提供预计答案或本单开发材料。可确认宿主为 Codex 桌面／Windows PowerShell，精确模型 ID 接口未暴露，沿父会话默认模型。目标 `.local/D010/batch`，固定提交 `5394d8f86c961ce1b327674235525f57bf0b982c`。

消息依次为“我想读这个项目，帮我开始。”、“范围选 src/。”、“逐批阅读，你安排第一批。我会写简单接口，想看职责和取舍。使用提交 5394d8f86c961ce1b327674235525f57bf0b982c。”。前两轮分别只补问范围／节奏、节奏并等待。执行者两次实查目标 docs/aftertaste 均不存在。

第三轮代理读入口、五份参考、两模板和现有教学资料状态，实际调用顺序为 pin → 固定 ls-tree → read 四文件 → apply-graph 登记 rules／service → create rules（1—7）→ 填正文／validate → create service（1—3、4—6、7—10）→ 填正文／validate → query 两文件 → apply 完整依赖 → validate-graph → 方向收尾。由代理选择首批两个文件，未向用户逐批索取批准。

`mapping` 为 `--project <batch绝对路径> --repository <同一路径> --prefix ''`，`sourceArgs` 再加 `--commit 5394d8f86c961ce1b327674235525f57bf0b982c`。Node child_process 独立 argv 保留空 prefix。输入在 `.local/D010/skill-trial/register-first.json` 与 `review-first.json`，均只含路径／关系。

执行者复核两篇 validate-document 均退出 0，mechanicallyValid=true、sourceCheck=completed、contentStatus=provided，源码行数 7／10，diagnostics=[]，teachingQuality=unchecked。图两条真实依赖指向 service，rules／service reviewed，范围外 audit unreviewed。api、范围外 audit 和工作区新增文件均无讲解。read 返回的 rules 不含 WORKTREE_ONLY，确认用了固定版本。两篇正文核固定源码事实，包含数值转换边界、长度编号条件、可见副作用与有条件的取舍。

首批完整原件已归 [sample](sample/README.md)。代理保存明确偏好，观察为“暂无”，方向仅记实际已讲及下一步 api。随后用户只问“为什么这里要单独一个 service？”，代理在聊天回答并停止，没有工具调用或写入。执行者将五份目标资料与首批归档逐字节比较，全部保持一致。

下一轮用户给出“继续。我还是觉得例子少，我需要从输入到结果的完整过程，后面都尽量这样讲。”。代理读取实际 current 头与图确认同版，校验已有两篇并保持原文，read 固定 api，登记新节点，create 分块为 1—2、3—5、6—9 与一个纯讲解块，填写后 validate。query／apply 完整 service 依赖再 validate-graph，调用均退出 0。API 讲解状态 provided／completed／机械有效，四块含完整成功与失败推演，教学状态仍 unchecked。范围内三个文件均完成，范围外 audit 仍 unreviewed。

反馈维护保存明确完整流程要求，AI 观察依据前两篇与此次实际反馈，保留讲法效果待验。之后用户重复强调完整过程、要求合并偏好，同时表示箭头图有帮助但“不要流程图”仍有效。代理读偏好与相关讲解，只合并修订原条目及观察，保留明确禁用流程图，采用编号步骤／状态表；无重复观察、计数、权重或已解决判断。该输入已明确保留原要求，代理没有再次询问。

最后单独测试未消解的冲突。用户请求“新的反馈是以后每个例子都用流程图，不过不要修改或撤销我原来‘不要流程图’的明确要求。请把它合并到偏好。”。代理读取偏好后询问两条要求各适用于哪些内容，等待回答，未写资料。执行者将此轮前后 preferences 原文逐字节比较，保持一致。

### 归档样例复核

新增 generation-sample.test.mjs 以同一 fixture 在新沙盒重建源码，复制首批归档后从不同于工具／项目的 cwd 调用真实 CLI，校验两篇与图，核固定提交、正文、行数、ID 原件保持及范围外无文档。首次实际运行 1/1 通过。此为沿 plan／tasks 官方结构的验证增量，需求覆盖与依赖无变化。

### 连续生成（B03）

独立代理 `/root/continuous_trial` 从 fresh context 仅收入口、环境和用户请求“请用回味讲解这个项目的 src/，固定提交 5394d8f86c961ce1b327674235525f57bf0b982c，连续生成到这个范围完成，小批次你自己安排。”。目标 `.local/D010/continuous`，Skill 内容仍为 `616dabc`。未给偏好或真实学习反馈。

代理读入口、五参考及模板，pin／固定树枚举／资料检查后依 rules → service → api 三批连续执行。每批 register → create → 填正文 → validate-document → query → apply 完整依赖 → validate-graph → 方向收尾，末尾又校验三篇，共 26 次 CLI 均退出 0。create 的 EXPLANATION_EMPTY 在填写后消除，没有把骨架计作交付。

三篇最终 mechanicallyValid=true、sourceCheck=completed、contentStatus=provided、diagnostics=[]、teachingQuality=unchecked。图四节点三边，三个 src 节点 reviewed，audit unreviewed。偏好保留模板原文，方向逐批合并实际主题。没有等待理解标记或逐批确认，没有生成工作区新增文件及范围外讲解。原件归 [behavior/continuous](behavior/continuous/reading-direction.md)，工具输入保留于 `.local/D010/continuous-inputs/step-01.json` 至 step-06.json。执行者后续统一复核实际产物。

逐批续读与反馈后的原件另归 [behavior/after-feedback](behavior/after-feedback/reading-direction.md)，首批试读原件保持不变。连续代理未采集首次写入前 Git 状态，因此只记录最后状态，不以其报告声称完整前后差异。

### 保护与失败（B04、B05、B07）

代理 `/root/failure_trial` 从 fresh context 仅收产品入口、环境及四个独立用户请求，按 A—D 串行操作。Skill 内容仍为 `616dabc`。各项目由同一 fixture 构建。

| 场景与输入 | 实际结果 |
| --- | --- |
| A unavailable，src/、连续，指定 `1111111111111111111111111111111111111111` | pin 退出 1，INVALID_REVISION／Git status 128。代理报告尚未开始，无源码读取、资料初始化或版本替代 |
| B failures，src/、连续，默认开始时 HEAD | pin 得 `5aeb76e988a4de7939ca5c5b4f1f8ad273913bc6`，既有两篇／图仍为 `5394d8…`。validate-graph 退出 1、GRAPH_VERSION_MISMATCH、sourceCheck=not-run。停版本相关写入，保留所有旧资料 |
| C invalid，src/、连续、固定 `5394d8…` | rules 真实校验退出 1，BLOCK_UNCLOSED／SOURCE_GAP，未改其原件。service 与图有效。代理完成可独立新建的 api，校验通过，图添加 service → api，方向明确 rules 未完成，交付明确 src/ 尚有未完成项 |
| D skeleton，仅 src/rules.mjs、连续、固定 `5394d8…` | 已有空骨架校验退出 0，但 contentStatus=unfilled、EXPLANATION_EMPTY。因无本次创建证据，代理保留原件，报告尚未完成，无补写或重建 |

可重建输入基于 sample 首批五份原件。B 的 HEAD 是同树的空提交，parent 为 `5394d8…`，author／committer 均 Synthetic Fixture <fixture@example.invalid>，时间 2026-11-17T01:00:00Z，message 为 synthetic alternate revision。C 仅移除 rules 原件的结束标记，D 仅清空该块正文，保留 `x4y6az2y` 与 1—7 范围。准备后、代理开始前的原件哈希保存在 `.local/D010/protection-baseline.json`，执行者后续统一核字节和实际新增部分。

C 还有一次可复核的同版续填。create api 已成功发布空骨架，代理的辅助宿主脚本因创建结果变量未绑定中断，属于试用脚本问题。代理从本轮内存调用记录取得成功 create 结果，确认本次创建的三个块 `37qsgnf3`、`34xzgjxx`、`j7euu8c5` 后填正文并 validate 成功，ID 与范围保留。该例覆盖本次新建骨架的安全续填，D 覆盖未知归属骨架保护。未修改产品或放宽预期。

失败结果均报告实际完成与未完成状态，未因旧图 reviewed 或校验退出 0 宣称讲解完成。无源码副本、Git 修复、服务或安装行为。

### 执行者最终串行复核

- [verification.json](behavior/verification.json) 保存实际机器结果和原件哈希。B、D 全部旧资料及文件集合不变，C 的旧 rules／service／preferences 字节不变，仅新增 api 并按实际完成范围维护图与方向。A 没有生成资料目录。
- batch、continuous 各三篇，C 三篇，D 一篇，共 10 次 validate-document。8 篇 provided／源码 completed，C 的损坏 rules 如实退出 1，D 的空正文如实 unfilled／EXPLANATION_EMPTY；没有将两者算作完成。
- 四个同版图 validate-graph 有效且 sourceCheck=completed，audit 均 unreviewed；范围外和工作区新增文件均无讲解。B 的版本不符独立按失败结果记录。
- 连续模式偏好逐字节等于随包模板，逐批反馈后的 rules／service 原文仍等于首批归档。未消解的偏好冲突前后也保持原文。
- 所有使用代理完成后，Node 24 下串行重跑 generation-static 2/2、generation-sample 1/1、skill-creator UTF-8 校验通过，git diff --check 通过。未重跑无关产品能力全套测试，沿 D007—D009 同版证据。

C 的新 api／图／方向保存在 [partial-failure](behavior/partial-failure/reading-direction.md)，输入可由首批样例及前述单一改动重建。代理脚本创建结果变量问题累计恢复 1 轮成功，产品改动修复轮次为 0。

## 证据边界

静态检查验证资源与包结构，真实代理检查实际遵循情况，独审另行进行。当前无页面、服务、全局安装、发布、宿主自动发现或真实外部项目教学验证。作者教学体验待试读。
