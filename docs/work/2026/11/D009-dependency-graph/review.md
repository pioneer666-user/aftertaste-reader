# D009 · 独立审查原文

## R1 · 2026-11-17

本变更提供固定提交内的文件依赖图登记、局部替换、查询、检查与明确删除，使用完整临时文件发布图数据。

批准依据为 `docs/work/2026/11/D009-dependency-graph/task.md` @ `c4010db`，无有效调整。比较基线为 `4d3186e7b83c02792f1e682514fff2218ba4a233`，固定候选为 `debaea933957cbf447fadf3faa132f6f70d2a645`。产品实现涉及该候选的 28 个文件，分支另包含既有 D008 反馈与派单记录。

审查采用 Ponytail Review，并以 Sharp Edges 检查输入与保存接口，以 property-based-testing 方法核对性质测试的独立预期。预期使用方式为本地 AI 串行调用工具。

## 结论

**需修复一项 P2 问题。**

### 1. [P2] 未知数组输入可跳过校验或覆盖校验遍历

问题位于 `src/core/dependency-graph.ts:58` 的 `Fields.array`，调用处为第 115、126、134 行。

共用入口 `GraphService.apply(fixed, inputUnknown)` 接受程序构造的对象。数组检查仅判断 `Array.isArray` 并返回原数组，后续直接调用它的 `map`。因此，空槽会被跳过，继承槽会被读取，数组自己的 `map` 可以替代校验过程。

在 Node 24.11.1 下，通过候选 `dist/application/dependency-graph.js` 和内存端口独立复现了以下结果。

| 输入 | 实际结果 |
| --- | --- |
| `register: new Array(1)` | 被接受，调用 `save` 一次 |
| `remove: new Array(1)` | 被接受，调用 `save` 一次 |
| `reviews: new Array(1)` | 抛出无稳定 code、field 的 `TypeError` |
| `dependencies: new Array(1)` | 抛出无稳定 code、field 的 `TypeError` |
| `register` 的第 0 项仅存在于数组原型 | 被接受并登记该节点，`Object.hasOwn(array, 0)` 为 false |
| 空 `remove` 数组的 `map` 返回 `['schema.ts']` | 删除已有 schema 节点及关联边，并调用 `save` |
| 空 `reviews` 数组的 `map` 返回 service 的已核对空依赖 | 清空 service 入边，将其标为 reviewed，并调用 `save` |

后两项的关键输入如下，输入数组长度均为 0。

```javascript
const remove = [];
remove.map = () => ['schema.ts'];

const reviews = [];
reviews.map = () => [{
  path: 'service.ts',
  analysis: 'reviewed',
  dependencies: [],
}];
```

作为对照，显式 `[undefined]` 和 `[null]` 均得到正确的 `GRAPH_INPUT_INVALID`，定位到 `$.register[0]`。

这些异常数组可导致共用用例绕过明确列表项与字段校验，甚至删除节点或改变核对状态。JSON 文件入口不会产生上述数组，但工程约定要求共用用例对 `unknown` 输入执行运行时校验，D009 也要求命令与共用用例使用同一规则。

建议在共用数组检查中固定长度，逐索引检查自有项，并将读取结果复制到普通数组后返回。后续遍历应使用该快照。补充三个顶层数组及 dependencies 的稀疏槽、继承槽和自定义 `map` 回归，断言非法输入拒绝时没有触发取源或保存，并保留合法空数组的行为。

## 其余审查结果

已追踪 CLI、GraphService、纯规则、固定取源与磁盘存储的完整调用链，未发现其他需修复问题。

- 使用者完整列表替换保留未提交者关系，重复登记保留状态，新引用节点保持 unreviewed。
- 显式 reviewed 和完整列表共同表达完成核对，允许自环与循环。删除后的存续失边使用者降为 unreviewed。
- 空图也调用实际提交身份核验，完整 ID 解析结果需严格相等。查询保留已保存关系，并明确 `sourceCheck=not-run`。
- 损坏结构、错误编码及版本不符的旧图会被拒绝。临时文件取得排他句柄后才归本次清理，首次创建与已有图替换分别发布。
- 共用目录提取保留 D008 的目录身份检查、大小写别名支持和链接保护。图操作的目标范围限于图文件。

已核对现行规格 08 的相关规则、04 U82—U86/U88、004 全套正式材料及必要的 002/003 调用契约。spec、plan、tasks 的必需结构与生效模板相符。只读前置检查成功，唯一 requirements checklist 为 16/16，无自定义 checklist，无 extensions hooks。受管资产、依赖与配置相对基线没有变化。

## 实际验证与证据

本轮独立执行了以下检查。

- 图单元测试 5/5 通过，包含 512 种三节点有向图。性质检查同时约束幂等、未提交者关系保留和删除后的状态，具有独立预期。
- 对既有合成样例 `.local/D009/run-Ch0HkP/` 执行真实 `query-graph`、`validate-graph`，均退出 0。固定提交为 `58584a3a508f552345a39a17b0603d579e62ac3a`，service 为 unreviewed，router 使用关系保留，图文件字节保持。
- Node 24 下 `tsc --noEmit` 退出 0。
- 上述异常数组复现均使用内存取源与存储端口，确认了接受、保存调用及错误类型。
- 只读 Spec Kit 前置与模板解析成功，候选和工作区核验通过。

核阅并复用了执行方的图集成、受影响回归及 demo 日志。完整图集成 7/8 的唯一失败发生在目录清理，候选已改用 rmdir，受影响项另跑 1/1 通过。受影响回归为 33/33，demo 的 9 步退出状态符合记录。本轮没有将这些记录称为独立重跑。

未检查非 Windows、其他文件系统、Windows 单独启用大小写敏感的目录、负载、恶意并发目录置换或断电恢复。作者体验验收按本单范围不适用。

## 写入交还

结束时 HEAD 仍为 `debaea933957cbf447fadf3faa132f6f70d2a645`，工作区干净，候选及既有输入未发生漂移。本轮未写产品或规范文件，未执行 Git 写操作，未启动服务或浏览器，定向命令均已结束。

**采集结束，可以恢复写入。**
