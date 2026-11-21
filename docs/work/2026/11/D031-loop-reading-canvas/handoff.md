# D031 · 闭环画布、步骤直读与按需源码对照回执

## 当前结论与入口

[4341 共用试读](http://127.0.0.1:4341/) 已换到受审候选 `3474aa3dcf913ce4e11d9e82bf1900e13b104ead`，使用原共用项目及固定构建 `.local/D031/build-3474aa3`。订单闭环中点击步骤即可直读讲解；桌面按需预览／固定源码，窄窗在本步展开；两类图复用点阵、曲线、浮条、小地图和卡面约 2 CSS px 轻抬，图面增加「点击节点查看详情，点击空白关闭」。

建议作者先试三处手感：

1. 在「规则转换并检查边界」固定源码，再点「无效数量让创建提前结束」，核左侧 `src/rules.mjs` 第 1–7 行留稳，右侧换到“建立订单和追加集合都没有发生”的讲解。
2. 掠过并拖动节点，再用顶栏开合当前图工具；切换订单、路径工具和依赖图，核各图状态互不串扰。
3. 在约 390 CSS px 窄窗点按「对照源码」，或桌面固定后直接缩窗，核代码、横滚与关闭入口可用。

作者尚未亲验本候选；实体触屏、屏幕阅读器实读和完整 Tab 顺序审计未做。浏览器触摸仿真、键盘固定／Esc 归还焦点及窄窗操作已检查，不等同上述未验项。

2026-11-21，作者明确指示「合并到dev」。已以普通 `git merge --no-ff` 合入 `dev`，合并提交为 `05e1cbe57891cc690509038eb8cfaccf00a21110`；两个父提交分别为原 dev `552a309603d8e850f9c26d3b4748d613e2d15bd3` 与任务归档 `324a85f062cca149043086672f5db2f01975d219`。合并树与任务归档一致，受审候选 `3474aa3` 是其祖先。功能分支已安全删除，当前停在 `dev`；未创建或改动 master／main，未推送或发布。该合并指令不记成作者产品体验通过。

## 依据与验证

批准依据为 [任务单](task.md)（派单提交 `159111821ecc3aa756e41a1f4688ba52a09e9702`）及 [画布提示调整](amendments.md)。比较基线为 `dev@552a309603d8e850f9c26d3b4748d613e2d15bd3`。实现候选 `e54d2bc` 后，以 `32ae13c` 修正派单完整哈希；R1 后由 `3474aa3` 修复三项发现。当前产品代码与测试均对应最终候选。 [R1／R2 独审原文](review.md)

按 Spec Kit 的 specify、plan、tasks、analyze 与 implement 项目适配增量维护 009 的 US1、FR-002–008、SC-005、模型、契约、研究、复验步骤和任务；未重写成完整新流程。检查清单保留需求表达质量标记，不当作实现或体验通过。界面实施使用 Ponytail Review 与 Impeccable，机械 `detect --json` 返回空数组。 [规格](../../../../../specs/009-loop-reader/spec.md) · [实施清单](../../../../../specs/009-loop-reader/tasks.md) · [实测记录](../../../../../specs/009-loop-reader/quickstart.md#d031-实测记录2026-11-21)

### 自测与实图

- 最终修复工作树通过 `npm run typecheck`、TypeScript 编译及 Vite 构建；全量 Node 测试 100／100 通过。固定构建 71 个文件的 SHA-256 与清单匹配。 [Node 日志](../../../../../.local/D031/npm-test-r1fix.log) · [冻结清单](../../../../../.local/D031/frozen-3474aa3.json)
- Windows 10.0.26200 上，`loop-main-experience.mjs` 在 Edge 157.0.4341.60、Chrome 157.0.8103.80、Firefox 159.0 各通过 12 组，覆盖直读、两条分支、同行理由、预览／固定／换步、同引用滚动保持、选字复制、键盘、直接缩窗、长文底部直接点节点、三图工具隔离、390 CSS px、English、减少动态和触摸仿真。 [Edge](../../../../../.local/D031/main-edge-BK7qAl/report.json) · [Chrome](../../../../../.local/D031/main-chrome-L4Vpih/report.json) · [Firefox](../../../../../.local/D031/main-firefox-hwKKzx/report.json)
- 修复后 Edge 关联回归：闭环旧路径 8 组、闭环画布 4 组、依赖图选择 6 组、依赖图工具 4 组、历史 13 组，另跑依赖图通用回归 10 组；覆盖抓手、Ctrl 临时反转、框选、Ctrl+G、布局独立、冲突／失败、个人资料保护与恢复。 [闭环旧回归](../../../../../.local/D016/browser-edge-8xiwJx/report.json) · [闭环画布](../../../../../.local/D031/canvas-edge-kvQ9xI/report.json) · [依赖图选择](../../../../../.local/D026/browser-edge-ZAX2Cf/report.json) · [工具](../../../../../.local/D027/tools-edge-zQMI0k/report.json) · [历史](../../../../../.local/D028/history-edge-0rGDiD/report.json)
- Chrome／Firefox 的闭环旧路径 8 组记录来自 R1 前构建；R1 改动由上述最终三浏览器 12 组主路径复验。Chrome 旧脚本另次补跑在隔离样例创建阶段遇到 EPERM，未进入页面，不计为通过或产品断言失败；没有为此修改产品代码。 [此前 Chrome](../../../../../.local/D016/browser-chrome-TKnjnq/report.json) · [此前 Firefox](../../../../../.local/D016/browser-firefox-aBK5ii/report.json)
- 候选实图及连续帧记录零资料写入、零页面错误；悬停位移为 `0、0、-2、-2、0` CSS px，正常桌面与窄窗源码图已人工查看。 [实图报告](../../../../../.local/D031/candidate-visual/report.json) · [4341 最终烟测图](../../../../../.local/D031/preview-3474aa3/4341-source-stop.png)

### 独审与处理

R1 在 `32ae13c` 上实际复现三项问题：桌面固定后直接缩窗残留 520 px 宽度、长文底部直接点节点未回开头、工具开合跨图共享。审查者交还写入后，分别清除内联模式的桌面定位属性、统一选中步骤的滚动与焦点处理、按闭环 ID 保存工具状态；新增三条原场景自动回归。修复假设、动作与结果见 [R1 修复记录](../../../../../.local/D031/fix-rounds.md)，三项均为第 1 轮修复，未触发两轮停点。

R2 由原审查者在 `3474aa3` 固定构建上亲手复跑三项原失败及历史交接，12 组主路径与 13 组历史检查通过，三项均关闭，无新增确认问题，结论为“通过”。审查期间候选、构建和输入未漂移，自建浏览器与服务均已收束，并已明确交还写入。 [R2 原文](review.md#r2--2026-11-21)

## 资源与交回

换版前实测 4341 已无监听，D030 记录的 PID 45704 不存在，首页连接失败，因此没有停止任何旧进程。随后用 `.local/D009/runtime/node.exe` 启动固定构建，当时监听 PID 22428；该后台进程随后结束。合并后已用同一固定构建恢复原入口，当前监听 PID 41400；项目仍为 `.local/2026-11-19-page-preview/project`，Git HEAD 为 `4be951b2bf9aae434e0acc3e1aeab3e4e0cf0734`。 [初次换版记录](../../../../../.local/D031/preview-3474aa3/preview.json) · [当前启动日志](../../../../../.local/D031/preview-3474aa3/server-live.out.log)

首页、`index-BbxNmnka.js`、`index-Ouv9lWhd.css` 的响应 SHA-256 均匹配固定构建。真实 4341 烟测完成“校验步固定源码 → 无效数量提前结束”，相同源码滚动位置保持，右侧讲解更新；捕获写请求 `[]`、页面错误 `[]`。初始换版前后 15 份资料的逐份 SHA-256 与项目 HEAD 完全一致，覆盖个人笔记、书签、理解标记及三类个人布局。 [换版前哈希](../../../../../.local/D031/preview-3474aa3/before.json)

合并后复核时，13 份资料仍匹配初始记录；`docs/aftertaste/dependency-layout.json` 与 `docs/aftertaste/loops/order-quantity/layout.json` 的哈希已不同。两份文件修改时间分别为 2026-11-21 12:28:44、12:33:13（UTC+8），均早于合并提交时间 12:35:44，可确认不是本次合并写入。现值已原样保留，未恢复旧布局；项目 HEAD 与首页、JS、CSS 哈希仍正确。 [合并核对记录](../../../../../.local/D031/preview-3474aa3/merge-check.json)

保留 4341、固定构建、实图和审查证据供作者体验；隔离自测服务与浏览器均已关闭。需要重启时，从仓库根用上述 Node 运行 `.local/D031/build-3474aa3/cli/main.js serve`，以原共用项目绝对路径作为 `--project`，指定 `--port 4341`。作者体验可继续验收；推送或发布仍需另行授权，本单不自动接续下一功能。
