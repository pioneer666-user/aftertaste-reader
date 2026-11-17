# Implementation Plan · 单篇讲解文档骨架与校验

**Branch** `codex/feat-document-blocks` | **Date** 2026-11-17 | **Spec** [spec.md](spec.md)

**Input** 与 spec 相同的 D008 @ 39a7fdf、M01—M06、001 约束、002 能力及后置范围，材料仅限本单。

## Summary

共用 core 负责 CommonMark 顶层注释解析、范围与大小校验，application 复用 FixedSourceService 并编排文档用例，adapter 校验现存路径并排他发布新骨架。CLI 提供 create-document 和 validate-document。

## Technical Context

**Language/Version** Node 24 LTS、TypeScript 5.9.3 strict/NodeNext。

**Primary Dependencies** mdast-util-from-markdown 2.1.0，MIT，仅解析 CommonMark AST；源码读取复用 002。

**Storage** 指定项目的镜像 Markdown。临时文件只含骨架和引用，完成写入后用同目录硬链接排他发布，清理临时名。

**Testing** node:test/assert，生成性质测试采用确定性枚举与独立占用数组，真实 Git 与 CLI 串行。

**Target Platform** Windows，Node 24，本地普通 Git 仓库。

**Project Type** 共用 library 与 CLI。

**Performance Goals** 本单无新增性能承诺，仅单篇内存处理，不开展负载。

**Constraints** 源码不落盘，取源不回退，不覆盖旧文档，拒绝现存链接/junction，保留 D007 历史读取。

**Scale/Scope** 一次处理一个文件，无注册表和批次事务。

## Constitution Check

规划前核 I—V。I 使用 D008 已批准范围及 001，不新增业务取舍。II 固定提交、镜像推导及无源码临时文件。III core/application/adapter/cli 单向依赖，复用 002。IV 边界、失败、真实 CLI、独审分别留证。V 通过 resolver 读取实际模板，运行 setup-plan、setup-tasks 与前置脚本，材料保持官方结构。

Phase 1 后复核同五项，模型和契约明确路径、空文件、失败与填写状态，未发现违例。

## Project Structure

### Documentation (this feature)

```text
specs/003-document-blocks/
  spec.md
  plan.md
  research.md
  data-model.md
  contracts/cli.md
  quickstart.md
  tasks.md
  checklists/requirements.md
```

### Source Code (repository root)

```text
src/core/document-blocks.ts
src/application/document-blocks.ts
src/adapters/document-store.ts
src/cli/main.ts
tests/unit/document-blocks.test.mjs
tests/integration/document-blocks.test.mjs
tests/fixtures/document-blocks.mjs
```

**Structure Decision** 沿工程现有边界扩展，共用结果供后续服务复用。新增解析依赖用于完整 Markdown 上下文，文件系统端口便于真实写失败注入。

## Complexity Tracking

无 Constitution 违例，不增加框架或多包结构。
