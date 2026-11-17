# D003 · Spec Kit 核查与开发准备收束

## 结果与依据

下载核实成功：Spec Kit v1.4.0 压缩包 SHA-256 为 `E21F526177A3BC3F884B6C92A821713B6EDE9E0B056DEA84B3BB2D2B411DCC99`，解压目录 1,055 文件与压缩包逐文件一致，无缺失／变化／额外文件。原先只有本地源码参考，现已用官方安装器补齐项目级接入。

- 固定源码提交沿 .tools 记录 `0019fa14d12f45edabc2cc3176c9168a68bd0f97`；本次未升级版本或重新声称最新。
- 官方 Codex integration 安装 9 个技能、5 份模板、6 个 PowerShell 脚本和 bundled workflow；受管文件由官方 manifests 记录。
- 补齐[Spec Kit 文档规则](../../../../development/spec-kit.md)：正式设计使用官方技能／模板，局部更新保持结构，偏离必须在聊天说明并取得对应决定。
- 用已安装 speckit-constitution 完成模板解析与已批准原则填写，初始原则版本 1.0.0，不是产品版本；无遗留占位，未改模板源。
- 更新原技能核验脚本以识别另一份官方 manifest 管理的技能，仍保护原 137 文件；官方共享模板和脚本另由 integration status 核验。

## 安装与检查记录

运行固定 CLI：`uv tool run --from './.tools/spec-kit' specify ...`。先在 `.local/D003-speckit-check/bootstrap` 初始化，确认仅生成 .agents／.specify 后，再在项目根运行官方 init；参数见 Spec Kit 接入说明。uv 下载并隔离安装了开发 CLI 的 44 个依赖，未替换用户级 CLI，未安装产品依赖。

- 初次 `version --json`：1.4.0，Windows AMD64，Python 3.14.8；用户级 `uv tool list` 仍是 specify-cli v1.3.0。
- 初次 `integration status --json`：status=ok，9 个 Codex 技能＋12 个共享受管文件，缺失／修改／无效路径均为 0。
- constitution-template 官方 resolver 成功，未配置 extensions.yml，因此前后 hooks 均无待执行项。首次占位检查把 Markdown 链接标签 AGENTS 误当大写占位，已区分实际模板占位与文档链接；不是原则缺失。
- `.agents/verify-sources.ps1`：原 137 个来源文件＋9 个官方技能核验通过。
- `SPECIFY_FEATURE_DIRECTORY=specs/001-first-release`、`SPECIFY_FEATURE_NO_PERSIST=1` 下 `check-prerequisites.ps1 -Json -PathsOnly` 正确定位当前产品目录；`-Json -RequireSpec` 按预期退出 1，报告缺少 plan.md。未创建真实 plan、tasks 或本机 feature.json 指针。
- 隔离样例：在 bootstrap 的 specs/999-smoke 建立合成入口，`setup-plan.ps1 -Json` 生成内容与安装的 plan-template 完全一致；追加保留标记后再次执行，文件哈希不变。只测模板脚本，不声称完整 plan／研究流程通过。
- constitution 同步摘要：未填写模板 → 1.0.0，五项已批准原则及工程／验证／治理入口，无删减既有原则或遗留占位；临时 Sync Impact Report 按官方要求在提交前移除，摘要保留于本回执。
- 文档自检：21 份项目文档的 128 个本地链接存在；最终官方 integration status 仍为 ok，缺失／修改／无效路径为 0；用户级 CLI 仍是 v1.3.0，specs／src／tests／产品 skills 无改动。
- 暂存完整差异用 `git -c core.whitespace=trailing-space,space-before-tab,cr-at-eol diff --cached --check` 通过。普通检查会将官方 Windows 生成元数据的 CRLF 报作尾空白，使用 cr-at-eol 正确识别，未改官方字节或关闭尾空白检查。
- [独审 R1](review.md)通过，无需修复，结论绑定候选 `0f1d2e0ac560516547029624f153801fe7fce72b`。独立复核官方状态、来源脚本、18 份文档的 119 个本地链接、差异空白、真实功能路径与前置缺失状态；下载及隔离写入验证复用已有证据。修复轮次为 0。此处不将文件安装称为完整架构规划执行。

## 当前 Git 与接续

基线 `7528e1d`，成果与独审候选 `0f1d2e0`，dev 原基线 `80ff6eb`。所需验证／独审已通过；后续归档提交仅保存审查原文、更新交接状态并标清 README 的历史 Spec Kit 记录，不改变受审工具或规则。作者已明确允许检查完成后将 D001—D003 正常合 dev；本回执随归档提交进入合并，最终收束以 dev 的正常合并提交及包含关系为证，不以历史回执的“未合并”状态为准。

新主脑从根 AGENTS、主脑角色、[D002 交接](../D002-directory-layout/handoff.md)及本回执接续，编写正式设计前读 Spec Kit 接入说明。现有 spec 为历史总入口，尚未整理成完整官方 spec／plan 套件，下一项正式规划任务须明确该衔接，不自动重写所有历史分册。

没有产品代码、实际产品 Skill、产品实验、页面或教学验收；不推送、不发布，不操作 master／main。用户会自行开启新主脑会话。
