# D054 · 沿示例试读两张图

## 当前结论与入口

任务分支 `codex/feat-loop-example-highlights`，批准单 `20157ee`，本地 `dev` 基线 `e865d8d`。行为候选 `4ba7e75` 已完成制作、校验、两种格式的读回和双图试读。独审结论见[审查原文](review.md)。当前等作者试读；收到对本候选的接受或合并指示后，由执行办理本地合并。未合入 dev，未推送、发布或变更主分支。后续归档提交仅含回执与审查原文。

| 入口 | 试读动作 |
| --- | --- |
| [闭环图 · 同一份数量校验，两种订单结果](http://127.0.0.1:4358/#aftertaste-loop/quantity-examples/check) | 在「示例路线」选 “04”，看校验、建单、追加。点建单核对源码，再换 “4.5”，看它在哪里抛错。 |
| [依赖图 · 订单参与文件](http://127.0.0.1:4358/#canvas-reading) | 打开顶栏的闭环目录，选「同一份数量校验，两种订单结果」。点选 rules.mjs 与 service.mjs 之间的线，区分参与文件标记和当前依赖理由。可点「阅读此闭环」再后退。 |

作者可在闭环图主动展开「通过和拒绝后，各自会发生什么？」比较两条分岔；切回「查看全图」后保留自己的开关和拖放。作者的路线辨认、源码往返与依赖图选线观感仍待反馈。

## 依据与验证

- 依据 [D054 原单](task.md)及[作者截图反馈 A1](amendments.md)。R1 行为候选 `0e3d60b` 已独审，作者随后要求改为发光路线；R2 视觉候选 `4ba7e75` 接续。按已有能力增量使用 Spec Kit v1.4.0 的 specify／spec-template、plan／plan-template、tasks／tasks-template。分别针对 007、008、009 检查真实功能路径与 plan、tasks、模型及契约，解析三份官方模板；本批核宪法、现行 R16–R18 与上下游。编码前按 analyze 核本批三个需求的覆盖，007 FR-028 → T056／SC-024，008 FR-011 → T014／SC-011，009 FR-015 → T039／SC-015。三项均有对应场景，沿用 D042、D052、D053 的画布与固定源码流程，无新依赖或需裁决的契约缺口。未重建分支或重跑无关历史设计。
- 安装包试读项目由[订单样例](../../../../../tests/fixtures/loop-examples.mjs)复用 D051 原始讲解及 D053 问句构建。固定源码 `4be951b2bf9aae434e0acc3e1aeab3e4e0cf0734`。每例独立从空集合开始。`rules.mjs` 将文本转成数值并检查整数与范围，`service.mjs` 先建对象再追加。页面与 CLI 读到固定版，样例工作区的规则文件另有内容。示例使用可选的 `examples`；无此字段的既有成品可直接读，个人布局格式沿用现状。
- Windows、Node 24.11.1。根目录运行 `npm run typecheck`、`npm pack --pack-destination .local/D054/r1`，从生成的 tgz 运行 `npm install --offline --omit=dev --prefix .local/D054/r1/install`。R1 安装包 SHA-256 `B15B34D4F47B7E6469125C936244C21B4A79740D3CADAEEB896226B76A45866B`。用 `AFTERTASTE_BUILD=.local/D054/r1/install/node_modules/aftertaste-reader/dist` 运行样例；安装包的 create-loop、read-loop JSON 和 Markdown 核对通过。包内指南随包安装。
- `node --test tests/integration/loops.test.mjs` 7 项通过。错误输入具体定位到 inputPath 与示例步骤下标，未发布闭环；合法回访保留顺序。`node --test tests/unit/switch-legends.test.mjs` 4 项通过，包括临时显出端点时受控边仍可隐藏。单元读取同轮构建的 dist。[集成断言](../../../../../tests/integration/loops.test.mjs) · [单元断言](../../../../../tests/unit/switch-legends.test.mjs)
- 三个浏览器串行运行[双图检查](../../../../../tests/browser/loop-examples.mjs)，分别使用同一安装包和试读项目的独立副本。Edge 158.0.4370.33、Chrome 158.0.8127.38、Firefox 159.0 均通过。核对示例精确成员、旁路与单控线、收起及主动展开、换例和键盘清例、固定源码、右栏、开关、拖后坐标与视野、读图期间布局写请求；依赖图核文件、真实边理由、前进后退、清除、版本失配及旧闭环阅读。核了浅深主题、标签、库线虚线、箭头和键盘焦点，查看了实际页面截图。首次后退断言在界面尚显示「正在读取」时采集；改为等待路线核验结果后在三浏览器通过。产品程序未因该断言调整。
- 检查日志与截图在 `.local/D054/r1/` 及 `.local/D054/browser-woC9YV/`（Edge）、`browser-BCvtpq/`（Chrome）、`browser-F5ukVW/`（Firefox），属本机可重建材料。验证限本批，未跑全仓测试和手机专项；教学和操作感受交作者亲验。

### A1 光感呈现

根据作者对 R1 截图的意见，比较 [yFiles 状态指示](https://docs.yfiles.com/yfiles-html/dguide/customizing_indicators/)与 [Cytoscape.js 节点及边衬层](https://js.cytoscape.org/#style/underlay)。R2 在两图的参与卡片上绘制边缘光与环形标记，实走的边在语义色线芯下面增加柔光，箭头尺寸独立于线宽。当前选中、选线与键盘焦点沿各自的视觉层呈现。所有绘制由包内 SVG 和 CSS 完成，路线光效没有轮询或逐帧动画。

同输入重新打包并离线安装；用 R2 最终包在 Edge、Chrome、Firefox 串行跑双图浏览器检查。实测额外覆盖卡片阴影、SVG 柔光、箭头尺寸单位及键盘沿线焦点。[浅色成功路线](../../../../../.local/D054/browser-kt1WZT/success.png) · [深色失败分岔](../../../../../.local/D054/browser-kt1WZT/fork-dark.png) · [依赖图成员与选线](../../../../../.local/D054/browser-kt1WZT/dependency.png)。Chrome 截图在 `.local/D054/browser-vH5Eli/`，Firefox 在 `.local/D054/browser-FjHrCH/`。按五套主题令牌计算，路线实色相对画布底色对比度为 5.13∶1 至 11.65∶1，仅代表这组色值。未做大图帧率或低配设备基准。源码协议、输入与 CLI 沿用 R1 证据。

## 资源与交回

作者试读使用 R2 最终安装包，SHA-256 `7F5E44DC2BCAFD28EFA28B7B58D5A22C9A0C97AA4D27A83BD9900098DBBAEBC9`。服务监听 `127.0.0.1:4358`，PID `12684`，以 `.local/D054/r2-final/install/` 的包读取 `.local/D054/r2-final/project/` 独立资料。试读期间保留该服务和目录。重启前确认端口空闲，从仓库根运行：

```powershell
& .local/D009/runtime/node.exe .local/D054/r2-final/install/node_modules/aftertaste-reader/dist/cli/main.js serve --project (Resolve-Path .local/D054/r2-final/project).Path --port 4358
```

验收后若要停止服务，先核监听 PID 和命令行仍对应上述项目及安装目录，再停止该进程。测试浏览器与临时监听已由脚本关闭。`4317`、`4351` 至 `4357` 的原资料与服务本单未操作。
