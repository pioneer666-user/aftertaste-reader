# 调用回味工具

首次调用前读取本页。运行需要 Node.js 24 LTS 与本地 Git 2.45+。

## 定位与参数传递

从实际读取到的 `SKILL.md` 父目录得到 skillRoot。在 npm 安装包和已构建开发树中，toolRoot 都是 `skillRoot/../..` 的绝对路径，CLI 都在 `toolRoot/dist/cli/main.js`。核实 toolRoot 的 `package.json` 名为 `aftertaste-reader`，并检查 CLI 入口存在。安装路径缺文件时请读者核对安装位置及安装包，开发树缺文件时先构建。以实际 Skill 路径为准，避免调用 cwd 或 PATH 中的同名工具。

projectRoot 是用户目标项目绝对路径。pin 给 repositoryRoot、projectPrefix、commit，四项形成 fixed。子项目的 prefix 是 Git 仓库内前缀，根项目为空字符串。工具参数独立传 argv，特别是空 prefix 使用 Node child_process 的数组传递，避免 PowerShell 吞掉空参数或 JSON 引号。

在一个 Node 24 JavaScript 执行上下文中依次运行以下片段。先提供实际绝对路径 `cli`、`projectRoot`，以及本地版本 `revision`（缺省传 `undefined`，首次固定时使用 `'HEAD'`）。接续本批时，将已保存的 `fixed` 四字段作为 `previousFixed` 传入。首次固定时，`previousFixed` 传 `undefined`。源码正文仅在内存中消费，执行终端应关闭 transcript／输出落盘。

```javascript
const { spawnSync } = await import('node:child_process');
const gitMaxBuffer = 64 * 1024 * 1024;

function receive(operation, program, args, options) {
  const result = spawnSync(program, args, { encoding: 'utf8', windowsHide: true, ...options });
  if (result.error || result.signal) {
    throw Object.assign(new Error(`${operation} 未收到完整输出。`), {
      status: result.status, signal: result.signal, code: result.error?.code,
    });
  }
  return result;
}

function parseCliOutput(text) {
  try { return JSON.parse(text); } catch { return undefined; } // 解析异常可能包含输出原文。
}

function runSourceCli(args, maxBuffer = gitMaxBuffer) {
  const [operation] = args;
  const { status, stdout, stderr } = receive(operation, process.execPath, [cli, ...args], { maxBuffer });
  const response = parseCliOutput(status === 0 ? stdout : stderr);
  if (status === 0 && response?.ok === true) return response;
  throw Object.assign(new Error(`${operation} 调用失败。`), {
    status, code: response?.error?.code ?? (status === 0 ? 'INVALID_RESPONSE' : 'CLI_FAILED'),
    reason: response?.error?.context?.reason,
  });
}

const fixed = previousFixed ?? runSourceCli(['pin', '--project', projectRoot, '--revision', revision ?? 'HEAD']).source;
const mapping = ['--project', fixed.projectRoot,
  '--repository', fixed.repositoryRoot, '--prefix', fixed.projectPrefix];
const sourceArgs = [...mapping, '--commit', fixed.commit];
```

跨工具调用保留 `fixed` 四字段。失败时报告动作及已知定位（仓库、提交、文件），附 `status`、`signal`、`code` 或 `reason` 中可取得的诊断。丢弃中断或超限的输出，避免打印原始输出、解析异常或子进程异常对象。

## 固定文件枚举

从 `fixed.repositoryRoot` 查询 `fixed.commit`。本例沿用固定取源的 Git 环境规则，剔除继承的 `GIT_*` 配置，关闭对象替换和自动取源。用 NUL 分隔保留字面路径，按完整的 `projectPrefix/` 边界得到项目相对路径。根项目的前缀为空。

```javascript
const { isUtf8 } = await import('node:buffer');
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith('GIT_')));
const { status, stdout } = receive('列固定树', 'git', [
  '--no-lazy-fetch', '--no-optional-locks', '--no-replace-objects', '--literal-pathspecs',
  '-c', 'core.fsmonitor=false', '-C', fixed.repositoryRoot,
  'ls-tree', '-r', '-z', '--name-only', fixed.commit,
], {
  env: { ...env, GIT_NO_LAZY_FETCH: '1', GIT_TERMINAL_PROMPT: '0',
    GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null' },
  encoding: 'buffer', maxBuffer: gitMaxBuffer, timeout: 30_000,
});
if (status !== 0) throw Object.assign(new Error('Git 无法列出固定树。'), { status, code: 'GIT_READ_FAILED' });

const prefix = fixed.projectPrefix ? `${fixed.projectPrefix}/` : '';
const paths = [];
for (let start = 0; start < stdout.length;) {
  const end = stdout.indexOf(0, start);
  if (end === -1) throw new Error('固定树清单缺少 NUL 结尾。');
  const bytes = stdout.subarray(start, end);
  start = end + 1;
  if (!isUtf8(bytes)) continue;
  const name = bytes.toString('utf8');
  if (name.startsWith(prefix)) paths.push(name.slice(prefix.length));
}
```

## 读回选定文件

按用户范围从 `paths` 选出 `sourcePath`，保留该项目相对路径原样。`read` 核对提交、项目映射、路径、普通文件及 UTF-8 正文。选取和分块都依据这棵固定树。

Git 单次原始输出上限是 64 MiB。受支持的 UTF-8 正文中，换行、回车、制表符、引号及反斜杠经 JSON 转义最多占原字节数的两倍，其余正文保持原字节数。接收上限取两倍 Git 上限，加上 JSON 编码后的路径与固定映射字节数，再加 1 KiB 给其余字段和 JSON 外壳。

```javascript
const metadata = { ...fixed, path: sourcePath, repositoryPath: prefix + sourcePath };
const maxBuffer = 2 * gitMaxBuffer + Buffer.byteLength(JSON.stringify(metadata)) + 1024;
const { file } = runSourceCli(['read', ...sourceArgs, '--path', sourcePath], maxBuffer);
```

在内存中分析 `file.content`。接收失败时沿用上面的诊断方式，取得完整成功结果后再继续分块。

## 已有命令

每个参数独立传入 argv。`runSourceCli` 专用于 `pin` 和 `read`。调用表中的两条校验命令时，按[读取校验结果](#读取校验结果)处理。

| 命令 | args 与判断 |
| --- | --- |
| pin | `pin --project projectRoot`，可加 `--revision 本地提交`。只在开始时解析目标，返回 source 完整映射 |
| read | `read` + sourceArgs + `--path 项目相对路径`。file.content 是运行时源码，返回值没有行数字段。分块在内存中按物理行核对，LF／CRLF／CR 均为行终止符，末尾终止符不额外计行，空串为零行 |
| create-document | `create-document` + sourceArgs + `--path 路径 --blocks JSON.stringify(有序清单)`。返回 generated 和 result，初始为空正文 |
| validate-document | `validate-document` + mapping + `--document docs/aftertaste/current/源码路径.md`。提交由文档头读取，本命令没有 --commit |
| apply-graph | `apply-graph` + sourceArgs + `--input 输入JSON绝对路径`。可维护文件依赖及本图的库图例，输入按源码引用规则准备 |
| query-graph | `query-graph` + sourceArgs + `--path 项目相对路径`。查询已有局部与状态，缺图报 GRAPH_NOT_FOUND |
| query-legends | `query-legends` + sourceArgs，可加 `--id 图例ID`。只读查询本图图例和使用文件，缺图报 GRAPH_NOT_FOUND |
| validate-graph | `validate-graph` + sourceArgs。缺图报错，校验读取无写入 |
| serve | `serve --project projectRoot`，可加 `--port 端口`。提供本地阅读页，允许摆放图中对象并保存布局，stdout 的 ready.url 为入口，终端 Ctrl+C 关闭。源码使用各文档头提交 |

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

## 库图例

```json
{
  "format": "aftertaste-dependency-update/v1",
  "legendUpserts": [{
    "id": "node-path",
    "kind": "standard",
    "name": "node:path",
    "description": "提供与平台相适配的路径拼接和解析。",
    "uses": [{"path": "src/reader.mjs", "reason": "构造讲解资料的镜像路径。"}]
  }]
}
```

首次登记给出稳定 ID、类别、名称与介绍。ID 由 1—80 个小写字母、数字、点、下划线或连字符组成，首字符为字母或数字。类别为 standard 或 third-party。后续更新只提交 ID 和有变化的字段。uses 一旦提供就替换该图例所有使用关系，空数组可清空。路径必须已在合并后的图中登记，每个文件最多一条使用关系。用 `legendRemove: ["node-path"]` 正式移除图例，由画布协调清理它的布局。query-legends 查看实例，validate-graph 校验结构与端点。读者在网页可查看和摆放，内容变更由工具提交。

## 闭环

用户选定路线后，使用 `create-loop` + sourceArgs + `--id 闭环ID --input UTF-8输入文件绝对路径`。成品路径在 result.path。布置节点及讲解时可参考以下最小合成输入。

```json
{
  "format": "aftertaste-loop-input/v1",
  "title": "服务如何校验数量",
  "goal": "理解创建服务怎样把数量交给规则",
  "explanation": "服务收到输入后先调用数量规则。规则正常返回整数后，服务才继续。",
  "entry": "receive",
  "nodes": [
    {"id": "receive", "path": "src/service.mjs", "block_id": "m3vuiqzi", "title": "服务收到输入", "explanation": "服务取出数量作为规则的输入。"},
    {"id": "check", "path": "src/rules.mjs", "block_id": "x4y6az2y", "title": "规则检查数量", "explanation": "规则返回有效整数或抛出异常。"}
  ],
  "edges": [{"from": "receive", "to": "check", "reason": "调用把原始数量传给校验函数。"}],
  "reading_order": ["receive", "check"]
}
```

闭环和节点 ID 最多 64 字符，使用小写字母、数字和分隔用的单连字符，闭环 ID 避开 Windows 设备名。路线至少涉及两个源码文件，所有节点可从入口沿边到达，推荐顺序覆盖每个节点一次。填写实际已讲解的文件与块 ID，节点可附 `hint`。有实际使用的库图例时加 `"legends": [{"id": "node-path", "paths": ["src/reader.mjs"]}]`，列出路线中选用该图例的文件。块讲解、行范围和图例正文由工具取得。

用 `read-loop --project projectRoot --id 闭环ID` 读回 JSON。result.loop 是独立成品，result.sources 含本次取出的源码行，只在内存查看。给读者一份文本可用 `--format markdown` 输出讲解、关系、图例及源码引用。源码部分缺失时，工具仍会交回讲解，result.sourceCheck 为 unavailable，result.mechanicallyValid 为 false，并给出各失败引用。

`LOOP_BLOCK_INVALID` 定位需核对的现有块，`LOOP_LEGEND_INVALID` 定位所选图例及用法，`LOOP_INPUT_INVALID` 定位输入字段。已占用的 ID 返回 `LOOP_EXISTS`，可以重读原成果。保存失败后先核对诊断和成品是否可读，确认尚未发布再重试。

## 读取校验结果

沿用上文的 `cli`、`receive` 和 `parseCliOutput`。逐篇校验时调用 `runValidation(['validate-document', ...mapping, '--document', documentPath])`，其中 `documentPath` 是项目相对讲解路径。收尾时调用 `runValidation(['validate-graph', ...sourceArgs])`。

```javascript
function runValidation(args) {
  const [operation] = args;
  const { status, stdout, stderr } = receive(operation, process.execPath, [cli, ...args], { maxBuffer: gitMaxBuffer });
  const response = parseCliOutput(stdout || stderr);
  if (stdout && typeof response?.ok === 'boolean' && response.result?.mechanicallyValid === response.ok
      && status === (response.ok ? 0 : 1)) {
    return response.result;
  }
  const error = response?.error;
  throw Object.assign(new Error(error?.message ?? `${operation} 未取得校验结果。`), {
    status, code: error?.code ?? 'INVALID_RESPONSE', context: error?.context,
    nextStep: error?.nextStep, diagnostics: error?.diagnostics,
  });
}
```

返回结果后先看 `mechanicallyValid` 和 `sourceCheck`。校验未通过时，按 `diagnostics` 中的文档路径、块 ID、行号或图字段定位，取源原因见 `sourceError` 或图诊断的 `params.sourceCode`。仅摘取所需诊断；文档结果的 `raw` 含整篇讲解。

## 结果和诊断

默认成功 stdout 为一行 JSON，stderr 空，退出 0。闭环的 Markdown 模式输出多行讲解。操作／输入失败通常 stdout 空、stderr 为 `{ok:false,error}`，参数错误退出 2，其余退出 1。文档或图校验可完成但不合法时 stdout 返回 `{ok:false,result}` 并退出 1，因此同时检查两个流和退出码。

文档成功要读 mechanicallyValid、sourceCheck、contentStatus 及 diagnostics，教学质量仍为 unchecked。图要读 mechanicallyValid、sourceCheck 和节点 analysis。保留 SOURCE_TOO_LARGE、EXPLANATION_TOO_LARGE 告知，EXPLANATION_EMPTY 继续填。

DOCUMENT_EXISTS 保留原文，按生成流程确认本次骨架归属。GRAPH_VERSION_MISMATCH 停止版本相关写入。GRAPH_CHANGED 重新读真实图后判断，勿盲重试。DOCUMENT_PATH_UNSAFE／GRAPH_PATH_UNSAFE 和其他失败带定位给用户，保留原资料。Git 错误不能自动修仓库、取新 HEAD 或换工作区。

参数、路径或工具实现疑问可在当前 toolRoot 读 `dist/cli/main.js`、`dist/application/` 和对应 adapters/core。源码读取问题沿固定来源诊断，检查工具代码也保留当前范围和资料保护。

<a id="revise-current"></a>
## 同提交修订

使用 Node argv 独立传参，UTF-8 stdin 只传替换正文。先从已核对的目标 current 读取 Buffer，`createHash('sha256').update(buffer).digest('hex')` 得到 expected。对同一 Buffer 解码并形成候选，保留标题和需要保留的段落，按磁盘原文的编码计算摘要。

| 命令 | 目标参数 | stdin |
| --- | --- | --- |
| revise-document | --document 项目相对镜像路径 --block 块ID | 该块完整的新 Markdown 正文 |
| revise-document | --document 项目相对镜像路径 --blocks 原序相邻旧ID逗号列表 | 完整替换这些块的顶层标记、正文与结束符；结果各用未用过的随机八位小写字母数字 ID，连续覆盖原范围 |
| revise-step | --id 闭环ID --step 步骤ID --field explanation 或 hint | 对应字段完整的新 Markdown |

三者均另传 `--project` 绝对项目、`--commit` 成品完整固定提交和 `--expected` 原文摘要。调用示意：

```javascript
const result = receive('revise-step', process.execPath, [cli, 'revise-step',
  '--project', projectRoot, '--id', loopId, '--step', stepId, '--field', field,
  '--commit', commit, '--expected', expected], { input: revisedMarkdown });
```

核退出码和 JSON。校验或内容冲突失败保住原件；锁冲突先核是否有进行中的修订。读回失败须报告已尝试发布、重查当前成品。原始 read-loop 响应不能当写回输入。
