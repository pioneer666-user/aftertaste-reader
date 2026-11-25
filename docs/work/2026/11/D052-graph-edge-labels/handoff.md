# D052 · 双图连线试读回执

## 当前结论与入口

本地候选 `9dc45aa`，批准版本 `b9204c0`，产品基线 `dev@42ce69e`。作者体验待验。独审在 `a2f27c6` 发现展开的节点说明遮住标签，修复后在原布局复核通过，已交还写入。[两轮独审原文](review.md)

| 试读入口 | 可以试什么 |
| --- | --- |
| [数量闭环 · 带前导零的数量能下单吗？](http://127.0.0.1:4353/#aftertaste-loop/quantity-edges/check) | 从「转换后再判断数量」看绿线「返回 4」和红线「非整数，抛错」。固定该步源码，点线再关底部详情，可接着读原步。建单到追加只画主题线。 |
| [文件依赖图 · 订单数量从哪来](http://127.0.0.1:4353/#canvas-reading) | 点 `rules.mjs` 通往 `service.mjs` 的线，看「提供订单数量」和完整理由。用 Tab 聚焦连线，Enter 或空格可查看两端；点 Number 到规则文件的虚线可读该文件的库用法。 |

[两条分支](../../../../../.local/D052/browser-oVOpPJ/quantity-branches.png) · [触屏点选的曲线](../../../../../.local/D052/browser-oVOpPJ/selected-curve.png) · [键盘焦点与底部详情](../../../../../.local/D052/browser-oVOpPJ/keyboard-focus.png) · [深色主题](../../../../../.local/D052/browser-oVOpPJ/branches-dark.png)

## 依据与验证

- **获批范围**　实现[任务单](task.md)的四种连线。文件依赖、逐文件库用法、教学步骤边和逐步库用法独立携带 `label` 和 `color`。完整理由必填。短文本按单行普通文字读写，配色可选 `theme`、`red`、`green`，缺省跟随主题。原有 v1 成品可直接读。没有新增布局字段或写入接口。
- **资料制作**　执行会话显式读取安装包 Skill、制图与闭环指南。隔离订单项目沿 D051 已选「职责与取舍」讲法和[原始输入](../D051-loop-node-annotations/trial-input.json)，核 `4be951b2bf9aae434e0acc3e1aeab3e4e0cf0734` 中规则、服务、入口和审计路径。同一假设输入分别得到整数 4 和小数 4.5，两路理由保留在原边。通过安装包的 apply、validate、query-graph、query-legends、create-loop 和 read-loop（JSON、Markdown）验证保存与读回。Number 文件用法的短文本与判断步骤的独立用法可分别查阅。[可重建的制作与读回断言](../../../../../tests/fixtures/edge-labels.mjs)
- **正式材料**　按 Spec Kit v1.4.0 的 speckit-specify、speckit-plan 与解析到的 spec-template、plan-template，核四个已有功能目录、项目原则与 hooks，增量更新各自的需求、成功条件、方案、模型及契约。沿用既有实施清单。[004](../../../../../specs/004-dependency-graph/spec.md) · [007](../../../../../specs/007-dependency-canvas/spec.md) · [008](../../../../../specs/008-loop-authoring/spec.md) · [009](../../../../../specs/009-loop-reader/spec.md)
- **程序自测**　Windows，Node 24.11.1。通过 `npm run typecheck`、`npm pack` 与隔离离线安装。串行运行 `dependency-graph.test.mjs`（单元 7/7）、`loops.test.mjs`（集成 6/6）、`loop-reader.test.mjs`（集成 1/1），覆盖非法颜色、未知字段、幂等、旧成品及两种读回。旧图另跑 `canvas-reading-layout.mjs`，前景线穿过卡片时仍可操作该卡，依赖图和闭环均通过。最终包与制作试读资料的包在 CLI、后端和 Skill 上的 47 份文件哈希逐一相同。[旧图实测记录](../../../../../.local/D052/trial/tests/reading-Z4Lyxj/report.json)
- **浏览器自测**　Edge 158.0.4370.33、Chrome 158.0.8127.38、Firefox 159.0 使用最终安装包 在桌面及 540 px 窄窗串行操作。实测节点关联高亮、直接点线、Tab 与 Enter／空格、模拟触屏、无字边、库虚线、五套主题、深色红绿、密图省略与缩小后的详情。拖文件与拖组后沿原线读回标签；读关系期间零布局 PUT，两图布局文件字节一致。窄窗、缩小和密集交叉时，局部空间不足会省去线旁文字，底部仍可读全。[操作断言](../../../../../tests/browser/edge-labels.mjs)
- **修复记录**　首轮截图中红线箭头偏黑，复用同色 marker 后比对实际线色、箭头填色及实图通过。拖文件后原路径及详情正确，线段外接矩形却挡住可用标签位置；增加线段投影检验后，原断言在拖文件及拖组后均通过。两项分别于第 1 轮修复关闭。独审另发现展开说明纸片遮挡标注，`9dc45aa` 在第 1 轮修复中按纸片实际位置和尺寸避让。三浏览器均在手摆复现场景检查了收展与缩小，独审也在原坐标复验。[修复实图](../../../../../.local/D052/browser-oVOpPJ/note-clearance.png)初版缩小用例误点小地图、单元用例误传字面量反斜杠加 n，分别纠正操作与输入后通过。[初测与定位](../../../../../.local/D052/trial/check-notes.md)
- **体验边界**　触屏为浏览器模拟。实体触屏手感，以及短文本在作者日常阅读中的帮助程度，留待作者试读。

## 资源与交回

交回时服务监听 `127.0.0.1:4353`，PID `16300`，项目位于 `.local/D052/trial/candidate/project`。最终包 SHA-256 为 `4a85dca436228165557820670ac64c332978791f769bfd45352cdfce3fa6bed9`。页面主 JS 与 CSS 的实际响应均与 R2 安装包哈希匹配，两图 GET 已核到同一固定提交和预期的逐边标注。4351 与 4352 的原监听进程仍在，未操作 4317。验收后如需停止，仅在核对进程命令行、端口及本单安装目录后结束该实例。

仓库根目录 PowerShell 可在该端口空闲时用以下命令重启。

```powershell
& .local/D009/runtime/node.exe .local/D052/trial/r2/installed/node_modules/aftertaste-reader/dist/cli/main.js serve --project (Resolve-Path .local/D052/trial/candidate/project).Path --port 4353
```

本单保留 `codex/feat-graph-edge-labels`、本地安装包与隔离项目供作者试读。Git 交回时工作区干净，`dev` 仍为 `42ce69e`，无合并、推送或发布。截图和运行日志位于本机忽略目录，重新克隆后可用上述样例与浏览器用例重建。
