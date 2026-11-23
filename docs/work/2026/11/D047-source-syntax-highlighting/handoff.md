# D047 · 回执

## 当前结论与试读

候选 `b1be8629c93aed00a40921d36717415b1e98013f` 完成固定源码栏离线多语言高亮。开箱按源码路径选择语法，已有讲解可直接试读。实现、自测及独立复核完成，已合入本地 `dev`。本单试读、回归和独审均用仓库内合成资料。

- [试读 config.py 首块](http://127.0.0.1:4318/#aftertaste-block/docs%2Faftertaste%2Fcurrent%2Fconfig.py.md/syntax01)可对照导入、普通名字和跨块三引号，切换主题看颜色变化。
- [试读 Demo.vue 首块](http://127.0.0.1:4318/#aftertaste-block/docs%2Faftertaste%2Fcurrent%2FDemo.vue.md/syntax01)可查看模板标签和属性、TypeScript 脚本及 CSS。窄窗可横滚查看长行。
- 2026-11-23，作者在执行会话确认「可以，合并到dev」，授权将当前 D047 候选合入；验收记录限于此次合并确认。
- A1 和合成数据口径在 `0379fc1` 随实现提交。合并提交为 `39ae507c92e261acab98259337ad3fe10f366355`，父提交为 `dev@7ea3b50` 和任务分支尖端 `6abc30c`。合并树与分支尖端完全相同，复用候选自测及独审。已回到 `dev`，工作区干净，已安全删除本地任务分支 `codex/feat-source-syntax-highlighting`。本次整合仅为本地操作。

## 依据与验证

- 实现依据为[原单](task.md) `979fbfb` 及[调整 A1 和作者执行时补充](amendments.md)，比较基线 `dev@7ea3b50`。按 Spec Kit v1.4.0 的 speckit-specify／speckit-plan、当前解析的 spec-template／plan-template 增量维护既有 [006 spec](../../../../../specs/006-file-reader/spec.md)（FR-023、SC-021）、[plan](../../../../../specs/006-file-reader/plan.md)及受影响的 research、data-model、quickstart。核过路径前置、原模板和 constitution。既有 plan 被保留，前后均无扩展 hooks，未执行整套工作流。既有 HTTP 和资料格式照常使用。
- Node 24.22.3 上 `npm run typecheck`、`npm pack`、从实际 tarball `npm install --offline --omit=dev` 均成功。包大小 2,066,165 字节，SHA-256 为 `3DAF60E576081BD30C78A97B267EC4D76DF537CB5C3D54921AADE8968FF87BC6`。包含本机 JS 语法分块、WebAssembly 引擎与再分发声明。Vite 有分块尺寸提示。[包清单](../../../../../.local/D047/a1-r2/pack-files.txt)
- Shiki 锁定目录有 242 个语法 ID。实际包按许可证排除九项，其余 233 项随包，其中 231 项可通过 231 个文件名或 812 个后缀匹配。两个未独立关联的 ID 是 `jsonl`（该后缀用 JSON 语法）和 `reg`（纯文本）。C/C++ 共用的 `.h` 使用 C++ 语法。Terraform/HCL 等排除项见 [第三方声明](../../../../../THIRD-PARTY-NOTICES.md)。
- Windows 11 26200 上，Edge 158.0.4370.33 用独立上下文逐篇首次打开，并拦截外网请求和写请求。合成固定提交 `21da6e25ff3344d1b548d5448118c4b0585f4602`。八种指定语言 Java、C、Vue、JavaScript、TypeScript、HTML、CSS、Python 全部实测。另实测 C++、C#、Go、Rust、PHP、Ruby、Shell、PowerShell、SQL、JSON、YAML 和 Dockerfile，并检查 `.h`、`.mjs`、`.mts`。25 份样例中 23 份着色，55 个代表片段按预期分类，未知后缀和被排除的 Terraform 样例保留纯文本。Vue 分别检查模板、TS 脚本和 CSS，Python 刻意将工作区改成另一文本，页面仍逐行对齐固定提交。尖括号、与号、空行、缩进和行号逐行对比，跨块字符串与注释保持原语境。[离线矩阵](../../../../../.local/D047/a1-r2/offline/browser.json)
- 五套主题原位切换，测量关键字、普通名、字符串、注释、标签、属性六类共 30 个样本，最低 5.35∶1。390 px 下分别滚到 Vue 长行及纯文本长行末并用指针选取，行号横向位置稳定。拦截 Rust 分块时原文完整，切换 TypeScript 后成功着色。延迟 Python 分块时保留先选的整行，原生 Ctrl+C 读回相同文字，清除选区后着色。[离线矩阵及截图](../../../../../.local/D047/a1-r2/offline/)
- 最终候选的 Edge `reader-center.mjs` 与 `node --test tests/integration/file-reader.test.mjs` 通过，后者 7/7。R1 的 Edge 和 Chrome 文件阅读回归通过。首轮中区脚本在基线和候选均因 1440 px 下目标短语未跨行而停在选区断言。保留跨行要求，将该场景视口设到实际换行的 1360 px，长行测量也改用最后一个文本节点，兼容着色分段，后续中区回归通过。[最终中区结果](../../../../../.local/D047/a1-r2/reader-center.log) · [最终集成结果](../../../../../.local/D047/a1-r2/file-reader-integration.log)
- 独审 R1 复现首次着色清空原生选区。一次修复后，候选在源码存在原生选区时延迟切换显示，等选区离开再着色。执行的延迟分块回归和 R2 独立复核通过。[独审原文](review.md)
- 未逐项实测全部语法和路径关联，未验实体触屏。Firefox 文件阅读回归的既有行号对比度断言在 `979fbfb` 与初版候选均测得 3.33∶1，低于 4.5∶1。最终离线矩阵和独立复核为 Edge 主验，该 Firefox 断言留存基线证据。[Firefox 基线输出](../../../../../.local/D047/a1-r1/file-reader-firefox-baseline.log)

## 本机资源

合入后 4318 仅监听 `127.0.0.1`，PID 33544。试读服务独立使用 `.local/D047/a1-r2/install` 的固定安装和 `.local/D047/a1-final/project` 的合成项目。4317 原服务仍使用 PID 32096。自测、基线和独审专用浏览器及临时核验服务已收束。试读结束后可停止 4318。在仓库根从同一安装重新开时，等终端出现 `"status":"ready"` 再点试读链接，Ctrl+C 可关闭本次前台进程。

```powershell
$node24 = where.exe node | Where-Object { (& $_ --version) -like 'v24.*' } | Select-Object -First 1
$cli = (Resolve-Path -LiteralPath '.local/D047/a1-r2/install/node_modules/aftertaste-reader/dist/cli/main.js').Path
$project = (Resolve-Path -LiteralPath '.local/D047/a1-final/project').Path
& $node24 $cli serve --project $project --port 4318
```
