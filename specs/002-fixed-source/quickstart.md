# 固定取源快速验证

在仓库根使用 Node.js 24 LTS、npm 和 Git 2.45+。

```powershell
npm ci
npm run typecheck
npm run build
npm test
```

测试内的建库入口为 `tests/fixtures/fixed-source.mjs` 的 `createFixture()`，只使用合成内容。独立创建可复查样例并打印路径/提交，不打印源码。

```powershell
node tests/fixtures/fixed-source.mjs
```

输出 repositoryRoot、projectRoot、commitA、commitB、forkCommit。样例位于 `.local/D007/<run-id>/`，内含中文/空格路径及多种文本；当前工作区已在 B 后修改/删除文件。使用输出的绝对路径及 commitA。

```powershell
node dist/cli/main.js pin --project '<projectRoot>' --revision '<commitA>'
node dist/cli/main.js read --project '<projectRoot>' --commit '<commitA>' --path '中文 空格/[x].ts'
node dist/cli/main.js read --project '<projectRoot>' --commit '<commitA>' --path '../outside.ts'
```

前两条分别成功返回固定引用及 A 的文件，第三条失败退出 2，问题码 INVALID_PATH。完整协议见 [contracts](contracts/cli.md)。integration 测试覆盖固定后 HEAD 移动、根/子项目、不同 cwd、只读快照、失败注入与真实 CLI，unit 覆盖用例输入及端口调用约束。技术验收摘要与实际环境见 [D006 handoff](../../docs/work/2026/11/D006-fixed-source/handoff.md)。

## 当前子项目消失后的读取

调用 AI 在内存中保存 pin 返回的完整 source。后续 read 可将相同的 projectRoot、repositoryRoot、projectPrefix、commit 传回，当前子目录缺失仍可读原仓库的历史对象。

```powershell
node dist/cli/main.js read --project '<source.projectRoot>' --repository '<source.repositoryRoot>' --prefix '<source.projectPrefix>' --commit '<source.commit>' --path 'other.ts'
```

根项目的 prefix 传空字符串。旧的 project/commit/path 用法仍可用于现存项目，完整历史映射需同时提供 repository/prefix。共用用例直接 `await service.read(source, 'other.ts')`，便捷输入为 `await service.read({projectRoot, commit}, 'other.ts')`。调用方可使用 `code` 及 `context.reason` 区分字段、映射、提交身份和目标形态失败，详见契约。

```powershell
node --test --test-concurrency=1 --test-name-pattern='D007' tests/integration/fixed-source.test.mjs
```

正式回归建立并移动同形分支、移走整个子项目、核篡改映射与链接/gitlink，并在任意普通工作仓库之外建立 bare 样例。外部样例输出绝对路径并在测试结束清理，普通样例保留在隔离 .local 目录。D007 结果见 [handoff](../../docs/work/2026/11/D007-fixed-source-hardening/handoff.md)。
