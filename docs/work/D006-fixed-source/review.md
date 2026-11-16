# D006 独立审查原文

审查子代理为 `/root/d006_review`，未参与实现。以下保留其首轮完整原文，修复后复核追加于本文。

---

# D006 独立审查原文

**结论为需修复。**

审查候选为 `cc824df1f9f0d049e3031bed20047c498f8a9957`，dev 基线为 `a5c1fb7465ec8479f46c6b46bbd0bbc845025e8e`。批准依据为 `docs/work/D006-fixed-source/task.md@8d51ad849a281870967c0c4ef1f2a95d180b7aac`，无有效调整。

本次变更提供固定本地提交、按固定提交读取整文件及相应 CLI。按单个本地调用者的使用场景，使用 Ponytail Review 与 Sharp Edges 检查了用例、Git 适配器、命令、测试、工程配置及 002 正式材料。

## 必须修复

### 1. [P2] CLI 在校验源码路径前访问项目，定位失败时丢失读取依据

位置为 `src/cli/main.ts` 第 43—44 行。

- 具体输入为合成项目、有效完整提交、`--path ../outside.ts`，同时将子进程 `PATH` 置空。实际返回 `GIT_UNAVAILABLE`、退出 1。用例中的相同非法路径会在调用适配器前返回 `INVALID_PATH`，对应退出 2。
- 原因是 CLI 先执行 `repository.locate(projectRoot)`，再进入 `service.read` 的路径校验。正常 Git 环境下，非法路径也会触发项目目录检查及 Git 命令，未满足任务对拒绝越界输入的前置边界。
- 同一前置调用还绕过用例的读取错误上下文汇合。用有效提交和 `other.ts` 读取不存在的合成项目时，实际 `PROJECT_UNAVAILABLE` 的 context 仅有 `projectRoot`，缺少已知的 `commit` 和 `path`，不符合 U101 及 contracts 的诊断要求。
- 建议复用 application 的路径校验，在 CLI 定位前拒绝非法路径，并为读取阶段的定位失败汇合已知项目、提交和文件依据。补真实 CLI 的非法路径加空 PATH，以及项目缺失时的上下文回归测试。

### 2. [P2] Windows 无盘符根路径会随调用进程所在盘符改变目标

位置为 `src/application/fixed-source.ts` 第 48—49 行，以及 `src/cli/main.ts` 第 32 行。

- `path.isAbsolute` 在 Windows 对 `\project\...` 返回 true，但该路径仍需要当前盘符才能确定目标。
- 使用同一个位于 D 盘沙盒中的合成项目，将项目参数去掉 `D:` 后，从 D 盘 cwd 执行 pin 成功，并定位到 D 盘项目。从 `C:\` 执行完全相同的参数则返回 `PROJECT_UNAVAILABLE`。
- 这违反 D006 的“调用进程所在目录不改变目标”。若两个盘符存在相同路径，还可能固定到另一个项目。
- 建议 Windows 项目根校验要求包含完整盘符根或 UNC 根，CLI 与共用用例使用同一判定。补无盘符根路径的前置拒绝测试，并保留完整绝对路径在不同 cwd 下定位一致的验证。

## 已核内容

- pin 将 HEAD 或显式本地 revision 固定为完整提交。read 沿完整提交对象读取，调用链未重新解析 HEAD。
- 路径以参数数组传给 Git，使用字面 pathspec。提交树逐段检查能拒绝链接、gitlink 和目录条目。
- 原文读取使用严格 UTF-8 解码并保留 BOM，无 trim 或换行转换。空文件有明确成功结果。
- Git 调用禁用 lazy fetch、replace、可选锁及 fsmonitor，清除继承的 GIT_*。产品代码未发现目标写入、源码缓存或源码临时文件路径。
- 002 的 spec、plan、tasks 保留官方必需结构，模型与命令约定基本对应实现。测试、quickstart 和 handoff 明确了平台及未测范围。
- 本次实现范围保持在固定取源能力。文档结构、教学、页面和完整 A01 仍有后续工作。

## 独立验证

- `tsc --noEmit` 通过。
- 单元测试串行运行，3/3 通过。
- Spec Kit 的 `RequireSpec/RequireTasks/IncludeTasks` 只读前置检查通过。
- `git diff --check` 通过，工作区保持干净。
- 在 `.local/D006-fixed-source/run-edCN5X/` 合成样例上复现了以上两项问题。跨盘 cwd 检查使用同一合成项目，未读取真实用户源码。
- 复用了候选对应的完整集成测试 12/12 证据，未重复运行完整集成套件。

未检查其他操作系统、真实用户项目、30 秒超时与 64 MiB 上限注入、Windows 权限拒绝及页面教学效果。审查过程未修改产品、规范、测试或 Git。

**完成发现 1、2 的修复与回归验证后需要复核。**

---

## 修复复核原文

**复核结论为通过。**

绑定修复候选 `195e00ff0fc2f1ce941e3adebf9942f0b0593fcf`，比较初始候选 `cc824df1f9f0d049e3031bed20047c498f8a9957`。本次复核覆盖原发现 1、2，以及共享校验、CLI 诊断、关联测试和 002 材料增量。

### 发现 1 已关闭

application 提供共享的 `validateSourcePath`，CLI 在 `repository.locate` 前调用。新增真实命令测试以越界路径和空 PATH 验证前置拒绝，得到 `INVALID_PATH`、退出 2。

CLI 汇合请求中已知的 `projectRoot`、`commit`、`path` 与操作诊断。缺失项目测试返回 `PROJECT_UNAVAILABLE`，上下文完整保留这三个字段。正常读取继续调用原 `FixedSourceService.read`，固定提交取源链路保持一致。

### 发现 2 已关闭

项目根的共享判定在 Windows 要求完整盘符或 UNC 根。`FixedSourceService.pin/read` 与 CLI 使用同一判定。

新增回归验证了无盘符根路径从 C、D 两个盘符的 cwd 调用时均在定位前返回 `INVALID_ARGUMENT`、退出 2。完整绝对项目路径从这两个 cwd 执行 pin/read 均成功，返回同一项目根及 A 的内容。

### 独立复验

在 Node `24.11.1`、Windows 上串行执行以下检查。

```powershell
node --test --test-concurrency=1 tests/unit/fixed-source.test.mjs
node --test --test-concurrency=1 --test-name-pattern='CLI 在定位前|Windows 无盘符' tests/integration/fixed-source.test.mjs
git diff --check
git status --short
git rev-parse HEAD
```

- 单元测试 3/3 通过。
- 两项 CLI 回归 2/2 通过，零跳过，耗时约 7.3 秒。
- 空白检查通过，工作区干净，HEAD 与复核候选一致。
- 复用执行提供的修复后 typecheck/build 和完整串行测试 14/14 证据。后续增补的跨盘成功断言已在本次定向复验中覆盖。

原两项 P2 均关闭，本次增量未发现新的需修复问题。审查过程未修改产品、规范、测试或 Git。

其他操作系统、实际 UNC Git 共享、超时与输出上限注入、Windows 权限拒绝、真实用户项目及教学页面仍未验证。作者体验与首版完整验收继续按后续任务安排。
