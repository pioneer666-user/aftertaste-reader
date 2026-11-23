# D044 · 阅读器五套主题回执

## 当前结论与订单入口

[打开订单第 03 步「规则返回后回到服务」](http://127.0.0.1:4346/#aftertaste-loop/order-quantity/resume)。顶栏「界面语言」旁的「主题」可切换浅绿、暖色、科技蓝、浅白和深黑。本次试读的产品提交为 `14e6a660eba125ba8bc0f4011cff1486c51a0350`。原审查者已在独立订单副本复核通过，两项首审发现均已关闭。作者于 2026-11-23 指示合并到 dev，实际阅读体验待作者验收。

1. 选一套想长期使用的主题，在文件讲解中交替阅读规则块与源码。关页后用同一浏览器和地址重开，确认仍是刚才的选择。
2. 切到「文件依赖图」，从左上目录选择订单闭环，再点 `src/service.mjs`。暖底与 ◆ 表示经过的文件，实线粗边表示当前点选，库使用虚线。试一次深黑→浅绿。
3. 打开「笔记」中的《订单步骤核对》，从引文回到第 03 步，再按左上后退，在规则块的页边查看书签理由和红色 ? 批注。

派单起点 `504fec9`，产品基线 `dev@592793f`，固定订单源码 `4be951b2bf9aae434e0acc3e1aeab3e4e0cf0734`。试读从 D043 副本独立复制，主题与语言分别使用同一站点下的 `aftertaste.theme` 和 `aftertaste.language`。仅在读者选定主题时写浏览器偏好。项目资料格式沿用现行版本。[批准任务](task.md) · [用色盘点](color-audit.md) · [独审原文](review.md)

## 六页五主题自测

Windows 11、Node 24.11.1、Edge 158.0.4370.33，1440 × 900 CSS px。每行先打开表中所示内容，再依次选暖色、科技蓝、浅白、深黑、浅绿。同一元素持续挂载，记录所在屏幕几何、样式和实页截图，JSON 按页面与主题索引。窄窗和强制色另测。[六页接触表](six-pages.jpg) · [Edge 操作及取样实值](../../../../../.local/D044/self/themes-edge-SPMTmk/report.json) · [浅绿版前／候选同场景](green-comparison.jpg)

| 已打开的订单场景 | 浅绿 | 暖色 | 科技蓝 | 浅白 | 深黑 |
| --- | --- | --- | --- | --- | --- |
| 文件讲解 · 同块页边标注 | [实页](../../../../../.local/D044/self/themes-edge-SPMTmk/reader-green.png) | [实页](../../../../../.local/D044/self/themes-edge-SPMTmk/reader-warm.png) | [实页](../../../../../.local/D044/self/themes-edge-SPMTmk/reader-blue.png) | [实页](../../../../../.local/D044/self/themes-edge-SPMTmk/reader-white.png) | [实页](../../../../../.local/D044/self/themes-edge-SPMTmk/reader-black.png) |
| 依赖图 · 路线与选中文件 | [实页](../../../../../.local/D044/self/themes-edge-SPMTmk/canvas-green.png) | [实页](../../../../../.local/D044/self/themes-edge-SPMTmk/canvas-warm.png) | [实页](../../../../../.local/D044/self/themes-edge-SPMTmk/canvas-blue.png) | [实页](../../../../../.local/D044/self/themes-edge-SPMTmk/canvas-white.png) | [实页](../../../../../.local/D044/self/themes-edge-SPMTmk/canvas-black.png) |
| 闭环 · 第 03 步与源码 | [实页](../../../../../.local/D044/self/themes-edge-SPMTmk/loops-green.png) | [实页](../../../../../.local/D044/self/themes-edge-SPMTmk/loops-warm.png) | [实页](../../../../../.local/D044/self/themes-edge-SPMTmk/loops-blue.png) | [实页](../../../../../.local/D044/self/themes-edge-SPMTmk/loops-white.png) | [实页](../../../../../.local/D044/self/themes-edge-SPMTmk/loops-black.png) |
| 书签 · 理由与摘录 | [实页](../../../../../.local/D044/self/themes-edge-SPMTmk/bookmarks-green.png) | [实页](../../../../../.local/D044/self/themes-edge-SPMTmk/bookmarks-warm.png) | [实页](../../../../../.local/D044/self/themes-edge-SPMTmk/bookmarks-blue.png) | [实页](../../../../../.local/D044/self/themes-edge-SPMTmk/bookmarks-white.png) | [实页](../../../../../.local/D044/self/themes-edge-SPMTmk/bookmarks-black.png) |
| 标注 · 不理解与原话 | [实页](../../../../../.local/D044/self/themes-edge-SPMTmk/marks-green.png) | [实页](../../../../../.local/D044/self/themes-edge-SPMTmk/marks-warm.png) | [实页](../../../../../.local/D044/self/themes-edge-SPMTmk/marks-blue.png) | [实页](../../../../../.local/D044/self/themes-edge-SPMTmk/marks-white.png) | [实页](../../../../../.local/D044/self/themes-edge-SPMTmk/marks-black.png) |
| 笔记 · 混合引文编辑与预览 | [实页](../../../../../.local/D044/self/themes-edge-SPMTmk/notes-green.png) | [实页](../../../../../.local/D044/self/themes-edge-SPMTmk/notes-warm.png) | [实页](../../../../../.local/D044/self/themes-edge-SPMTmk/notes-blue.png) | [实页](../../../../../.local/D044/self/themes-edge-SPMTmk/notes-white.png) | [实页](../../../../../.local/D044/self/themes-edge-SPMTmk/notes-black.png) |

- **同一张图。** 订单的规则和服务两个文件出现 ◆，再点服务文件后保留路线底和选中边。文件、库、实／虚线和 SVG 箭头、分组、小地图和画布随主题更新。直接边与 marker 实际颜色一致。首次换色后从原 Canvas 位图读取组外 128 × 128 样区，五次得到五种不同点色，未平移、缩放或重挂。D027 波纹专项另外验证保存后才发生一次波纹，失败／待确认阶段无波纹，组内外点与移动行为沿用原图。
- **第 03 步与引文。** 选中《订单步骤核对》的随手记文本后切浅白、深黑，再聚焦原编辑器，读回实际光标、选区。点预览中的 resume 引文，原位切过五色时步骤、阅读栏和展开的固定源码保持一致，后退回到刚才的图。工作台用同一笔记并排编辑和预览，也能回访后接着编辑。
- **同块记录和失败。** 在 `x4y6az2y` 打开「这个边界例子讲得巧」的书签和「为什么要先校验数量」的批注，原位切五色。保留 ○、✓、? 三种符号。普通选文浮条原位切深黑，再注入剪贴板拒绝，手动复制框包含同块定位。另阻断隔离副本一次实际笔记 PUT，出现未保存及重试，切色后草稿仍在，放行重试后显示已保存。空笔记搜索也有真实样例。矩阵和只读回访写请求为零，故障专项记录的两次 PUT 分别是主动编辑失败与重试。
- **记忆及键盘。** 刷新和重新打开标签页均恢复深黑，无效旧值和拒读均从浅绿起步。拒写后同页仍切换并显示未保存。切到英文后主题独立。851／850 px 核桌面和收纳断点，390 px 顶栏分两行，方向键、Home、选择与 Esc 回焦均实际操作。390 × 430 粗指针且展开小地图时，画布贴合可视区，左浮条和 44 px 触控目标可达。
- **Firefox 旧缺口。** 固定旧构建的按钮 CSS 背景三态都为透明，实际绘制的 SVG 填充分别为普通 255/255/255、当前 231/239/233、悬停 240/245/241，键盘焦点额外绘出 51/130/104 的实线。新断言沿关联 SVG 或原生样式核三种不同填充及单独焦点环。完整 `dependency-canvas-selection.mjs` 已实际跑完逆向框选、只取完全命中、成组、移组、失败重试、重开与解散。[完整框选记录](../../../../../.local/D044/self/firefox-selection-final.log)

## 对比度与颜色来源

用生产页面截图采样文字区域的合成底色，并记录最接近实际文字颜色的像素。按 sRGB 相对亮度计算对比度。另在选中路线卡上沿读实绘边线与内、外相邻像素，对未直接关联的库线计入透明度，以同视野实测组内底色计算。下表是该批订单实页抽样中最低的文字与图线色对。完整值见 Edge JSON 各格的 `contrast`。普通字和大标题均按至少 4.5∶1 检查，控件和必要图形按 3∶1。装饰点、阴影和禁用态另列在盘点中。

| 主题 | 矩阵内文字／实绘底色（前四套为书签位置小字） | node:path → src/api.mjs 次要关系／组内底色 |
| --- | --- | --- |
| 浅绿 | #52645b / #e0eee4 · 5.26∶1 | #857396 / #e8ece6 · 3.59∶1 |
| 暖色 | #675748 / #ecdcc5 · 5.15∶1 | #87728c / #ece3d3 · 3.43∶1 |
| 科技蓝 | #495e78 / #d3e6fc · 5.23∶1 | #7e739b / #dfe8f1 · 3.52∶1 |
| 浅白 | #565656 / #dfe4e8 · 5.73∶1 | #84748e / #e7e7e6 · 3.48∶1 |
| 深黑 | 当前页签悬停 #bbdaf2 / #405666 · 5.26∶1 | #a592b8 / #252a2c · 5.12∶1 |

实际选中订单源码后，选区与相邻源码底板依表中顺序是 6.43、5.87、6.05、7.55、9.30∶1。首轮四套浅色仅有 2.58–2.80∶1，深黑当前页签的悬停文字原为 4.16∶1。修复后把这两处加入截图像素断言。文件讲解已滚动 140 px 时切深黑再回浅绿，读回的滚动位置仍为 140 px。

另外按五套实值核 CodeMirror 正文／选区分别为 4.52、4.71、4.54、4.93、4.57∶1，选区／编辑纸面分别为 3.13、3.16、3.02、3.11、3.07∶1。浅绿沿用正文墨色和纸底，调深控件边、选区和非直接关系线，避免选中路线后库线难辨。摘要保留 33% 底色、4 px 模糊与轻高光。强制色实测使用系统焦点色，Firefox 的圆角 border image 退出绘制。

## 工程验证

按 Spec Kit specify、plan、tasks 原件与生效模板增量维护 006 US13、FR-021、SC-019，并对齐 007／009／010／011／012。显式指定 006 目录并关闭功能目录持久化，setup-plan 保留已有计划，setup-tasks 识别现有模型、研究、契约和 quickstart。analyze 核对站点偏好、六页原位换色、图与编辑器特殊绘制、对比度与浏览器验收，均落到 T085–087。implement 前置返回五项设计材料，006 的需求清单 16/16。Ponytail full 复用现有渲染和保存路径，Impeccable 采用项目的既有页面局部视觉流程。产品、记录格式和 CLI 服务之间没有新增协议。

| 命令／运行 | 输入与结果 |
| --- | --- |
| `npm.cmd run typecheck`、`npm.cmd run build` | 通过。Vite 仍提示主 JS 压缩前超过 500 kB。 |
| `node tests/browser/reader-themes.mjs` | Edge 主验全部 30 格。Chrome 和 Firefox 各自串行复走六页、存储退化、键盘、选区与强制色。Edge 158.0.4370.33、Chrome 157.0.8103.80、Firefox 159.0 均用最终冻结构建完成，页面异常为零。[Chrome 操作记录](../../../../../.local/D044/self/themes-chrome-livGb3/report.json) · [Firefox 操作记录](../../../../../.local/D044/self/themes-firefox-2KoTIc/report.json) |
| `reader-center.mjs`、`loop-route-highlights.mjs`、`loop-note-revision.mjs`、`reader-margin-records.mjs` | 实际源码／讲解、路线清除和回访、闭环选文及笔记混合引文、标注返回都通过。D043 订单用于现有资料，创建《订单步骤核对》的旧用例使用 D042 副本。页边回归的旧下拉筛选定位改为现行分段按钮，继续核返回后的选中项。 |
| `record-details.mjs`、`reader-file-switch.mjs` | 前者在 D043 输入找不到 D041 的无备注书签，改用 D041 冻结样例，空态、失效、双区滚动及强制色均通过。后者实测占位、迟到请求、窄窗与切篇失败恢复。 |
| `dependency-canvas-polish.mjs`、`reader-history.mjs` | 原绿点阵与真实保存波纹通过。历史检查发现摘要填充过实和窄矮窗小地图越界，恢复低透明度玻璃并收短矮窗小地图后，D028 固定输入全程通过。曾在临时创建订单时遇到 EPERM，固定输入复跑已覆盖原操作。[完整历史](../../../../../.local/D044/self/history-frozen.log) |
| `file-reader.mjs` | Edge 全程通过。原错误定位在切文件时提前命中过上一文件的同名错误文案。现先等目标文件题头，并在文件枚举之后注入坏编码，实际验证普通 Markdown 降级、修复提示和恢复。[运行记录](../../../../../.local/D044/self/r2-file-reader.log) |

首轮独审在 `60a8a41` 独立复扫、操作 Edge 六页五主题并跑完 Firefox 框选链，发现深黑页签悬停与浅色源码选区两项对比度问题。原审查者在 `14e6a66` 另用订单副本复扫并复测两处、编辑器选区与强制色，完整复走 Edge 矩阵，确认关闭并交还写入。复核所用 Chrome／Firefox 主题结果为同一冻结构建的执行自测。[两轮独审原文](review.md) · [独立复核取样](../../../../../.local/D044/review/r2/probe.json)。未验证实体触屏、读屏器实际播报及作者长期阅读偏好，强制色用浏览器模拟。像素记录针对所列订单、视口与状态。

## 固定试读服务

本机端口 4346 由 D044 的 Node 进程 14512 监听，仅绑定 127.0.0.1。它使用 `.local/D044/reviewed-r2/dist` 和作者专用订单副本 `.local/D044/preview/project`。全新 Edge 标签页直接进入第 03 步，阅读栏已展开，可见「主题」，笔记《订单步骤核对》及其第 03 步引文可打开。此次只读检查的项目写请求和页面异常均为零。[入口实测](../../../../../.local/D044/preview/landing.json) · [打开时的画面](../../../../../.local/D044/preview/landing.png)

待验期间保留此服务。验收结束后可核对 4346 监听者及命令行，确认仍为上述构建和订单副本后结束该进程。需重开时，在本仓库根目录的 PowerShell 执行以下命令。

```powershell
& .local/D009/runtime/node.exe .local/D044/reviewed-r2/dist/cli/main.js serve --project (Resolve-Path .local/D044/preview/project).Path --port 4346
```

自测原始 PNG、JSON、固定输入及构建同留在本机 [.local/D044](../../../../../.local/D044/)。图版、盘点、回执和独审原文随仓库保存。

## Git 与作者验收

作者于 2026-11-23 在本会话指示「合并到dev」。派单为 `504fec9`，首审为 `60a8a41`，复核产品为 `14e6a66`，归档候选为 `a383139`。已以合并提交 `88993cc` 合入本地 `dev`，合并结果与候选文件树一致。核实候选已包含后，本地任务分支 `codex/feat-reader-themes` 已删除。未推送或发布。作者实际阅读体验仍待验收，试读服务和资料副本继续保留。
