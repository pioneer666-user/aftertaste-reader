# 开发任务入口

规则见[任务流程](../development/workflow.md)，模板见 [task](_templates/task.md)、[handoff](_templates/handoff.md) 与 [review](_templates/review.md)。任务按[创建年月](../development/directories.md#测试实验与任务编号)归档，编号跨年月递增；索引只记录入口，状态看各任务 handoff。

2026-11-17 按作者要求将 D001—D006 唯一原件移入 `2026/11/`，原位置已移除，无副本或跳转目录。批准版本和审查结论不因归档改变，迁移依据及核验见 [D001 维护回执](2026/11/D001-development-standards/handoff.md)。

项目待办、优先级和剩余工作见[项目待办](../product/backlog.md)。主脑接回或准备下一项时按其中的触发时机检查；正式设计与实施仍进入对应规格和任务。

开发规则与技能的抽样意见集中在[反馈观察](../standards/feedback.md)；按[阶段优化规则](../development/maintenance.md#feedback-cycle)累计，由作者发起优化，完成后压缩已处理记录，不作为每单交付要求。

| 编号 | 任务 |
| --- | --- |
| D001 | [首版开发规范与技能接入](2026/11/D001-development-standards/task.md) · [回执](2026/11/D001-development-standards/handoff.md) |
| D002 | [目录职责与开发接续准备](2026/11/D002-directory-layout/task.md) · [新主脑交接](2026/11/D002-directory-layout/handoff.md) |
| D003 | [Spec Kit 核查与 dev 收束](2026/11/D003-speckit-check/task.md) · [回执](2026/11/D003-speckit-check/handoff.md) |
| D004 | [图画布自由布局与持久恢复验证](2026/11/D004-canvas-persistence/task.md) · [回执](2026/11/D004-canvas-persistence/handoff.md) |
| D005 | [开发准备收尾](2026/11/D005-development-cleanup/task.md) · [回执](2026/11/D005-development-cleanup/handoff.md) |
| D006 | [固定提交取源](2026/11/D006-fixed-source/task.md) · [回执](2026/11/D006-fixed-source/handoff.md) |
| D007 | [固定取源加固](2026/11/D007-fixed-source-hardening/task.md) · [回执](2026/11/D007-fixed-source-hardening/handoff.md) |
| D008 | [单篇讲解文档骨架与校验](2026/11/D008-document-blocks/task.md) · [回执](2026/11/D008-document-blocks/handoff.md) |
| D009 | [文件依赖关系维护](2026/11/D009-dependency-graph/task.md) · [回执](2026/11/D009-dependency-graph/handoff.md) |
| D010 | [普通文件讲解的分批生成 Skill](2026/11/D010-generation-skill/task.md) |
| D011 | [本地逐文件源码对照阅读](2026/11/D011-file-reader/task.md) |
| D012 | [文件依赖图的阅读与布局保存](2026/11/D012-dependency-canvas/task.md) |
| D013 | [画布布局与阅读导航修复](2026/11/D013-canvas-fixes/task.md) |
| D014 | [依赖图中的库图例](2026/11/D014-dependency-legends/task.md) |
| D015 | [生成并保存一条跨文件闭环讲解](2026/11/D015-loop-authoring/task.md) |
| D016 | [在共用画布上阅读已保存的闭环](2026/11/D016-loop-reader/task.md) |
| D017 | [让讲解 AI 按固定提交选文件并完整读回源码](2026/11/D017-skill-fixed-source/task.md) |
| D018 | [让讲解 AI 拿到文档和依赖图的具体校验结果](2026/11/D018-skill-validation/task.md) · [下一阶段主脑交接](2026/11/D018-skill-validation/handoff.md) |
| D019 | [块级注解书签与回访](2026/11/D019-block-bookmarks/task.md) |
| D020 | [项目内全局笔记与跨文件回访](2026/11/D020-project-notes/task.md) |
| D021 | [块级理解标注与批注](2026/11/D021-understanding-marks/task.md) |
| D022 | [阅读页文件树、块目录与块内记录](2026/11/D022-reader-navigation/task.md) |
| D023 | [讲解中区阅读与复制块定位](2026/11/D023-reader-center/task.md) |
| D024 | [理清首版规格入口与历史裁决](2026/11/D024-current-spec-entry/task.md) |
| D025 | [统一当前试读入口，让共用样例可独立重建](2026/11/D025-preview-fixtures/task.md) |
| D026 | [文件依赖图首屏与框选分组](2026/11/D026-dependency-canvas-selection/task.md) |
| D027 | [文件依赖图的连续圆角、曲线与点阵交互](2026/11/D027-dependency-canvas-polish/task.md) |
| D028 | [站内前进后退与画布浮动工具](2026/11/D028-reader-history-canvas-tools/task.md) |
| D029 | [文件讲解页与共用顶栏的连续圆角](2026/11/D029-reader-continuous-corners/task.md) |
| D030 | [文件树切篇的即时反馈与阅读占位](2026/11/D030-reader-file-switch/task.md) |
| D031 | [闭环画布、步骤直读与按需源码对照](2026/11/D031-loop-reading-canvas/task.md) |
| D032 | [闭环目录抽屉与满幅点阵画布](2026/11/D032-loop-catalog-drawer/task.md) |
| D033 | [闭环阅读栏收展、步骤关系与画布内解散分组](2026/11/D033-loop-reading-panel/task.md) · [回执](2026/11/D033-loop-reading-panel/handoff.md) |
| D034 | [闭环满幅画布与步骤阅读顺序](2026/11/D034-loop-step-reading/task.md) · [回执](2026/11/D034-loop-step-reading/handoff.md) |
| D035 | [个人记录工作台与笔记读写](2026/11/D035-personal-record-workbench/task.md) · [回执](2026/11/D035-personal-record-workbench/handoff.md) |
| D036 | [文件讲解选文与新建笔记](2026/11/D036-reader-note-actions/task.md) · [回执](2026/11/D036-reader-note-actions/handoff.md) |
| D037 | [浅色选区浮条与右上角随手记](2026/11/D037-quick-note-overlay/task.md) |
| D038 | [笔记工作台的篇首、标签筛选与连续圆角](2026/11/D038-note-workbench/task.md) |
| D039 | [文件讲解页的页边书签与理解标注](2026/11/D039-reader-margin-records/task.md) |
| D040 | [书签原位编辑与紧凑标注浮层](2026/11/D040-margin-record-editors/task.md) · [回执](2026/11/D040-margin-record-editors/handoff.md) |
| D041 | [书签与标注回读，三页详情对齐](2026/11/D041-record-management-details/task.md) |
| D042 | [从依赖图高亮闭环参与文件，进入步骤讲解](2026/11/D042-loop-route-highlights/task.md) |
| D043 | [从闭环选文记笔记，按文件块或闭环步骤答疑与写回](2026/11/D043-reading-qa-and-revision/task.md) · [回执与订单试读](2026/11/D043-reading-qa-and-revision/handoff.md) |
| D044 | [阅读器五套主题与全站用色核验](2026/11/D044-reader-themes/task.md) |
| D045 | [首次安装回味，读通真实后端的一次收藏请求](2026/11/D045-alpha-first-run/task.md) |
| D046 | [从左往右读懂后端请求：两图分层、紧凑文件树与讲解深度](2026/11/D046-alpha-reading-layout/task.md) |

早期产品设计 AR1 的外层原话入口见根 README；本次归档仅处理本仓 D001—D006，外层资料仍按其原入口读取。
