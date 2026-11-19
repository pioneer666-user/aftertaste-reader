# 开发技能与项目适配

本页是角色选择技能的唯一入口。技能帮助完成批准任务，不授予新权限。按实际动作读所用 SKILL 及其必要参考；已读有效内容复用，不启动整套无关流程。

## 场景路由

| 角色／场景 | 方法 | 回味中的用法 |
| --- | --- | --- |
| 主脑审视尚未确定的方案 | [Ponytail](../../.agents/skills/ponytail/SKILL.md) ultra | 核价值、前提和复杂度；不反复重开已确认产品决定 |
| 执行实现、修复、重构；主脑已定方向的细化 | 同上 full | 最少必要机制，完成所有受影响调用方、资料和检查 |
| 独立代码审查 | [Ponytail Review](../../.agents/skills/ponytail-review/SKILL.md) | 读真实调用链，报告具体场景；由未参与实现的子代理执行 |
| 规范、角色、产品 Skill 与 AI 参考资料写作 | [writing-for-agents](../../.agents/skills/writing-for-agents/SKILL.md) | 单一主定义、明确读取条件与完成条件；产品 Skill 再读其 SKILL-MECHANICS |
| 创建产品 Skill 包，或改入口、元数据、结构与打包方式 | 当前宿主提供的 `skill-creator` | 按宿主目录定位并读完整入口。仅改已有参考指南时，用 writing-for-agents 整理，在实际场景读回验证。任务明确指定的包校验照做 |
| 产品需求、澄清、方案、任务、一致性 | 官方 [Spec Kit 项目接入](spec-kit.md) | 正式设计与后续更新必须沿对应技能／模板；偏离须告知，见下节 |
| 新阅读页面、布局或交互呈现；对应设计审查 | [Impeccable](../../.agents/skills/impeccable/SKILL.md) | 先按下方任务范围选流程，再选 Read／Operate 模式 |
| 块解析、行范围、图关系、序列化等可表达性质的代码 | [property-based-testing](../../.agents/vendor/trailofbits-skills/plugins/property-based-testing/skills/property-based-testing/SKILL.md) | 生成／审查／解释失败按对应参考；具体例子测试仍保留 |
| 易误用的命令参数、路径、写入和安全配置接口 | [sharp-edges](../../.agents/vendor/trailofbits-skills/plugins/sharp-edges/skills/sharp-edges/SKILL.md) | 从真实接口找误用路径并验证，不替代普通逻辑审查 |

## 共同适配

- Ponytail 的简洁以完整解决本项、易读和减少机制为准；保留已批准功能、分层边界、校验、错误处理、可访问性与必要测试，不竞赛最短 diff。
- `ultra` 用于尚未定案的价值审视；已确认目标用 full 落实。技能的持续模式不扩展任务授权。
- Ponytail Review 的发现、触发场景、证据与结论写进同一份[中文独审原文](../work/_templates/review.md)。结论用“通过／需修复／证据不足”，Git 合并、发布及作者验收各按对应授权。
- writing-for-agents 指导如何表达，产品原话、关键约束和失败证据不能因“精简”删除。调用策略以实际宿主为准，不直接照搬其他宿主的元数据字段。
- 开发技能与产品 Skill 的验证分开：来源一致只证明复制一致；能读取不代表宿主已自动发现，入口能启动也不证明效果。真实验证范围见 D001 回执和后续任务。
- Windows 上用 skill-creator 的 Python 校验器检查中文 UTF-8 包时，在本次解释器调用加 `-X utf8`，如 `python -X utf8 "<校验器实际路径>/quick_validate.py" skills/aftertaste-reader`。结构校验后，按改动核实际使用场景，例如从项目资料分别读出当前自评和读者保留的旧问句。

## Spec Kit 的现状与使用

- D003 已从原先的源码参考升级为官方 v1.4.0 项目接入；9 个技能和共享模板／脚本已落仓。进入所需阶段先看[阶段执行入口](spec-kit.md#stage-entry)，按当前动作和实际条件读取原件；具体材料结构、更新规则、版本核验和运行边界统一在该接入说明维护。
- 正式架构设计读 speckit-plan 与实际 plan-template；后续更新保留官方结构。前置不满足或需要偏离时明确告知作者，不静默换成自创格式。已有能力的增量输入、checklist 未勾项、勾选责任和 converge 写入范围统一见[分批输入与前置门槛](spec-kit.md#incremental-input)。
- 已确认规格与作者裁决优先；模板不补造范围、性能承诺或产品取舍，不能伪造 plan／tasks 或把旧清单勾完来绕过检查。上游受管文件不改，项目适配在接入说明中维护。

## Impeccable

保留完整 4.8.2 原版包及来源。以下是依据 D004 反馈、由 [D005](../work/2026/11/D005-development-cleanup/task.md) 明确的项目适配，适用于上游 SKILL、playbook 和工具输出；不改上游字节。阅读内容用 Read，管理／操作用 Operate，模式不决定必须采用完整设计流程。

| 本次目标 | 读取与执行 | 完成依据 |
| --- | --- | --- |
| 正式产品的新主要页面或主要交互重设 | 读 SKILL、new-work 和 UI 编辑前的 craft-floor；从现行规格补齐尚未确定的使用场景、结构、重要状态与视觉决定。已确认设计直接沿用；需要作者选择的体验取舍用具体方案沟通 | 实际页面与批准场景对应，核心操作和相关视口验证，必要设计决定归既有规格／设计材料，按任务独审及作者体验 |
| 已有页面的局部功能或视觉修改 | 读 SKILL 和命中动作的参考，如 layout／clarify／harden／polish，加 craft-floor；沿用现有布局和视觉系统，检查受影响状态 | 修改目标完整，相关交互、错误及布局无回退；不扩成整页重设计 |
| 技术实验或仅为验证提供的临时页面 | 读 SKILL 中适用的 Operate／Read 原则和 craft-floor，必要时补对应局部参考；直接实现任务已限定的控件、状态和最小页面 | 核心行为证据、实际渲染、可读性、标签／键盘焦点及成功失败反馈；不以品牌表现或完整产品视觉作为实验门槛 |

- 上表后两类不启动 init、完整 new-work、视觉竞选、概念稿或配套文档生成；正式页面也只对尚未确定且影响体验的事项询问。任务与现行规格足以说明用途时，不因上游“至少确认一次”再次询问已确认事实。
- PRODUCT／DESIGN 文件缺失或工具未识别 Vue 不构成信息缺失的证据。优先读项目现有权威材料；仅在正式页面任务确有可持续维护的视觉资产需要时建立相应记录，不为让工具全绿复制第二套产品真相。正式需求与架构仍按 Spec Kit；新增记录按目录职责安排。
- craft-floor 中可读性、必要状态、键盘焦点、可访问性和真实渲染检查继续适用；动画、品牌字体、主题滚动条等表现要求按表中目标选择，技术实验不为它们增加实现。原生控件可保留，质量裁剪不能删掉获批功能或数据保护。
- 正式 UI 工作可按 SKILL 每会话运行一次 context；局部修改／技术实验若现有上下文足够，可直接按表中参考执行，说明采用项目裁剪，无需为了满足流程启动引擎。实际调用前核平台、启动器、下载与缓存位置；失败就说明实际错误并直接读已有上下文，不伪称运行成功。D004 已有一次 context／detect 的实际运行记录，不再视为从未运行。
- detect 仅是适用时的辅助检查，空结果不能替代真实页面检查。审查按任务使用 critique／audit 的相关方法，由项目独审子代理覆盖，不额外强制启动同范围的 finish-reviewer／documenter 链；自测不能替代独审，缺独审仍如实交回。
- 上游固定收尾语、问卷、额外文件和自动后续建议不覆盖项目中文回执及本批结束条件。主脑纯讨论、规范维护和无呈现影响的逻辑任务不启动 UI 流程。只有实际的产品取舍或授权缺口才暂停依赖部分，不为采用本适配逐次请求许可。

## 两项专项技能

- Trail of Bits 只接入 property-based-testing 与 sharp-edges 两个完整 plugin family；配套代理／参考按所选分支读取，未安装整个 marketplace。
- `.agents/vendor` 是来源库，包内命令或代理名称不代表当前宿主已注册；需要代理时将完整适用提示交给实际审查子代理，执行者汇总。
- 性质测试须有独立、可判断的性质；例如同一关系提交的幂等性、合法范围的覆盖，不用实现代码照抄一遍作预期。新测试库先说明具体收益，再按任务授权处理依赖。
- sharp-edges 的安全建议结合本地工具真实边界验证，不能自动扩展产品功能、改变已批准数据行为或引入复杂恢复系统。
- 本节对 Trail of Bits 方法的适配说明归属 `trailofbits/skills`，按其 CC-BY-SA-4.0 保留；来源与许可见 [.agents/README](../../.agents/README.md)。其余独立项目规范不据此统一变更许可。

## 后续候选与扩展

Anthropic [skill-creator](https://github.com/anthropics/skills/tree/main/skills/skill-creator) 的对照试用与评测方法是后续候选，未复制、未注册、未运行。若接入，先核 Claude CLI／Python 等运行要求及当前宿主适配，避免与已有 skill-creator 同名混淆。产品仍不增加 Python 必需依赖。

来源更新、增加技能和调整流程按[维护约定](maintenance.md)办理，不随上游 main 自动升级，不安装无当前用途的整套插件。
