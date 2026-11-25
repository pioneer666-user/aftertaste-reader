# D055 · 在闭环节点上方试读讲解

## 当前结论与入口

固定行为候选 `7963b5a`（初版 `e42cc34`）位于 `codex/feat-loop-node-hover-preview`，开发基线 `dev@7fdce86`，批准单 `7ba5ceb`。普通教学步骤在全图或示例中停留约 350 ms 即可预览已有 Markdown。外壳左侧有 3 CSS px 主题色竖线，小倒三角指向卡片上沿。进场上移 3 px、淡入 150 ms，离开淡出 100 ms。已展开的节点说明优先；无法放置可读气泡时仍可点选步骤。

[试读 · 从空集合到第一条订单](http://127.0.0.1:4360/#aftertaste-loop/quantity-preview/check) · [对照 · 原始订单讲解](http://127.0.0.1:4360/#aftertaste-loop/quantity-examples/check)

1. 打开试读，点左栏「示例路线」，选「“04” · 成功建单」。先扫过，再停在「用返回的 4 建立订单」。看底边尾尖、左侧竖线和两段文字，包括加粗的「此时集合仍是空的」。
2. 从卡片上沿缓慢越过尾尖，移入气泡选几字，再移到空白处。判断出现和消失是否够轻。悬停「转换后再判断数量」，可与节点下方已展开的说明同时读。
3. 改选「“4.5” · 校验失败」，在「小数触发异常」读长文；点击步骤可到原有详情。按键盘 Tab 也可聚焦步骤及其中的链接，Esc 原位收起。

三浏览器安装包自测通过。R1 发现的框选按钮遮挡已修复；原审查者复核通过并交还写入，详见 [review.md](review.md)。2026-11-25，作者试读候选 `7963b5a` 后回复「可以，效果不错，合并到dev并推送」，认可气泡位置与动效并授权合并推送。

本地 `dev` 以合并提交 `4cf4393` 合入归档尖端 `018ba5f`，合并树与尖端一致，远端 `dev` 已核指向该合并提交。远端 `main` 核为 `9f31aec`。已切回 `dev` 并安全删除已合入的本地任务分支。试读服务继续使用固定安装包及独立资料。手机专项和全仓测试未执行。

## 依据与验证

- [批准任务](task.md)及[作者附图调整](amendments.md)。本批按 Spec Kit v1.4.0 的 speckit-specify、speckit-plan、speckit-tasks 和相应实际模板增量更新 009，保留原有结构，修订旧的轻抬描述及临时状态。范围为 [FR-016 / SC-016](../../../../../specs/009-loop-reader/spec.md)、[方案](../../../../../specs/009-loop-reader/plan.md)、[数据模型](../../../../../specs/009-loop-reader/data-model.md)、[US5 两项任务 T040–T041](../../../../../specs/009-loop-reader/tasks.md)。沿用 007 FR-024 的两图直接关系反馈。Markdown 复用右栏渲染器，布局、示例与保存契约沿用现状。局部 UI 使用 Impeccable 的项目裁剪与已有版式。
- Windows / Node 24.11.1。`npm run typecheck`、`npm pack --pack-destination .local/D055/r2`（含构建）、`npm install --offline --omit=dev --prefix .local/D055/r2/install .local/D055/r2/aftertaste-reader-0.1.0-alpha.1.tgz` 成功。安装包 SHA-256 为 `B94ADD0B6DFD01637AD03F9C1F2E2E8789EC3A39AF2938155B8B4449A2DC56B7`。资料由 R1 安装包的 `dist` 生成，R2 复用同一输入。[样例](../../../../../tests/fixtures/loop-step-preview.mjs)调用成品命令生成两份闭环。原单保留 D051 讲解与 D054 示例；另建的 Markdown 试读展示附图样式，均引用订单源码 `4be951b2bf9aae434e0acc3e1aeab3e4e0cf0734`。
- 设置 `AFTERTASTE_BUILD=.local/D055/r2/install/node_modules/aftertaste-reader/dist`、`AFTERTASTE_TRIAL_PROJECT=.local/D055/fixed/project`，依次将 `AFTERTASTE_BROWSER` 设为 `msedge`、`chrome`、`firefox`，串行执行 [node tests/browser/loop-step-preview.mjs](../../../../../tests/browser/loop-step-preview.mjs)。每轮复制独立资料并使用随机空闲端口。Edge 158.0.4370.33、Chrome 158.0.8127.38、Firefox 159.0 均通过。前两者实测原生连续圆角，Firefox 实测后备绘制。连续动作读到进退中间透明度；减少动态时实测过渡为 0 秒。对应记录在 `.local/D055/r2/{msedge,chrome,firefox}.log`，实图在 `.local/D055/browser-VPcaUX`、`browser-CBKFvB`、`browser-aUuPLI`。
- 自动检查覆盖原文前提、两个输入，粗体、行内代码、代码块、列表和长文提示，慢移进正文选文、键盘与安全链接实开、Esc 归焦，快速扫过及鼠标与键盘分别指向两步、源代码返回、拖动与缩放、上沿降级、右栏尾尖及向上展开的注释避让。预览阶段布局文件逐字节相同、零 PUT、视野及浏览历史保持；另切换依赖图核直接边。R2 新增复现框选操作，气泡打开时按钮中心命中「分组」，实际点击后可输入组名。浏览器运行无页面错误。手机专项、全仓测试与作者主观体验未包含在上述结论中。
- 开发中的首轮位置实测发现透明的方向提示容器占满画布，导致建单气泡无法打开。只避让它的实际按钮后，同一场景通过（1 轮）。测试中改用顶栏切依赖图，并按 Firefox 实际的「卡片 → 可滚动正文 → 链接」顺序核焦点。早期 npm 默认缓存受限和一次样例写入 EPERM，经授权离线打包、在独立新目录重新生成后成功。启动服务一度使用相对项目路径被 CLI 拒绝，换用绝对路径后返回 ready 和 HTTP 200。

## 资源与交回

D055 专用服务监听 `127.0.0.1:4360`，启动时 PID `13964`，页面返回 HTTP 200，API 读回两条示例与建单步 Markdown。服务使用 `.local/D055/r2/install/` 中的包、`.local/D055/fixed/project/` 的资料。通过 HTTP 取回的 JS 和 CSS 均与 R2 安装包对应文件逐字节相同。每轮测试进程已经自己关闭。既有服务和资料继续保留。

重启前确认该端口空闲，在仓库根目录 PowerShell 运行：

```powershell
& .local/D009/runtime/node.exe .local/D055/r2/install/node_modules/aftertaste-reader/dist/cli/main.js serve --project (Resolve-Path .local/D055/fixed/project).Path --port 4360
```

验收结束后可按端口、命令行与资料目录核对归属再停止 D055 服务。
