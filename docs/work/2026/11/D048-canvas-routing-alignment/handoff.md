# D048 · 双图走线与拖动对齐回执

## 当前结论与试读入口

实现、自测和独审已完成。行为候选 `fb501d6`，派单 [task.md](task.md) 固定于 `3be7c90`，基线 `dev@96a69e5`，无调整。两图根据卡片当前位置选边、错开来线、绕过挡路卡片。拖卡或拖组名可按边缘和中心轻吸附，按 5 CSS px 判定；只保存摆放结果，两图沿用各自的布局文件。首轮发现的贴边箭头消失已修复，独立复核通过。[独审原文及写入交还](review.md)

| 入口 | 作者试读 |
| --- | --- |
| [文件依赖图](http://127.0.0.1:4319/#canvas-reading) | 悬停右侧 `service.mjs`，从左边最上方的入箭头逆线追到 `src/rules.mjs`。线从 `api.mjs` 上方经过；点线可读「在创建订单前使用数量转换与范围校验约定」。也可悬停紫色 `node:path`，看指向 `audit.mjs` 的短虚线。 |
| [闭环图 · 对照两种路径用法](http://127.0.0.1:4319/#aftertaste-loop/path-comparison/choose) | 悬停「选择要看的路径操作」，两条教学箭头分别到「取出上传文件名」与「拼出日志路径」，再从任一分支追到「对照两种结果」。右侧把手可收起步骤讲解。 |
| 整组对齐 | 文件图拖「入口与审计」的组名向上约 30 屏幕像素，让组框上边对齐「规则与工具」；闭环图拖「两种用法」向下约 80 像素，与「路径入口」对齐。距离取试读初始倍率。可继续拖离，或看到虚线时松手，再刷新查看。 |

2026-11-24 实际从两个链接分别打开，读到 7 条依赖／库关系和 6 条教学／库关系，均载入候选资源 `index-C7x9tJ27.js`。2026-11-24 作者回复「可以，合并到dev」，授权将候选合入 dev，未逐项说明亲验范围。已以合并提交 `a5791b0` 合入本地 dev，合并结果与任务分支尖端 `344d69f` 一致，本地任务分支已删除。未推送或发布。[链接实查记录](../../../../../.local/D048/reading/links.json)

## 依据与验证

- 按 Spec Kit v1.4.0 的 speckit-specify／spec-template 和 speckit-plan／plan-template 增量维护既有材料。007 更新 FR-014、FR-015，补 FR-025 和 SC-021；009 更新 FR-005 和 SC-011，两个 plan 的 Summary 说明共用实现。资料协议、默认布局和旧布局坐标沿用。未启动整套新功能建档流程。[007 规格](../../../../../specs/007-dependency-canvas/spec.md) · [007 方案](../../../../../specs/007-dependency-canvas/plan.md) · [009 规格](../../../../../specs/009-loop-reader/spec.md) · [009 方案](../../../../../specs/009-loop-reader/plan.md)
- 合成输入基于仓库订单、路径图例及闭环样例，源码固定于 `4be951b2`。额外的互逆边和自环专门用于走线检查。每次浏览器检查用独立副本。未使用真实教学项目或 4317、4318。[样例生成器](../../../../../tests/fixtures/canvas-routing.mjs)
- Windows 11，Node 24.11.1。最终候选 `npm.cmd run typecheck`、`npm.cmd run build` 通过，Vite 保留大块体积提示。`node tests/unit/canvas-layout.test.mjs` 五项通过，含六档倍率、两轴、正反向和 4.9／5.1 px 的吸附边界。首轮的 `dependency-canvas-polish.mjs` 和 `loop-canvas-interactions.mjs` 通过，覆盖原有抓手平移、Ctrl 框选、组菜单、保存反馈和拖离。R2 改动涉及贴边走线，仅重跑受影响检查。[自测日志](../../../../../.local/D048/self/)
- 最终 `node tests/browser/canvas-routing-alignment.mjs` 串行在 Edge 158.0.4370.33、Chrome 157.0.8103.80、Firefox 159.0 通过，各 16 项记录。实际 SVG 采样查箭头、落点、路径是否进入卡面；移动中间卡重查非关联边，窗口失焦后草稿收起。四种吸附组合均在两图实拖，并验证成员位移、外部坐标、缩放、松手刷新及另一图布局的字节一致。横向、纵向贴边后分支箭头仍可见。[Edge](../../../../../.local/D048/self/routing-lg5xhD/report.json) · [Chrome](../../../../../.local/D048/self/routing-RPxOkf/report.json) · [Firefox](../../../../../.local/D048/self/routing-NeY7Sj/report.json)
- 相同输入、相同视野对照。文件图近邻库线从 294.0 缩至 66.8 个画布单位；三条入边从同一屏幕高度 287.2 分到 275.3、283.2、299.0。闭环两路汇合从同一高度 280.4 分到 281.6 和 291.7，两个库用法从穿入卡面变为绕开卡面。[文件图改前](../../../../../.local/D048/self/routing-4ffmuZ/dependency-relations.png) · [改后](../../../../../.local/D048/self/routing-lg5xhD/dependency-relations.png) · [闭环改前](../../../../../.local/D048/self/routing-4ffmuZ/loop-relations.png) · [改后](../../../../../.local/D048/self/routing-lg5xhD/loop-relations.png)
- 首轮 `2e49801` 独审发现相贴的分支线缩为零，另有一处测试终点夹在两个可吸附对象之间。`fb501d6` 改从外侧绕行，调整该测试的接近方向。两项均在第一轮修复后独立复验通过。初测还修正了近邻落点偏长，旧闭环自由拖动检查在第二轮固定拾取点后通过；样例绝对路径、目标距离、画布边缘与浮点容差的测试前提见记录。[原始失败与假设](../../../../../.local/D048/fixtures-log.txt) · [独审复核](../../../../../.local/D048/review/routing-Nuezts/report.json)
- 未验证真机触屏、卡面完全重叠或超大图性能。浏览器检查在桌面鼠标、键盘环境完成。

## 资源与交回

试读服务由本单在本机 Windows 后台启动，监听 `127.0.0.1:4319`，PID `22800`。构建固定在 `.local/D048/fb501d6/dist`，读者在页面的摆放只写入 `.local/D048/reading/project` 内的合成资料。未动的初始布局保存在 `.local/D048/trial/project`；截图、日志和输入副本位于忽略目录，不随克隆分发，仓库内生成器和检查可重建。自测和审查各自的临时服务、浏览器均已关闭。

如需重启，可从仓库根在 PowerShell 执行下列命令；以终端输出 `status=ready` 为准。试读结束后只关闭命令行与此候选、项目和端口相符的进程，PID 可能在重启后变化。试读副本和固定构建继续保留，供作者后续查看。

```powershell
& .local/D009/runtime/node.exe .local/D048/fb501d6/dist/cli/main.js serve --project (Resolve-Path .local/D048/reading/project).Path --port 4319
```
