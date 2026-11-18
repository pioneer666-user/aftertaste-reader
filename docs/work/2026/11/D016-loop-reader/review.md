# D016 · 独立审查原文

## R1 · 2026-11-18

**结论：需修复。** 闭环阅读、切图和布局保存的独立实测通过。闭环列表有一处故障诊断缺口。

- 审查依据为 D016 派单 `1b5a1c83dc4cbfbea8620a6283bc6569e1d51af3`，无有效调整。比较基线 `dev@0cacc2653205dc1a82861608ed4c38cee9a044cd` 与固定候选 `e6c417e6103a1d6bc18c691cbc7d9ef446228c97`。通过 `git diff <基线> <候选>` 查看实际差异，`git diff --check <基线> <候选>` 无输出。对照 D016 V01–V04、现行规格 R16–R18 和 A17–A19 的本单范围、04 共用画布、007 布局契约、008 成品模型及 009 规格。核对了 009 的需求、方案和任务结构及对应关系。审查以本机单项目、同服务多标签为运行范围。
- 在 Windows 11 `10.0.26200`、Node `24.22.3` 和 Edge `157.0.4341.60` 下，以 `.local/D016/candidate/build-final` 为 `AFTERTASTE_BUILD`、`edge` 为 `AFTERTASTE_BROWSER`，通过 Node 24 执行 `node tests/browser/loop-reader.mjs`，7 组通过。两条订单分支均可按保存的连线及理由读完。同一原块的两个步骤有不同讲解，共享固定源码与行号，能分别拖放并恢复坐标。A 的真实保存请求先落盘，响应等 B 完成编辑后才放行。独立读回两份布局，确认坐标、修订及页面状态各归原图。旧依赖图坐标、分组和视野得到保留，同库图例在闭环和依赖图中可分别编组摆放。重启服务后恢复三张图。旧标签保存冲突保留磁盘新版本及本页草稿，注入写失败后可重试。成品、依赖图字节核对一致。改写当前讲解并隔离一个 Git 源码对象后，旧闭环仍呈现保存的讲解，受影响步骤显示诊断，其余步骤与布局仍可用。查看了订单分支和 390px 窄屏截图。 [独立 Edge 报告](<D:/project/SpecDev Harness/aftertaste-reader/.local/D016/browser-edge-oYyqU8/report.json>)
- 另用 `node --input-type=module` 运行隔离 Edge 补测。列表取回后，使合成项目的 A 成品出现非法字段并延迟真实 HTTP 422 响应。在 B 上缩放并保存，再放行 A 响应。B 保持已保存状态且修订与磁盘一致，A 的布局字节保持一致，回到 A 才看到 A 的读错误。 [补测报告](<D:/project/SpecDev Harness/aftertaste-reader/.local/D016/review-list-FeTTBm/report.json>)
- **发现 1｜列表告警缺少它要求读者核对的字段。** 将隔离样例 A 的 `nodes[0].title` 置空后刷新列表。服务报告 `LOOP_INVALID`、字段 `$.nodes[0].title` 和原因为 `TEXT`，A 从可选项中移除，B 仍可阅读。中英文列表告警都要求核对所示字段，页面只展示错误代码和闭环 ID，读者因此无法从该告警定位坏字段。建议在现有列表告警中补上 `problem.context.field`，有原因时一并显示，沿用画布错误提示已有的呈现方式。 [列表告警实现](<D:/project/SpecDev Harness/aftertaste-reader/src/web/App.vue:175>) [补测报告](<D:/project/SpecDev Harness/aftertaste-reader/.local/D016/review-list-FeTTBm/report.json>)
- 核阅执行方的 26/26 回归记录及最终构建上的 Chrome、Firefox 报告。本轮独立浏览器验证用 Edge。写入失败用注入的 `EACCES` 响应检查页面及草稿，实际文件系统权限失败未复现。闭环内容更新、历史、依赖路线高亮属后续任务。作者体验验收、合并及发布待各自授权。
- **写入交还。** 审查前后 HEAD 均为固定候选，跟踪工作区干净。候选与构建保持冻结，补测仅使用 `.local/D016` 中的合成项目。自建浏览器和服务均已关闭。**采集结束，可以恢复写入。**

## R2 · 2026-11-18

**结论：通过。** R1 发现 1 已关闭。

- 比较 R1 候选 `e6c417e6103a1d6bc18c691cbc7d9ef446228c97` 与 R2 固定候选 `3866952edfa0063ac8c08286603fdd8734459b4f`。用 `git diff <R1> <R2>` 核对闭环列表诊断、浏览器回归和 R1 原文归档，`git diff --check <R1> <R2>` 无输出。
- 在 Windows 11、Node `24.22.3` 和 Edge `157.0.4341.60` 上，用 `node --input-type=module` 加载冻结的 `build-r2`，从隔离项目的新页面复核。将订单闭环首个节点标题置空后，中英文列表告警均显示 `LOOP_INVALID order-quantity $.nodes[0].title TEXT`，与服务返回的诊断一致。损坏闭环从选项移除，仍可从列表打开有效闭环，沿连线到下一步并读到保存的中文讲解。恢复订单成品并刷新后，订单闭环重新可选，能打开入口步骤。 [独立 Edge 复核报告](<D:/project/SpecDev Harness/aftertaste-reader/.local/D016/review-r2-lgl2es/report.json>)
- 复核了两套冻结构建中 `adapters`、`application`、`cli`、`core` 和 `server` 共 44 个文件的 SHA-256，全部一致。沿用 R1 的后端与持久化证据，另核阅 R2 的 Edge、Chrome 和 Firefox 执行方报告，各 8 组通过。本轮独立实测覆盖本次变更的列表行为。R1 所载真实文件系统权限失败及后续功能的验证限制仍适用。作者体验、合并与发布待各自授权。
- **写入交还。** 复核前后 HEAD 均为 R2 固定候选，跟踪工作区干净，冻结构建未改动。隔离样例已恢复，自建 Edge 和本地服务均已关闭。**采集结束，可以恢复写入。**
