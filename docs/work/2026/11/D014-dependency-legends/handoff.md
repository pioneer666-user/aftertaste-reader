# D014 · 回执

## 当前结论与入口

- D014 已交付本地依赖图的库图例候选。讲解 AI 可查询、登记、局部更新、移除和校验当前图的库介绍及逐文件使用理由。读者能按标准库和第三方库辨认图例，并和文件一起摆放、编组、重排及恢复布局。
- 行为候选为 `538bf66744e0a66cb3553899d58627aece168e17`，比较基线为 `dev@89a026b64c011b8c7bb08b9e19d8238ed8ac534d`。执行侧自测完成，[R1 独立审查](review.md)通过并交还写入。当前分支 `codex/feat-dependency-legends` 留待作者体验和合并确认。归档提交只涉及文档，`dev` 仍在比较基线，本地整合、推送及发布待授权。
- [打开试读](http://127.0.0.1:4334/) 后进入“文件依赖图”。作者待验两点。先选 `node:path`，判断两个文件的用途是否各自讲清楚。再把图例和一个文件编组、拖动并等“布局已保存”，重开确认能否接着原排布读。

## 依据与验证

批准依据为 [D014 任务单](task.md) `6b0d5be`，无有效调整。首版内容权限已归入 [04 共用画布](../../../../../specs/001-first-release/04-reading-modes.md#shared-graph-canvas)，08 的 R16、A17—A18 本次覆盖本地依赖图。图例正文和关联随原 `dependency-graph.json` 一起发布，布局写入原 `dependency-layout.json`。文件路径和 `legend:<id>` 共用布局与移除凭据。正式删除发布凭据，由页面加载或刷新时通过现有保存接口清理成员及空组。这些协议沿用原资料路径，已有纯文件项目可直接读取。[图工具契约](../../../../../specs/004-dependency-graph/contracts/cli.md#库图例) · [画布模型](../../../../../specs/007-dependency-canvas/data-model.md)

| 要求 | 执行侧自测与磁盘结果 |
| --- | --- |
| L01 工具维护 | 真实 CLI 登记 `node:path` 与第三方库，逐文件给不同理由。查询、部分更新、替换关联和重复提交通过，重放后的图字节一致。错误类别、重复实例、重复或无效端点及同批删除冲突被拒绝，原图字节保持。文件关系继续由原工具查询和更新，核对与固定 Git 校验走原入口。 |
| L02 网页查看 | Edge 对同显示名的第三方图例和文件分别选择、勾选成员及读取讲解。标准库两条使用理由在中英文界面保持原文。页面的所有摆放前后内容字节一致，真实布局 PUT 夹带图例字段得到 400，向画布内容路由发 PUT 得到 405。 |
| L03 共同布局 | 已保存的纯文件布局新增图例后，旧坐标、组和视野保持。Edge 检查混合组、移出、保组重排、单拖、拖组、平移和缩放。只改介绍后，在重启的服务和新浏览器会话中看到新正文、原两条理由及原磁盘布局。图例恢复坐标约为 `(418.333, 262)`，组为“路径工具”，视野约为 `(34, -20, 120%)`。 |
| L04 布局保护 | 暂缺提示 `LAYOUT_GRAPH_UNCONFIRMED`，坏资料提示字段错误，磁盘布局逐字节保留，恢复后回到原排布。真实旧页面在正式移除后保存得到 409，新页协调落盘清除实例坐标及空组。另核正式删除后手工恢复旧图和 CLI 重加两条顺序，旧坐标及成员均未恢复，旧请求均拒绝。删除使用文件清理该端点关联。注入候选凭据暂存后的图替换失败，`published=0`，图、凭据和布局原字节保留，正常 CLI 重试及布局发布通过。 |

- Windows `10.0.26200`、Node `24.11.1`、Git `2.50.1.windows.1`、Edge `157.0.4341.60`。TypeScript、Vue 类型检查和 Vite 构建通过。身份补强前串行全量 `node --test --test-concurrency=1 'tests/unit/*.test.mjs' 'tests/integration/*.test.mjs'` 为 **85/85**，Chrome `157.0.8103.79`、Firefox `159.0` 的图例浏览器用例通过。冻结构建重跑受身份补强影响的依赖画布、库图例 HTTP 用例 **2/2**，以及 `node tests/browser/dependency-legends.mjs` 和 `node tests/browser/dependency-canvas.mjs` 的 Edge 回归，全部通过。后者使用 `AFTERTASTE_TEST_TASK=D014` 和空闲端口 4335。日志及候选文件哈希在 `.local/D014/self-test/`，最终浏览器结果在 `.local/D014/browser-edge-LzaKtO/result.json` 和 `.local/D014/browser-edge-v2N7Mk/evidence.json`。
- 首轮集成测试触发重复正式删除，证明图和凭据语义相同，但凭据字段顺序改变。统一发布和重放序列化顺序后，原字节断言及全量测试通过。首跑保留在 `.local/D014/self-test/integration.log`。原画布浏览器测试首跑尝试默认端口 4320，现有服务占用导致启动拒绝。改用独立端口 4335 后完成回归，原服务继续运行。
- Spec Kit 按 007 增量执行 specify、plan、tasks、analyze、implement，解析实际模板，保留已有结构及编号，新增 T023—T027。前置脚本读到 spec、plan、tasks 和关联材料。需求检查 16/16，无扩展配置。编码前分析 FR-001—009 与 SC-001—009 均有任务，27 项任务无编号冲突、歧义或宪章冲突。L01 对应 T023/T025/T026，L02 对应 T024/T025/T026，L03 对应 T024/T025，L04 对应 T023—T025。页面沿 Impeccable 的局部改动流程检查既有画布、文案、焦点和实渲染。[007 规格](../../../../../specs/007-dependency-canvas/spec.md) · [方案](../../../../../specs/007-dependency-canvas/plan.md) · [实施清单](../../../../../specs/007-dependency-canvas/tasks.md)
- 独审在同一冻结候选独立走过内容写入边界、介绍和理由更新、服务重启、临时缺失、坏图、删除文件和删除图例的真实 CLI／HTTP 顺序，并与最终磁盘比对。未发现需修复项，已收束其临时服务及进程。[审查原文](review.md)
- 待验包括作者体验。未验证旧版降级读取新增图例、外部文件系统极端竞争、同一项目多服务同写、非 Windows 平台，以及不同讲解 AI 宿主的稳定教学表现。兼容浏览器全流程复用身份补强前证据，补强路径由真实 HTTP 与最终 Edge 验证。闭环图及路线高亮仍由对应任务交付。

## 试读资源与重建

试读运行在本机 4334，监听 PID `34416`，构建与合成项目位于 `.local/D014/author-538bf66/`。41 个构建文件及锁文件与行为候选清单逐项匹配。合成项目固定提交 `4be951b2bf9aae434e0acc3e1aeab3e4e0cf0734`。实查首页和候选脚本 HTTP 200、两篇讲解、两类库。Edge 在 1366×900 中进入画布，看到 `node:path` 对两个文件的用法，确认初始图例坐标已保存、内容字节保持。证据为试读目录的 `ready.json` 和 `browser-smoke.json`。此前试读资源分别使用原有项目与端口。

若试读已停，可在本机 Windows PowerShell、4334 空闲时重启固定构建。启动输出 `"status":"ready"` 后打开试读入口，前台终端用 Ctrl+C 停止。布局保存在试读项目的原布局文件中。

```powershell
& 'D:/project/SpecDev Harness/aftertaste-reader/.local/D009/runtime/node.exe' 'D:/project/SpecDev Harness/aftertaste-reader/.local/D014/author-538bf66/dist/cli/main.js' serve --project 'D:/project/SpecDev Harness/aftertaste-reader/.local/D014/author-538bf66/project' --port 4334
```

从克隆重建时，在包含行为候选的分支用 Node 24、Git 和项目 npm 依赖完成 `npm run build`。在回味开发仓库根运行以下命令，生成全新的合成项目并在空闲的 4336 打开。更完整的自测重跑见 [007 Quickstart](../../../../../specs/007-dependency-canvas/quickstart.md#quickstart-文件依赖画布)。

```powershell
$trial = Join-Path (Get-Location).Path ('.local/D014/trial-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $trial | Out-Null
$project = Join-Path $trial 'project'
node tests/fixtures/dependency-legends.mjs $project
if ($LASTEXITCODE -eq 0) { node dist/cli/main.js serve --project $project --port 4336 }
```

保留固定试读及分支供作者体验。验收完成后，如需停止后台试读，先确认布局已保存、4334 的进程命令行仍指向本试读目录，再停止该监听进程。合并等待作者确认。
