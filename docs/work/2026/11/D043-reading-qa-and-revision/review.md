# D043 · 独立审查原文

## R1 · 2026-11-23

**结论：需修复。** 两个同源步骤的定位、混合笔记回访、讲解写回和原件保护均取得了实走证据。闭环步骤回访还有两处可复现的导航问题。

**审查输入。** 批准依据为同目录 `task.md`，无调整。产品基线 `9900ce5ee7d300864060384d74a1385a25b3d831`，派单 `cd7b02555f8c6d82d5296d54dce218fc7e1dc54c`，候选 `89020c86879440dfc484979f782bb8dd2956bdbe`。派单至候选共变动 49 个文件，涉及规格与契约、产品 Skill、CLI 修订、网页选文与回访、测试和使用说明。独审未参与实现或前两次产品 Skill 试用。按 Ponytail Review 追踪单人本地阅读时的页面导航、编辑、写入和读回路径，依据 05 U72–U73、04 U81、08 R12／A06／A11、006 FR-015–016、009 FR-009／SC-009，并对照 005、008、011 的增量定义。

### 已确认问题

1. **回访当前已展开的同一步，会多出一次空后退。** `src/web/App.vue:722` 对每次非首次步骤回访都调用 `pushPosition`。用深链打开并展开 `order-quantity/resume` 时，后退禁用。打开随手记预览，点同一 `resume` 摘录，后退变为可用。点后退，仍停在原先已展开的 `resume`。006 FR-015 要求重复打开同一目的地不增加步骤；这里读者得额外后退一次才能离开。建议按当前页面、闭环和步骤识别重复目标，仍读取最新讲解并展开栏，只在实际更换目的地时增加历史。
2. **回访结果到得稍晚，会把读者从后来亲手选的步骤拉走。** `src/web/App.vue:696` 用导航序号判断回访是否仍有效，`src/web/DependencyCanvas.vue:492` 的手动选步不使这次待完成的回访失效。在 `start` 展开随手记点 `resume` 摘录，用 Playwright 暂缓真实 GET 的响应交付，在右栏点「下一步」，界面已显示 `check`。放行同一响应后，界面自行回到 `resume`。复现只控制响应时序，响应内容来自真实订单服务。006 FR-015 要求迟到读取不能抢焦点或改历史。建议让回访识别等待期间发生的手动换步或换闭环，放弃过期跳转，并保留当前操作的位置。两项复现脚本为 `.local/D043/review/check-history.mjs`，实测状态为 `selection-2HKoPE/history-review.json`。

### 实走与核对

- **真实选文和笔记。** 在 Windows、Edge `158.0.4370.33`、Node `24.11.1` 上，从 `.local/D042/preview/project` 复制订单，以固定构建运行 `node tests/browser/loop-note-revision.mjs`。设置 `AFTERTASTE_TEST_TASK=D043/review`、`AFTERTASTE_BUILD=.local/D043/candidate/dist`、`AFTERTASTE_TRIAL_PROJECT=.local/D042/preview/project` 和 `AFTERTASTE_HEADED=1`，路径变量执行时使用绝对路径。第 03 步反向鼠标划选后实粘得到 `resume` 与「建立对象这一步还没有改变集合」，第 01 步实粘得到 `start` 与「此时集合仍保持原状」。两者同指文件块 `m3vuiqzi`，固定提交均为 `4be951b2bf9aae434e0acc3e1aeab3e4e0cf0734`。浮层新建、预览中追加、混排文件块与两步引用、重开、从工作台和浮层点回均成功。另核整步定位、原生复制、跨区选文、手动复制回退、失效目标保留摘录，以及 390×844 触控模拟。选文和复制阶段没有 PUT。证据在 `.local/D043/review/selection-2HKoPE/report.json`、`desktop.png`、`narrow.png`。
- **独立写回和失败保护。** 运行 `node .local/D043/review/check-revisions.mjs`。按真实定位读取和校验文件及闭环，读取前后 15 份资料哈希全部一致。错误提交、缺失步骤、非法文件块正文分别被拒绝，资料保持原样。修订第 03 步后，以旧摘要再次提交得到 `REVISION_CONFLICT`，先前成功的新文保留。再修订文件块，保留块 ID，逐字比对所指块之外的内容；完整比较闭环 JSON，只有 `resume.explanation` 改变。最终 15 份资料中只有两份对应 current 改动，笔记、书签、自评、偏好、方向、个人布局及另一闭环保留。运行 `node .local/D043/verify-trial.mjs .local/D043/review/selection-2HKoPE/project`，从旧摘录分别回访，看到了新步骤和新文件讲解。证据在同一目录的 `revision-review.json`、`reopened-step.png`、`reopened-block.png`。
- **产品 Skill 与设计。** 固定 Skill 的 13 份文件均与候选工作树同字节。核对了实际宿主试用记录、固定指南、`skill-trial/before.json` 与 `skill-confirm/project`。15 份资料中仅 `preferences.md`、所指文件 current、所指闭环 current 三份变化，与读者同意补例、要求改文件、明确提出长期教法相符。仅提问时的宿主对话及中间零写入采用执行者试用记录；本轮独立复核了只读命令的零写入与最终文件差异。005、008、009、011 的新增定义和 009 T035–037 覆盖了定位、回访、写回及验证，006 的既有导航约束仍适用。
- **限制。** 本轮未重跑全库、其他浏览器或安装包，未测实体触屏。教学效果、划选手感和最终作者体验仍待作者验收。上述两项导航缺陷在固定候选上成立，建议修复后复核重复目的地、迟到响应、成功／失败回访和后退。

**写入交还。** 采集后复核 HEAD 仍为 `89020c86879440dfc484979f782bb8dd2956bdbe`，原订单 HEAD 仍为 `4be951b2bf9aae434e0acc3e1aeab3e4e0cf0734`。受审代码、测试、规格与 Skill 无工作树差异；开始和结束均只见执行者未跟踪的 `handoff.md`。自建浏览器和临时服务均已关闭，独审脚本、副本与证据位于 `.local/D043/review/`。未操作 4343、4344 或作者试读副本，未执行 Git 写操作。

采集结束，可以恢复写入

## R2 · 2026-11-23

**结论：通过。** 首轮两项回访缺陷均在固定候选 `5ed7e51fd1ae7297ae21bf15b87c2a4dcc4e6542` 上独立复测关闭。相对 R1 的 `89020c86879440dfc484979f782bb8dd2956bdbe`，变更限于 `App.vue`、`DependencyCanvas.vue` 和 `tests/browser/loop-note-revision.mjs`。批准任务及调整情况沿用 R1。

| 复核场景 | 实际结果 |
| --- | --- |
| 深链打开并展开 `resume`，再从随手记预览回访同一摘录 | 仍在 `resume`，前进、后退均保持禁用。R1 问题 1 关闭。 |
| 从 `start` 点 `resume` 摘录，暂缓真实 GET 响应，在右栏点「下一步」进入 `check`，再放行响应 | 仍在 `check`，前进、后退均保持禁用。R1 问题 2 关闭。 |
| 从 `check` 成功回访 `resume`，随后点一次后退 | 回访进入 `resume`，后退回到 `check`，此时前进可用。 |
| 在上述 `check` 位置再次回访，令该次请求返回目标缺失 | 浮层保留原摘录并显示错误，仍在 `check`，后退禁用、前进可用。正式浏览器用例另实走了副本中成品 ID 失配及工作台错误提示。 |

在 Windows、Edge `158.0.4370.33`、Node `24.11.1` 上，从 D042 原订单另建副本，串行运行 `node tests/browser/loop-note-revision.mjs` 和 `node .local/D043/review/r2/check-history.mjs`。前者指定 `AFTERTASTE_BUILD=.local/D043/candidate-r2/dist`、`AFTERTASTE_TRIAL_PROJECT=.local/D042/preview/project`、`AFTERTASTE_TEST_TASK=D043/review/r2`、`AFTERTASTE_HEADED=1`，路径变量执行时使用绝对路径。两项均通过。新证据在 `.local/D043/review/r2/selection-m0axxV/report.json` 和同目录 `r2-history.json`，首轮证据保留。

本轮聚焦修复涉及的网页与历史行为。CLI、产品 Skill 和资料协议沿用 R1 的审查与试用证据，未重跑全库、其他浏览器或实体触屏。作者的划选手感及教学体验仍待亲验。

**写入交还。** 结束时复核 HEAD 仍为 `5ed7e51fd1ae7297ae21bf15b87c2a4dcc4e6542`，原订单提交仍为 `4be951b2bf9aae434e0acc3e1aeab3e4e0cf0734`。工作区仅见派审时已有的未跟踪 `handoff.md`、`review.md`。两次自建的浏览器与临时服务均已关闭。未操作作者试读副本、4343／4344／4345 或 Git 写入。

采集结束，可以恢复写入
