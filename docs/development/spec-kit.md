# Spec Kit 官方接入与文档维护

2026-11-16，按 [D003](../work/D003-speckit-check/task.md) 接入官方 **v1.4.0**；[D005](../work/D005-development-cleanup/task.md) 停止维护本地下载副本，固定来源与按需维护入口统一保存在本页，目录物理清理状态见其回执。本页规定正式产品文档的结构和使用时机；不是另一套产品规格。

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

作者在 [D006](../work/D006-fixed-source/task.md) 明确一单只做一件事或一类事。001 保留首版总设计；逐项实现可在独立 `specs/<三位编号-能力>/` 按官方结构维护本批需求映射、方案和实施清单，引用 08 的相关规则及分册，后续同一能力仍在该目录增量维护。对应全局产品要求以 08 及作者后续确认优先，不能用局部规格缩减首版要求。整份首版 spec 的结构迁移不作为每批编码前置。

本调整只改变材料组织和批次范围，不免除本批真实设计、模板结构或前置检查；保留原话／历史及新旧对应关系。涉及产品取舍照既定授权处理，不重新讨论已确认结论；不能根据过时“未定”扩散问题。完成真实设计前，不把前置脚本通过或已有文件存在称为规划通过。

## 安装与核验

日常使用已安装的 9 个 `.agents/skills/speckit-*/SKILL.md`、`.specify/templates/`、PowerShell 脚本及 bundled workflow，无需维护另一份完整上游源码。`.tools/` 已停止作为项目目录维护；Git 恢复其中旧 README 也不会恢复被忽略的源码和压缩包。

### 固定来源与重建

| 项目 | 固定记录 |
| --- | --- |
| 官方仓库／版本 | [github/spec-kit](https://github.com/github/spec-kit)，[v1.4.0](https://github.com/github/spec-kit/releases/tag/v1.4.0)；这是本项目固定版本，不代表当前最新版 |
| 源码提交 | `0019fa14d12f45edabc2cc3176c9168a68bd0f97` |
| 原始下载 | 2026-11-14 下载的 [v1.4.0 ZIP](https://codeload.github.com/github/spec-kit/zip/refs/tags/v1.4.0)，当时文件名 `spec-kit-v1.4.0.zip`；当时记录的发布时间为 2026-11-10 |
| 原始 ZIP 的 SHA-256 | `E21F526177A3BC3F884B6C92A821713B6EDE9E0B056DEA84B3BB2D2B411DCC99`；本机副本校验值，非上游签名，不用于比较其他归档格式 |
| 许可 | 上游 MIT；按需获取源码时保留其 LICENSE |

D003 安装前及 D005 清理前均核对原始 ZIP 哈希与 **1,055 个解压文件**逐一一致。历史安装命令和结果见 D003 回执；来源记录从原 `.tools/README.md` 归入此处，今后不维护完整下载副本。D005 自动删除曾被工具审批拦截，随后作者手动删除，主脑已确认目录不存在；删除后安装资产与按需维护入口的核验见 D005 回执。

需要官方 CLI 检查／维护时，由 uv 按固定提交在自己的可重建缓存中准备开发工具；缓存不存在时需要网络、Git 及相应 Python 环境，失败应报告，不替换成 PATH 上其他版本。以下从项目根运行，既不安装用户级 CLI，也不重新初始化项目：

```powershell
uv tool run --from 'git+https://github.com/github/spec-kit.git@0019fa14d12f45edabc2cc3176c9168a68bd0f97' specify integration status --json
```

该命令检查 Codex 与共享受管文件，期望无缺失、修改或无效路径；安装状态不证明产品规划完成。网络不可用时，已安装技能／脚本仍可使用；可运行 `.agents/verify-sources.ps1` 检查原 137 个来源文件及 9 个官方技能，但它不覆盖共享模板／脚本，也不替代官方完整状态检查。按需下载 ZIP 时在任务临时目录核版本与上述原始归档哈希，不恢复长期镜像目录。

### 已装资产与升级边界

- 官方 manifests 是受管文件的来源基线。原版模板、脚本和技能由官方安装器管理；项目适配在本页，constitution 单独填写，不手改受管正文或 manifest 哈希。
- D003 官方初始化先在隔离目录核副作用，再执行 `init --here --force --integration codex --integration-options '--skills --events false' --script ps --ignore-agent-tools --non-interactive`。这是当时的安装记录，当前已接入项目不重跑；events=false，未安装额外扩展／presets／hooks，未运行整套自动开发 workflow。
- 技能可通过已安装路径显式读取，客户端是否发现技能以会话列表为准，不把文件存在等同于完整工作流通过。
- 将来升级需对应任务授权，先核版本、状态和差异，再按官方升级流程维护；日常检查不自动升级。Python、uv 和它们的缓存仅属开发辅助，不进入产品运行链路，不因本次目录清理删除全局工具或缓存。

## 功能路径与检查边界

在维护分支定位已有功能，用进程级 `SPECIFY_FEATURE_DIRECTORY=specs/001-first-release`；只读检查另设 `SPECIFY_FEATURE_NO_PERSIST=1`，不修改用户级环境。使用其他功能目录时明确替换，不能从当前 Git 分支名猜错主题。

- `check-prerequisites.ps1 -Json -PathsOnly` 只解析路径，不证明设计完成。
- `resolve-template.ps1 plan-template -Json` 读取实际生效模板；没有模板时报告失败，不另手写一个冒充原版。
- `setup-plan.ps1 -Json` 会生成不存在的 plan；只能在获批设计任务或隔离工具验证目录执行。本项没有在真实产品 specs 生成计划。
- implement、analyze 及任务生成按各自真实前置判断；缺 plan／tasks 时保持缺失状态，不能为全绿建立空文件。安装测试与产品验收分别报告。
