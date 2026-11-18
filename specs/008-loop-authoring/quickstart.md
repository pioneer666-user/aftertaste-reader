# Quickstart · 生成和重读一条订单闭环

准备 Node.js 24、Git 2.45+ 和仓库锁定依赖。从开发仓库运行：

```powershell
npm run build
node --test --test-concurrency=1 tests/integration/loops.test.mjs
```

测试在 `.local/D015/` 的隔离目录创建样例，调用真实 CLI。检查读者提出数量校验问题后可从服务跟到规则并回到服务，合法与非法两种结果都能说明。机器检查结构和固化行为，作者试读判断因果是否讲清。

需生成一份可打开的试读：

```powershell
$trial = Join-Path (Get-Location).Path ('.local/D015/trial-' + [guid]::NewGuid())
node tests/fixtures/loop-authoring.mjs $trial
```

生成目录下的 `order-quantity.md` 可以直接阅读，CLI 保存的成品位于同一目录下 `project/docs/aftertaste/loops/order-quantity/current/loop.json`。生成选线对照 [D015 试讲过程](../../docs/work/2026/11/D015-loop-authoring/sample/session.md)。

按 [CLI 协议](contracts/cli.md)在新进程读同一闭环。集成用例覆盖原讲解与图例改写及 HEAD 前进、原提交引用暂不可用、失效块与悬空边、重复 ID 和一次中断后的重试。Markdown 试读仅落盘解释与源码定位。
