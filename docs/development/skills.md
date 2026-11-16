# 开发技能与项目适配

本页是角色选择技能的唯一入口。技能帮助完成批准任务，不授予新权限。按实际动作读所用 SKILL 及其必要参考；已读有效内容复用，不启动整套无关流程。

## 场景路由

| 角色／场景 | 方法 | 回甘中的用法 |
| --- | --- | --- |
| 主脑审视尚未确定的方案 | [Ponytail](../../.agents/skills/ponytail/SKILL.md) ultra | 核价值、前提和复杂度；不反复重开已确认产品决定 |
| 执行实现、修复、重构；主脑已定方向的细化 | 同上 full | 最少必要机制，完成所有受影响调用方、资料和检查 |
| 独立代码审查 | [Ponytail Review](../../.agents/skills/ponytail-review/SKILL.md) | 读真实调用链，报告具体场景；由未参与实现的子代理执行 |
| 规范、角色、产品 Skill 与 AI 参考资料写作 | [writing-for-agents](../../.agents/skills/writing-for-agents/SKILL.md) | 单一主定义、明确读取条件与完成条件；产品 Skill 再读其 SKILL-MECHANICS |
| 创建／更新产品 Skill 包 | 当前宿主提供的 `skill-creator` | 通过本会话技能目录定位并读完整入口，组织描述、参考与脚本并验证；缺失时先报告，不凭名字冒称已调用 |
| 产品需求、澄清、方案、任务、一致性 | 官方 [Spec Kit 项目接入](spec-kit.md) | 正式设计与后续更新必须沿对应技能／模板；偏离须告知，见下节 |
| 新阅读页面、布局或交互呈现；对应设计审查 | [Impeccable](../../.agents/skills/impeccable/SKILL.md) | 阅读内容用 Read，管理／编辑操作用 Operate；按实际页面选模式 |
| 块解析、行范围、图关系、序列化等可表达性质的代码 | [property-based-testing](../../.agents/vendor/trailofbits-skills/plugins/property-based-testing/skills/property-based-testing/SKILL.md) | 生成／审查／解释失败按对应参考；具体例子测试仍保留 |
| 易误用的命令参数、路径、写入和安全配置接口 | [sharp-edges](../../.agents/vendor/trailofbits-skills/plugins/sharp-edges/skills/sharp-edges/SKILL.md) | 从真实接口找误用路径并验证，不替代普通逻辑审查 |

## 共同适配

- Ponytail 的简洁以完整解决本项、易读和减少机制为准；保留已批准功能、分层边界、校验、错误处理、可访问性与必要测试，不竞赛最短 diff。
- `ultra` 用于尚未定案的价值审视；已确认目标用 full 落实。技能的持续模式不扩展任务授权。
- Review 的结论采用项目中文“通过／需修复／证据不足”；其中 Ship 不等于获准发布、合并或作者验收。简短测试建议不削减本批必要覆盖。
- writing-for-agents 指导如何表达，产品原话、关键约束和失败证据不能因“精简”删除。调用策略以实际宿主为准，不直接照搬其他宿主的元数据字段。
- 开发技能与产品 Skill 的验证分开：来源一致只证明复制一致；能读取不代表宿主已自动发现，入口能启动也不证明效果。真实验证范围见 D001 回执和后续任务。

## Spec Kit 的现状与使用

- D003 已从原先的源码参考升级为官方 v1.4.0 项目接入；9 个技能和共享模板／脚本已落仓，具体角色、材料结构、更新规则、版本核验和运行边界统一见 [Spec Kit 接入](spec-kit.md)。
- 正式架构设计读 speckit-plan 与实际 plan-template；后续更新保留官方结构。前置不满足或需要偏离时明确告知作者，不静默换成自创格式。
- 已确认规格与作者裁决优先；模板不补造范围、性能承诺或产品取舍，不能伪造 plan／tasks 或把旧清单勾完来绕过检查。上游受管文件不改，项目适配在接入说明中维护。

## Impeccable

- 保留完整 4.8.2 原生包、代理、参考、Windows／POSIX 启动器和许可；未复制巧格专用适配器、缓存或引擎二进制。
- 新页面／主要路径重设读完整 new-work；已有页面局部调整按实际变化读 layout／clarify／harden／polish 等；UI 编辑前读 craft-floor。审查按目标读 critique／audit，只输出发现，不代修。
- 上下文以回甘规格、真实页面和已确认设计为准。工具没有识别出 Vue 或找不到 PRODUCT／DESIGN 文件，不能推断没有实现或触发重新访谈；有真实缺口才补。
- 初次实际运行先核原版启动器、平台、下载与缓存位置及必要网络行为；本次仅接入文件，未运行引擎。引擎失败按上游降级路径直接读取项目上下文，说明限制，继续适用的设计与检查，不伪称 context 已运行。
- 静态 detect 不能代替真实渲染和操作；可视结果按[验证](verification.md)进行。主脑讨论不调用 UI 设计流程，纯无呈现影响逻辑不强制设计评分。

## 两项专项技能

- Trail of Bits 只接入 property-based-testing 与 sharp-edges 两个完整 plugin family；配套代理／参考按所选分支读取，未安装整个 marketplace。
- `.agents/vendor` 是来源库，包内命令或代理名称不代表当前宿主已注册；需要代理时将完整适用提示交给实际审查子代理，执行者汇总。
- 性质测试须有独立、可判断的性质；例如同一关系提交的幂等性、合法范围的覆盖，不用实现代码照抄一遍作预期。新测试库先说明具体收益，再按任务授权处理依赖。
- sharp-edges 的安全建议结合本地工具真实边界验证，不能自动扩展产品功能、改变已批准数据行为或引入复杂恢复系统。
- 本节对 Trail of Bits 方法的适配说明归属 `trailofbits/skills`，按其 CC-BY-SA-4.0 保留；来源与许可见 [.agents/README](../../.agents/README.md)。其余独立项目规范不据此统一变更许可。

## 后续候选与扩展

Anthropic [skill-creator](https://github.com/anthropics/skills/tree/main/skills/skill-creator) 的对照试用与评测方法是后续候选，未复制、未注册、未运行。若接入，先核 Claude CLI／Python 等运行要求及当前宿主适配，避免与已有 skill-creator 同名混淆。产品仍不增加 Python 必需依赖。

来源更新、增加技能和调整流程按[维护约定](maintenance.md)办理，不随上游 main 自动升级，不安装无当前用途的整套插件。
