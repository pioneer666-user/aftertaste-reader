# 当前开发树工具

首次调用前读取本页。运行需要 Node.js 24 LTS 与本地 Git 2.45+。当前交付使用已构建开发树，安装／发布路径待交付任务验证。

## 定位与参数传递

从实际读取到的 `SKILL.md` 父目录得到 skillRoot，当前开发树 toolRoot 是 `skillRoot/../..` 的绝对路径，CLI 是 `toolRoot/dist/cli/main.js`。核 package.json 和入口实际存在。缺构建时报告并按开发使用说明准备，勿从 cwd 猜工具位置。

projectRoot 是用户目标项目绝对路径。pin 给 repositoryRoot、projectPrefix、commit，四项形成 fixed。子项目的 prefix 是 Git 仓库内前缀，根项目为空字符串。工具参数独立传 argv，特别是空 prefix 使用 Node child_process 的数组传递，避免 PowerShell 吞掉空参数或 JSON 引号。

以下是可在宿主 JavaScript 中使用的调用形状，cli 与 projectRoot 须先解析为实际绝对路径。使用宿主已选择的 Node 24。源码输出仅在内存消费，调用日志只记动作、定位及诊断，执行终端应关闭 transcript／输出落盘。

```javascript
const { execFileSync } = await import('node:child_process');
const result = JSON.parse(execFileSync(process.execPath,
  [cli, 'pin', '--project', projectRoot],
  { encoding: 'utf8', windowsHide: true }));
const fixed = result.source;
const mapping = ['--project', fixed.projectRoot,
  '--repository', fixed.repositoryRoot, '--prefix', fixed.projectPrefix];
const sourceArgs = [...mapping, '--commit', fixed.commit];
// 读取结果在内存中交 AI 分析，禁止重定向到文件。
const source = JSON.parse(execFileSync(process.execPath,
  [cli, 'read', ...sourceArgs, '--path', sourcePath],
  { encoding: 'utf8', windowsHide: true }));
```

跨工具调用可在有效上下文复用 fixed，保留四字段。子进程失败时捕获 status/stdout/stderr，解析 JSON 诊断后报告，避免打印可能带源码的异常对象。

## 固定文件枚举

现有 CLI 没有 list 命令。可用 Git 的只读对象查询，用 argv 调用 `git --no-pager --no-lazy-fetch -C repositoryRoot ls-tree -r -z --name-only fixed.commit`。在内存按 NUL 分割，严格筛出 projectPrefix 下的项目路径，再按用户范围选择。空前缀表示仓库根。对选择的文件用 read 核普通文件与 UTF-8 支持，选取和分块均依固定树。

Git 查询失败时保留真实状态，read 会核完整提交身份与项目映射。工作区 glob、HEAD 搜索和源码临时副本无法充当固定树清单。

## 已有命令

下列 args 都交上述 Node argv 调用。命令无交互帮助页，以这里的参数和实际 JSON 为准。

| 命令 | args 与判断 |
| --- | --- |
| pin | `pin --project projectRoot`，可加 `--revision 本地提交`。只在开始时解析目标，返回 source 完整映射 |
| read | `read` + sourceArgs + `--path 项目相对路径`。file.content 是运行时源码，返回值没有行数字段。分块在内存中按物理行核对，LF／CRLF／CR 均为行终止符，末尾终止符不额外计行，空串为零行 |
| create-document | `create-document` + sourceArgs + `--path 路径 --blocks JSON.stringify(有序清单)`。返回 generated 和 result，初始为空正文 |
| validate-document | `validate-document` + mapping + `--document docs/aftertaste/current/源码路径.md`。提交由文档头读取，本命令没有 --commit |
| apply-graph | `apply-graph` + sourceArgs + `--input 输入JSON绝对路径`。输入文件仅保存路径、状态和原因，不含源码 |
| query-graph | `query-graph` + sourceArgs + `--path 项目相对路径`。查询已有局部与状态，缺图报 GRAPH_NOT_FOUND |
| validate-graph | `validate-graph` + sourceArgs。缺图报错，校验读取无写入 |

图输入使用当前格式，以下路径仅为合成示意，实际必须核固定源码。

```json
{
  "format": "aftertaste-dependency-update/v1",
  "register": ["src/service.mjs"],
  "reviews": [{
    "path": "src/service.mjs",
    "analysis": "reviewed",
    "dependencies": [{"path": "src/rules.mjs", "reason": "使用输入校验约定"}]
  }]
}
```

先登记阶段只传 format/register。依赖提交阶段明确每个使用者的完整结果。新引用的项目文件由工具登记，边方向是 dependency → dependent。输入文件放本次可重建工具输入位置，用完可清理自己创建的文件。

## 结果和诊断

成功 stdout 为一行 JSON，stderr 空，退出 0。操作／输入失败通常 stdout 空、stderr 为 `{ok:false,error}`，参数错误退出 2，其余退出 1。文档或图校验可完成但不合法时 stdout 返回 `{ok:false,result}` 并退出 1，因此同时检查两个流和退出码。

文档成功要读 mechanicallyValid、sourceCheck、contentStatus 及 diagnostics，教学质量仍为 unchecked。图要读 mechanicallyValid、sourceCheck 和节点 analysis。保留 SOURCE_TOO_LARGE、EXPLANATION_TOO_LARGE 告知，EXPLANATION_EMPTY 继续填。

DOCUMENT_EXISTS 保留原文，按生成流程确认本次骨架归属。GRAPH_VERSION_MISMATCH 停止版本相关写入。GRAPH_CHANGED 重新读真实图后判断，勿盲重试。DOCUMENT_PATH_UNSAFE／GRAPH_PATH_UNSAFE 和其他失败带定位给用户，保留原资料。Git 错误不能自动修仓库、取新 HEAD 或换工作区。

参数、路径或工具实现疑问可在当前 toolRoot 读 `src/cli/main.ts`、`src/application/` 和对应 adapters/core。源码读取问题沿固定来源诊断，检查工具代码也保留当前范围和资料保护。
