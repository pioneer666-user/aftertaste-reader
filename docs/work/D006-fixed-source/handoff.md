# D006 · 固定提交取源回执

## 结果与入口

- 完成 D006 批准的固定提交取源用例、Git 适配器、正式 CLI、严格 TypeScript 工程配置、合成样例和测试。002 的需求、方案、数据模型、命令约定与实施清单已建立。
- 下一批唯一业务入口为 [FixedSourceService](../../../src/application/fixed-source.ts)，使用 `new FixedSourceService(new GitSourceRepository())` 组装。先 `pin(absoluteProjectRoot, revision?)`，再复用返回的固定引用调用 `read(fixed, projectRelativePath)`。
- 命令为 `node dist/cli/main.js pin/read`，完整输入、JSON 输出、稳定问题码及退出码见 [contracts](../../../specs/002-fixed-source/contracts/cli.md)，重建与调用见 [quickstart](../../../specs/002-fixed-source/quickstart.md)。
- 覆盖 08 的 R01、R02、R06、U101 及 A01 的底层取源部分。后续文档结构、教学、阅读页面继续按派单安排。

## 版本与验证

### 版本及正式流程

- dev 基线为 `a5c1fb7465ec8479f46c6b46bbd0bbc845025e8e`，批准任务为 `task.md@8d51ad849a281870967c0c4ef1f2a95d180b7aac`，实际接续 HEAD 为 `1afb7fd`，接单时工作区干净。
- 初始实现候选为 `cc824df1f9f0d049e3031bed20047c498f8a9957`（`feat: 实现D006固定提交取源与命令入口`）。独审后的行为修复另提交，修复候选和最终纯记录状态在下方记录。
- 按官方 speckit-specify、plan、tasks 完成本批完整流程，实际调用 resolve-template、setup-plan、setup-tasks 和 prerequisite 脚本。采用过程级 `SPECIFY_FEATURE_DIRECTORY=specs/002-fixed-source`，只读检查另加 `SPECIFY_FEATURE_NO_PERSIST=1`。本机 feature.json 为被忽略的功能定位状态。
- spec/plan/tasks 按官方必需栏目和关系维护，生成 research、data-model、contracts、quickstart 和 16 项需求质量检查。未发现扩展 hooks 配置。
- analyze 对真实材料只读核对，7 项 FR 和 4 项 SC 全部有任务覆盖，共 12 项任务，覆盖率 100%，歧义、重复、未映射任务及 Constitution 冲突均为 0。再经 implement 前置核验，需求质量检查 16/16，按清单串行实施。实施和后续修复保持同一 002 材料结构。

### 环境与依赖

- Windows 11 家庭版，Git `2.50.1.windows.1`，npm `11.6.4`。系统默认 Node 为 `22.23.2`，本批实际构建与最终测试使用任务级 Node `24.11.1`。
- npm 固定唯一根 package-lock。直接开发依赖为 TypeScript `5.9.3` 与 `@types/node` `24.10.1`，另有锁定的传递类型依赖 undici-types `7.16.0`。运行时仅 Node 标准库和本地 Git。
- TS 用于 strict/NodeNext 编译与声明输出，Node 类型支持目标主版本。测试采用 Node 自带 test/assert，Git 使用 child_process 参数数组，编码使用 TextDecoder，当前能力均可由标准库满足。
- 已授权的局部技术选择为必填绝对项目根、`/` 分隔规范文件路径、严格 UTF-8/BOM 保真、普通本地仓库及子项目。链接项目、linked worktree、子模块目标、bare 和 Git 元数据项目明确诊断。
- Git 选定 2.45+，每次调用带 `--no-lazy-fetch`，旧版无法识别时直接失败，防止忽略环境变量后自动获取对象。每个进程最多 30 秒、stdout 最多 64 MiB，超出返回 GIT_READ_FAILED。选择依据见 [research](../../../specs/002-fixed-source/research.md)。

### 实际命令和证据

在项目根执行。为 npm 子进程优先使用任务级 Node，当前进程临时将其 bin 加到 PATH。该 Node 由以下命令准备，无全局升级。

```powershell
$env:NODE_TLS_REJECT_UNAUTHORIZED='1'
npm.cmd exec --yes --package=node@24.11.1 --call 'node --version'
npm.cmd exec --yes --package=node@24.11.1 --call 'node -p process.execPath'
npm.cmd exec --yes --package=node@24.11.1 --call 'npm install --ignore-scripts'
```

已核 Node 输出 `v24.11.1`，执行文件位于本机 npm-cache 的任务工具缓存。安装及独立 `npm.cmd ci --ignore-scripts` 均成功，安装器报告 0 vulnerabilities。

```powershell
npm.cmd ci --ignore-scripts
npm.cmd run typecheck
npm.cmd run build
npm.cmd test
git diff --check
```

初始实现候选的 typecheck/build 和串行测试均通过，测试 12/12，通过耗时 75.7 秒。独立运行 quickstart 建库入口及真实 pin/read，样例为 `.local/D006-fixed-source/run-ouxjKI/`，A 为 `3eaa9ddc15a4a68ff492ad38e70f4d8ae8c17595`，子项目映射为 `packages/小 项目`，目标文本 38 字节且与预期完全一致，越界路径返回 INVALID_PATH、退出 2。空白检查与最终 Spec Kit 前置检查通过。测试的稳定证据为已提交的测试和合成建库入口，沙盒目录可重建，未以忽略目录日志作为唯一依据。

| 验证内容 | 实际结果 |
| --- | --- |
| 固定 A 后产生 B、修改工作区、删除源码、多文件读取 | 始终返回 A 和完整提交依据，默认 HEAD、历史及分叉均可固定 |
| 项目根/子项目，不同 cwd，中文/空格/方括号/美元符号/前导短横线路径 | 真实 CLI 与用例定位一致，按字面读取 |
| 空文件、Unicode、BOM、CRLF/LF/CR、末尾无换行、文本 U+FFFD | 返回字节与合成原文一致 |
| 越界、参数注入、错误引用、运行时错误类型和畸形 Unicode | 拒绝，参数问题退出 2，无 adapter 取源调用 |
| 链接/gitlink/目录、无效 UTF-8、UTF-16、二进制控制字节 | 对应 UNSUPPORTED_FILE_TYPE 或 UNSUPPORTED_ENCODING |
| 项目缺失、非仓库、无提交、无效版本、Git 不可用、Git 配置读取失败 | 诊断类别和退出状态符合约定 |
| 缺 commit 与缺 blob，配置可用的本地 promisor origin | 分别 OBJECT_UNAVAILABLE/GIT_READ_FAILED，不获取缺对象，调用前后仓库校验快照相同 |
| replace 与继承 GIT_DIR/WORK_TREE/TRACE/CONFIG 等干扰 | 仍取原固定对象，无 trace 文件产生 |
| 成功与失败前后只读核验 | 递归核对目标全部文件、目录、Git 对象/索引/配置/引用内容，前后相同 |
| SHA-256 仓库 | 固定 64 位提交并成功读取 |
| 构建后的真实 CLI | 成功 JSON 仅 stdout，诊断 JSON 仅 stderr，0/1/2 退出状态符合 contracts |

测试先观察缺产物/缺 CLI 的预期失败，再完成实现。实现中 GitResult 状态类型和 ES2024 的类型声明各经一轮调整后编译通过。bare 目标定位错误经一轮修复后通过。非仓库测试起初用了仓库内普通目录，核实该输入确属外层仓库后，改为卷根的只读定位检查。各问题均未达到两轮修复失败停点。

### 独立审查

未参与实现的 `/root/d006_review` 已按 Ponytail Review 和 Sharp Edges 审查候选 `cc824df1f9f0d049e3031bed20047c498f8a9957`，结论为需修复，首轮完整原文归 [review.md](review.md)。接受两项 P2 发现，分别为 CLI 前置路径校验/读取失败上下文，以及 Windows 无盘符根路径随 cwd 盘符改变目标。

修复复用 application 的项目/源码路径校验，CLI 在 locate 前校验，并汇合读取上下文。Windows 完整路径需含盘符或 UNC 根。新增两项真实 CLI 回归，在原候选构建产物上先观察 2/2 失败，再对修复构建运行。两项发现第 1 轮修复均验证通过。修复后的 typecheck/build 通过，全套 14/14、零跳过，耗时 77.7 秒。随后在 Windows 专项测试补充完整绝对路径从 C 盘和 D 盘 cwd 的 pin/read 成功断言，再定向运行两项回归 2/2 通过，耗时 7.4 秒。产品源码在这两次通过间相同。修复提交后交原审查者复核。

### 未验证项与限制

- Windows 为本次实际验证平台，其他操作系统未验证。
- 30 秒超时和 64 MiB 输出上限未做实际耗时/体量注入，Windows 权限拒绝场景未单独构造，UNC 共享上的实际 Git 仓库未测试。
- 合法 UTF-8 且符合控制字符规则的字节流按文本处理。支持边界按 contracts 判断，编码探测不作猜测。
- 真实用户项目、网页、教学效果和首版完整 A01 未验证。固定源码继续依赖原仓库对象可用。

## 作者验收与 Git

- 本批为底层能力，作者无需执行技术命令。作者体验验收不适用，页面和教学体验归后续批准任务。
- 唯一 Git 写负责人为本执行，分支继续为 `codex/feat-fixed-source`，按任务保留候选供主脑接回。最终工作区与提交状态在收尾补记。
- 本批范围无调整，无需新增 amendments。当前技术细化均在 D006 授权内，无新增产品取舍待作者决定。
