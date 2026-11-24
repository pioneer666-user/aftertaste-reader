# D049 · 双图试读与交回

## 当前结论与试读入口

最终行为候选 `9631db4`，首审候选 `1307013`，批准[任务书与三张参考图](task.md)固定于 `2728295`，产品基线 `dev@7c573d1`，本批无调整。作者试读使用同一个合成项目，两图分别保存。文件图可点线查理由，闭环保留步骤导航。旧个人布局按原文件读回，确认重排只替换当前图的位置与视野，保留组名和成员。布局、图内容和 API 格式均沿用原协议。自测完成，首审发现的贴边错位已修复，独立复核通过并交还写入。[独审原文](review.md)

当前保留 `codex/feat-canvas-reading-layout` 供作者验收。工作区只提交本单成果和交回材料，`dev` 仍为 `7c573d1`，未合并、推送或发布。作者尚未亲验本候选的遮挡、分列与确认手感。

| 试读入口 | 建议操作 |
| --- | --- |
| [文件依赖图](http://127.0.0.1:4320/#canvas-reading) | 从左侧 `rules.mjs` 看向右侧 `service.mjs`，中间是 `api.mjs`。悬停左端，再点击并移开指针，可见同一条线穿过中间卡面。点线下的 `api.mjs` 改看它自己的关系，点空白复原。可点两卡之间的线读理由。 |
| [闭环图 · 路径与数量](http://127.0.0.1:4320/#aftertaste-loop/input-comparison/choose) | 深链会选中「选择输入样例」。点画布空白看路径卡 `路径「report.csv」`挡住到「结果汇总」的直达线，再点「选择输入样例」看线浮起。右栏可用底部「收起讲解」收起。 |
| 两图左侧首个工具「重新布局」 | 先试「取消」或 Esc，保留手摆状态。闭环确认后，从左向右是三个库、教学入口、两个输入类别、18 个并列样例、一个汇合点。18 个样例原先竖排，确认后变成三列各六张。在 1440 宽窗口点一次「−」可看全图。 |

可直接对照截图：[文件图遮挡](../../../../../.local/D049/repair/reading-7jocjy/dependency-behind.png) · [同位置浮起](../../../../../.local/D049/repair/reading-7jocjy/dependency-front.png) · [闭环原布局](../../../../../.local/D049/repair/reading-7jocjy/loop-behind.png) · [重排全图](../../../../../.local/D049/repair/reading-7jocjy/loop-all-layers.png)。上述截图取自最终候选。[同次实测数据](../../../../../.local/D049/repair/reading-7jocjy/report.json)记录两图路径与层边界。截图及运行输出存在本机忽略目录，仓内[生成器](../../../../../tests/fixtures/canvas-reading-layout.mjs)与[正式双图检查](../../../../../tests/browser/canvas-reading-layout.mjs)可重建。

## 依据与验证

- 以 Spec Kit v1.4.0 的 speckit-specify／spec-template 和 speckit-plan／plan-template 增量维护既有 [007](../../../../../specs/007-dependency-canvas/spec.md) 的 FR-003、015、023、SC-021 与 [009](../../../../../specs/009-loop-reader/spec.md) 的 FR-005、010、SC-011，以及两份 plan、quickstart。模板解析均成功，本项目无 extensions.yml。既有模型、接口和实施清单足以承载本批，未运行完整新功能建档。局部 UI 按项目裁剪复用既有主题、参考图及 Impeccable 的 layout／craft-floor。
- Windows，Node 24.11.1。执行 `npm.cmd run typecheck`、`npm.cmd run build` 均通过，Vite 保留 chunk 大小提示。`node --test --test-concurrency=1 tests/unit/canvas-layout.test.mjs tests/integration/dependency-canvas.test.mjs tests/integration/loop-reader.test.mjs` 共 13/13 通过，含无库、3／13 库、两根、18 分支、含环、身份协调与独立保存。[检查日志](../../../../../.local/D049/self/rules.txt)
- `node tests/browser/canvas-reading-layout.mjs` 用同一固定来源的合成资料分别在 [Edge 158](../../../../../.local/D049/self/reading-0addET/report.json)、[Chrome 157](../../../../../.local/D049/self/reading-d6a6XL/report.json)、[Firefox 159](../../../../../.local/D049/self/reading-FOPJ7E/report.json) 串行通过。比较第三卡内同一 12 × 9 截图区：两图悬停像素与普通态完全相同，点选并移开后 Edge 分别有 117、108 个 RGB 通道差值超过 15。核所有底层路径、空白处点线查理由、两端切换、覆盖处点选和起拖、库虚线与触屏模拟。两图手拖库及组、缩放后打开中文确认并取消／Esc，英文取消也可用；选中、视野及磁盘相同且取消零 PUT。确认各 1 次 PUT，刷新后组名成员保留，另一布局逐字节相同。模拟重排保存失败，旧文件保留，可在页内重试。
- 密集闭环 3 个库、1 个教学入口、2 个类别、18 个并列样例、1 个结果。布局坐标从左起各层左缘为 72、392、712、1032／1276／1520、1840，所有列中线 y=313。卡宽 212、高 56，行距 82，子列净空 32，逻辑层净空 108。出现子列时初开及重排显示 78%，小图为 100%；有个人快照则按其倍率恢复。去掉隔离副本的布局后，新读位置与确认重排完全一致。
- `node tests/browser/canvas-routing-alignment.mjs` 在 Edge 两图完成 16 组检查，含小型分岔汇合、库虚线、自环、回边、错开落点、贴边箭头与四种拖动吸附。[记录](../../../../../.local/D049/self/routing-9eBCnA/report.json) 受影响的原 Edge 回归 `dependency-canvas.mjs`、`dependency-legends.mjs`、`loop-reader.mjs` 均通过，含 Windows 文件占用、迟到确认、修订冲突及重开。[文件图](../../../../../.local/D049/self/browser-edge-GjARRy/evidence.json) · [库图例](../../../../../.local/D049/self/browser-edge-h8GC1R/result.json) · [闭环](../../../../../.local/D049/self/loop-reader.log)
- 检查脚本首次像素解码受页面策略限制，改用截图 Blob 后通过。全图截图一度点到小地图开关，改按名称缩小后通过。模拟 tap 后在同页继续桌面拖动未收到图例保存，分开触屏与鼠标页后两组操作均通过。原回归按旧网格硬拖使非成员落到框外，改按实际卡片中点放置后入框；原位移断言忽略 5 px 吸附，改核成员等距和屏幕吸附容差后通过。另一项旧回归新增库后直接点屏外 `zod`，改用小地图先平移入窗后通过。各项首次针对性修复通过，原失败、假设及复测保留在[自测目录](../../../../../.local/D049/self/)。
- 首轮独审在依赖图上下贴边、横向错开 180 的摆法中，实测 24 个路径采样点提前进入目标卡。第 1 轮修复让线先抵达两张端点卡的共同外侧后转弯。最终候选类型检查、构建、[Edge](../../../../../.local/D049/repair/routing-ii0AzX/report.json)、[Chrome](../../../../../.local/D049/repair/routing-qnUb0R/report.json)、[Firefox](../../../../../.local/D049/repair/routing-CgC4D6/report.json) 各 18 项走线及吸附检查和 [Edge 双图完整流程](../../../../../.local/D049/repair/reading-7jocjy/report.json)通过。独立复核以原坐标及互换方向等四种位置重采，穿入真端点卡的点均为 0。见 [R2 原文](review.md#r2--2026-11-24)。本次未做真机触屏或超大图性能测量。

## 资源与交回

最终试读服务以 Node 24.11.1 在本机后台监听 `127.0.0.1:4320`，启动 PID `16344`，冻结构建位于 `.local/D049/9631db4/dist`。两个入口已用 Edge 在此服务分别打开，实读 9 条文件／库关系和 43 条步骤／库关系，两页加载 `index-C_q9x5sr.js`，打开过程中无 PUT。[直达链接核验](../../../../../.local/D049/reading/links.json)

读者操作只写入 `.local/D049/reading/project` 的合成资料，固定源码提交 `4be951b2`。未动的手摆种子位于 `.local/D049/trial/project`，可从仓内生成器重建。所有自测、独审临时浏览器及临时服务已关闭。保留 4320 及其独立构建和资料供作者验收。需停用时核对监听端口、进程命令行与本候选相符后关闭；其余端口由原用途管理。

若机器重启，在仓库根的 PowerShell 运行下列命令，见 `status=ready` 后即可继续使用两图链接。

```powershell
& .local/D009/runtime/node.exe .local/D049/9631db4/dist/cli/main.js serve --project (Resolve-Path .local/D049/reading/project).Path --port 4320
```

作者试读后将本回执交回主脑，再决定是否合入 dev。
