# D051 · 闭环节点说明试读回执

## 当前结论与入口

**候选 `5d0ba32` 已完成自测与独立复核，保留在 `codex/feat-loop-node-annotations`，待作者试读。** 讲解 AI 可以给单个闭环步骤写 Markdown 短注。读者可点「节点说明」收起，点同一张步骤卡再展开，也能对照该步固定提交的源码。[批准单与样式依据](task.md) · [两轮独审原文](review.md)

| 试读入口 | 可直接体验的动作 |
| --- | --- |
| [稀疏图 · 带前导零的数量能下单吗？](http://127.0.0.1:4351/#aftertaste-loop/quantity-text/check) | 在「转换后再判断数量」卡下读 `"04"` 和 `"4.5"` 的区别。收起说明，再点同一卡片。源码入口对应 `src/rules.mjs` 第 1–7 行。[展开截图](../../../../../.local/D051/author-read/sparse-open.png) · [收起截图](../../../../../.local/D051/author-read/sparse-closed.png) |
| [手摆密图 · 路径与数量](http://127.0.0.1:4351/#aftertaste-loop/annotated-inputs/paths) | 从「输入类别」组里的「查看文件名」开始，点卡打开就近说明，再收起。切到「查看数量」可进阅读栏看完整列表。小窗口可先点底条「收起讲解」露出画布。[手摆原位](../../../../../.local/D051/author-read/dense-manual.png) |
| [同项目文件依赖图](http://127.0.0.1:4351/#canvas-reading) | 点 `rules.mjs` 查看文件，再点通往 `service.mjs` 的依赖线，读取「在创建订单前使用数量转换与范围校验约定」。 |

作者待验纸色短注的阅读观感，以及密图里从选步到就近读说明的手感。常规位置在卡下对齐左缘；若主动打开时下方受窗口边缘或关系条遮挡，会就近贴卡上缘，右栏占宽时横向避让。收展不移动手摆位置。当前分支保留候选；后续归档提交只补交接材料。合入本地 `dev`、推送与发布均待作者另行决定。

## 依据与验证

- **版本与规格。** 基线 `dev@4b30f2d`，批准单 `b6b1554`，无调整。首轮实现 `3542cf6`，右栏遮挡修复 `5d0ba32`。按 Spec Kit v1.4.0 读取 specify、plan 技能与实际解析模板，核了功能路径、项目原则和 hooks。沿 008、009 原结构增量更新场景、功能要求、成功条件、方案、模型及契约。本批使用已有实施清单。[008 FR-008、SC-008](../../../../../specs/008-loop-authoring/spec.md) · [009 FR-012、SC-012](../../../../../specs/009-loop-reader/spec.md)
- **制作到读回。** 执行会话显式读取安装版 `SKILL.md` 与闭环指南，沿合成订单项目已有的「职责与取舍」讲法，从文件讲解、依赖查询及固定源码核分支，编写了上方稀疏图的四步路线，仅判断步附短注。通过安装包的 `pin`、`create-loop`、`read-loop` 保存并核对 JSON 与 Markdown。首次以相对输入路径调用被 CLI 拒绝，换为同一文件的绝对路径后成功。判断步与异常步共享原块，读回只有判断步有说明。页面实点读到 Git 提交 `4be951b2bf9aae434e0acc3e1aeab3e4e0cf0734` 的第 1–7 行，工作区故意放置的 `WORKTREE_ONLY` 没有进入结果。[试读原始输入](trial-input.json) · [安装包 Markdown 读回](../../../../../.local/D051/author-read/quantity-text.md)
- **程序自测。** Windows、Node 24.11.1，`npm run typecheck`、`npm pack` 及隔离离线安装成功。串行执行 `canvas-layout.test.mjs`、`loops.test.mjs`、`loop-reader.test.mjs`，分别通过 6、6、1 项。覆盖空白短注拒绝、同块两步各自读回、纯讲解步、固定源不可用和布局保存。后两次构建只动前端，三个安装目录的 36 个 CLI／后端编译文件逐文件哈希汇总相同。无注释旧订单闭环可直接重读。[命令集成用例](../../../../../tests/integration/loops.test.mjs)
- **页面自测。** 最终包在 Edge 158.0.4370.33、Chrome 158.0.8127.38、Firefox 159.0 串行通过同一用例。桌面、390 像素窄窗、800 与 950 像素开栏覆盖默认开合、复点、换步、键盘、模拟触屏、选文、长文、源码、中英文控件、纯讲解步和旧图。读说明时布局 PUT 为零，手摆密图的坐标、组、视野与磁盘字节均维持原值。主动拖步、拖组、缩放和确认重排分别收到保存响应，重排保组并为注释留位。留用服务另实测平移并移回、深色主题及两处直达。依赖图无注释或占位，文件点选、点线读理由及布局文件原字节已核。[浏览器用例](../../../../../tests/browser/loop-annotations.mjs) · [密图构造](../../../../../tests/fixtures/loop-annotations.mjs)
- **修复与复核。** 首测发现窄窗底条遮字，随后修正视口外卡片的注释错误横移；鼠标拖动用例改用独立页面，确保真实鼠标手势不受紧邻的触摸事件抑制。重排截图发现分支线穿过默认短注，增加按实际曲线避让的判断。独审 R1 另复现开栏遮挡，单轮修复后 R2 在原场景实测关闭。旧轮次一次 Chrome 启动即退出，最终包三浏览器均完整跑通。实体触屏及作者本人对教学内容的体验尚待验证。

## 资源与交回

服务仅监听本机 `127.0.0.1:4351`，交回时 PID 为 `5284`。使用 `.local/D051/author-read/project` 合成项目与 `.local/D051/review-fix/installed/node_modules/aftertaste-reader` 安装包，未操作 4317 或其他试读服务。最终包 SHA-256 为 `d1f31546c8ac6a833bbe76d4192be47598217276447367ec1b567d8a27a0eb2b`。截图、实际包、浏览器日志与合成项目在本机 `.local/D051/` 保留至作者验收；独审临时服务已关闭。

若机器重启，在本仓库根目录的 PowerShell 执行下行，出现 `status=ready` 后可重开上述入口。前台服务可用 Ctrl+C 结束。若要停当前保留的实例，请先核对该端口的进程命令行与本单安装路径。

```powershell
& .local/D009/runtime/node.exe .local/D051/review-fix/installed/node_modules/aftertaste-reader/dist/cli/main.js serve --project (Resolve-Path .local/D051/author-read/project).Path --port 4351
```
