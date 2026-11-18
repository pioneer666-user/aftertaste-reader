# D013 · 画布布局与阅读导航修复回执

## 当前结论与入口

- F1—F4 已实现并通过真实浏览器、正式图工具与本地服务验证。执行侧独审通过，候选为 `7fe6791686acbea5fe6ffc8bea28f62106d79fe9`。批准依据为 [D013 任务单](task.md) `347954cdbba21b75db88168f6eeb6934fab03413`，无有效调整。比较基线为 `dev@91d6c799141526809529df3851f38c696c3233bb`。后续归档提交仅更新回执、独审及清单状态。
- 本机 [试读入口](http://127.0.0.1:4331/) 对应固定候选和独立合成项目。作者体验待验，可关注保存后重新打开的排布、从画布打开讲解再返回的视野。主脑可按下文重跑正式删空和同路径重加，无须使用作者的试读布局。
- `codex/fix-canvas-layout-navigation` 保留待验候选，工作区干净。dev 仍为上述基线。未合并、推送或发布。作者转回本回执后，由主脑另派独立子代理定向复核 F1／F2 及其布局影响，再按复核和授权决定是否合并。执行侧独审覆盖版本与原文见 [R1](review.md#r1--2026-11-18--执行侧独审)。

## 完成内容与验收证据

| 编号 | 执行侧实测与落盘结果 |
| --- | --- |
| F1 | 在 Edge 三节点样例中建立 `Start` 组、放大到 120%，保存并关闭页面和服务。正式 CLI 删空后，新会话打开图，页面自动 PUT 200，显示“布局已保存”，刷新可用。磁盘修订更新，坐标 `{}`、分组 `[]`、缩放 120%。重新登记 `rules.mjs` 后同页刷新并拖动，重启服务和浏览器后恢复新位置，约为 `(124.667,105.667)`。无移除凭据的空图保持原布局，缺图、坏图的保护由真实服务集成检查覆盖。 |
| F2 | 两份相同排布中，`support/audit.mjs` 从 `(722,55)` 与 `Audit` 组起步。全程关页与删后打开并等保存两种路径，经 CLI 重加均为 `(570,64)`，空组消失，其他坐标及视野 `(20,18,120%)` 相同。继续拖动保存、刷新和重开均保有新位置。另一次删后重加的图字节与原图相同，旧页 PUT 仍返回 `409 LAYOUT_GRAPH_CHANGED`，磁盘未变。保留草稿刷新后，已保存的 144% 缩放保留，旧成员未回来。无凭据的临时缺席恢复后，原位置和 `Temporary` 分组回来。 |
| F3 | 在合成 Git 项目提交并由正式图工具登记 `__proto__`、`neighbor.mjs`，读取已有 D012 格式布局。页面完成协调并先后拖两节点，逐次等待真实 PUT 200 和已保存。最终普通节点 `(225,165)`、特殊名节点 `(515,139)`，重开均恢复。真实服务另核错误条目和旧请求格式 400、旧修订 409、来源及作用范围限制，保有已保存文件。 |
| F4 | 暂扣真实服务初始清单，实际仅有 `src/rules.mjs`。补入 `src/service.mjs` 讲解，经图选中并点“阅读讲解”。释放旧清单后标题仍为 service，三个正文块相同。返回图恢复 120% 视野。普通打开选到 rules，主动刷新保留 service，之后从清单显式切换两篇均通过。 |

空图协调使用原布局保存入口，页面可以在画布手势初始化前写回。正式图工具保留每条路径最近一次移除标记，服务识别同路径重加并拒绝过期图请求。已有 D012 磁盘布局及移除凭据可读。PUT 坐标改用条目数组，服务升级后仍打开旧构建的页面需要重新加载。新构建首次保存重加路径时，可在磁盘布局附加已接受的移除标记，旧构建回退读取含新标记的布局未验。参见[布局模型](../../../../../specs/007-dependency-canvas/data-model.md)与 [HTTP 契约](../../../../../specs/007-dependency-canvas/contracts/graph-layout.md)。

## 自测、独审与覆盖范围

- Windows 11 `10.0.26200`、Node `24.11.1`。用 `.local/D009/runtime/node.exe` 执行 TypeScript 与 Vue 类型检查、`tsc` 和 Vite 构建，通过。运行 `node --test --test-concurrency=1 tests/unit/canvas-layout.test.mjs tests/integration/dependency-canvas.test.mjs`，6 项全部通过。构建清单和锁文件哈希见 `.local/D013/regression-02/candidate.json`，同目录保留命令日志。
- `node tests/browser/canvas-fixes.mjs` 串行通过 Edge `157.0.4341.60`、Chrome `157.0.8103.79`、Firefox `159.0`。结果依次在 `.local/D013/browser-edge-HRMxvK/result.json`、`.local/D013/browser-chrome-HAkpj1/result.json`、`.local/D013/browser-firefox-pIHenK/result.json`。样例由 [dependency-canvas.mjs](../../../../../tests/fixtures/dependency-canvas.mjs) 重建，固定源码为 `5394d8f86c961ce1b327674235525f57bf0b982c`，F3 在其合成仓库追加两个根目录普通文件后用新提交登记。
- 既有 Edge 画布与文件阅读分别运行 `node tests/browser/dependency-canvas.mjs` 和 `node tests/browser/file-reader.mjs`，均通过。参数为 `AFTERTASTE_TEST_TASK=D013`、`AFTERTASTE_CANVAS_PORT=4332`、`AFTERTASTE_BROWSER=edge`。证据为 `.local/D013/browser-edge-lRg2Mt/evidence.json` 和 `.local/D013/browser-yuOoxE/report.json`，覆盖原有拖组、保存迟到与丢失应答、写入失败重试、读取和导航。
- 较早构建运行串行全量测试，D009 图工具和 D011 阅读集成回归通过。79 项中有 1 项未通过，为新增的“同路径重加同时还有其他已删除节点”断言。上一构建把已删除节点的坐标计入摆放范围，得到 `(840,64)`。候选以存续坐标计算，得到两种时序相同的 `(570,64)`，最终定向验证已通过。全量 79 项未在最终候选上重跑。基线反例在 `.local/D013/browser-edge-npqDro/result.json` 和修正测试图输入后的 `.local/D013/browser-edge-a4Hi3j/result.json`。首轮修复的 F1／F2 重开画面比较还暴露 CSS 小数舍入，后用容差比画面、磁盘精确比对，结论见最终三浏览器证据。
- 独审在同一 SHA 上另开 Edge 和临时真实服务，F1—F4 重新实测通过，并补测字节相同的图、两种过期拒绝、校验、写入来源及同一保存重放。起止锁文件与 41 个构建文件相符，采集资源已关闭并交还写入。原文和证据入口见 [独审记录](review.md)。
- Spec Kit 按现有 007 目录做增量维护。specify 解析官方模板并更新场景、需求及成功条件。plan 和 tasks 使用官方模板及前置脚本，保留原结构和 T001—T012，增 T013—T019。编码前按 analyze 的只读前置核查，6 项功能需求及 6 项成功条件均有实施或验证任务，F1 至 F4 分别对应 T017／018、T017／018、T015／016、T013／014，19 项任务无编号冲突，无阻断、歧义或宪章冲突。implement 前置脚本通过，需求检查表 16 项均已勾选，Git 和当前 Node 工程忽略路径已核对。各阶段无扩展配置，未重跑无关研究或另建功能目录。详见 [007 规格](../../../../../specs/007-dependency-canvas/spec.md)、[实施计划](../../../../../specs/007-dependency-canvas/plan.md)和[任务清单](../../../../../specs/007-dependency-canvas/tasks.md)。
- 多服务进程同写、外部文件系统竞争、作者实际体验未验。F1—F4 运行证据使用可重建合成项目，`.local` 日志和固定试读复制件不随克隆恢复。

## 试读与重建

执行保留 `.local/D013/author-7fe6791/`。固定构建的 41 个文件已与候选清单逐项校验，根锁文件哈希随清单记录。后台 PID 28552 监听 `127.0.0.1:4331`，启用的资料目录为该试读文件夹的 `project`。实查首页 HTTP 200、候选页面资源、三节点、两条边、两篇讲解，样例尚未落盘布局。D011 和 D012 的原试读资源未参与本次写入。

需重启时，在 Windows PowerShell 使用固定构建和样例。端口可用时以下命令的完成标志为输出 `"status":"ready"`。服务仅使用 D013 样例。前台启动后用 Ctrl+C 关闭。

```powershell
& 'D:/project/SpecDev Harness/aftertaste-reader/.local/D009/runtime/node.exe' 'D:/project/SpecDev Harness/aftertaste-reader/.local/D013/author-7fe6791/dist/cli/main.js' serve --project 'D:/project/SpecDev Harness/aftertaste-reader/.local/D013/author-7fe6791/project' --port 4331
```

当前后台服务由本次执行启动。待验资源可用时继续保留。需要收束时，先核实 4331 的监听者仍对应本目录 `dist/cli/main.js`，且页面保存已经结束，再关闭该进程。布局随样例目录保留。若从 Git 重建，用 Node 24 在候选上构建并按 [quickstart](../../../../../specs/007-dependency-canvas/quickstart.md) 运行浏览器用例。该用例自行构造隔离项目与临时端口，能复查页面触发、真实保存和重新打开。
