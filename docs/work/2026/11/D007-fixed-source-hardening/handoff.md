# D007 · 固定取源加固回执

## 当前结论与入口

- 执行中，批准为 [task.md](task.md)@05daca6，接续分支 `codex/fix-fixed-source-hardening`，初始 HEAD 为 `05daca6f463a8cd0ab8a2e04c7e8640b8c6d0ad3`，比较 dev 基线 `4ecb7ca36a68ae1909fec0ad52937b38b006107c`。接单时工作区干净，无有效调整文件。
- 已完成 H01—H05 修复、002 正式材料增量及自测。typecheck/build 成功，完整串行测试 22/22、零跳过。正在固定成果候选供独立审查，独审结论待回。
- 本次技术选择为 CLI 增加成对 `--repository`/`--prefix`，传回 pin 已有字段以读取当前消失的子项目。原 `--project --commit --path` 仍用于现存项目，目标解析集中于同一 service.read。完整协议见 [CLI 契约](../../../../../specs/002-fixed-source/contracts/cli.md)，示例见 [quickstart](../../../../../specs/002-fixed-source/quickstart.md)。
- 作者体验验收不适用，本单没有页面或教学呈现变更。其他平台、实际 UNC 仓库与资源限制注入未测，具体范围见下文。
- 当前唯一 Git 写负责人为本执行。分支保留，dev 仍为上述基线，无推送或发布。下一步完成独审与归档后交回主脑，保留条件解除于后续获准合 dev。

## 依据与验证

### Spec Kit 增量

使用 Ponytail full，读取 speckit-specify/plan/tasks/analyze/implement 原版技能。以 `SPECIFY_FEATURE_DIRECTORY=specs/002-fixed-source`、`SPECIFY_FEATURE_NO_PERSIST=1` 运行 resolve-template 的 spec/plan，以及 setup-tasks 的实际任务模板，保留原结构、编号和 D006 T001—T012 完成记录，追加 D007 T013—T022。按任务授权增量维护已有 plan，未覆盖写入 setup-plan 或重新创建功能目录，未重跑无关依赖研究。

analyze 的 User Input 见 [tasks.md](../../../../../specs/002-fixed-source/tasks.md) 的 D007 段，包含批准版本、H01—H05、既有实现及证据、后置范围和允许材料。实际运行 `check-prerequisites.ps1 -Json -RequireSpec -RequireTasks -IncludeTasks` 成功，逐项核对 spec/plan/tasks/constitution，未发现重复、歧义、未映射任务或原则冲突。9 项 FR、6 项 SC 全部有任务覆盖，22 项总任务中 D007 新增 10 项。覆盖映射见 tasks 的依赖段。扩展 hooks 配置不存在。

implement 同输入，实际 checklist 扫描为 requirements.md 共 16 项、16 勾选、0 未勾。勾选在 specify 增量中逐项复核，表示需求表达可实施。沿现有 Node/TS 工程、单一锁文件与 ignore，不涉及安装/发布、Docker 或其他工具配置。

### 修复前失败与累计轮次

2026-11-17，产品源码仍为 05daca6。系统默认 Node 22.23.2、npm 10.9.8、Git 2.50.1.windows.1，Windows。先运行 `npm.cmd run build` 成功，再运行以下正式回归，3 项均实际失败。

```powershell
node --test --test-concurrency=1 --test-name-pattern='D007 H0[123]' tests/integration/fixed-source.test.mjs
```

| 问题 | 已触发动作和实际结果 | 本轮修复假设与轮次 |
| --- | --- | --- |
| H01 | SHA-1 合成 A/B，64 个 a 的分支依次移向 A、B。service/CLI 两次均返回成功，内容分别为 `A\n`、`B\n`，CLI 退出 0 | 原检查只验长度及对象类型，Git 将同形字符串解析为可移动分支。将实际解析 ID 与输入精确比较后沿核定 ID 读对象。此前只有只读复现，本次将进入第 1 轮产品修复 |
| H02 | 真实 CLI pin A 后将整个子项目移至该次沙盒的 removed-project。原提交对象仍为 commit，service.read 返回 PROJECT_UNAVAILABLE，新增完整映射参数的两个 cwd CLI 均因旧入口不支持而返回 INVALID_ARGUMENT/2 | 固定引用校验根与前缀组合后只核原仓库，CLI 将已有映射字段交共用用例。CLI 参数尚未实现属于新增契约的前置失败，service 失败证明原缺陷。本次将进入第 1 轮产品修复 |
| H03 | 临时样例 `C:\Users\Lenovo\AppData\Local\Temp\aftertaste-D007-oNt6h1`，建库前确认 `rev-parse --show-toplevel` 失败，普通目录为 NOT_REPOSITORY。init --bare 后 is-bare 为 true，CLI 仍 NOT_REPOSITORY，断言失败。测试结束已清理该样例 | `.git` 祖先扫描先走到卷根退出，bare 检查未触发。将 bare 判定移到扫描之前。承接 D006 已有 1 轮，本次将进入累计第 2 轮，若验证仍失败即停写 |

失败采集输出由本会话工具记录，稳定重建入口为 tests 的三项 D007 回归及 fixture。没有以旧 .local 样例作为接单输入。

H01/H02 的第 1 轮与 H03 的累计第 2 轮修复后，Node 24.11.1 构建及 H01—H03 定向回归 3/3 通过，耗时 17.0 秒。独立 bare 位于 `C:\Users\Lenovo\AppData\Local\Temp\aftertaste-D007-ru851R`，返回 UNSUPPORTED_TARGET/BARE_REPOSITORY，结束已清理。H03 此轮成功，无继续写入该问题的修复。

随后完整 typecheck/build 通过，22 项串行测试中 21 通过、1 失败，耗时 162.3 秒。失败位于新增“历史固定映射拒绝篡改”测试，伪造仓库根使用 f.runRoot，向上落到回味开发仓库，Git 根核验返回 GIT_READ_FAILED/operation=locate/status=128，未进入预期 MAPPING_MISMATCH。工具没有读取成功。这是测试布局前提问题。只读探查 `run-Su3ueP` 同时验证此结果和受控合成仓库 packages 错误根的 INVALID_ARGUMENT/MAPPING_MISMATCH。测试第 1 轮修正仅将该样例改为合成仓库现存 packages 目录，仍要求 INVALID_ARGUMENT，产品源码未改。另将 Windows 跨盘 cwd 明确取 SystemRoot 卷根，保证任务级 Node 放在 D 盘时仍覆盖 C/D 两盘。

该测试和 Windows 定向复验 2/2 通过（22.3 秒），随后全套 22/22 通过（135.1 秒）。收尾核对补全完整固定引用在仓库不可用时的 repositoryPath 上下文，保留调用时的项目根，并增加对应断言。最新源码再次 typecheck/build 通过，全套 22/22 通过（126.4 秒），零失败、零跳过。H01/H02 产品修复累计各 1 轮通过，H03 承接累计第 2 轮通过，测试布局自身第 1 轮修正通过。

### 最终自测与使用结果

实际环境为 Microsoft Windows NT 10.0.26200.0，Node 24.11.1、npm 10.9.8、Git 2.50.1.windows.1、TypeScript 5.9.3。默认 Node 22.23.2 仅用于修复前采集，最终测试使用既有 npm 缓存中 Node 24 的执行文件副本 `.local/D007/runtime/node.exe`，无全局升级和新依赖。曾尝试 npm offline 获取，返回 ENOTCACHED；之后获工具自动审批通过，读取既有缓存并复制执行文件到任务目录。

从仓库根串行执行以下命令，当前进程临时将任务级 Node 目录置于 PATH 首位，TLS 验证设为 1。

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd test
git diff --check
```

| 要求 | 预期与实际结果 |
| --- | --- |
| H01 | SHA-1 仓库中的 64 位同形分支移向 A/B 后，service 和真实 CLI 均拒绝 INVALID_ARGUMENT/COMMIT_ID_MISMATCH，CLI 退出 2。pin 仍解析本地分支。有效 SHA-1/SHA-256 完整提交均可读，SHA-256 内的 40 位分支也拒绝 |
| H02 | 真实 CLI pin 后移走整个子项目，service 与两个 cwd 的完整映射 CLI 均读 A。根/前缀篡改、越界、元数据、提交树链接/gitlink 均拒绝。当前路径替换为 junction 后仍只读提交。原仓库或提交确实缺失时分别 PROJECT_UNAVAILABLE/OBJECT_UNAVAILABLE，诊断保留固定定位 |
| H03 | 系统临时目录内建库前核无普通工作仓库，普通目录 NOT_REPOSITORY，独立 bare 的用例和 CLI 均 UNSUPPORTED_TARGET/BARE_REPOSITORY，旧的嵌套布局回归继续通过 |
| H04 | CLI 无 repository.locate 调用，service 便捷输入只定位项目一次，完整输入只定位原仓库根一次，端口测试核实职责与调用，不绑定 Git 内部命令数量 |
| H05 | unit 有效映射改用当前平台 path.resolve，Windows 无盘符拒绝、完整绝对路径从 C/D 两盘 cwd 成功的原专项继续通过 |
| 既有边界 | 历史/分叉/文本保真、特殊路径、前置参数拒绝、只读快照、缺对象不 fetch、禁 replace/环境干扰、链接目标/编码拒绝均通过 |

独立 quickstart 调用实际通过 `node tests/fixtures/fixed-source.mjs` 建库，样例为 `.local/D007/run-BLu0Ep/`，A 为 `d91dbf9bb32a704d89b523fbc1c3d498b9ac1fe0`。真实 CLI pin、旧 read 均退出 0，移走子项目后完整映射 read 仍退出 0，原文 `A\n` 为 2 字节；越界失败 INVALID_PATH/2。测试中的相同真实 CLI 路径随后在最新源码全套中再次通过。

可再生成日志在 `.local/D007/final-validation/`，包含 typecheck.log、build.log、test.log（135.1 秒）和 test-context.log（最新 126.4 秒）。稳定证据为提交的 tests/fixture 与本摘要。前置脚本再次运行 `check-prerequisites.ps1 -Json -RequireTasks -IncludeTasks` 成功。文档仍为同主题增量维护，未运行完整新功能创建流程。

### 未验证项

- 实际运行平台仅 Windows。Linux/macOS 及真实 UNC 共享仓库未测。
- 30 秒超时、64 MiB 输出限制和 Windows 权限拒绝未做专门注入，沿用 D006 限制。
- 真实用户项目、网页和教学效果、首版完整 A01 不在本次证据范围。历史源码仍依赖原 Git 仓库和对象可用。

## 资源与交回

本次未启动服务或浏览器。普通合成样例在 `.local/D007/run-*`，仅含合成数据，可由正式 fixture 重建，保留供接回复查，之后可按任务目录清理。系统临时样例使用 aftertaste-D007 前缀，清理前核绝对父路径及归属。已确认早期四个外部样例目录不存在，最新全套的 `aftertaste-D007-AB8cEg` 也由测试结束钩子清理。任务运行时和日志留在忽略目录，不作为接单必需输入。
