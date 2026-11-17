# D008 · 独立审查原文

## R1 · 2026-11-17

### 范围与方法

- 批准依据为 `docs/work/2026/11/D008-document-blocks/task.md @ 39a7fdf`，无有效调整。比较基线为 `fa6360f`，固定候选为 `105d1a3515a68452716f796d448ca68792d9863a`，实施差异核对 `39a7fdf..105d1a3`。
- 本变更交付单篇骨架创建、CommonMark 块解析和固定提交覆盖校验。按 Ponytail Review 追踪 CLI、DocumentService、core、DocumentFileStore 与既有取源调用链，按 Sharp Edges 检查输入、路径、排他发布及失败结果。
- 核对了 001 的相关现行规则、02、06，002 取源契约，以及 003 的规格、方案、任务、模型、契约、研究、quickstart 和 checklist。官方结构及需求映射完整。只读运行 Spec Kit 前置检查成功，requirements 为 16 项已勾选，T016 保持待完成。
- 自测中的全套 41/41、最终适配器集成 8/8 和真实 CLI 示例证据可按影响复用。审查另做了九类 Markdown 上下文内存探查，以及下述共用 API 失败复现。

### 结论

**需修复。确认问题 1 项，优先级 P2。**

#### 1. 范围对象检查通过后可能生成并保存非法骨架

涉及 `src/core/document-blocks.ts` 第 75—79、220—223 行，以及 `src/application/document-blocks.ts` 第 45—49 行。

- `validRange` 只检查自有可枚举键数量等于 2，并读取 `start/end`。随后生成器用对象展开复制范围。对于通过原型 getter 提供 `start/end` 的对象，检查值与实际复制字段不同。
- 复现输入为以下 JavaScript 范围对象，共用用例实际接收的 `blocks` 类型是 `unknown`。

```javascript
class Range {
  constructor() {
    this.from = 1;
    this.to = 3;
  }
  get start() { return this.from; }
  get end() { return this.to; }
}
```

调用 `DocumentService.create(fixed, 'a.ts', [{ lines: new Range() }])`，针对三行合成源码，实际正常返回并写入含 `lines=undefined-undefined` 的文档。返回结果为 `mechanicallyValid=false`，诊断包含 `RANGE_INVALID` 和 `SOURCE_GAP`。

- 独立预期是将接受的范围保存为已校验的数值，或在输入不符合清单格式时明确拒绝并保持目标缺失。当前行为违反 M02 的合法骨架创建结果。
- 最小修复是在边界读取并校验 `start/end` 数值，随后显式构造 `{ start, end }`，同时精确校验允许字段。补一条共用用例回归，检查非法输入不会写入无效骨架。
- 内存复现和真实磁盘复现均确认。磁盘样例保留于 `.local/D008/run-265sQb/`，只含合成材料。本项通过共用 API 复现，输入使用 JavaScript getter。

### 已核与限制

- 顶层标记、围栏、缩进代码、列表、引用、HTML 容器、转义和行内示例的补充探查结果符合预期。
- 固定提交复用、源码不落入骨架、原文保留、警告及降级状态、现存链接检查、排他发布和临时文件拥有判定的调用链检查未发现其他已确认问题。
- 审查未重跑构建及整套测试。网页、教学效果、非 Windows 平台、系统突发终止和恶意并发置换目录沿执行回执列为未验证范围。
- 本轮只读审查未修改产品、规范或 Git。候选末次核验仍为 `105d1a3`，工作区干净。未启动服务或浏览器，探查进程均已结束。

**采集结束，可以恢复写入。**
