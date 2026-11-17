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

输出 repositoryRoot、projectRoot、commitA、commitB、forkCommit。样例位于 `.local/D006-fixed-source/<run-id>/`，内含中文/空格路径及多种文本；当前工作区已在 B 后修改/删除文件。使用输出的绝对路径及 commitA。

```powershell
node dist/cli/main.js pin --project '<projectRoot>' --revision '<commitA>'
node dist/cli/main.js read --project '<projectRoot>' --commit '<commitA>' --path '中文 空格/[x].ts'
node dist/cli/main.js read --project '<projectRoot>' --commit '<commitA>' --path '../outside.ts'
```

前两条分别成功返回固定引用及 A 的文件，第三条失败退出 2，问题码 INVALID_PATH。完整协议见 [contracts](contracts/cli.md)。integration 测试覆盖固定后 HEAD 移动、根/子项目、不同 cwd、只读快照、失败注入与真实 CLI，unit 覆盖用例输入及端口调用约束。技术验收摘要与实际环境见 [D006 handoff](../../docs/work/2026/11/D006-fixed-source/handoff.md)。
