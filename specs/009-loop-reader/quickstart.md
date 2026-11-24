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
4. 在开栏时点空白看到闭环概览；D032 起闭环工具常驻，由共用顶栏开合闭环目录。鼠标掠过两类图的卡面仅内部轻抬约 2 CSS px，拖动时直接跟手，Vue Flow 节点与端口坐标不变。固定提示为「点击节点查看详情，点击空白关闭」。
5. 390 CSS px 窄窗点按入口，在本步内展开并读到末行；关闭后选另一步。键盘、English、减少动态效果和触摸仿真分别复验。源码不可用显示既有诊断，纯讲解步骤无源码入口。

先在旧构建运行 `node tests/browser/loop-main-experience.mjs` 记录新行为缺失，再对候选执行。候选构建后串行运行本页三浏览器闭环回归、`reader-history.mjs`、受影响画布与导航回归；每个脚本使用独立样例和服务。实图与详细结果归 `.local/D031/`，独立审查和共用试读换版按 D031 任务执行。

### D031 实测记录（2026-11-21）

以下 R1 修复后结果来自 `.local/D031/build-r1fix`，最终候选提交与受审固定副本另由 D031 回执绑定。所有浏览器脚本均串行运行，各自使用隔离项目和服务。

- `npm run typecheck`、TypeScript 编译与 Vite 构建通过；全量 Node 测试 100／100 通过。[Node 日志](../../.local/D031/npm-test-r1fix.log)
- `loop-main-experience.mjs` 在 Edge 157.0.4341.60、Chrome 157.0.8103.80、Firefox 159.0 各通过 12 组，覆盖两条分支、相同源码位置保持、键盘／窄窗开合、源码选字复制与横滚、390 CSS px 布局、English、减少动态及仿真触摸；另覆盖 R1 的桌面固定后直接缩窗、长文底部直接点节点和三图工具状态隔离。[Edge](../../.local/D031/main-edge-BK7qAl/report.json) · [Chrome](../../.local/D031/main-chrome-L4Vpih/report.json) · [Firefox](../../.local/D031/main-firefox-hwKKzx/report.json)
- `loop-reader.mjs` 在修复后 Edge 通过 8 组旧行为回归；Chrome／Firefox 的 8 组记录来自 R1 前构建，受影响交互由上述修复后三浏览器 12 组主路径复验。Chrome 旧脚本补跑在隔离样例创建阶段遇到 EPERM，未进入页面，不计为通过或产品断言失败。[修复后 Edge](../../.local/D016/browser-edge-8xiwJx/report.json) · [此前 Chrome](../../.local/D016/browser-chrome-TKnjnq/report.json) · [此前 Firefox](../../.local/D016/browser-firefox-aBK5ii/report.json)
- `loop-canvas-interactions.mjs`、`dependency-canvas-selection.mjs`、`dependency-canvas-tools.mjs` 和 `reader-history.mjs` 在修复后 Edge 分别通过 4、6、4、13 组，覆盖抓手、Ctrl、框选、分组、键盘顺序、小地图、两图独立状态、历史恢复及个人资料保护。[闭环画布](../../.local/D031/canvas-edge-kvQ9xI/report.json) · [依赖图选择](../../.local/D026/browser-edge-ZAX2Cf/report.json) · [工具](../../.local/D027/tools-edge-zQMI0k/report.json) · [历史](../../.local/D028/history-edge-0rGDiD/report.json)
- 候选实图与连续帧记录零资料写入、零页面错误；悬停位移读数为 `0、0、-2、-2、0` CSS px，正常桌面与窄窗源码图已人工查看。R1 修复后 Impeccable `detect --json` 仍返回空数组。[实图报告](../../.local/D031/candidate-visual/report.json)

作者体验、实体触屏和屏幕阅读器实读不在上述自动检查范围内，仍待验收。

## D032 目录与画布

构建后运行 `node tests/browser/loop-catalog.mjs`。以 1440 × 900 打开依赖图和未选、已选闭环，核满幅四边。订单校验步平移缩放、固定源码并滚动右栏，在目录滑动期间记录节点、小地图、阅读位置、写请求和焦点。390 px 选图再读步骤。切换路径图和订单，再离开后退。空列表、失败重试和坏条目在隔离项目验证。

脚本把共用试读项目复制到新的 `.local/D032/catalog-*/project` 后启动。可用 `AFTERTASTE_TRIAL_PROJECT` 指定同一试读的固定副本，`AFTERTASTE_BUILD` 指向包含 CLI 和 web 的固定构建。目录清空、恢复及故障注入只发生在本次副本和浏览器中。输出含全窗 PNG 和逐帧屏幕坐标的 `report.json`。

## D033 收栏阅读与分组

1. 在共用试读副本打开订单，校验步固定源码并滚动，收起再展开核原位。再次收起，点「通向」的失败步，展开读集合未变；实点「来自」、推荐上一步与入口。
2. 比对平移缩放后收展前、中、后的节点和小地图，检查目录、图例、长名、多出口、键盘及 390 px 点按。
3. 框选命名、拖动并保存。用「⋯」取消、改名、调整成员，再解散并重开。核坐标、其他组、视野、连线及失败重试，按任务单归档证据。

## D034 满幅与步骤阅读

在冻结的共用项目副本运行 `node tests/browser/loop-reading-panel.mjs`。1440 × 900 打开订单、点校验步，靠近把手、Enter 开栏、空格收栏。逐帧比较绘图区、视野、节点、小地图与底部关系条。点面板边界两侧，检查选择及布局请求。按每条真实出口读通过后的建单、追加，以及提前退出；在失败步比较「来自」和推荐上一步。390 px 点按与中英文目标全名、长文底部键盘导航、同一步滚动及固定源码分别复验。报告及截图归 `.local/D034/`。作者用概览中的文本「4」独立回答哪一步首次改变集合。

## D042 · 依赖图与闭环往返

运行 `node tests/browser/loop-reading-panel.mjs`。选中校验步，点击底部展开、沿两个出口换步，再回原依赖图。多出口样例查第三个理由与目标。

## D043 订单试读

打开 order-quantity 的 resume 步，选择「建立对象这一步还没有改变集合」，复制后核 JSON，再加入笔记。从浮层及工作台重开引文。按 [D043 任务](../../docs/work/2026/11/D043-reading-qa-and-revision/task.md) 分别只问、同意补例和明确改写；对比文件与闭环 current、个人资料。

## D049 · 步骤连线和密集分支

按[共用双图检查](../007-dependency-canvas/quickstart.md#d049--双图遮线与重排)在输入样例闭环中查看入口到汇总的直达线，确认重排后对照最左库列和三个并列样例子列。
