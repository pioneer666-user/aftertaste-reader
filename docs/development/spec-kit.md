# Spec Kit 官方接入与文档维护

2026-11-16，按 [D003](../work/D003-speckit-check/task.md) 核实下载并接入官方 **v1.4.0**。本页规定正式产品文档的结构和使用时机；不是另一套产品规格。

## 必须遵守的文档规则

- 新建正式需求、架构设计／实现方案和实施清单，必须先读取对应官方技能与实际模板，按其适用流程维护 `specs/<三位编号-功能>/`。不能只记得技能名称就自行写另一种格式。
- 后续修改沿同一功能目录和官方结构维护现行内容，更新受影响的模型、接口、场景及任务；不用新的自由格式文档绕开已有主定义。
- 局部修改可保留未受影响的内容，不重跑无关研究；交回明确说明“按某技能／模板维护的增量”及实际完成步骤，不能冒称完整 plan 或 analyze 已执行。
- 若技能前置不满足、工具失败、模板不适配或确需偏离，**在聊天中明确说明缺口、原因、影响和替代方法，并写入回执**。偏离官方结构必须先让作者知情并取得对应决定；不得只在文档角落记例外或静默换格式。
- 模板的必须栏目、状态与关系保留；正文用中文，必要栏目可用中文并保留对应英文名称。模板示例、占位数据和目录选项要换成真实内容；不虚构性能、需求或验收结果。
- 根规范、任务回执、实验说明和产品 Skill 指南各有职责，不强套 plan 模板；涉及正式产品设计的内容仍归 specs。

## 角色与材料入口

| 场景 | 读取的官方技能 | 成果／格式 |
| --- | --- | --- |
| 主脑维护需求、处理重要歧义 | [specify](../../.agents/skills/speckit-specify/SKILL.md)、[clarify](../../.agents/skills/speckit-clarify/SKILL.md) | spec.md；[spec-template](../../.specify/templates/spec-template.md) 的用户场景、要求和成功条件 |
| 主脑或获派方案执行者编写架构／技术设计 | [plan](../../.agents/skills/speckit-plan/SKILL.md) | plan.md；[plan-template](../../.specify/templates/plan-template.md) 的 Summary、Technical Context、Constitution Check、Project Structure、适用 Complexity Tracking；按阶段完成 research、data-model、contracts、quickstart |
| 执行准备实施清单 | [tasks](../../.agents/skills/speckit-tasks/SKILL.md) | tasks.md；[tasks-template](../../.specify/templates/tasks-template.md)，按用户场景和依赖组织，注明真实路径 |
| 执行实施前／审查跨材料一致性 | [analyze](../../.agents/skills/speckit-analyze/SKILL.md) | 按真实 spec／plan／tasks 前置检查；发现不自动授权修复 |
| 检查需求表达质量 | [checklist](../../.agents/skills/speckit-checklist/SKILL.md) | checklists；检查需求而非假报产品通过，写入式能力不直接交只读审查者执行 |
| 执行获批实现／核剩余工作 | [implement](../../.agents/skills/speckit-implement/SKILL.md)、[converge](../../.agents/skills/speckit-converge/SKILL.md) | 沿任务范围及官方前置；不得自动推进未批准后续批次 |
| 主脑修订规划门禁原则 | [constitution](../../.agents/skills/speckit-constitution/SKILL.md) | [.specify/memory/constitution.md](../../.specify/memory/constitution.md)，只维护原则，不改上游模板 |

官方技能有自己的前置和必要产物，按所选阶段完整读取执行。局部维护不为运行技能伪造材料；并行提示、自动后续建议及模板默认值服从作者范围、串行资源规则和三角色交接。任务单 `docs/work/D编号/` 管批准与本批边界，官方 `tasks.md` 管产品实施清单，不复制一份同内容列表。

## 既有首版文档的衔接

`specs/001-first-release/spec.md` 目前是演进总入口，08 汇总现行规则，01—07 保留详细设计与历史；这不是已由完整官方工作流生成的 spec／plan 套件。本次没有重写这些资料或补造 plan、tasks。

下一次正式需求／方案任务开始时，由主脑在任务中明确把既有已确认内容按官方 spec 结构维护到同主题入口，引用 08 和分册，保留原话／历史及新旧对应关系。涉及产品取舍照既定授权处理，不重新讨论已确认结论；不能根据过时“未定”扩散问题。完成真实设计前，不把前置脚本通过或已有文件存在称为规划通过。

## 安装与核验

- 原下载压缩包 SHA-256 与记录一致，解压目录 **1,055 文件**逐一比对一致；来源详见 [.tools/README](../../.tools/README.md)。本次未追最新版本。
- 使用官方固定源码通过 `uv tool run --from './.tools/spec-kit' specify ...` 执行；开发辅助依赖在 uv 隔离缓存中，未替换用户级 v1.3.0 CLI。不要直接调用 PATH 上旧的 `specify` 来升级本项目。
- 官方初始化先在 `.local/D003-speckit-check/bootstrap` 核副作用，再于项目根执行 `init --here --force --integration codex --integration-options '--skills --events false' --script ps --ignore-agent-tools --non-interactive`；当时没有既有 `.specify` 或 speckit 技能可被覆盖。
- 已安装 9 个 `.agents/skills/speckit-*/SKILL.md`、原版 `.specify/templates/`、PowerShell 共享脚本、官方 manifests 与 bundled workflow。events=false，未安装额外扩展、presets 或启用 hooks，未运行整套自动开发 workflow。
- `uv tool run --from './.tools/spec-kit' specify integration status --json` 检查官方受管文件，需无缺失、无修改及无效路径。官方 manifests 是此部分的来源基线；原 137 个其他技能仍由 `.agents/sources.json` 核验。
- 原版模板、共享脚本、技能全文由官方安装器管理；项目适配在本页，constitution 单独填写。维护不直接改上游正文或伪造 manifest 哈希来掩盖修改。
- 正常技能可通过本地路径显式读取，刷新后的会话可用 `$speckit-plan` 等名称；客户端是否实际发现以会话列表为准，不把文件存在等同于发现或完整运行成功。
- 日常文件与共享脚本随 Git 交付，不依赖被忽略的下载目录。维护 CLI 若缺本地源码，先按 .tools 记录恢复固定版本；本项目 Python 仅作开发辅助，不进入产品运行链路。
- 将来升级先按任务授权核版本、状态和差异，再使用固定版官方 integration upgrade；已接入项目不再次盲目 `init --force`，不让升级覆盖已有资料。

## 功能路径与检查边界

在维护分支定位已有功能，用进程级 `SPECIFY_FEATURE_DIRECTORY=specs/001-first-release`；只读检查另设 `SPECIFY_FEATURE_NO_PERSIST=1`，不修改用户级环境。使用其他功能目录时明确替换，不能从当前 Git 分支名猜错主题。

- `check-prerequisites.ps1 -Json -PathsOnly` 只解析路径，不证明设计完成。
- `resolve-template.ps1 plan-template -Json` 读取实际生效模板；没有模板时报告失败，不另手写一个冒充原版。
- `setup-plan.ps1 -Json` 会生成不存在的 plan；只能在获批设计任务或隔离工具验证目录执行。本项没有在真实产品 specs 生成计划。
- implement、analyze 及任务生成按各自真实前置判断；缺 plan／tasks 时保持缺失状态，不能为全绿建立空文件。安装测试与产品验收分别报告。
