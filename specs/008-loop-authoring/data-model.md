# Data Model · 闭环 current

唯一成品为目标项目的 `docs/aftertaste/loops/<loop-id>/current/loop.json`，UTF-8，版本 `aftertaste-loop/v1`。循环 ID 为 1–64 个小写字母、数字和单连字符组成的分段名称，拒绝 Windows 设备名。项目内只创建新 ID。

| 成品字段 | 值和规则 |
| --- | --- |
| `format`、`id` | 版本及路径对应的闭环 ID。 |
| `source_commit`、`project_prefix` | 完整 Git 提交和仓库内的项目相对前缀，根项目为空。源码位置由它们和节点的项目相对路径组成。 |
| `title`、`goal`、`explanation` | 闭环标题、目标与独立串讲 Markdown。 |
| `nodes` | 每节点含 `id`、`path`、`block_id`、`title`、`explanation`、可选 `hint` 和节点说明 `annotation`。程序补充 `block_explanation` 及对照块的 `lines:{start,end}`。纯讲解块无范围。不同节点可引用同一个块，用于不同教学步骤。 |
| `entry`、`edges` | 入口节点 ID 与边列表。边含 `from`、`to`、`reason`，支持分支、汇合及环。各节点从入口可达。 |
| `reading_order` | 每个节点 ID 恰好出现一次，允许独立于边方向安排读法。 |
| `legends` | 实际采用的库图例快照，沿用 [图例结构](../004-dependency-graph/contracts/cli.md#库图例)，用法为本路线明确使用的参与文件。 |

步骤可含`annotation?: string`；存在时须为非空白、合法 Unicode 的 Markdown，保留原文。身份为闭环 ID 与步骤 ID。

节点可附 `library_uses: [{id,reason}]`。每步每库唯一，ID 需已选且包含本步文件用法，reason 说明本步作用。缺省表示没有确定的步骤关联。

两种 JSON 的教学字段均为非空文本。节点至少来自两个项目相对源码文件。节点 ID、起止节点和图例引用在各自命名空间内校验。源码范围来自有效文件文档，1 起始且含末行。创建输入不能提交替代范围、已存块正文或图例正文。

校验完毕后暂存并发布整目录。正式 ID 下无成品时读回失败；无法读某条固定源码时成品依旧可读，运行时为每个节点返回自己的状态与具体诊断。一次生成始终以实际读到并校验的各文档与图例为依据。

## 同提交的步骤定位及修订

剪贴板标识为 `aftertaste-loop-step/v1`。JSON 的 `loop_id`、`step_id` 和 `source_commit` 取自保存的成品；选文时增加 `field`（explanation 或 hint）与原样 `selection`。整步省略这两项。两个步骤可共享来源块。修订从磁盘最新成品核对原版本，只替换指定节点字段，验证固定来源后安全替换。运行时 sources 不进入成品。
