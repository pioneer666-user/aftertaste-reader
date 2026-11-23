# D046 · 收藏请求新版试读回执

## 当前结论与入口

2026-11-23，作者要求“合并到dev”。D046 已以合并提交 `7625ef95db32dd6695f045e803d5d19a1783a01f` 合入本地 `dev`，任务分支已按规范删除。随后作者试读反馈“感觉已经没什么特别大的问题了，虽然我还是能找到很多小问题，但是不应该阻止首版先用着”，接受当前体验作为公开 Alpha 的起点。试读入口和独立安装继续保留。

2026-11-23，首个公开 Alpha 已发布。下一位主脑从[公开 Alpha 后的真实使用体验交接](mainbrain-handoff.md)接手。

同日，新主脑按作者要求整理本地分支。合并提交 `dc45eb6` 将公开 Alpha `9f31aec` 与交接 `55e7062` 一并纳入 `dev`。已核合并后的文件树与交接提交一致，两个分支尖端均在 `dev` 历史内。已删除本地分支 `codex/release-alpha-1`、`codex/docs-alpha-handoff`，仅有的工作树已切回 `dev`，收尾时工作区干净。远端 `main` 与发行标签 `v0.1.0-alpha.1` 仍指向 `9f31aec`。

[从收藏按钮进入新版闭环](http://127.0.0.1:4359/#aftertaste-loop/question-bookmark-request/request) · [直接看分岔](http://127.0.0.1:4359/#aftertaste-loop/question-bookmark-request/choose-branch) · [看两条响应](http://127.0.0.1:4359/#aftertaste-loop/question-bookmark-request/send-http)

[打开控制器的三个请求字段](http://127.0.0.1:4359/#aftertaste-block/docs%2Faftertaste%2Fcurrent%2Finternal%2Fcontroller%2Fcollection_controller.go.md/vmi6gwjc) · [打开文件依赖图](http://127.0.0.1:4359/#canvas-reading) · [对照 4357 原版](http://127.0.0.1:4357/#aftertaste-loop/question-bookmark-request/request)

- 文件图按被依赖文件到使用文件排，闭环从入口沿业务边向右分层。画布默认留淡线，指向卡片或键盘聚焦提亮直接来路、出口及关联库。触屏点选也能查关系。旧位置优先，新增节点沿关系补位，重新布局保组。
- 14 篇文件目录改为单行。试讲用空白偏好重写控制器、收藏服务与整条闭环；其余 12 篇同提交正文复用。作者可依次体验长名文件好不好找、密图中能否看清一跳关系、读过分支后能否解释两种返回。
- 成果候选 `a670cff460b75745fa5b0c3861e9ef64514d0eac`，批准[任务书](task.md) `6531723` 及[作者执行中调整](amendments.md)，基线 `dev@1fa27a2`。独审结果见[原文](review.md)。原任务分支 `codex/fix-alpha-reading-layout` 已合入并删除，候选 SHA 与独审记录保留供追溯。

## 依据与验证

**设计与安装。** 按 Spec Kit v1.4.0 的 speckit-specify 与 speckit-plan 对 005—009 现行 spec、plan、相关模型和契约做增量维护。核了 constitution、实际 spec-template／plan-template 和扩展配置，保留原目录和栏目，沿用已有验证过的运行时，未另建 feature 或正式任务清单。[D046 实验入口](../../../../../experiments/D046-alpha-reading-layout/README.md)

Windows 本机，Node 24.22.3、Edge 158.0.4370.33，`npm run typecheck` 与 `npm pack` 成功。最终安装使用 `npm install --offline --prefix <工具目录> --omit=dev <tgz>`。[最终包](../../../../../.local/D046/r2/aftertaste-reader-0.0.0.tgz) SHA-256 为 `32295332BEBECF0B211E71743BA6CADE9FA4B8EBF8BB0FD809C4F7DC2D4D5A4F`。Vite 保留单 JS 块尺寸提示。取源、制作和读回均使用同版产品指南与解析协议。试讲完成后调整了画布呈现及树的列宽，包内 10 份 Skill 文件逐字节核对，最终读回沿用同一独立项目。试读数据与安装在仓外。

**浏览器。** 正式 Edge 用的是 54 个实际文件节点、85 条直接边和 2 个库，依赖图共显示 90 条关系；新闭环有 12 个步骤、12 条教学边和 8 条步骤用库虚线。无布局初开、拖动、分组、缩放至 83.33%、关页再开、增加关联节点、刷新、重排及重开均在两图走过。保存坐标与组逐项对比，新增节点避开旧卡，重排后组名和成员保留，默认视野恢复 100%。小图另验多根、孤点、自环、循环分量和菱形汇合，逆转输入顺序坐标一致。高亮参与文件后坐标及视野一致，能进入所选闭环，深链接可直接打开步骤。[坐标及读回](../../../../../.local/D046/final/layout-checks.json) · [作者入口实测](../../../../../.local/D046/r2/author-checks.json)

- 淡线默认 9% 不透明度，文件节点悬停时其 4 条直接关系达到 100%，闭环入口相连的 2 条也匹配端点名单。移开恢复，键盘焦点及模拟触屏点选可提亮；指向和聚焦未产生布局修订。平移到 `choose-branch` 后实点两条出口，汇合在 `send-http`。库卡可跳至确实用它的步骤。在相同文件新增无用库字段的验证步骤后，没有给该步生成库虚线。[文件图悬停](../../../../../.local/D046/r2/author-dependency-hover.png) · [闭环分岔](../../../../../.local/D046/final/layout-branch.png) · [触屏模拟](../../../../../.local/D046/r2/touch-checks.json)
- D045 旧成品仅有文件用法。两张库卡在闭环隐藏，概览仍可读 Gin、XORM 的介绍和逐文件理由。在隔离副本构造混合组和纯库组，重排保存后隐藏成员、组名和两个旧库坐标与预期一致；无图例的另一条路线可读。依赖图继续保留库用法。[旧布局证据](../../../../../.local/D046/final/legacy-checks.json)
- 同一 1440 × 900 窗口与 14 篇真实文档，展开后共 29 行。完整可见由 10 行增到 15 行，行高由 36 降至 24 CSS px；侧栏由 264 收至 232 px，正文区由 1176 增至 1208 px。四个长名出现省略号，按钮 title 保留完整相对路径。多级折叠、键盘切篇、分隔线调节与 390 × 844 窄窗切篇已走通，窄窗行高 44 px。[原版目录](../../../../../.local/D046/trial/baseline-tree.png) · [新版目录](../../../../../.local/D046/r2/author-tree.png)

**试讲。** Codex desktop 的独立讲解试用会话显式读安装包 Skill，接收 D045 原始读者问题和固定源码，不接收验证答案。固定 Apache Answer 提交 `3f1ed50f6776452c11b6ffdbdc767cd1887d629b`。控制器 4 块、收藏服务 5 块均保留原 ID 与行范围，14 篇文档通过 validate-document，文件图通过 validate-graph，12 步闭环经 create-loop 与 read-loop 实际保存、读回。空白 preferences.md 与模板字节一致。明确要求简述时，试用代理在聊天中只用同一组值解释输入、决定写入和两种结果。以上证据覆盖这一次显式加载的试讲。[两篇修订范围](../../../../../.local/D046/final/doc-compare.json)

| 读者要回答的问题 | 在新版哪里找 | 固定源码与假设 |
| --- | --- | --- |
| 前端传什么，谁是操作者 | 控制器 `vmi6gwjc`、`wpvn4ro6`；闭环 `request → bind → identity` | 假设用户 42、问题 10010000000000427、另有两人已收藏。按钮传问题 ID、`bookmark:true` 与字符串 `group_id:"0"`。身份来自登录上下文。按钮再点一次和原样重发的目标值不同。 |
| 谁决定写库，接口如何接到实际表 | `wiring → default-group → lookup → choose-branch`；首次沿 `insert → recount` | 原版装配证据放在 `start-service` 提示，新版 `wiring` 正文对上 `cmd/wire_gen.go` 的实际仓储。假设默认组主键 7。服务用用户和问题判断关系是否存在，关系仓库分配 ID 并在事务内复查、写入 `collection`，使用后端组主键。问题仓库随后另开事务，按 `object_id` 计数，按问题 ID 更新 `question.collection_count`。计数事务失败时，已提交的关系写入仍在。 |
| 重发还做哪些事，返回什么 | `choose-branch → unchanged → send-http`，首次经过 `count-result` 后在同一点汇合 | 重发仍处理默认组并查询关系，随后跳过增删与计数。两次 HTTP 都是 200，首次 `data.object_collection_count=3`，重发 `data=null`。新版应答正文解释这个空值与前端读取计数字段的后果。 |

试读闭环 SHA-256 为 `8ec8e3d418695fa05ada21bf2adab29acf2e1f23d25b7c6996388d655fcec7c1`，原版为 `816716e244a7b0bf0d39cfdd751569b88740f1632c845046ee530fee608a6d08`。教学数值均为假设；已核固定源码，未运行 Apache Answer 或真实数据库。

**回归和修复记录。** 首轮串行 npm test 为 100/103。新布局下重加身份的旧绝对坐标和步骤用法无效输入的 CLI 退出码断言已按契约修正。受影响的 4 个测试文件串行复跑为 16/17，以上两项通过。既有闭环中断／同名创建测试在 Windows 有一次重试发布 EPERM、一次竞争失败者收到 LOOP_WRITE_FAILED；该测试独立复跑 1/1 通过。保留首次失败和复验，不宣称全套一次全绿。自测脚本修正了等待窄窗渲染、逐项勾选、排序副本和等待真实空白画布命中后，最终路径完整通过。树的内层列一度撑至 266 px，限定网格列后实测 231 px 内宽，长名省略通过。[首轮](../../../../../.local/D046/trial/full-test.log) · [关联复跑](../../../../../.local/D046/hover/regression.log) · [单例复跑](../../../../../.local/D046/hover/loop-create-retry.log)

**独审。** 首轮候选 `0d2898140b1359e911aaa6de09e2e94367b052fc` 在键盘聚焦一条边、鼠标再指向另一文件时多亮一条线。最终候选修正了两种输入同时存在时的焦点样式。独审在独立安装逐条核对 90 条边，确认悬停只亮应有的 4 条，移开恢复原先的键盘焦点线，布局写请求为 0。复核通过。双图布局、旧图例及试讲沿用首轮证据。[独审原文](review.md) · [混合输入实测](../../../../../.local/D046/review/r2/actual-tab.json)

## 本机资源与交回

作者服务使用 `%TEMP%\Aftertaste D046 reading\r2` 的独立安装和同级 `apache-answer` 项目。交付时进程 PID 为 9412，端口 4359，仅监听 127.0.0.1。原版仍在 4357。执行侧 4358 核验服务和检查浏览器已关闭。作者试读期间保留两份安装与资料。若 4359 已停止，可在本机 PowerShell 从同一包重新打开，终端输出 ready 后再点页首链接。该终端中 Ctrl+C 可关闭本服务。

```powershell
$node24 = where.exe node | Where-Object { (& $_ --version) -like 'v24.*' } | Select-Object -First 1
$trial = Join-Path $env:TEMP 'Aftertaste D046 reading'
$cli = Join-Path $trial 'r2/node_modules/aftertaste-reader/dist/cli/main.js'
& $node24 $cli serve --project (Join-Path $trial 'apache-answer') --port 4359
```

未覆盖实体触摸设备、全部浏览器与全部主题的逐项体验。完整回执与审查覆盖范围一并交主脑，个人观感和讲解是否解决疑问由作者试读验收。
