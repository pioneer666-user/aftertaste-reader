# D043 · 订单选文、笔记回访与讲解修订回执

## 当前结论与试读入口

**已合入 dev，待作者体验。** 成果候选 `5ed7e51fd1ae7297ae21bf15b87c2a4dcc4e6542`，比较起点 `cd7b02555f8c6d82d5296d54dce218fc7e1dc54c`。闭环讲解及提示可以复制定位、摘进随手记再点回；讲解 AI 可以只在聊天回答，也可按明确要求修订对应步骤或文件块。单次目标修订前后均已在实际宿主和浏览器核对。独审首轮发现两项历史回访缺陷，修复后原审查者复核通过。[独审原文及复核](review.md)

2026-11-23 作者指令「合并到dev」。合并提交 `2d15d54ce708e0440138a126b3947fde8115b68c` 的父提交为 `9900ce5` 和归档候选 `f7367e6`，合并树与候选一致。本地任务分支已在确认完全合入后删除，当前在 dev。作者体验尚未记录，等待下述三项验收；未推送或发布。

[打开订单第 03 步「规则返回后回到服务」](http://127.0.0.1:4345/#aftertaste-loop/order-quantity/resume)。固定源码为 `4be951b2bf9aae434e0acc3e1aeab3e4e0cf0734`。这是 D043 专用副本。顶栏「笔记」中的「订单步骤核对」含第 03 步、第 01 步及文件块三段真实选文。作者可以直接在这份副本里追加笔记或让 AI 修订。

1. 划选「建立对象这一步还没有改变集合」，分别试「复制步骤定位」和「加入笔记」。
2. 从「订单步骤核对」点引文，比较第 01 步与第 03 步打开的讲解，再用左上角后退接着读。
3. 将下列请求分别粘贴给能访问本机项目的讲解 AI。提问后可接着说「好，把这个空集合的例子补进刚才的步骤里」，再点笔记中的旧摘录。

**请求一 · 只问第 03 步**

```text
请加载 D:/project/SpecDev Harness/aftertaste-reader/.local/D043/candidate-r2/skills/aftertaste-reader/SKILL.md。订单项目是 D:/project/SpecDev Harness/aftertaste-reader/.local/D043/preview-r2/project。本机 Node 24 在 D:/project/SpecDev Harness/aftertaste-reader/.local/D009/runtime/node.exe，固定候选 CLI 在 D:/project/SpecDev Harness/aftertaste-reader/.local/D043/candidate-r2/dist/cli/main.js。
{"format":"aftertaste-loop-step/v1","loop_id":"order-quantity","step_id":"resume","source_commit":"4be951b2bf9aae434e0acc3e1aeab3e4e0cf0734","field":"explanation","selection":"建立对象这一步还没有改变集合"}
建立对象时，集合已经变了吗？可以用空集合举例吗？
```

**请求二 · 明确修改文件讲解**

```text
请加载 D:/project/SpecDev Harness/aftertaste-reader/.local/D043/candidate-r2/skills/aftertaste-reader/SKILL.md。订单项目是 D:/project/SpecDev Harness/aftertaste-reader/.local/D043/preview-r2/project。本机 Node 24 在 D:/project/SpecDev Harness/aftertaste-reader/.local/D009/runtime/node.exe，固定候选 CLI 在 D:/project/SpecDev Harness/aftertaste-reader/.local/D043/candidate-r2/dist/cli/main.js。
{"format":"aftertaste-block/v1","document":"docs/aftertaste/current/src/service.mjs.md","block_id":"m3vuiqzi","source_commit":"4be951b2bf9aae434e0acc3e1aeab3e4e0cf0734","selection":"成功后按集合当前长度加一产生编号，再建立订单对象。"}
这句容易误解，改一下文件讲解。用集合里已有两笔订单的例子，讲清建立和追加的界限。
```

## 实现与依据

接单分支 `codex/feat-reading-qa-and-revision@cd7b025`，产品基线 `dev@9900ce5`。[批准任务和原截图](task.md)规定两种定位、同提交写回、偏好分流和订单场景。文件继续用 U73；步骤定位含闭环、步骤及固定提交，选文再带字段。笔记引用按步骤身份回访，原句留在笔记中。两种修订命令先验证目标、原文 SHA-256、固定来源与候选内容，发布前再比对原件；同目标写入锁协调工具间并发。磁盘保留了来源快照、连线和个人资料。

Spec Kit 对既有能力做增量维护。按 specify、plan、tasks 原件及实际模板，将 005 FR-010／SC-005、009 FR-009／SC-009 与 008、011 两个资料协议映射到 009 T035–037。009 复用既有研究、方案与契约；setup-plan 保留已有方案，setup-tasks 解析已有输入。analyze 在 009 上从真实 spec／plan／tasks 核五项批准范围，均有实施和验收落点，未发现阻塞或未覆盖项。implement 前置检查读到五项设计材料；009 需求清单 16/16。Ponytail full 复用选区浮条与笔记保存；局部 Impeccable 检查读取、键盘和遮挡，沿用现有视觉系统。产品 Skill 按 writing-for-agents、SKILL-MECHANICS 和 skill-creator 更新触发与按需指南。

## 真实 Skill 试用

在 Codex 桌面宿主中新开无父会话历史的讲解子代理，显式读取开发树 `skills/aftertaste-reader/SKILL.md` 和相对指南，使用 Node 24.11.1。宿主报告基于 GPT-6，未取得精确变体。使用隔离订单，原始输入取自浏览器的实际粘贴。试用代理独立于产品审查。

| 读者输入 | 实际回答和落盘 |
| --- | --- |
| 第 03 步，问建立对象时集合是否改变，要求空集合举例 | read-loop 核 resume、store 及固定源码，解释建立前后均为 0、追加后为 1，问是否把例子补回。15 份资料逐文件 SHA-256 全部一致。 |
| 同意补例，并明确「以后讲集合变化时，我也想先看操作前后的条目数」 | revise-step 更新 resume.explanation 并重新 read-loop，sourceCheck 为 completed。只另改 preferences.md 中的一条明确要求，并注明读者依据。比较完整 JSON，其他节点、来源讲解与边全部一致。 |
| 文件块 m3vuiqzi，明确要求已有两笔的例子 | pin、validate-document、read 后运行 revise-document，保留块 ID，原文其他区域逐字相同。读回结果为建立时 2 笔、追加后 3 笔，机械校验通过、诊断为空。 |
| 把 resume 定位的固定提交换成 40 个 0，要求写「建立就等于入列」 | AI 说明两个版本不同、所要求的说法与当前源码相反，要求重新提供对应版本或确认正确信息。既有成果保留。 |

首轮写回范围正确，但例子把聊天里引用的一条目标源码调用带进了讲解。随后将修订指南接回文档制作的「固定源码只存引用」，要求落盘前用状态变化与行号重述。首轮逐文件对照、原件摘要和实际试用副本在 [skill-trial](../../../../../.local/D043/skill-trial/)，这些本机文件不随克隆分发。

第二轮在全新讲解代理和独立的 [skill-confirm](../../../../../.local/D043/skill-confirm/) 副本显式加载固定包。使用相同两个真实定位，先问空集合，再同意补例、明确长期偏好并要求改文件块。最终步骤讲解以「建立订单前有 0 笔，建立后仍有 0 笔。到第 04 步追加后，集合才有 1 笔」开头；文件例子写明第 6 行前后 2 笔，到第 7 行才有 3 笔。两份新文用行号与状态变化解释，没有抄入目标项目语句。15 份资料中只有对应的两个 current 和 preferences.md 改动；逐节点、逐块核对，笔记、书签、自评、个人布局及方向均与原件一致。修订指南 SHA-256 为 `3d0907470718edfa31d8f914d86e67e23682be000bed34c9a219ffbebb400d5f`。

## 自测与可复核证据

在 Windows 上使用仓库的 Node 24.11.1 和 Edge 158.0.4370.33。类型检查 `npm run typecheck`、TypeScript／Vite 生产构建及 Skill 结构检查通过。Vite 报告主脚本压缩前超过 500 kB。候选构建的网页主脚本为 `index-D4ny42zm.js`。[自测日志](../../../../../.local/D043/self/checks/)

| 实际入口与输入 | 结果 |
| --- | --- |
| `node --test --test-concurrency=1`，覆盖 unit、integration 和 Skill 静态用例 | 首轮 112 项中 111 项通过。既有子项目订单样例在 create-loop 发布阶段返回 EPERM；在新副本重跑原用例通过。 |
| `node --test tests/integration/reading-revisions.test.mjs` | 文件讲解普通改写保留块 ID，明确拆块生成新 ID。实测仅改指定步骤的讲解，其他节点逐字段一致。错提交、缺目标、无效候选、锁占用及校验后原件被另一编辑器改动均有失败覆盖。 |
| `node tests/browser/loop-note-revision.mjs`，D042 订单的隔离副本，1440×900 有头 Edge，390×844 触控模拟 | 实际 Ctrl+V 得到 start、resume 和文件块三种定位。整步复制省略选文。原生复制、反向选择、键盘、拒绝剪贴板后的手动复制、源码和跨区边界通过。仅选文或复制时零资料写入。保存混合笔记后，两处预览均可回访；目标损坏时保留笔记与原句。[定位实值](../../../../../.local/D043/self/selection-KOOEhB/report.json) · [桌面](../../../../../.local/D043/self/selection-KOOEhB/desktop.png) · [窄窗](../../../../../.local/D043/self/selection-KOOEhB/narrow.png) |
| `reader-center.mjs`、`note-references.mjs`、`reader-history.mjs`、`loop-reading-panel.mjs` | 四项分别串行复验通过。笔记引用首次创建测试样例遇 EPERM，改用原订单的独立副本复验。旧阅读栏顺序断言漏列新增的整步复制控件，单列该控件再核余下阅读顺序，复验通过。 |
| 在第二轮 Skill 产物重新开浏览器，从笔记点两条旧摘录 | 旧句已从讲解正文移除，点击后仍打开第 03 步的新例子或原文件块的新例子；第 03 步阅读栏已展开。[步骤重开](../../../../../.local/D043/skill-confirm/reopened-step.png) · [文件重开](../../../../../.local/D043/skill-confirm/reopened-block.png) |

窄窗检查曾发现全选正文时浏览器给出零宽高的光标矩形，浮条未出现。改为取选区的可见矩形后，原窄窗用例通过，并已实际点按加入笔记。桌面和窄窗证据均来自浏览器；最终候选另在 Chrome 157.0.8103.80 串行跑过同一完整订单用例。[Chrome 实际粘贴记录](../../../../../.local/D043/self/selection-OyiywO/report.json)。Firefox、实体触屏手势及作者对讲解的理解效果尚未验证。以上本机日志、截图及试读资料由 `.local/D043/` 保留，不随克隆分发。

## 独审修复与复核

首轮候选 `89020c8` 的两次失败均已实际触发：在已展开的第 03 步点本步摘录平添一条历史；点摘录后趁请求未返回换到 check，迟到的结果又把读者带回 resume。两项均为首轮修复。针对前者按页面、闭环和步骤核相同目的地，针对后者在请求完成时复核读者最近的闭环选择。补入可控延迟的真实 HTTP 回归测试。修复候选 `5ed7e51` 重新通过类型检查、生产构建、订单测试和完整阅读历史测试。独审另取新副本验证原失败、成功回访、回退及目标缺失，已明确交还写入。[两轮独审原文](review.md) · [独审实测](../../../../../.local/D043/review/r2/selection-m0axxV/r2-history.json)

## 试读服务与重开

当前试读使用 `.local/D043/candidate-r2/dist`、`.local/D043/candidate-r2/skills/aftertaste-reader` 和 `.local/D043/preview-r2/project`。本机 4345 的 Node 进程为 3904，命令行服务会话为 47424。实际打开顶部地址已见第 03 步原句、阅读栏展开、后退禁用；笔记「订单步骤核对」含三个引用，启动期间写请求为零。[实际入口核验](../../../../../.local/D043/preview-r2/landing.json) · [试读页截图](../../../../../.local/D043/preview-r2/landing.png)

若服务已退出，在本机 PowerShell 从仓库根目录运行以下命令，看到 `status: ready` 后即可打开顶部链接。在该终端按 Ctrl+C 结束本次服务。验收前保留固定构建、订单副本及新写的笔记。

```powershell
& .local/D009/runtime/node.exe .local/D043/candidate-r2/dist/cli/main.js serve --project (Resolve-Path .local/D043/preview-r2/project).Path --port 4345
```

D042 原服务仍监听 4343。D043 首轮 4344 服务（PID 9376）及其独立副本也保留在本机；自动审批拦截了停止并替换该进程的组合操作。最终入口 4345 使用另一份订单，两个 D043 副本各自保存作者的操作。
