# Implementation Plan: 固定提交取源

**Branch** | `codex/fix-fixed-source-hardening` | **Date** | 2026-11-17 增量 | **Spec** | [spec.md](spec.md)

**Input** | `specs/002-fixed-source/spec.md`

## Summary

固定阶段建立项目到仓库映射并解析完整提交。读取阶段只接受完整提交，沿提交树逐段查找普通 blob，返回严格 UTF-8 文本及路径依据。CLI 与后续服务通过同一 application 用例调用 Git 适配器。

D007 增量将 read 的目标分为已有完整固定引用与仅有 projectRoot/commit 两种输入。后者由用例定位项目一次，前者校验字段及 `projectRoot = repositoryRoot + projectPrefix`，再定位仓库根并核对真实普通仓库身份。读取不访问当前子项目目录。adapter 核实解析出的提交 ID 与输入完全相同，随后只沿该 ID 和树返回的对象 ID 读取。bare 检测放在向上搜索 `.git` 之前。

## Technical Context

**Language/Version** | TypeScript 5.9.3，Node.js 24 LTS，ESM，strict

**Primary Dependencies** | 运行时仅 Node 标准库和本地 Git 2.45+。开发依赖 TypeScript 5.9.3、@types/node 24.10.1，npm 单一锁文件。

**Storage** | 仅内存持有源码与引用。目标仓库只读。

**Testing** | Node 内置 test/assert，测试文件串行，合成仓库位于 `.local/D007/<run-id>/`。独立 bare/非仓库样例在经核验的系统临时目录创建并在测试结束清理。

**Target Platform** | Windows 主验。其他平台待验。

**Project Type** | 可复用用例与 CLI

**Performance Goals** | 本批无吞吐或延迟承诺，以确定提交和内容保真验收。

**Constraints** | 无网络取源、无源码持久副本、无 shell 拼接。支持普通本地非 bare 仓库，linked worktree、子模块目标和链接项目目录明确拒绝。支持 SHA-1/SHA-256 对象标识。

**Scale/Scope** | 每次读取一个完整文本文件，调用者复用固定引用读取多个文件。单次 Git stdout 最大 64 MiB，超过给 Git 读取失败及输出限制原因，避免误报空内容。

## Constitution Check

研究前核对 I—V，设计后复核如下。

| 原则 | 本批依据和结果 |
| --- | --- |
| I 授权 | D006 的固定取源与 D007@05daca6 H01—H05 加固，spec 映射 08 |
| II 源码归属 | Git 对象读取，禁 lazy fetch、replace 和工作区替代，无写入 API |
| III 最少机制 | application 定义端口和固定用例，adapter 集中进程/文件系统，CLI 只处理传输 |
| IV 验证 | unit + 合成 Git integration + 构建 CLI，候选提交后独审，A01 只覆盖取源 |
| V 文档 | 官方解析 spec/plan/tasks 模板，保留必需结构，analyze 后实施 |

研究前与设计后均无原则冲突。具体技术选择见 [research.md](research.md)。

D007 复核 I—V 仍成立。复用原工程与依赖，按 specify/plan/tasks 的实际解析模板做增量，编码前 analyze，implement 检查实际 checklist，新增回归先记录旧实现失败。候选冻结后独审。H03 累计进入第 2 轮修复，失败即停写。

## Project Structure

### Documentation (this feature)

```text
specs/002-fixed-source/
├── spec.md
├── checklists/requirements.md
├── plan.md
├── research.md
├── data-model.md
├── contracts/cli.md
├── quickstart.md
└── tasks.md
```

### Source Code (repository root)

```text
package.json / package-lock.json / tsconfig.json
src/
├── application/fixed-source.ts
├── adapters/git-source.ts
└── cli/main.ts
tests/
├── unit/fixed-source.test.mjs
├── integration/fixed-source.test.mjs
└── fixtures/fixed-source.mjs
```

**Structure Decision** | 单个 TypeScript 工程。application 集中类型、诊断和端口，现阶段无独立纯领域规则，按职责创建实际层。测试直接消费构建产物。

## Complexity Tracking

无需要豁免的原则违反项。
