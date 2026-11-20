# D026 · 独立审查原文

## R1 · 2026-11-20

- **依据与范围**　[D026 批准任务](task.md) `af08db4`，无生效调整。基线 `dev@6ca44d8c409ab3213e9576524cac7073a4180e87`，候选 `85e5addc4ffa4e8e39c87fedcda8c9f017a6591d`。审查了共用顶栏、依赖图首屏与详情、框选、两种分组入口和布局保存，核对 [08 R16／A17—A18](../../../../../specs/001-first-release/08-current-spec-and-acceptance.md#graph-layout-acceptance)、[006](../../../../../specs/006-file-reader/spec.md)、[007](../../../../../specs/007-dependency-canvas/spec.md) 及其任务映射。沿真实调用查了布局成员更新、空组清理、失败重试和闭环布局分离。
- **独立实操**　Windows 11、Node 24.11.1、Edge 157.0.4341.60。运行 `node tests/browser/dependency-canvas-selection.mjs`，在新隔离试读中验证中文桌面、英文 851／850 CSS px 与 390 CSS px 窄窗导航，图到讲解返回、组框内起拖、逆向边缘命中、移组提示、取消、实际文件锁失败、解除后重试及重开独立布局。例行脚本六项均通过，另核了首屏、边缘浮钮、移组提示及失败画面。证据在 `.local/D026/browser-edge-4dALxo/`。
- **结论：需修复。** 已确认以下单标签页操作会把过期的分组成员写回磁盘。

### 1. 只改旧组名称也会撤销已确认的移组

在依赖图点「订单处理」打开编辑器，继续在画布框选 `src/rules.mjs`，用 Ctrl+G 将它移入「独审新组」。此时磁盘上旧组只剩 `src/service.mjs`，新组只有 `src/rules.mjs`，但旧编辑器仍勾着两个文件。只改旧组名称并点「应用分组」，磁盘会把 `src/rules.mjs` 移回旧组并删掉新组。若旧组起初只有 `src/rules.mjs`，框选移组后旧组已经消失，仍可用残留表单把它以原 ID 写回。两种情况下，框选成组和随后应用表单的 PUT 均返回 200。

`src/web/DependencyCanvas.vue:238` 在开启编辑时复制成员列表，`:359` 的框选确认更新布局后没有清除旧编辑草稿，`:245` 又提交这份成员列表。预期是只改名称时保留最新组成员，移空的旧组也不应被残留表单重建。建议框选确认时关闭并清空旧编辑器，重新打开时从当前布局读成员。框选取消时保留原有编辑状态。

- 旧组仍有成员的复现脚本为 `.local/D026/review-overlapping-editors.mjs`，磁盘前后对照和截图在 `.local/D026/review-overlapping-editors-q17lgK/`。
- 旧组移空的复现脚本为 `.local/D026/review-old-group-emptied.mjs`，磁盘前后对照在 `.local/D026/r1-empty-OVIGJy/`。首次建立该变体时，闭环样例发布返回 `EPERM`，尚未开始浏览器操作。另建仅含所需依赖图的副本后复现。

### 限制与交还

Chrome、Firefox 与广域回归沿用执行证据，本轮独立实操使用 Edge。作者原项目、4341 试读和作者体验验收由执行方后续处理。已关闭独审启动的浏览器和服务，核对候选工作区干净，JS 与 CSS 的 SHA-256 与采集前一致。采集结束，可以恢复写入。

## R2 · 2026-11-20

- **复核对象**　固定候选 `a09ecd4c687e13c6db14fde63319b0053820c2c6`。相对 R1，框选成组后，仍存在的旧组编辑器会移除已转出的成员并保留未提交的改名；旧组移空时，关闭并清空旧编辑器。
- **旧组仍有成员**　在新隔离试读中运行 `node tests/browser/dependency-canvas-selection.mjs`。保持「订单处理」编辑器打开并输入改名，框选后将 `src/rules.mjs` 和 `node:path` 移入新组。旧编辑器取消了 `src/rules.mjs` 的勾选，保留输入的组名。再次应用后，磁盘上旧组仅改名，两个组的成员归属保持预期。脚本六项通过，包含保存失败、重试和重开。证据在 `.local/D026/browser-edge-xWVWxB/`。
- **旧组移空**　在另一隔离副本运行 `node .local/D026/review-r2-old-group-emptied.mjs`。打开只有 `src/rules.mjs` 的旧组编辑器，将该文件移入新组。确认后旧编辑器关闭，磁盘只剩新组。重新打开编辑器和刷新页面后，旧组入口、旧 ID 均未恢复。证据在 `.local/D026/r2-empty-hgroTi/`。
- **结论　通过。** R1 第 1 项的两个复现条件均已关闭。独立实操使用 Windows 11、Node 24.11.1、Edge 157.0.4341.60。Chrome 和 Firefox 沿用执行证据。
- **写入交还**　已关闭独审启动的浏览器和服务。HEAD、工作区及 JS、CSS 资产哈希与采集前一致。作者原项目、4341 试读与作者体验验收由执行方后续处理。采集结束，可以恢复写入。
