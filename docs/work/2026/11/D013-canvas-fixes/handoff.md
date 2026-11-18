# D013 · 画布布局与阅读导航修复回执

## 当前结论与入口

- **执行侧交回最终行为候选 `58aac2af751f323092d61e308f972783e795d665`。** F2 两条反例已通过真实 Edge、正式 CLI 和布局服务验证。点击“刷新图并保留本页布局”后，新位置和新组在重开时仍可见。无关说明改动又撤销后，跨过正式删除的旧页始终收到 409。最终候选全量测试 82/82，Edge 的 F1—F4 全部通过。
- [R3 执行侧独审](review.md#execution-review-f2)关闭两条 F2 反例，同时发现首次建图失败后重试无法保存。另提交修复后，[R4 最终复核](review.md#execution-review-final)通过并明确交还写入。
- 批准依据为 [D013 任务单](task.md) `347954c` 以及作者按 [R2](review.md#mainbrain-review) 和[主脑补查](#mainbrain-checks)回派的两条 F2 验收。比较基线为 `dev@91d6c799141526809529df3851f38c696c3233bb`。第一候选 `7fe6791` 修复 F1—F4，`457d84c` 补修 F2 的登记身份、保留草稿和旧页保护，`58aac2a` 收束发布失败回退。归档提交仅更新回执、独审原文及任务完成状态。
- 分支 `codex/fix-canvas-layout-navigation` 保留待验，`dev` 仍在比较基线，无合并、推送或发布。作者体验待验。作者可打开文件依赖图查看 `Second latest`，拖动组中节点、等“布局已保存”后重开体验。[最终候选试读](http://127.0.0.1:4333/)
- 作者将本回执交回主脑后，由主脑另派未参与实现及执行侧独审的子代理，定向复核最终候选布局，再决定是否合并。

## 最终候选的自测与复核

| 验收 | 实际操作与结果 |
| --- | --- |
| F2 保留本页布局 | 用正式 CLI 两次删除和重新登记同一路径，第二次的重复删除沿用该次标记。Edge 刷新后暂扣页面自动 PUT，在画布上将 `support/audit.mjs` 从 `(570,64)` 拖到 `(668,155)` 并建 `Second latest` 组。另一个文件暂缺时放行请求得到 409，点保留显示 `LAYOUT_GRAPH_UNCONFIRMED`，磁盘保持第一轮布局。恢复图再点保留，PUT 200。磁盘保存的新位置和新组，在新浏览器上下文及重启的服务中均恢复。 |
| F2 旧标签页 | 留着删除前磁盘上的 `(722,55)`、单成员 `Audit` 组和布局修订。正式删后重加得到字节完全相同的图，此时、原子替换图仅改无关边说明、原样写回及重启服务这四步，最新预览均为 `(570,64)` 与空组。旧请求逐次返回 `409 LAYOUT_GRAPH_CHANGED`，布局文件逐字节一致。当前版本仍可提交。手工临时移出文件后，即使用正式工具修改另一条边，服务仍拦住对缺席文件布局的清理。 |
| F1、F3、F4 | 同一最终构建的 Edge 中，正式删空由页面写回空坐标和空组，保有 120% 视野，重加后可拖动并重开。已有 D012 格式布局中的普通节点与 `__proto__` 均能拖动、保存和重开，分别为 `(225,165)`、`(515,139)`。释放只含 rules 的旧清单后仍显示 service 和三个正文块，返回画布时保持 120% 视野。 |
| R3 新发现的首次发布失败 | 注入首次建图的 `link` 失败，断言 `published=0`。原有凭据按字节恢复，原本没有凭据时图和凭据均不存在。随后正常 CLI 登记同一路径，GET 无布局故障，PUT 200，实际保存坐标 `(668,155)`。已有图替换失败和已发布后收尾失败也经过定向注入。 |

- Windows `10.0.26200`、Node `24.11.1`、Edge `157.0.4341.60`。最终候选用仓内 Node 24 执行 `tsc --noEmit`、`vue-tsc --noEmit -p tsconfig.web.json`、`tsc`、`vite build`、`node tests/browser/canvas-fixes.mjs` 和串行全量 `node --test --test-concurrency=1 'tests/unit/*.test.mjs' 'tests/integration/*.test.mjs'`。全量 **82/82**。最终构建清单及日志在 `.local/D013/f2-final/`，Edge 页面证据在 `.local/D013/browser-edge-kgVeeC/result.json`。
- 在 `457d84c`，串行全量 81/81，Chrome `157.0.8103.79` 和 Firefox `159.0` 通过 F2 两条链，既有 Edge 画布和阅读回归也通过。报告依次为 `.local/D013/browser-chrome-nLsy2o/result.json`、`browser-firefox-N5xMd5/result.json`、`browser-edge-QHj6UD/evidence.json`、`browser-yu6QFw/report.json`（均在 `.local/D013/`）。最终构建只更换了 `adapters/graph-store.js` 及其声明文件；浏览器页面资源哈希逐项一致。兼容浏览器沿用这次检查，最终候选的图存储、异常恢复和页面联动另由上述全量与 Edge 实测覆盖。
- 规格按 Spec Kit 的 007 增量工作流沿用原模板与 16 项需求检查，补入 T020—T022。实施前完成覆盖分析和前置检查，实施后同步 004 凭据模型、007 布局模型及 HTTP 契约。第一候选的流程及此前失败均保留在下文。
- 未验范围包括作者体验、旧构建降级、多服务同写及外部文件系统竞争。D012 原布局与匹配的旧移除凭据可读。若试用过第一候选，且它留下的旧标记已失去对应快照，服务提供只读预览并保全布局，恢复路径见[图数据模型](../../../../../specs/004-dependency-graph/data-model.md#画布移除凭据)。同批另增节点的自动摆放差异仍按[主脑补查](#mainbrain-checks)记录。

## 最终候选试读与重建

本机端口 4333 使用 `.local/D013/author-58aac2a/` 的固定构建与独立合成项目，监听 PID 44236。用最终 Edge 样例复制出已完成“保留”的布局，固定源码提交 `5394d8f86c961ce1b327674235525f57bf0b982c`。验过首页和脚本 HTTP 200、三个节点、一条边和两篇讲解。GET 返回 `(668,155)`、`Second latest`、与磁盘一致的修订，布局没有待协调操作。清单逐项校验了 41 个构建文件，根锁文件 SHA-256 为 `E0BE9B44C870AEE9AD7947DC13456F547C3588A2A6C44AA47B37F78CB624BB81`。

试读以受管前台进程运行。若入口已停，在本机 Windows PowerShell、4333 空闲时运行以下命令。输出 `"status":"ready"` 即可打开试读地址；该终端 Ctrl+C 可停止服务。验收后收束前，核监听者命令行指向本试读目录并确认页面保存已结束。试读使用仓内现有 Node 24 和依赖。

```powershell
& 'D:/project/SpecDev Harness/aftertaste-reader/.local/D009/runtime/node.exe' 'D:/project/SpecDev Harness/aftertaste-reader/.local/D013/author-58aac2a/dist/cli/main.js' serve --project 'D:/project/SpecDev Harness/aftertaste-reader/.local/D013/author-58aac2a/project' --port 4333
```

从干净克隆复验时，用 Node 24 在行为候选构建，按 [quickstart](../../../../../specs/007-dependency-canvas/quickstart.md) 运行 `node tests/browser/canvas-fixes.mjs F2`，可重建磁盘及重开证据。大日志和试读副本在忽略目录中。旧 D013 试读仍在 4331，D012 在 4320。中间版 `.local/D013/author-457d84c/` 的递归清理被宿主策略拒绝，副本保留且未启动服务。

## 第一候选 `7fe6791` 的完成内容与验收证据

| 编号 | 执行侧实测与落盘结果 |
| --- | --- |
| F1 | 在 Edge 三节点样例中建立 `Start` 组、放大到 120%，保存并关闭页面和服务。正式 CLI 删空后，新会话打开图，页面自动 PUT 200，显示“布局已保存”，刷新可用。磁盘修订更新，坐标 `{}`、分组 `[]`、缩放 120%。重新登记 `rules.mjs` 后同页刷新并拖动，重启服务和浏览器后恢复新位置，约为 `(124.667,105.667)`。无移除凭据的空图保持原布局，缺图、坏图的保护由真实服务集成检查覆盖。 |
| F2 | 两份相同排布中，`support/audit.mjs` 从 `(722,55)` 与 `Audit` 组起步。全程关页与删后打开并等保存两种路径，经 CLI 重加均为 `(570,64)`，空组消失，其他坐标及视野 `(20,18,120%)` 相同。继续拖动保存、刷新和重开均保有新位置。另一次删后重加的图字节与原图相同，旧页 PUT 仍返回 `409 LAYOUT_GRAPH_CHANGED`，磁盘未变。保留草稿刷新后，已保存的 144% 缩放保留，旧成员未回来。无凭据的临时缺席恢复后，原位置和 `Temporary` 分组回来。 |
| F3 | 在合成 Git 项目提交并由正式图工具登记 `__proto__`、`neighbor.mjs`，读取已有 D012 格式布局。页面完成协调并先后拖两节点，逐次等待真实 PUT 200 和已保存。最终普通节点 `(225,165)`、特殊名节点 `(515,139)`，重开均恢复。真实服务另核错误条目和旧请求格式 400、旧修订 409、来源及作用范围限制，保有已保存文件。 |
| F4 | 暂扣真实服务初始清单，实际仅有 `src/rules.mjs`。补入 `src/service.mjs` 讲解，经图选中并点“阅读讲解”。释放旧清单后标题仍为 service，三个正文块相同。返回图恢复 120% 视野。普通打开选到 rules，主动刷新保留 service，之后从清单显式切换两篇均通过。 |

空图协调使用原布局保存入口，页面可以在画布手势初始化前写回。正式图工具保留每条路径最近一次移除标记，服务识别同路径重加并拒绝过期图请求。已有 D012 磁盘布局及移除凭据可读。PUT 坐标改用条目数组，服务升级后仍打开旧构建的页面需要重新加载。新构建首次保存重加路径时，可在磁盘布局附加已接受的移除标记，旧构建回退读取含新标记的布局未验。参见[布局模型](../../../../../specs/007-dependency-canvas/data-model.md)与 [HTTP 契约](../../../../../specs/007-dependency-canvas/contracts/graph-layout.md)。

## 第一候选的自测、独审与覆盖范围

- Windows 11 `10.0.26200`、Node `24.11.1`。用 `.local/D009/runtime/node.exe` 执行 TypeScript 与 Vue 类型检查、`tsc` 和 Vite 构建，通过。运行 `node --test --test-concurrency=1 tests/unit/canvas-layout.test.mjs tests/integration/dependency-canvas.test.mjs`，6 项全部通过。构建清单和锁文件哈希见 `.local/D013/regression-02/candidate.json`，同目录保留命令日志。
- `node tests/browser/canvas-fixes.mjs` 串行通过 Edge `157.0.4341.60`、Chrome `157.0.8103.79`、Firefox `159.0`。结果依次在 `.local/D013/browser-edge-HRMxvK/result.json`、`.local/D013/browser-chrome-HAkpj1/result.json`、`.local/D013/browser-firefox-pIHenK/result.json`。样例由 [dependency-canvas.mjs](../../../../../tests/fixtures/dependency-canvas.mjs) 重建，固定源码为 `5394d8f86c961ce1b327674235525f57bf0b982c`，F3 在其合成仓库追加两个根目录普通文件后用新提交登记。
- 既有 Edge 画布与文件阅读分别运行 `node tests/browser/dependency-canvas.mjs` 和 `node tests/browser/file-reader.mjs`，均通过。参数为 `AFTERTASTE_TEST_TASK=D013`、`AFTERTASTE_CANVAS_PORT=4332`、`AFTERTASTE_BROWSER=edge`。证据为 `.local/D013/browser-edge-lRg2Mt/evidence.json` 和 `.local/D013/browser-yuOoxE/report.json`，覆盖原有拖组、保存迟到与丢失应答、写入失败重试、读取和导航。
- 较早构建运行串行全量测试，D009 图工具和 D011 阅读集成回归通过。79 项中有 1 项未通过，为新增的“同路径重加同时还有其他已删除节点”断言。上一构建把已删除节点的坐标计入摆放范围，得到 `(840,64)`。候选以存续坐标计算，得到两种时序相同的 `(570,64)`，最终定向验证已通过。全量 79 项未在最终候选上重跑。基线反例在 `.local/D013/browser-edge-npqDro/result.json` 和修正测试图输入后的 `.local/D013/browser-edge-a4Hi3j/result.json`。首轮修复的 F1／F2 重开画面比较还暴露 CSS 小数舍入，后用容差比画面、磁盘精确比对，结论见最终三浏览器证据。
- 独审在同一 SHA 上另开 Edge 和临时真实服务，F1—F4 重新实测通过，并补测字节相同的图、两种过期拒绝、校验、写入来源及同一保存重放。起止锁文件与 41 个构建文件相符，采集资源已关闭并交还写入。原文和证据入口见 [独审记录](review.md)。
- Spec Kit 按现有 007 目录做增量维护。specify 解析官方模板并更新场景、需求及成功条件。plan 和 tasks 使用官方模板及前置脚本，保留原结构和 T001—T012，增 T013—T019。编码前按 analyze 的只读前置核查，6 项功能需求及 6 项成功条件均有实施或验证任务，F1 至 F4 分别对应 T017／018、T017／018、T015／016、T013／014，19 项任务无编号冲突，无阻断、歧义或宪章冲突。implement 前置脚本通过，需求检查表 16 项均已勾选，Git 和当前 Node 工程忽略路径已核对。各阶段无扩展配置，未重跑无关研究或另建功能目录。详见 [007 规格](../../../../../specs/007-dependency-canvas/spec.md)、[实施计划](../../../../../specs/007-dependency-canvas/plan.md)和[任务清单](../../../../../specs/007-dependency-canvas/tasks.md)。
- 多服务进程同写、外部文件系统竞争、作者实际体验未验。F1—F4 运行证据使用可重建合成项目，`.local` 日志和固定试读复制件不随克隆恢复。

<a id="mainbrain-checks"></a>
## 主脑补查 · 2026-11-18

在候选 `7fe6791` 的 41 个构建文件及锁文件均与清单匹配后，用 Node 24.11.1、[三节点合成样例](../../../../../tests/fixtures/dependency-canvas.mjs)、正式 CLI 和真实服务串行核对。每条时序独立建项目，使用动态端口，服务均已关闭。原始响应与落盘结果在 `.local/D013/mainbrain-check-B04OpI/result.json`。

**F2 阻断 · 已正式重加的节点又进入旧组。** 在样例中用 CLI 将 `service` 的依赖改为仅含 `rules`，让 `audit` 没有关联边。通过布局接口保存 `support/audit.mjs` 的位置 `(722,55)` 和单成员组 `Audit`，留存该次 GET 的图版本与布局修订。

1. 用 CLI 删除再登记 `audit`。确认图文件字节与起点相同。GET 正确给出 `(570,64)` 和空组，旧图版本的 PUT 返回 `409 LAYOUT_GRAPH_CHANGED`。保持此时的磁盘布局，模拟页面尚未提交清理结果。
2. 通过项目支持的直接编辑，只改 `rules → service` 边的一句说明，保留节点和所有关系。GET 此时返回旧位置 `(722,55)`、旧组 `Audit`、`reconciled=false` 和 `layoutProblem=null`。
3. 把说明原样改回。此时 GET 给出的图版本与删除前相同。用删除前页面的版本与布局修订只改缩放到 120%，PUT 返回 `200`，磁盘实际保存了旧位置、旧组及新缩放。该时序没有并发文件写入。

当前[图存储](../../../../../src/adapters/graph-store.ts)把移除凭据绑定在图文件内容、身份和修改时间上。改说明后匹配落空，[布局用例](../../../../../src/application/dependency-canvas.ts)失去识别这次正式移除的依据。修复须让这个已重加的节点保有新身份，拒绝跨越正式移除的旧写入。对照验证暂时缺席的节点仍能恢复原布局，并在 [R2 的真实页面操作](review.md#mainbrain-review)中确认草稿的新坐标与分组在成功响应后确实落盘，重开仍可见。

**同批新增其他节点的摆放差异。** 从相同已保存布局开始，先用一次 CLI 同时移除 `audit`、登记 `src/api.mjs`，下一次再登记 `audit`。中间不写布局时，最终磁盘里 `api` 在 `(570,64)`、`audit` 在 `(570,176)`。中间写回自动协调结果时，两者分别在 `(992,64)`、`(1262,64)`。仅涉及自动分配的位置，原有存续节点与视野保持，两条路径均清掉了旧组。执行调整摆放规则时可用此例核对影响；本次合并阻断以用户草稿丢失和旧写入被接受两项为依据。

## F2 补修 · 第 2 轮

2026-11-18 原执行按作者回派续修 F2。上一轮候选 `7fe6791` 在上述两条操作链仍失败，R2 和主脑补查属于只读定位。第 2 轮假设是将正式重加的身份保存在已发布记录中，跨直接编辑继承；授权清理缺席节点仍须匹配当前图。恢复草稿只按正式登记身份识别再次重加。用分组、暂扣 PUT、直接编辑及撤销的真实顺序复核落盘和重开。

首次运行发布失败注入时，两处断言把 Node 的嵌套对象比对当成了部分匹配。两次均已触发真实图替换失败，错误含预期的 `GRAPH_WRITE_FAILED`、`published=0`，还含 `projectRoot`、`graphPath`、`reason=EPERM`。本轮修正测试的诊断对象比对，随后继续核落盘及收尾失败路径。首跑记录在 `.local/D013/f2-followup/service.log`。

R3 在 `457d84c` 独立关闭两条 F2 反例。另在首次图文件发布注入 `EPERM` 后，以正常 CLI 重试登记，GET 出现 `GRAPH_READ_FAILED`，布局 PUT 422。图发布确实失败，本次提前准备的凭据仍在项目中。原文见 [R3](review.md#execution-review-f2)。这是新增发布失败恢复反例的第 1 次修复，假设为在图发布失败时恢复操作之前的凭据原件，并检查原本无凭据与已有凭据两种情形，再通过 CLI 和 HTTP 验证正常重试。

`58aac2a` 在图发布返回失败时，仅撤回内容仍与本次暂存完全匹配的凭据。原有字节恢复、首次失败后无残留、独立替换的凭据保全和正常重试，均经 R4 实证。F2 两条操作链在累计第 2 轮通过；新增的首次建图失败恢复问题在第 1 轮修复并通过复核。

## 第一候选试读与重建

执行保留 `.local/D013/author-7fe6791/`。固定构建的 41 个文件已与候选清单逐项校验，根锁文件哈希随清单记录。后台 PID 28552 监听 `127.0.0.1:4331`，启用的资料目录为该试读文件夹的 `project`。实查首页 HTTP 200、候选页面资源、三节点、两条边、两篇讲解，样例尚未落盘布局。D011 和 D012 的原试读资源未参与本次写入。

需重启时，在 Windows PowerShell 使用固定构建和样例。端口可用时以下命令的完成标志为输出 `"status":"ready"`。服务仅使用 D013 样例。前台启动后用 Ctrl+C 关闭。

```powershell
& 'D:/project/SpecDev Harness/aftertaste-reader/.local/D009/runtime/node.exe' 'D:/project/SpecDev Harness/aftertaste-reader/.local/D013/author-7fe6791/dist/cli/main.js' serve --project 'D:/project/SpecDev Harness/aftertaste-reader/.local/D013/author-7fe6791/project' --port 4331
```

当前后台服务由本次执行启动。待验资源可用时继续保留。需要收束时，先核实 4331 的监听者仍对应本目录 `dist/cli/main.js`，且页面保存已经结束，再关闭该进程。布局随样例目录保留。若从 Git 重建，用 Node 24 在候选上构建并按 [quickstart](../../../../../specs/007-dependency-canvas/quickstart.md) 运行浏览器用例。该用例自行构造隔离项目与临时端口，能复查页面触发、真实保存和重新打开。
