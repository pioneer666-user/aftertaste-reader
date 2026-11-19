# 正式测试与固定样例

本地文件阅读测试见 `unit/file-reader.test.mjs`、`integration/file-reader.test.mjs` 和 `browser/file-reader.mjs`。浏览器由构建后的真实 CLI 服务提供页面，依次验证 Edge、Chrome、Firefox，运行 `npm run test:browser`。`fixtures/reader-project.mjs` 重建 D010 合成讲解项目，运行资料在 `.local/D011/`。接口和场景见 [006 quickstart](../specs/006-file-reader/quickstart.md)。

文件依赖图测试为 `unit/dependency-graph.test.mjs` 和 `integration/dependency-graph.test.mjs`，覆盖局部替换、分析状态、512 种三节点有向图的性质、真实 Git/CLI、固定版本与存储失败。`fixtures/dependency-graph.mjs --demo` 输出每步实际退出状态，样例归 `.local/D009/run-*`；入口见 [004 quickstart](../specs/004-dependency-graph/quickstart.md)。

单篇文档测试为 `unit/document-blocks.test.mjs` 和 `integration/document-blocks.test.mjs`，覆盖 CommonMark 上下文、格式/范围/Unicode 边界、性质、路径、只读校验及写失败。`fixtures/document-blocks.mjs --demo` 调用真实 CLI 走通固定 A、生成、填写、校验、修改 HEAD/工作区后再校验，运行样例位于 `.local/D008/run-*`。入口见 [003 quickstart](../specs/003-document-blocks/quickstart.md)。

固定提交取源测试见 `unit/fixed-source.test.mjs`、`integration/fixed-source.test.mjs`，合成建库入口为 `fixtures/fixed-source.mjs`。先 `npm run build` 再 `npm test`，文件串行执行，本批临时仓库位于 `.local/D007/run-*`。独立 bare/普通非仓库在系统临时目录建立，先核无外层普通工作仓库，输出绝对路径并在测试结束清理。D007 回归覆盖提交身份、历史子项目、映射边界、共用入口与平台路径。后续按受影响能力建立 e2e、skills 等测试，定义见[目录规范](../docs/development/directories.md)，选择与证据要求见[验证约定](../docs/development/verification.md)。

fixtures 保留必要的合成输入和重建脚本；临时仓库、浏览器产物、实际日志不写回 fixtures。Skill 行为用例验证实际操作和产物，不用关键词命中替代行为结论。稳定的实验用例经正式实现任务接纳后放这里，仍引用实验来源。

## 页面改版共用试读

[打开本机试读](http://127.0.0.1:4341/)。各批页面候选使用同一目标项目 `.local/2026-11-19-page-preview/project`。它有四篇讲解、订单依赖图（含分组与库图例）、订单和路径工具两条闭环。两条书签、三条带批注的理解标记和两篇笔记的初始内容在 [page-preview](fixtures/page-preview/)。

D022 浏览器回归在构建后运行 `node tests/browser/reader-navigation.mjs`。脚本在 `.local/D022/` 中重建试读资料，使用独立端口验证收栏、目录跳转、同名路径、块名回退、窄屏键盘操作和精确回访。默认使用 Edge，可用进程级 `AFTERTASTE_BROWSER` 依次指定 `chrome` 或 `firefox`。相关的 `file-reader.mjs`、`bookmarks.mjs`、`understanding-marks.mjs` 和 `notes.mjs` 可用 `AFTERTASTE_TEST_TASK=D022` 将样例和报告归到同一任务目录。

可从标注的「不理解」回到数量校验块，同时看到该块的收藏理由。笔记《数量无效时，订单去哪了？》的两个链接分别跳到规则文件和订单服务。两张图可用「订单数量校验怎样决定集合会不会改变」这条闭环对照查看。

**每批换页面时**，使用该批已构建的 CLI，交接时核对监听进程与项目目录，重开此专用服务并刷新页面。资料目录跨批沿用，读者改过的笔记、书签、批注及个人排布会保留。在本机仓库根用 PowerShell 启动当前构建的命令如下，看到 `"status":"ready"` 即可打开上方链接。

```powershell
& '.local/D009/runtime/node.exe' dist/cli/main.js serve --project '.local/2026-11-19-page-preview/project' --port 4341
```

**首次建立新副本时**，使用 Node 24 和已有构建。下面命令在空的新目录运行一次。其他机器可把本机 Node 路径换成自己的 Node 24。

```powershell
$trialHome = '.local/2026-11-19-page-preview'
if (Test-Path -LiteralPath $trialHome) { throw '此处已有试读资料。请沿用原项目，或为新副本另选目录。' }
New-Item -ItemType Directory -Path $trialHome | Out-Null
$trialProject = Join-Path $trialHome 'project'
& '.local/D009/runtime/node.exe' tests/fixtures/loop-reader.mjs $trialProject
if ($LASTEXITCODE -ne 0) { throw '样例构建未完成，请先核对输出。' }
Get-ChildItem -LiteralPath 'tests/fixtures/page-preview' -Filter '*.json' | ForEach-Object {
    [IO.File]::Copy($_.FullName, (Join-Path $trialProject ('docs/aftertaste/' + $_.Name)), $false)
}
```
