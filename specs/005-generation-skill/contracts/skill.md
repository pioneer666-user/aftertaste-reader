# Skill 调用契约

## 入口与能力

`skills/aftertaste-reader/SKILL.md`，名称 aftertaste-reader，默认允许宿主选择。当前实际能力为普通文件讲解新生成与项目教学资料维护。答疑可在聊天回应，讲解写回、重新分块、跨提交更新、闭环、网页及导出尚未接入。

新生成请求需要目标项目、范围、节奏及项目讲法。只询问缺项并等待，首次讲法选项及项目间边界见 [005 FR-012](../spec.md#functional-requirements)。提交可显式指定，否则在开始时 pin HEAD。参考文件相对包根解析，工具取显式加载的 Skill 所属安装包或开发树的 dist/cli/main.js，目标项目独立指定。

## 工具接口

沿 [002](../../002-fixed-source/contracts/cli.md)、[003](../../003-document-blocks/contracts/cli.md)、[004](../../004-dependency-graph/contracts/cli.md)。Skill 的 tools.md 给当前可运行调用方式、空 prefix 参数传递及结果判读。不新增 CLI 或 JSON 格式。

读取源码输出在 AI 上下文／内存消费，禁止 shell 重定向或临时源码落盘。文件枚举可用固定提交 Git 对象查询，完整 Git 路径由 prefix 与项目内路径拼成，按项目边界过滤。不得从工作区枚举后当作固定提交清单。

## 完成契约

先实际核 current 与图版本，再登记本批节点，逐篇 create → 填正文 → validate。随后提交明确使用者的完整依赖并 validate-graph。超大警告告知用户，空正文阻止将该篇计作完成，Git 或结构失败如实保留进度。已完成文档复用，DOCUMENT_EXISTS 按保护边界处理。

交付列实际文档入口、固定源码路径／提交／行范围、警告、未完成与未核对部分，方向每批检查。逐批交付后等待，连续生成在范围内继续。模板初始化与反馈维护沿 data-model，既有文档和版本冲突停止依赖写入。
## D057 Git 可见性调用

`project-privacy --project <绝对项目路径> --action <check|ignore|remember|forget>`。`check` 和 `ignore` 从 UTF-8 stdin 取 `docs/aftertaste/` 下的具体文件路径数组。返回 `result.files`，含项目及仓库相对路径和状态，`check` 同时返回本机许可是否覆盖。状态文件不可读取时无有效许可，`stateIssue` 可用于诊断。

`ignore` 仅追加未忽略文件的路径规则到本仓 `.git/info/exclude`，保留原规则并返回复查结果。调用方先取得授权。仍可见时由读者决定下一步。 `remember` 接收含 `path` 与 `status`（`unignored` 或 `tracked`）的数组，状态变化则拒绝保存。 `forget` 无需输入，清掉当前项目许可。Git 检查失败或状态写入失败返回 `PRIVACY_CHECK_FAILED`，参数错误返回 `INVALID_ARGUMENT`。调用顺序见[随包工具说明](../../../skills/aftertaste-reader/references/tools.md#project-privacy)。
