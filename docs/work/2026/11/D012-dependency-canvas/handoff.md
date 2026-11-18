# D012 · 执行回执

## 当前结论与入口

D012 已合入 dev，合并提交 `8c683077b1ca632883e07cbbd4065cc96a5544ca`，行为候选 `335760febfdc1d91d9cc4e42e174f23e6bf1a95d`。**2026-11-18 合并后主脑接回判断为需修复。** 常规拖动、成组保存、重启恢复和同服务多标签页的冲突保护可继续沿用。新派独审在 Edge 复现了全部节点被正式移除后页面卡在保存中，以及旧文件列表覆盖刚打开的讲解。主脑另通过实际 HTTP 复现根目录合法文件名 `__proto__` 阻断整图保存，并核实正式移除后重加同一路径会因中途是否写回而得到不同分组。四项均待修复与复核，作者体验待验。[合并后独审原文](review.md#postmerge-audit) · [主脑补查](evidence.md#postmerge-layout-checks)

- [本机试读](http://127.0.0.1:4320/) 已启动。独立合成样例有两条边汇入 `src/service.mjs`，该文件和 `src/rules.mjs` 有讲解，`support/audit.mjs` 暂无讲解且依赖尚未核对。已有 D011 的 4317 试读仍由原 PID 41004 监听。
- [执行证据](evidence.md) 包含 G01—G05 的检查、命令、真实坐标及可重建输入。[独审原文](review.md) 按实际阶段保留各次结论。
- 2026-11-18，作者在本会话明确要求“合并到dev”。授权用于整合候选，作者体验仍单独记录。

## 依据与交付

- 批准依据为 [D012 任务](task.md) @ `5eb17a5`，无调整。比较基线为 dev `c19c7e665080edaa1a4d768b8baa81fbac985f61`。现行规则见 [08 的 A08、A17、A18](../../../../../specs/001-first-release/08-current-spec-and-acceptance.md#graph-layout-acceptance)，本单覆盖依赖图文件节点。
- 画布展示直接边、原因和核对状态，选中后可单独进入已有讲解并返回原视野。可拖文件与显式分组，按实际边界移动成员，主动重排保组。布局保存于选中项目的 `docs/aftertaste/dependency-layout.json`。
- 技术细化采用单组归属，勾选另一组成员会转组。主动重排恢复默认视野。自动清理需要真实图工具的明确移除凭据。图工具在专用 `dependency-graph-removals.json` 保存当前与候选的匹配记录，布局服务只读该记录。图暂时缺失或损坏与用户确认移除的行为见[数据模型](../../../../../specs/007-dependency-canvas/data-model.md)。
- 在 [007](../../../../../specs/007-dependency-canvas/spec.md) 完成 Spec Kit specify、plan、tasks、analyze 和 implement。读取实际模板，运行模板解析、plan／tasks 设置和前置检查，16 项需求表达检查完整，6 项 FR 均有实现和验收映射，无阻塞。复用 D004 研究，按受影响范围增量维护首审发现涉及的模型和契约。页面按 Impeccable 项目适配沿用 D011，实际查看恢复及保存失败截图。布局测试使用固定种子的性质预期。

## 自测及独审

- Node 24 类型检查和构建通过。初候选全套 77 项通过。最终候选布局定向 6 项、D009 受影响存储回归 3 项通过。图工具衔接变更后另有 D009 核心与 CLI 14 项通过。D011 Edge 阅读回归通过。
- 最终候选在 Windows 的 Edge、Chrome、Firefox 分别完成 9 个记录阶段。真实画布经完整关停和新会话重开，三文件坐标、两组与 144% 视野复原。文件占用、响应丢失、过期保存、合法临时子图与确认移除均走实际调用链。
- 执行侧独立审查者 `/root/d012_review` 首审 `9c1b824` 发现在临时子图、丢确认和坐标上限时的三项问题，修复于 `7d03b91`。复核确认三项关闭，发现被明确拒绝的旧请求仍会重发，以及后续图发布失败使旧凭据无法匹配。修复提交 `335760f` 后，独立复查真实 Edge 和图文件占用，确认两项关闭并交还写入。各反例和轮次见[审查原文](review.md)与[执行证据](evidence.md)。
- 合并前，`/root/d012_mainbrain_review` 独立验证 `335760f`。真实 Edge 与 CLI 验证拖组后同时增删图节点再重开，存续坐标、成员与视野恢复。两笔新保存后才放行旧标签页请求，真实服务返回 409，旧页保留草稿，磁盘保持最新布局。本次通过结论及原件见[合并前第二次独审](review.md#主脑第二次独审)。作者交回时说明此次二审由执行会话安排；其后由本主脑另派 `/root/d012_postmerge_audit` 独立检查已合并版本。
- 验证范围为一次项目启动的同一阅读服务及其多个标签页。多服务进程同写、其他操作系统、断电、干净机器安装、大图性能待验证。闭环图、图例和路线高亮由后续对应任务验收。

## 试读、停止与重启

作者打开[试读页](http://127.0.0.1:4320/)，从“文件依赖图”进入。先选 `src/service.mjs` 查看两条关系，点“阅读讲解”再返回。然后成组摆放和缩放，看到“布局已保存”后关闭页面和服务，再重开核对排布。作者体验仍待确认。

试读运行目录为 `.local/D012/author-335760f/`。独立构建含 41 份文件，路径和散列在该目录 `candidate.json`。样例由 `tests/fixtures/dependency-canvas.mjs` 重建，源码固定在 `5394d8f86c961ce1b327674235525f57bf0b982c`。已核对首页 HTTP 200、当前构建资源、三节点、两边和两篇讲解。后台 PID 9100 监听 4320。该目录保留给作者体验，停止后布局仍在样例项目。待验结束再按约收束资源。

当前后台实例可在本机 PowerShell 用下列命令停止。命令核对真实监听及试读构建路径，完成后 4320 不再监听。

```powershell
$listener = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort 4320 -State Listen -ErrorAction SilentlyContinue
if ($listener) {
  $trialProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)"
  if ($trialProcess.CommandLine -like '*\author-335760f\dist\cli\main.js*') {
    Stop-Process -Id $listener.OwningProcess
  }
}
```

重启使用同一构建和项目。前台启动终端显示 `status=ready` 后打开 4320，后续在该终端按 Ctrl+C 停止。

```powershell
& 'D:/project/SpecDev Harness/aftertaste-reader/.local/D009/runtime/node.exe' 'D:/project/SpecDev Harness/aftertaste-reader/.local/D012/author-335760f/dist/cli/main.js' serve --project 'D:/project/SpecDev Harness/aftertaste-reader/.local/D012/author-335760f/project' --port 4320
```

## 合并与 Git

合并提交的第一父提交为原 dev `c19c7e6`，第二父提交为功能分支归档 `f8c23ae`。合并树与来源一致，只有归档文档相对行为候选发生变化，原验证证据继续适用。已核对试读构建 41 份文件的散列及两个服务的监听归属和响应。确认候选纳入 dev 且功能分支无独有提交后，安全删除 `codex/feat-dependency-canvas`。当前停在本地 dev，工作区干净。试读继续使用上述固定构建。
