# Implementation Plan: 普通文件讲解的分批生成

**Branch**: `codex/feat-generation-skill` | **Date**: 2026-11-17 | **Spec**: [spec.md](spec.md)

**Input**: D010 @ `2a6f27d`、S01—S06 及本目录 spec。基线 dev `e331634`，复用 D007—D009 已核工具能力。本次完整执行 specify → plan → tasks → analyze → implement。

## Summary

**D057 增量**（`codex/fix-project-data-privacy`，批准 `e6ce8b5`，FR-013、FR-014、SC-009）。Skill 在首次写入前连接新增的 `project-privacy` CLI。CLI 按用户 Git 规则读取索引与忽略判断，固定源码仍使用独立环境。许可文件只驻留于仓外用户状态目录。笔记、书签、自评共用保存权限修复，要求沿三项原契约。

**D050 增量** `teaching.md` 共用三档定义、第二档内置起始讲法和对话停等条件。`feedback.md` 沿已有写入边界维护同一偏好文件的当前讲法。`generation.md` 按源码顺序讲运行，闭环按路线回答原因。CLI 调用保持原协议。按安装包实际对话验证，见 [行为检查](../../tests/skills/generation.md#项目讲法)。

**D046 增量** 共用 teaching 指南在目标块说明取值、条件、具体实现与结果，沿用已有偏好和固定源码规则。

以一个产品 Skill 入口连接现有 CLI。共用约束、教法、偏好、工具分别维护，generation 组织分批流程。AI 决定文件和块的语义，工具保留固定来源、ID、覆盖和图写入规则。通过隔离合成项目的实际代理调用与机械复核提供试读证据。

## Technical Context

**Language/Version**: 中文 Markdown 指南与模板，Node.js 24 的 `.mjs` 开发样例和检查。复用 TypeScript 5.9.3 CLI。

**Primary Dependencies**: 既有 Git 2.45+、Node、编译后 CLI，不新增依赖。

**Storage**: 目标项目 `docs/aftertaste/` 的 current、dependency-graph.json、preferences.md、reading-direction.md。产品包只保留通用原件。

**Testing**: Node assert 静态／样例核验、真实模拟使用代理串行场景、独立只读审查。

**Target Platform**: 当前 Windows／PowerShell／Codex 显式加载开发树，其他宿主与安装留待交付任务。

**Project Type**: AI Skill 配已有 CLI。

**Performance Goals**: 本单以小批次可读与真实完成度验收，无新增性能承诺。

**Constraints**: 源码只在内存消费，资料冲突不覆盖，读取失败不换来源。当前 cwd 与工具／项目位置独立，保留完整 pin 映射。

**Scale/Scope**: 普通文件新生成，逐批与连续两个节奏。无服务、页面、解析器或通用代理框架。

**D057 技术变更** TypeScript CLI 和 Node 文件适配。复用系统 Git、Windows 自带 PowerShell/.NET 文件 ACL、Linux GNU cp 的 ACL 保留及 macOS 的平台工具。资料位置与 JSON 保持原样。使用隔离安装包、Git 配置、NTFS 与 POSIX 项目验证。

生成与修订的工具暂存放在同仓 Git 元数据内，同文件系统原子发布。图更新的可见范围包含实际可能更新的移除凭据。隐私检查核工作树与 Git 元数据的映射并遵从实际索引，授权状态出现更新锁时暂停复用。

## Constitution Check

| 原则 | Phase 0 前检查 | Phase 1 后检查 |
| --- | --- | --- |
| I 已确认需求与授权 | S01—S06 与 spec FR 映射，无新增产品决策 | 路径和提示词细化在授权内，后置分支明确 |
| II 固定源码与资料归属 | 完整 pin 映射，冲突先停依赖写入 | data-model 明确目标资料、写入方和失败保留，示例合成 |
| III 共用规则与最少机制 | CLI 已有能力覆盖主流程 | 不写第二套解析／ID／图程序，无新增依赖 |
| IV 分层验证与独审 | 真实代理调用和作者试读分开 | quickstart、行为用例及独审固定候选，教学效果待作者 |
| V 官方结构 | 已读固定版技能，实际 resolve spec / setup-plan | 保留官方栏目，继续实际 setup-tasks / analyze / implement 前置 |

两次门禁均无冲突。官方路径脚本的 BRANCH 是功能目录名，真实 Git 分支以 `git branch --show-current` 核验。每阶段前后检查 hooks，当前不存在 extensions.yml。

D050 沿批准的三种讲法，写入限于经确认的目标项目 Markdown。共用单一方法和偏好，固定来源及 CLI 校验由已有实现担任。验证区分真实会话、机械读回、独审和作者试读。沿现有方案结构增量维护。

D057 依据 I 将可见性取舍交还读者。依据 II 将实际索引检查与固定取源隔离，许可仓外存放，权限不明时拒绝替换。依据 III 共用 Skill 规则、CLI 和个人文件适配。依据 IV 在隔离项目留实际对话、权限及回归证据并独审。依据 V 沿现有栏目增量维护研究、模型、契约与任务。

## Project Structure

### Documentation (this feature)

```text
specs/005-generation-skill/
  spec.md
  plan.md
  research.md
  data-model.md
  contracts/skill.md
  quickstart.md
  checklists/requirements.md
  tasks.md
```

### Source Code (repository root)

```text
skills/aftertaste-reader/
  SKILL.md
  references/{authoring,teaching,generation,feedback,tools}.md
  assets/templates/{preferences,reading-direction}.md
tests/skills/
  generation.md
  generation-static.test.mjs
  generation-sample.test.mjs
tests/fixtures/generation-project.mjs
docs/usage/generation-skill.md
docs/work/2026/11/D010-generation-skill/
  task.md
  evidence.md
  sample/
  review.md
  handoff.md
```

**Structure Decision**: 沿目录规范分离产品原件、合成 fixture、可再生成沙盒和正式证据。源码工具未暴露必要缺口时保持原实现。

D057 新增 `src/adapters/project-privacy.ts` 和 `src/adapters/personal-access.ts`，接入既有 CLI 与 PersonalFile。产品指南仍由 `skills/aftertaste-reader/references/tools.md` 给出单一操作入口。检查见 `tests/integration/project-privacy.test.mjs`、`tests/integration/personal-access.test.mjs` 与 `tests/skills/project-privacy.md`。

## Complexity Tracking

没有需要例外说明的原则违反。
