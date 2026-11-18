# Quickstart

## 在新目录重建试读

在 Windows 的仓库 PowerShell 中使用 Node 24、Git 和锁文件已安装的开发依赖。下列命令向新目录构建并通过正式 CLI 创建订单和库图例闭环。

```powershell
$run = Join-Path $PWD ('.local/D016/rebuild-' + [guid]::NewGuid().ToString('N'))
$env:AFTERTASTE_BUILD = Join-Path $run 'build'
node node_modules/typescript/bin/tsc --outDir $env:AFTERTASTE_BUILD
node node_modules/vite/bin/vite.js build --outDir (Join-Path $env:AFTERTASTE_BUILD 'web')
node tests/fixtures/loop-reader.mjs (Join-Path $run 'project')
node (Join-Path $env:AFTERTASTE_BUILD 'cli/main.js') serve --project (Join-Path $run 'project') --port 4336
```

打开启动输出中的本机 URL。选择订单，沿实际连线读完两个分支，检查两个服务步骤的讲解、源码和坐标。在带库图例闭环与依赖图各自拖放、分组、缩放和重开，核闭环移出组、成员范围及保组重排。

## 串行自动验证

在同样设置了 `AFTERTASTE_BUILD` 的 PowerShell 中运行，测试各自启动隔离服务并在结束时关闭。

```powershell
node --test --test-concurrency=1 tests/integration/loop-reader.test.mjs
$env:AFTERTASTE_BROWSER = 'edge'
node tests/browser/loop-reader.mjs
$env:AFTERTASTE_BROWSER = 'chrome'
node tests/browser/loop-reader.mjs
$env:AFTERTASTE_BROWSER = 'firefox'
node tests/browser/loop-reader.mjs
```

浏览器脚本核对页面操作与磁盘结果。受控延迟覆盖切图时的晚到读取和保存响应，另验同图冲突、失败和重试。

执行命令与试读入口见 [D016 回执](../../docs/work/2026/11/D016-loop-reader/handoff.md)。
