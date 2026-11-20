# Quickstart: 文件依赖画布

运行前备好 Node 24、Git 和项目根 npm 依赖。构建后按 [试读与保存说明](../../docs/usage/file-reader.md#dependency-canvas) 启动真实服务。

```powershell
npm run typecheck
npm run build
npm test
npm run test:browser:canvas
```

浏览器检查用 D010 固定样例，先沿两条线选 service，阅读并返回，再选 audit。建立两个组，把非成员放进一组范围，缩放后拖组，检查成员与非成员的变化。看到已保存后关闭浏览器与服务，用新的浏览器和服务对比原坐标、视野、成员及磁盘文件。再通过图工具增加并移除节点，核对位置协调、坏图保护及旧标签页冲突。脚本使用独立临时项目，可通过环境变量指定兼容浏览器，证据落 `.local/D012/`。

D013 定向检查运行 `node tests/browser/canvas-fixes.mjs`，用本机临时端口和 `.local/D013/` 下的合成项目。覆盖正式删空再登记、同路径重加的两种页面时序和旧页草稿、合法特殊文件名的持久化、迟到清单与显式选篇。预期按 [F1—F4](../../docs/work/2026/11/D013-canvas-fixes/task.md)。

D014 构建后串行执行 `node --test tests/integration/dependency-legends.test.mjs` 和 `node tests/browser/dependency-legends.mjs`。前者检查实际 CLI、HTTP 写入范围和图发布失败重试；后者从旧文件布局开始，检查两类库、双语查看、混合分组、拖动重开、暂缺和正式删除。浏览器默认 Edge，可用 `AFTERTASTE_BROWSER` 指定 Chrome 或 Firefox。隔离项目、坐标记录和截图在 `.local/D014/`，每轮使用独立项目和临时端口。单独重建试读见 [D014 回执](../../docs/work/2026/11/D014-dependency-legends/handoff.md)。

## D026 依赖图首屏与框选分组

沿[共用试读重建](../../tests/README.md#页面改版共用试读)在 `.local/D026/` 建隔离副本并使用独立端口；写入式操作与故障注入都在副本完成。执行 `npm run typecheck`、`npm run build`，再串行运行 `node tests/browser/dependency-canvas-selection.mjs`、受影响的既有画布及阅读脚本。按 [SC-010—013](spec.md#measurable-outcomes)用真实内容核首屏、详情、浮钮、命名和异常状态，保留对应实图与重开证据。顶栏视口验证见 [006](../006-file-reader/quickstart.md#d026-共用顶栏)。

- 使用 `src/api.mjs` 的直接关系进入 `src/service.mjs` 的讲解并返回。在组背景起框，分别用浮钮和快捷键确认分组，再移动组和重开。用反向及缩放场景观察边缘可达性。
- 依次核空选、取消、输入框焦点、切页、已分组成员转移和键盘分组管理。隔离副本触发真实布局保存失败后恢复写入并重试。用同项目独立闭环实点步骤，分别核布局文件及重开结果。
