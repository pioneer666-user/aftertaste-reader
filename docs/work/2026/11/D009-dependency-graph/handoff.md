# D009 · 回执

## 当前结论与入口

- G01—G05 已实现，自测完成；等待固定候选的独立审查，不宣称交付通过。批准依据为 [task.md](task.md) @ `c4010db`，无 amendments；比较 dev 基线 `4d3186e`。成果为本次待提交 feat 候选，提交后派审消息固定 SHA，最终归档补充结果。
- 工具入口为 `apply-graph`、`query-graph`、`validate-graph`，均传 pin 的完整固定参数。使用 [CLI 契约](../../../../../specs/004-dependency-graph/contracts/cli.md)和[可重跑 quickstart](../../../../../specs/004-dependency-graph/quickstart.md)；依赖由 AI 判断，程序不分析语义。
- 作者体验验收不适用：本单没有页面、图布局或教学呈现；只覆盖 A08/A09 的工具部分，未记成页面验收通过。
- 当前 `codex/feat-dependency-graph`，仅本范围改动；完成后保留候选交主脑，不自动合 dev、不推送/发布。无服务或浏览器；未改变已安装产品 Skill。

## 依据与验证

### 完成范围

| 要求 | 实际行为与证据 |
| --- | --- |
| G01 登记/版本 | 明确 apply 才初始化；新节点 unreviewed，重复登记不降级/丢边。完整映射与真实 40/64 位 commit 身份共用核验，空图同样拒绝缺对象和分支别名；子项目、异 cwd、HEAD/工作区改变已测 |
| G02 局部提交 | JSON 文件显式 reviews：analysis=reviewed 且完整 dependencies，空列表明确表示核对后无依赖；仅替换指定使用者入边，新引用文件 unreviewed，不递归分析或建讲解；重复结果相同 |
| G03 查询/检查 | 区分未登记、未核对、已核对无依赖；查询返回保存依据与关系，Git 不可用仍可查。独立检查共用结构/重复/引用/路径和真实固定文件，源码失败 sourceCheck=unavailable、mechanicallyValid=false，诊断定位字段与 sourceCode |
| G04 明确删除 | 仅 remove 显式节点及关联边；返回 removedEdges/affectedDependents，存续使用者被动失边恢复 unreviewed；其他节点、源码及无关资料保持 |
| G05 失败保护 | 原图严格 UTF-8/结构/版本检查；合并候选完整检查再发布。wx 临时文件完整生成，首次 link 排他创建、更新 rename，发布前比对原文；临时碰撞不清理他人文件。写/发布失败旧图字节不变；发布后清理异常返回 published=1 |

图位置仍为 docs/aftertaste/dependency-graph.json，格式沿已确认 v1 文件节点模型。新增 JSON 输入契约为 aftertaste-dependency-update/v1；删除与登记/核对/新依赖引用冲突则拒绝。不新增库节点、通用补丁语言、讲解台账或版本同步。

共用改动仅为纯源码路径谓词、D008 目录身份保护、完整固定引用/commit 验证。文档新建仍排他发布、拒绝覆盖；002 取源模型/契约按本批必要 API 增量维护，原 read/CLI 行为不变。正式方案在 [plan](../../../../../specs/004-dependency-graph/plan.md)。

### Spec Kit 与技能

按本批同一 User Input 执行：D009 @ c4010db、G01—G05、既有 002/003、D008 @ 3126c54 的有效证据与 d32f662/4d3186e 合并基线、后置范围和允许修改调用链。实际完整读取 specify/plan/tasks/analyze/implement 与 resolver 生效模板，生成 004 spec、plan、research、data-model、contracts、quickstart、requirements checklist 和 tasks；未改受管源文件。

- specify 使用 resolve-template spec-template，分支按作者接续，功能目录固定为 specs/004-dependency-graph；requirements 16 项逐项通过，无待澄清项。
- plan 实际执行 setup-plan，Phase 0 由 storage_research 子代理只读研究既有代码与 D007/D008 证据，生成决策/备选；该代理未参与实现或独审。Phase 1 完成模型/契约/quickstart，constitution 五项门禁前后均无冲突。
- tasks 实际执行 setup-tasks，沿真实模板生成 18 项与依赖。analyze 在真实 spec/plan/tasks 上运行 RequireSpec/RequireTasks/IncludeTasks：10 FR / 18 tasks，覆盖 100%；歧义 0、重复 0、关键问题 0，无未映射任务/原则冲突；只读报告见本执行聊天，不写入虚构分析产物。
- implement 实际执行 RequireTasks/IncludeTasks，全部 checklist 扫描唯一 requirements.md 为 16/16，0 未勾，无自定义 checklist。沿既有 Node/TS、单锁与 ignore，无新依赖、发布或额外框架。不存在 extensions.yml，各阶段无 hooks 可执行。
- Ponytail full 用最少必要共用规则；property-based-testing 的 invariant/idempotence 方法以有限域枚举实现，不安装新库。未运行 converge 或自定义 checklist，不将这些名称计成已调用。

### 实际环境与自测

2026-11-17，Windows NT 10.0.26200.0 / NTFS、Node 24.11.1、npm 11.6.4、Git 2.50.1.windows.1、TypeScript 5.9.3。默认 PATH 是 Node 22.23.2，正式检查使用从既有 D008 复制的 .local/D009/runtime/node.exe，仅任务进程 PATH 改变，无全局升级。

仓库根串行执行以下命令，前置为当前进程 PATH 首位加入上述 Node 目录；构建失败时停止后续检查。

```powershell
npm.cmd run typecheck
npm.cmd run build
node --test --test-concurrency=1 tests/unit/dependency-graph.test.mjs
node --test --test-concurrency=1 tests/integration/dependency-graph.test.mjs
node --test --test-concurrency=1 --test-name-pattern='存储的 Windows' tests/integration/dependency-graph.test.mjs
node --test --test-concurrency=1 tests/unit/fixed-source.test.mjs tests/integration/fixed-source.test.mjs tests/integration/document-blocks.test.mjs
node tests/fixtures/dependency-graph.mjs --demo
```

| 检查 | 实际结果与绑定范围 |
| --- | --- |
| typecheck / build | 全部通过；之后产品源码未变，本地 dist 对应该源码 |
| 图纯规则 | 5/5，含 512 种三节点有向图的替换隔离、幂等、删除引用一致/状态、序列化及具体反例；0.215 秒 |
| 图集成 | 完整文件 7/8；唯一失败为测试清理（下文），改为 rmdir 后该项独跑 1/1，2.332 秒。产品源码相同，复用其余 7 项证据；不称最终版全文件重跑 8/8 |
| 受影响回归 | 固定取源 unit 6 + integration 17 + 文档 integration 10，共 33/33，166.520 秒；含新增 verify 快照/不读文件单测 |
| 未变文档 core | 复用 D008 handoff @ 3126c54 的 12 项单测证据：相关 core 源码、测试、依赖/配置未变；没有为本单全套重跑 |
| 静态文档 | git diff --check 与本批新增/修改 Markdown 本地文件链接检查通过 |
| CLI demo | 9 步真实命令全部达到预期，详情如下；输出不含源码 |

本次新运行的有效不同测试为 46 项（图 13 + 受影响回归 33），另复用未变文档 core 12 项。没有把不同版本局部结果拼称 npm test 全套重跑。

可再生成日志：.local/D009/integration-1.log、integration-path-fix.log、regression.log、demo.log（忽略、不随克隆恢复）；正式 fixtures/tests 与本节摘要可复核与重建。所有源码/输入均为明确合成内容，未在本仓根创建真实 docs/aftertaste。

CLI 独立示例目录为 .local/D009/run-Ch0HkP/，项目 packages/小 项目，固定 A=58584a3a508f552345a39a17b0603d579e62ac3a。实际退出状态：首次登记 0、完整依赖 0、局部替换 0、重复提交 0、明确删除 0、非法输入 2/GRAPH_INPUT_INVALID、Windows 只读目标替换失败 1/GRAPH_WRITE_FAILED（published=0、reason=EPERM）、独立检查 0、查询影响 0。fixture 断言重复后原文相同、非法输入/替换失败旧图字节不变，最终 service 未核对且 router 边保留；已恢复样例只读属性。

### 失败、修正及累计轮次

- 初次构建 core/dependency-graph.ts 有两处 unknown 收窄错误（analysis/source_commit）。同一 shell 后续曾意外继续跑单测，5 项因 applyGraph 尚未实现失败，该输出不计构建后证据。第 1 轮显式标注 Fields 类型后 typecheck/build 通过，累计 1 轮成功。此后命令均按构建失败停止。
- TDD 中首次真实 CLI 定向测试在未实现入口时返回 INVALID_ARGUMENT/2，而预期缺图 GRAPH_NOT_FOUND/1，确认功能未交付；纯规则 5 项也先观察了未实现失败，再实现并通过。
- 首轮完整图集成的工具输出未保留，确认进程已结束但不能确认退出状态，不计证据；随后串行重跑并保留 integration-1.log。
- 保留日志的图集成为 7/8。run-yD1QwD 在目录型目标确实触发 GRAPH_PATH_UNSAFE 后，测试 rm(空目录) 返回 ERR_FS_EISDIR。测试第 1 轮仅改用 rmdir（不改产品或预期），定向重跑 1/1 通过，累计 1 轮成功。后续 junction/硬链接与外部资料断言也执行完成。

### 独审

待固定候选后调用未参与实现的审查子代理；尚未创建 review.md，不自封通过。审查期间冻结产品、构建和既有输入，取得明确写入交还后保存原文及必要修复/复核。

### 未验证边界与作者验收

- 无 UI、教学 Skill 或内容呈现，作者体验不适用；机械通过不证明 AI 依赖语义完整或用户已理解。
- 非 Windows、NTFS 之外文件系统、单独启用大小写敏感的 Windows 目录未实测；无负载或任意规模承诺。
- 未实现多进程协调、恶意进程并发置换目录保护、断电恢复或跨提交更新。发布前原文复查降低意外覆盖，但不是并发锁。
- 强制终止可能留下只含图数据的临时文件；首次 link 发布后若清理失败，published=1 如实报告，目标与残留临时文件此时有硬链接关系，后续硬链接保护会拒读，须核对并明确清理返回的 temporary 后再操作。没有自动扫描/删除未知临时文件。

## 资源与交回

本次无服务、浏览器或产品安装。任务级 Node 与合成样例/日志保留在 .local/D009/ 供主脑复核，可按已提交 fixture 重建，不是唯一证据。独立 bare/普通非仓库回归的系统临时目录由原测试核边界后清理。

唯一 Git 写负责人为本执行；dev 仍 4d3186e，保留 D008 反馈提交 1e38e4c 与派单 c4010db。无远程配置，未合 dev、未动 master/main、未推送或发布。独审完成后更新当前结论和交回入口，不自动开始下一功能。
