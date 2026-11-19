# D017 · 独立审查原文

## R1 · 2026-11-19

**结论：需修复。** 从首次 `pin` 开始，固定树枚举、大文件正文读回和受控失败均通过实测。已有固定映射时，顺序运行公开示例会重新 `pin`。HEAD 移动后，示例会列出并读回另一提交的文件。

### 审查对象与依据

- 批准任务为 [D017](task.md) @ `65e199f4efea12edff85d61d8689b7f44598c32f`，无有效调整。比较基线为 `dev@58402cbdea3efd0dc1f9b4c7ffc40f674d3f8b06`，冻结候选为 `codex/fix-skill-fixed-source@641fe20054b2d94ebc0b6971152bcf474f11b744`。基线至候选包含任务单及索引，批准提交之后的实现只涉及 Skill 的工具参考、分批生成入口及新增回归。
- 沿产品 Skill 入口、分批生成、工具示例、正式 CLI、固定取源用例和 Git 适配器检查。预期来自现行 R01、005 FR-002／FR-008、002 CLI 契约及 D010 S02／S06。采用 Ponytail Review 及 writing-for-agents 的真实调用与操作步骤检查方法。[现行规格](../../../../../specs/001-first-release/08-current-spec-and-acceptance.md) · [005](../../../../../specs/005-generation-skill/spec.md) · [002 CLI](../../../../../specs/002-fixed-source/contracts/cli.md) · [D010](../D010-generation-skill/task.md)
- 查看了执行方提供的 Skill 示例、静态链接、合成试读和取源回归日志。下列结果为本轮独立运行所得。

### 独立实测

Windows build 26200，Node `24.22.3`，Git `2.50.1.windows.1`。从非目标项目 cwd 串行运行候选的回归。回归直接提取正式 `tools.md` 的三段 JavaScript，提供声明的输入和观察点，实际调用开发树 `dist/cli/main.js` 与 Git。

```powershell
$Node24 = (Get-Command node -All | Select-Object -Last 1).Source
$repo = (Get-Location).Path
$test = Join-Path $repo 'tests/skills/fixed-source-example.test.mjs'
Set-Location -LiteralPath (Join-Path $repo '.local/D017')
& $Node24 --test --test-concurrency=1 --test-reporter=tap $test
```

- 回归 4/4 通过。单独设置 `git replace A B` 时，旧列树调用出现 B 的完整路径集合。撤掉替换后，单独令宿主 `GIT_DIR` 指向另一合成仓库，旧调用退出 `128`。两种条件下，新示例均只返回固定提交 A 的完整路径集合。根项目返回 `根 A.txt`、`包 空间/子 项目/唯 一 A.txt`、`包 空间/子 项目/较大 文件.txt` 及 `包 空间/子 项目-相邻/邻居.txt`。子项目只返回 `唯 一 A.txt` 与 `较大 文件.txt`，两种条件下选中的普通 UTF-8 文件均逐字读回 A 的正文。
- 所选大文件正文为 `792000` B，CLI JSON 为 `1152526` B。正文逐字相同，`path`、`repositoryPath` 与 `commit` 均匹配，正文 SHA-256 为 `528e36a6b4f94c566dba965eefca03660a1fd8b13d0b42f995e35196b5067d6d`。审读确认适配器接受的 UTF-8 正文里，需要 JSON 转义的字符至多占原字节数两倍，路径和固定映射另计，余量覆盖响应外壳。强制将接收上限降到 1 MiB 返回 `ENOBUFS`，错误对象无输出流或原始异常。读取 A 中缺失的 B 独有路径返回状态 `1` 和 `FILE_NOT_FOUND`，错误对象无输出流。
- `git diff --check 58402cbdea3efd0dc1f9b4c7ffc40f674d3f8b06 641fe20054b2d94ebc0b6971152bcf474f11b744` 通过。[回归原件](../../../../../tests/skills/fixed-source-example.test.mjs)

### 审查发现

1. **P2 · 已有固定映射时，公开步骤会重新固定 HEAD**（`skills/aftertaste-reader/references/tools.md:11,39`）。
   - **预期**：已有有效的 `fixed` 时，枚举和读取继续使用原映射，即使 HEAD 已变化。D017 的目标从已固定的项目和提交开始，分批生成第 1 节也明确要求保留完整映射。
   - **复现与实际**：在本轮合成子项目中，用 `node --input-type=module -` 执行从 `tools.md` 提取的原代码块，先以 `revision='HEAD^'` 运行第一段，保留提交 A `58271f72682565503103a91ccd0148eb62c484a0` 的 `fixed`。随后在能访问该映射的新执行上下文按顺序运行公开三段，按示例默认传 `revision='HEAD'`。第一段实际执行 `runCli(['pin', '--project', projectRoot, '--revision', revision])`，得到 B `ac12fd2a72456e170c7372af1c4111863f3a2d88`，列出 `唯 一 B.txt` 与 `较大 文件.txt`，并读回 B 独有的 `唯 一 B.txt`。将已有的 `fixed` 直接作为同一作用域的输入，示例则因重复声明 `fixed` 抛出 `SyntaxError`。补验只记录提交和路径。
   - **影响与建议**：讲解 AI 照抄示例续跑时，可能分析未经用户确认的提交。示例应显式接收既有映射，只在缺少映射时调用 `pin`，并补验已有 A 映射、HEAD 为 B 时仍列出完整 A 文件集、读回 A 的正文。[工具参考](../../../../../skills/aftertaste-reader/references/tools.md) · [分批生成](../../../../../skills/aftertaste-reader/references/generation.md)

### 未验证项与写入交还

- 本轮实测用超过默认接收上限的小样例覆盖 JSON 转义，未实跑 64 MiB 上限。未复跑全套测试，未检查其他平台、宿主自动发现、安装发布、浏览器或作者真实项目的讲解体验。
- 审查前后 HEAD 均为冻结候选，跟踪工作树干净。Skill 入口、受影响参考、测试及 fixture、批准任务、CLI 契约及三个相关构建文件的 SHA-256 一致。合成样例的 A／B 提交保持一致，测试设置的替换引用已撤除，子进程均结束。未启动服务或浏览器，未操作 D016 服务。自动执行策略拒绝了本轮合成样例的目录清理命令，样例留在 `.local/D017/example-csVsUN` 供复核。
- **采集结束，可以恢复写入。** 本轮结论限于上述候选与范围。作者体验、合并和发布由各自流程确认。[写入交还规则](../../../../development/workflow.md#review-handoff)

## R2 · 2026-11-19

**结论：通过。** R1 的 P2 已关闭。已有固定映射时，公开示例会复用该映射，即使 HEAD 已移动。首次固定、Git 隔离、完整正文读回及失败诊断均通过复验。

### 复核对象与验证

- 批准依据仍为 [D017](task.md) @ `65e199f4efea12edff85d61d8689b7f44598c32f`，无有效调整。新冻结候选为 `codex/fix-skill-fixed-source@4544cacca9fc305b4ebd1b2b3b4f91221976c10f`，对比 R1 候选 `641fe20054b2d94ebc0b6971152bcf474f11b744`。差异包含 R1 原文、工具示例的 `previousFixed` 输入与首次固定分支，以及续跑回归。`git diff --check` 通过。
- 示例说明明确将接续批次的四字段映射作为 `previousFixed` 传入。该值存在时，代码直接使用原映射；缺省时才按指定版本或 `HEAD` 调用 `pin`。[工具参考](../../../../../skills/aftertaste-reader/references/tools.md)

本轮在 Windows build 26200、Node `24.22.3`、Git `2.50.1.windows.1` 环境中，从非目标项目 cwd 独立串行执行。回归提取最终公开说明的三个 JavaScript 代码块，实际调用开发树 CLI 和 Git，结果 5/5 通过。

```powershell
$Node24 = (Get-Command node -All | Select-Object -Last 1).Source
$repo = (Get-Location).Path
$test = Join-Path $repo 'tests/skills/fixed-source-example.test.mjs'
Set-Location -LiteralPath (Join-Path $repo '.local/D017')
& $Node24 --test --test-concurrency=1 --test-reporter=tap $test
```

- **R1 关闭依据**。先指定提交 A `9a928d5c65da8e441fccad10b67c81d6aec72784` 取得固定映射。HEAD 为 B `971969dc44c48aa89b478e981511d89880bbff0c` 时，新上下文无映射且缺省版本的首次调用固定 B。另一个新上下文传入 A 的映射后，四字段与原映射一致，子项目完整路径集为 `唯 一 A.txt`、`较大 文件.txt`，选中的 `唯 一 A.txt` 返回提交 A 和逐字一致的正文。
- **固定树枚举复验**。分别开启 `git replace A B` 和将宿主 `GIT_DIR` 指到独立仓库。两种干扰下均验证根项目及带空格和中文的子项目完整路径集，子项目排除名称前缀相似的相邻目录，选中文件逐字读回 A 的正文。
- **完整读回及失败复验**。`792000` B 正文经 CLI 编码为 `1152526` B JSON，解析后的项目相对路径、仓库相对路径、提交和完整正文均匹配。正文 SHA-256 为 `528e36a6b4f94c566dba965eefca03660a1fd8b13d0b42f995e35196b5067d6d`。受控接收超限返回 `ENOBUFS`，读取 A 中缺失的文件返回状态 `1` 和 `FILE_NOT_FOUND`。两种错误均未附原始输出流。[行为回归](../../../../../tests/skills/fixed-source-example.test.mjs)

### 未验证项与写入交还

- 未实跑 64 MiB 边界、全套测试、其他平台、宿主自动发现、安装发布和浏览器。作者真实项目的讲解体验仍待作者验收。
- 复核前后 HEAD 均为 `4544cacca9fc305b4ebd1b2b3b4f91221976c10f`，跟踪工作树干净。批准任务、CLI 契约、Skill 入口及相关参考、测试与 fixture、三个相关构建文件的 SHA-256 前后一致。独立合成样例保留于 `.local/D017/example-IAe6Gm`，A／B 提交与测试记录一致，样例工作树干净，替换引用已撤除。子进程均已结束。未启动服务或浏览器，未操作 D016 服务。
- **采集结束，可以恢复写入。** 本轮结论限于该候选及上述复核范围。作者体验、合并与发布由各自流程确认。[写入交还规则](../../../../development/workflow.md#review-handoff)
