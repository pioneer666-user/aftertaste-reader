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

## D031 主阅读与源码对照

沿用同一项目固定副本，在 1440 × 900 CSS px 窗口打开订单闭环：

1. 选择「规则转换并检查边界」，本步讲解无需展开即可读；提示就近呈现，原块讲解默认折叠。
2. 悬停或键盘聚焦「对照源码」，核贴右栏左缘的代码、路径、行号与提交；移入代码后选字、复制和横滚，画布视野不变。点击或 Enter 固定，Esc 或关闭按钮收起并归还焦点。
3. 固定后点击「无效数量让创建提前结束」，左侧仍为 `src/rules.mjs` 第 1–7 行，右侧换成该步讲解。从校验点再走另一分支，核 `src/service.mjs` 第 4–6 行与第 7–10 行。
4. 点空白看到闭环概览；图内工具条由共用顶栏按钮开合。鼠标掠过两类图的卡面仅内部轻抬约 2 CSS px，拖动时直接跟手，Vue Flow 节点与端口坐标不变。固定提示为「点击节点查看详情，点击空白关闭」。
5. 390 CSS px 窄窗点按入口，在本步内展开并读到末行；关闭后选另一步。键盘、English、减少动态效果和触摸仿真分别复验。源码不可用显示既有诊断，纯讲解步骤无源码入口。

先在旧构建运行 `node tests/browser/loop-main-experience.mjs` 记录新行为缺失，再对候选执行。候选构建后串行运行本页三浏览器闭环回归、`reader-history.mjs`、受影响画布与导航回归；每个脚本使用独立样例和服务。实图与详细结果归 `.local/D031/`，独立审查和共用试读换版按 D031 任务执行。

### D031 实测记录（2026-11-21）

以下结果来自 `.local/D031/build`，最终候选提交与受审固定副本另由 D031 回执绑定。所有浏览器脚本均串行运行，各自使用隔离项目和服务。

- `npm run typecheck`、TypeScript 编译与 Vite 构建通过。全量 Node 测试曾取得 100／100 通过；其后仅有 Vue／CSS 视觉修正，最终类型检查与构建已重跑，但未把此前的 100 项结果冒称为最终提交后的全量复跑。[Node 日志](../../.local/D031/npm-test.log)
- `loop-main-experience.mjs` 在 Edge 157.0.4341.60、Chrome 157.0.8103.80、Firefox 159.0 各通过 9 组，覆盖两条分支、相同源码位置保持、键盘／窄窗开合、源码选字复制与横滚、390 CSS px 布局、English、减少动态及仿真触摸。[Edge](../../.local/D031/main-edge-DPWB8O/report.json) · [Chrome](../../.local/D031/main-chrome-6vUorp/report.json) · [Firefox](../../.local/D031/main-firefox-gpE6j9/report.json)
- `loop-reader.mjs` 在三浏览器各通过 8 组旧行为回归；`loop-canvas-interactions.mjs` 在 Edge 通过 4 组抓手、Ctrl、框选、分组及布局保护检查。[Edge](../../.local/D016/browser-edge-jmRR80/report.json) · [Chrome](../../.local/D016/browser-chrome-TKnjnq/report.json) · [Firefox](../../.local/D016/browser-firefox-aBK5ii/report.json) · [画布专项](../../.local/D031/canvas-edge-8seQGT/report.json)
- `dependency-canvas.mjs`、`dependency-canvas-tools.mjs` 和 `reader-history.mjs` 分别通过 6、4、13 组，覆盖框选后键盘顺序、共用工具、小地图、两图独立状态及历史恢复。[画布回归](../../.local/D026/browser-edge-4TPEEd/report.json) · [工具回归](../../.local/D027/tools-edge-t2JKik/report.json) · [历史回归](../../.local/D028/history-edge-OrTY2e/report.json)
- 最终实图与连续帧记录零资料写入、零页面错误；悬停位移读数为 `0、0、-2、-2、0` CSS px，正常桌面与窄窗源码图已人工查看。Impeccable `detect --json` 对本批页面文件返回空数组。[实图报告](../../.local/D031/candidate-visual/report.json)

作者体验、实体触屏和屏幕阅读器实读不在上述自动检查范围内，仍待验收。
