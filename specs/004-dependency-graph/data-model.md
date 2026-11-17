# 文件依赖图数据模型

## 固定依据

复用 [002 FixedSource](../002-fixed-source/data-model.md)：projectRoot、repositoryRoot、projectPrefix、commit 全部必填。图内 source_commit 是完整小写 40/64 hex ID。所有入口先核字段及组合映射；apply/validate 还核原仓库根及实际 commit 身份（空图也核）。不允许只替换 source_commit 跨版本。根目录资料访问需真实目录；Git 验证仍可读取已经消失的固定子项目树。

## DependencyGraph

唯一文件 docs/aftertaste/dependency-graph.json，UTF-8 JSON（允许 BOM）。顶层仅 format、source_commit、nodes、edges；format 固定 aftertaste-dependency-graph/v1。

- nodes: 仅含 path、analysis 的数组；path 项目相对规范 Git 路径，同图唯一且大小写敏感；analysis 仅 unreviewed 或 reviewed。
- edges: 仅含 dependency、dependent、reason 的数组；端点均已登记，同对端点唯一；reason 是非空且 Unicode 完好的说明（不得放源码）。方向 dependency → dependent；允许自环与循环。
- 所有路径沿 002 路径约束；核源码沿现有 UTF-8 普通文本读取契约。结构字段不允许未知项，避免未识别数据被更新丢弃。图不保存项目绝对路径、源码、讲解完成或理解状态。

## GraphUpdate

顶层仅 format、可选 register、reviews、remove；format 固定 aftertaste-dependency-update/v1，至少显式出现一个动作，数组可以为空以明确初始化。

共用用例接收程序构造输入时同样要求数组每个索引为自有项，拒绝空槽和继承槽，并读取到普通数组快照后校验；不执行输入数组自定义的遍历方法。合法 JSON 数组及明确空列表行为保持。

- register: 唯一路径数组，只补节点，不重设状态或边。
- reviews: 唯一使用者数组，每项仅 path、analysis、dependencies；analysis 必须为 reviewed；dependencies 必须显式数组，每项仅 path、reason，代表这个使用者完整的直接依赖，路径唯一。
- remove: 唯一路径数组；只明确移除此处节点。若同时在登记、核对、依赖引用中出现同一路径，拒绝冲突输入。删除未登记节点是幂等空操作。

先登记和补真实引用节点（unreviewed），按明确核对者替换其全部入边并设 reviewed；删除指定节点及关联边。删除造成存续使用者失去入边时设 unreviewed，其他已知入边可保留，表示不完整分析。返回 removedEdges 与 affectedDependents（仅存续者）。未提交/未受删除影响的状态和关系不变。

应用纯规则不修改原对象；输出节点按路径、边按使用者/被依赖方作确定排序。重复应用完整依赖和删除的图结果不变（移除报告可为空）。

## 检查与查询结果

GraphDiagnostic: code、field（JSON 字段定位）、message、nextStep、params（稳定字段参数）。GraphCheck: structureValid、sourceCheck（completed/unavailable/not-run）、mechanicallyValid、diagnostics，合法结构时含 graph；semanticQuality 固定 unchecked。源码失败诊断带 sourceCode 及文件/字段，不能包含源正文或 Git stderr。

查询返回 source_commit、path、registered、analysis（未登记为 null）、dependencies、dependents；sourceCheck=not-run，明确未核查源码。有效图 Git 对象不可用时仍能查询。未核对即使无边也不能解释为无依赖。

## 失败与存储状态

只 ENOENT 为缺图；损坏编码/JSON、无权限、链接/硬链接/目录均诊断。写操作先读取并检查旧图，比较固定提交；校验完整候选（含未修改节点真实源码）再发布。临时文件只有成功 wx 后归本次清理，首次 link、更新 rename，发布前比对旧图原文；发生变化拒绝覆盖，但不承诺消除最后复查与发布之间的竞争。

发布前失败保持旧图字节；发布后清理失败以 published=1 报告目标已更新。崩溃可留临时图，工具不自动清除未知临时文件。输入文件始终只读、原样保留。
