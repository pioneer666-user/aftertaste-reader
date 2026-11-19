# D018 · 让讲解 AI 拿到文档和依赖图的具体校验结果

## 目标与批准依据

讲解 AI 照工具参考调用 `validate-document` 或 `validate-graph` 后，能知道校验是否完成、哪一项失败，以及到哪里修。2026-11-19 接回 [D017](../D017-skill-fixed-source/handoff.md) 时，主脑用同一篇合成讲解复核：CLI 在标准输出返回 `BLOCK_UNCLOSED` 和 `SOURCE_GAP`，退出码为 1，标准错误为空。将同一组参数交给参考中的 `runCli` 后，只得到 `CLI_FAILED`。作者随后要求“小修给下一单任务吧”。

## 范围与材料

本单是产品 Skill 小维护。仓库 `D:/project/SpecDev Harness/aftertaste-reader`，基线 `dev@6020f14cf9648c65c066aa5804d7f203817b2b98`，任务分支 `codex/fix-skill-validation`。批准提交由派单消息提供。

在 [tools.md](../../../../../skills/aftertaste-reader/references/tools.md) 把 D017 的调用函数标明为 `pin/read` 专用，给两条校验命令一个共用、可照做的结果处理示例。沿用[文档 CLI 契约](../../../../../specs/003-document-blocks/contracts/cli.md)和[依赖图 CLI 契约](../../../../../specs/004-dependency-graph/contracts/cli.md)。分批生成指南如需指路，链接到工具参考的同一处。实现范围在 Skill 参考及直接受影响的 `tests/skills/`。本单按既有契约做增量维护，沿用现有正式规格。

## 验证与停点

- 用已知坏讲解照最终公开说明调用，核退出 1 时仍能取到 `result.diagnostics` 中的两条具体原因，以及 CLI 给出的定位。可复用 [D010 的坏样例记录](../D010-generation-skill/behavior/verification.json) 或[文档集成测试](../../../../../tests/integration/document-blocks.test.mjs)构造的可重建输入。
- 依照同一说明校验一张固定源码不可用的依赖图，仍能读出 `sourceCheck` 及具体取源原因；另核一个有效结果和一次返回标准错误的命令失败，三种状态均按真实结果报告。可复用[依赖图集成测试](../../../../../tests/integration/dependency-graph.test.mjs)中的场景。失败诊断按需提取，避免输出原始流或源码正文。
- 复验 D017 [公开取源示例测试](../../../../../tests/skills/fixed-source-example.test.mjs)，保证首次固定、续批和完整读回仍可用。验证按影响串行，运行材料放 `.local/D018/<run-id>/`。

## 责任与交回

作者转交新执行会话后，由执行负责实施、自测及分支内提交。冻结候选后派独立子代理，至少照最终说明核对一次“校验完成但资料不合法”的实际结果。回执与审查原文归本目录 `handoff.md`、`review.md`。保留受审候选，合并待作者另行确认。
