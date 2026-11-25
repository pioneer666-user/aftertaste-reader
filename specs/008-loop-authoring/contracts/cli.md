# CLI Contract · 生成与读回闭环

沿用[固定取源参数](../../002-fixed-source/contracts/cli.md)和单 JSON 输出。项目路径为绝对路径，空 `--prefix` 用 Node argv 数组传递。

## create-loop

```text
create-loop --project <absolute> --repository <absolute> --prefix <project-prefix> --commit <full-oid> --id <loop-id> --input <json-file>
```

文件为 UTF-8 JSON。根字段 `format:"aftertaste-loop-input/v1"`、`title`、`goal`、`explanation`、`nodes`、`entry`、`edges`、`reading_order` 必填。节点、边和顺序见[数据模型](../data-model.md)。可选 `legends` 为 `[{id,paths:[sourcePath,...]}]`，逐图例明确选取的用法。节点可附 `library_uses: [{id,reason}]`；解析输入和读回均检查库与本步路径，Markdown 在对应步骤显示用途。格式字段、正文与行号由各自的输入方或程序填充。未知字段、重复项和悬空引用拒绝。

程序检查完整固定映射及提交，参与文档须通过原文档机械校验、与固定提交一致、被选块有正文。所选图例及用途必须存在于对应版本依赖图。成功返回 `{ok:true,result:{id,path,source_commit,mechanicallyValid:true,teachingQuality:"unchecked"}}`。

## read-loop

```text
read-loop --project <absolute> --id <loop-id> [--format json|markdown]
```

默认 JSON。结果含 `loop` 完整成品及 `sources`（每节点一条，含 `node_id`，状态 `available`、`unavailable` 或 `not-applicable`）。可用条目含相应行的 `lines` 文本数组，仅供当次内存消费。不可用条目含 `error` 以及节点、文档、提交、文件和范围定位。JSON 返回 `{ok:true,result}` 表示成品可读；检查 `result.sourceCheck` 和 `result.mechanicallyValid` 判断取源是否完整。任一范围不可用时 `sourceCheck:"unavailable"`、`mechanicallyValid:false`。成功读到结构并输出成果时退出 0，包括固定源码部分不可用的情况。

Markdown 模式输出目标、串讲、顺序、来源定位、已存块解释、路线连线、提示和所用图例。若源码不可用，文内标出具体位置和诊断。输出只含讲解与引用，可作为可读试讲材料。

## 错误及保护

- 错误 JSON 走 stderr。调用参数、ID 或路线输入无效退出 2。其余未能完成操作退出 1。
- `LOOP_INPUT_INVALID`、`LOOP_INPUT_READ_FAILED` 定位输入失败字段或文件。 `LOOP_BLOCK_INVALID`、`LOOP_LEGEND_INVALID` 定位欠缺的引用。直接 Git 或依赖图失败保留原诊断。
- `LOOP_EXISTS` 表示 ID 已被占用。 `LOOP_NOT_FOUND` 表示未找到成品。 `LOOP_INVALID` 表示成品结构不合法。
- `LOOP_PATH_UNSAFE` 拒绝不安全的资料入口，`LOOP_READ_FAILED` 和 `LOOP_WRITE_FAILED` 给出失败类别与位置。失败的同名创建保留旧成果；未发布的创建可用原 ID 重试。

D043 的 revise-step 以固定提交、原文件 SHA-256、闭环 ID、步骤 ID 和字段为条件，stdin 仅为该字段的新讲解。成品与固定源码校验后同目录安全替换，重新读回核对。具体调用见[修订命令](../../../skills/aftertaste-reader/references/tools.md#revise-current)。

create-loop 的 nodes[i].annotation 接受可选非空 Markdown 字符串。read-loop 在 JSON 中原样返回，在 Markdown 中于该步列出「节点说明」。缺字段的 v1 成品仍可读。
