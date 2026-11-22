# D037 · 浅色选区浮条与右上角随手记回执

## 当前结论与入口

**待作者试读。** 4341 已在原订单项目上运行受审构建 `38f1e8d`。六页顶栏的纸笔可在当前页写一篇独立笔记，输入后才建篇，眼睛切换 Markdown 预览。桌面选区浮条为 64 × 32 CSS px。[打开本机试读](http://127.0.0.1:4341/) · [独审原文](review.md) · [使用说明](../../../../usage/file-reader.md#记录项目笔记)

作者可从两个场景验收。

1. 打开 `src/service.mjs`，划选首块的「服务随后忽略这个返回值」。悬停两个图标，观察浮条在选文旁遮住多少文字。点「加入笔记」可继续选择用原句新建或追加。[D036 同句](../../../../../.local/D036/touch-fix/edge-SJHO1x/candidate-service-selection.png) · [D037 同句](../../../../../.local/D037/final/edge-fxHlU5/candidate-service-selection.png)
2. 滚到讲解中段，点顶栏纸笔，写一行 `**待核对**：为什么先校验数量？`。点眼睛预览，再用铅笔回到刚才的光标。面板开着时向下读几行，点关闭后接着读。焦点在面板内时也可按 Esc 回到纸笔。想试样式可以只开空面板，输入正文才会保存到项目。[右上角预览实图](../../../../../.local/D037/r1-fix/history-edge-4lZ2CT/quick-note-preview.png)

分支 `codex/feat-quick-note-overlay` 保留给作者体验，比较基线为本地 `dev@73a1fbc`。[批准任务](task.md) 固定于 `106e170`，无调整。实现候选 `8cc0b26` 完成首轮自测与独审。修复候选 `38f1e8d` 通过独立复核，审查者已交还写入。回执与审查归档单独提交。dev、主分支、远端及发布均无本单写入。作者本轮确认了设计，候选的遮挡感、面板大小及阅读手感仍待亲验。

## 依据与验证

- **设计与实现。** 用 Spec Kit 的 specify、plan 和 tasks 生效模板在 006、011 原目录增量维护，复用既有 HTTP 契约、修订号及存档。编码前用 analyze 核对两组规格、方案及四项新任务，浮条与命中、六页现场、首次输入及共享草稿、失败与引文恢复各有验收路径，未发现待裁决项。implement 前置通过，两个功能各一份 requirements 清单，均 16/16。Ponytail full 与 Impeccable 按项目局部界面流程使用。[006 实施项](../../../../../specs/006-file-reader/tasks.md#d037--浅色选区浮条与右上角随手记) · [011 实施项](../../../../../specs/011-project-notes/tasks.md#d037--浅色选区浮条与右上角随手记)
- **选文。** 1440 × 900 的 Edge 在同一服务首块实测，外框由 80 × 44 缩到 64 × 32，两项命中从 36 × 36 缩到 28 × 28。段落和记录区顶边在划选与收起前后均为 475.05、559.83 px。390 px 细指针仍紧凑。粗指针实点复制和加入笔记，两项各 44 × 44，左右边界在 x=236 相接。白灰表面与 4 px 模糊只用于选区浮条。原生复制、带定位的剪贴板文本、拒绝写入后的手动复制、悬停、Tab 和强制色均经浏览器验证。[尺寸与实际粘贴](../../../../../.local/D037/final/edge-fxHlU5/report.json) · [强制色实图](../../../../../.local/D037/final/edge-fxHlU5/selection-forced-colors.png)
- **原页操作。** 六页中英文宽窄窗口均核当前页、面板宽度与回焦。在讲解中段把反向选中的「接口」切到预览再切回，继续输入替换为 API。在面板外点击和滚动，关闭后停在新位置。站内往返仍回到原图和讲解。图面板开合时复核边界、视野变换与文件节点位置。390 px 长稿还核了编辑框非零滚动、选区方向。320 px 英文触控顶栏实点菜单、刷新、纸笔与关闭。[页面与历史](../../../../../.local/D037/final/history-edge-rATXPk/report.json)
- **落盘与恢复。** 空开、连点、预览及 Esc 后零笔记 PUT。首次原生粘贴后立即关闭，重开服务读回恰好一篇。Edge 组合输入未提交时也零写入。试读副本对已有 `notes.json` 设置只读后提交中文并立即关面板，服务实际返回 422 / `NOTE_WRITE_FAILED`，原文件逐字未变。重开找回同一稿，恢复权限后重试，故意清空、撤销后均读回正确。工作台原笔记、筛选与待处理引文可接续。另在双文件样例用 Windows 文件锁、延迟响应、响应中断及两个页面修改复验草稿保护与冲突。[失败实图](../../../../../.local/D037/final/workbench-xfjq6F/quick-note-failure.png) · [工作台记录](../../../../../.local/D037/final/workbench-xfjq6F/report.json) · [笔记记录](../../../../../.local/D037/final/edge-kS1ZME/evidence.json)
- **环境与复验。** Windows，Node 24.11.1。用 Node 24 运行 `npm run typecheck`、`npm run build`，串行运行 `node tests/browser/notes.mjs`、`reader-center.mjs`、`record-workbench.mjs`、`reader-history.mjs`（后三个也在 `tests/browser/`）。Edge 158.0.4370.33 四项通过，阅读中区另在 Chrome 157.0.8103.80 与 Firefox 159.0 通过。试读输入冻结在 `.local/D037/input/project`，用 `AFTERTASTE_READER_INPUT`、`AFTERTASTE_D035_INPUT`、`AFTERTASTE_D028_INPUT` 指向它，测试会各自复制。`notes.mjs` 使用专有双文件样例。日志由 `AFTERTASTE_TEST_TASK` 归入同一任务。[自测目录](../../../../../.local/D037/final/)
- **一次测试前提修正。** 首次粗指针检查用段落元素边界构造 Range，截图有选文，但折叠端点没有可用字面坐标，尚未点到动作。改用可见文字节点的实际端点后，在同一输入下实点两项通过，测试修正 1 轮。[首次现场](../../../../../.local/D037/selftest/history-edge-nSVtOm/coarse-pointer-failure.png) · [复走结果](../../../../../.local/D037/selftest/history-edge-qgja0t/report.json)
- **未验证项。** 触控、强制色和输入法组合过程用浏览器环境模拟。实体触屏、系统输入法候选窗与读屏器未实测。后端存储、API 和数据格式沿用，未跑全量后端套件。Vite 构建成功，主 JS 约 510 kB（gzip 约 179 kB），触发 500 kB 的体积提示。
- **独审修复。** R1 在 `8cc0b26` 实测文件缺失后原错误提示盖住眼睛和关闭按钮，两次命中均落到提示文字。保留诊断，随手记展开期间提高顶栏层级，修复 1 轮。R2 在 `38f1e8d` 的新副本上实点预览、关闭和原提示，回焦纸笔，后台原文件、220 px 阅读位置及历史状态均保持。修复构建重跑 Edge `tests/browser/reader-file-switch.mjs` 和 `tests/browser/reader-history.mjs`，其余复用首轮同实现证据。两轮原文按次序归档。[独审原文](review.md) · [修复后自测](../../../../../.local/D037/r1-fix/) · [复核实图与命中](../../../../../.local/D037/independent-r2/)

## 资源与交回

2026-11-22，核对原监听 PID 2288、D036 固定资源、试读项目路径和活动连接后，换为 PID 30108 的 `127.0.0.1:4341`。新首页、JS、CSS 与 `.local/D037/build-38f1e8d/` 逐字节一致。换版前后原项目 HEAD 均为 `4be951b2bf9aae434e0acc3e1aeab3e4e0cf0734`，`docs/aftertaste/` 下 15 份资料及布局的逐文件 SHA-256 完全相同（清单 SHA-256 `3d23e7cb6e6b217947ed814a792855fb33762c61b987987c238ba210d18992f8`）。换版后在 4341 实际选中服务首块同句，量得 64 × 32。空开随手记、预览、Esc 回焦，全程零写请求、零页面异常。[换版前](../../../../../.local/D037/preview/before.json) · [换版后](../../../../../.local/D037/preview/after.json) · [在用资源和页面实测](../../../../../.local/D037/preview/live.json)

机器上的自测与独审服务、浏览器已收束。固定构建、截图和完整日志保留在本机 `.local/D037/`。回执中的实测摘要及独审原文随仓库保存。需要重启专用试读时，在本仓库根、4341 空闲的前提下运行以下命令，终端返回 `"status":"ready"` 后打开本机试读。

```powershell
& ./.local/D009/runtime/node.exe ./.local/D037/build-38f1e8d/cli/main.js serve --project (Resolve-Path -LiteralPath '.local/2026-11-19-page-preview/project').Path --port 4341
```
