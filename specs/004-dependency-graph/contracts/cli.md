# 文件依赖图 CLI 契约

环境：Node 24、Git 2.45+；构建后 node dist/cli/main.js。所有图命令必须携带 pin 返回的完整 --project、--repository、--prefix、--commit（根项目 prefix 为空字符串），不从 cwd/安装位置/HEAD 猜目标。

```text
apply-graph    <完整固定参数> --input <absolute-json-file>
query-graph    <完整固定参数> --path <project-relative-git-path>
query-legends  <完整固定参数> [--id <legend-id>]
validate-graph <完整固定参数>
```

apply 的 JSON 文件绝对路径可在项目外，只是 AI 明确指定输入，不作为源码或图路径；严格 UTF-8/JSON 只读。模型见 [data-model](../data-model.md)。例如：

```json
{
  "format": "aftertaste-dependency-update/v1",
  "register": ["service.ts"],
  "reviews": [
    { "path": "service.ts", "analysis": "reviewed", "dependencies": [
      { "path": "schema.ts", "reason": "使用 schema 的输入类型" }
    ] }
  ]
}
```

明确核对无依赖用 analysis=reviewed、dependencies=[]；未完成者不提交 reviews，仅 register。删除用 remove=[指定路径]。三个动作可同份输入，但删除与登记/核对/引用冲突时失败，输入不变。缺图时明确 apply 才可初始化，query/validate 不建目录或空图。

## 库图例

`apply-graph` 可接收 `legendUpserts` 和 `legendRemove`，可单独提交或与文件更新同批。图的可选 `legends` 数组只保存本图的实例及其关联。示例：

```json
{
  "format": "aftertaste-dependency-update/v1",
  "legendUpserts": [{
    "id": "node-path",
    "kind": "standard",
    "name": "node:path",
    "description": "提供与平台相适配的路径拼接和解析。",
    "uses": [{"path": "src/reader.mjs", "reason": "拼出讲解资料的镜像路径。"}]
  }]
}
```

- `id` 由 1—80 个小写 ASCII 字母、数字、点、下划线或连字符组成，首字符为字母或数字。按 ID 查询、更新和删除，显示名允许相同。持久化布局键为 `legend:<id>`。
- 首次登记需要 `kind`（`standard`／`third-party`）、`name`、`description`，省略 `uses` 表示无关联。名称、介绍、理由均为非空 Unicode 文本。更新时仅覆盖给定字段，包含 `uses` 时替换该实例的全部关联，传空数组移除其关联。每个 path 唯一且必须在合并后的文件图中已登记。
- `legendRemove: ["node-path"]` 明确移除实例及关联，供画布清除旧成员。可确认已经缺席的实例。一次更新内重复 ID、同时更新和删除同一实例、显式关系指向未登记或同批删除的文件均拒绝。文件的 `remove` 同时清理指向它的既有库关联。库关系独立于文件依赖及其核对状态。
- `query-legends` 返回 `{source_commit, legends, sourceCheck: "not-run", semanticQuality: "unchecked"}`。省略 ID 时列出当前图，指定未登记 ID 时数组为空。查询只读。验证检查实例、类型、重复和引用，同时沿用固定 Git 源码的文件检查。图例不充当源码路径。
- 图仍使用 `aftertaste-dependency-graph/v1` 和原路径；无图例时可省略 `legends`。旧图、布局及移除凭据可读。正式移除以同一图发布凭据记录对象 ID，格式见[图数据模型](../data-model.md#画布移除凭据)。

## 共用用例

src/application/dependency-graph.ts：GraphService(sources, store)。apply(fixed, inputUnknown)、query(fixed, path)、queryLegends(fixed, id?)、validate(fixed)。GraphStore.read(projectRoot) 返回原 UTF-8 文本或 undefined；save(projectRoot, raw, previous, removal) 创建或替换。FixedSourceService.verify(fixed) 核空图实际身份，所有图参数必须完整映射。查询核输入和保存结构，源码核验由 apply 和 validate 执行。

apply 返回 {graph, removedEdges, affectedDependents}；query 返回模型查询结果；validate 返回 GraphCheck。不自动分析语义或创建文档。

## 输出与退出状态

- apply/query 成功：stdout 一行 {ok:true,result}，stderr 空，退出 0。
- validate 可运行：stdout 一行 {ok:result.mechanicallyValid,result}，通过退出 0，结构/源码不通过退出 1；结构非法不继续源码核验。版本不符为图检查诊断。
- 操作/参数失败：stdout 空，stderr 一行 {ok:false,error:{code,message,nextStep,context,diagnostics?}}；参数/路径/更新输入非法退出 2，其余失败退出 1。与现有工具相同，不靠中文文案判断。

## 稳定诊断

沿用 SourceError 的固定引用/源码诊断。图错误为 GRAPH_INPUT_INVALID、GRAPH_INPUT_READ_FAILED、GRAPH_NOT_FOUND、GRAPH_INVALID、GRAPH_VERSION_MISMATCH、GRAPH_PATH_UNSAFE、GRAPH_READ_FAILED、GRAPH_WRITE_FAILED、GRAPH_CHANGED。

结构/输入诊断：GRAPH_JSON、GRAPH_FIELDS、GRAPH_FORMAT、GRAPH_COMMIT、GRAPH_PATH、GRAPH_ANALYSIS、GRAPH_REASON、GRAPH_DUPLICATE、GRAPH_REFERENCE、GRAPH_CONFLICT、GRAPH_LEGEND_ID、GRAPH_LEGEND_KIND。field 为具体字段路径；params 仅稳定定位值。SOURCE_UNAVAILABLE 记录 sourceCode 与失败 context；validate 的 sourceCheck=unavailable，绝不假报完成。

写失败 context 含 graphPath、projectRoot、reason 和 published（0/1），必要时 temporary。GRAPH_CHANGED 表示开始读取后旧图内容或存在性变化；调用方重新查询再决定，不自动重试。GRAPH_VERSION_MISMATCH 包含 expectedCommit/actualCommit，不改写版本。

## 兼容与边界

原 pin/read/create-document/validate-document 行为保持。新增 verify 不重 pin 来源。现有图仅支持本版字段，手编合法数据可独立校验；不引入迁移器。普通目录大小写别名依真实文件系统解析，Git 路径不折叠；现存 symlink/junction/硬链接拒绝。未实现多进程协调、恶意并发目录替换、断电恢复或跨版本更新。
