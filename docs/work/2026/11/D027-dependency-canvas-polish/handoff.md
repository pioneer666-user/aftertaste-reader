# D027 · 回执

## 当前结论与入口

[4341 共用试读](http://127.0.0.1:4341/) 已提供受审候选 `2e5a664`。在「文件依赖图」从空白滑向 `service.mjs` 再点选，即可沿两条入边找到数量规则与审计文件，沿一条出边找到 API。宽窗的文件详情在画布下方展开，79% 下可同时看全三个端点。左下角可点小地图定位，固定抓手或选择工具，按住 Ctrl 临时反转。

三浏览器自测通过。独审首轮发现保存中改名会留下旧提示，第一轮修复后复核通过，审查已交还写入。原请求、失败时序和复核结论见[独立审查原文](review.md)。

作者可在共用试读判断卡片、曲线和点阵的手感。用隔离副本完成了写入和失败验证。任务分支 `codex/feat-dependency-canvas-polish` 保留待作者验收，`dev` 位于 `5298a10`。本批仅在本机提交和换版。

## 依据与验证

[派单](task.md)固定于 `0d83d46`，无调整。基线为 `5298a1033cf0fa8df11c28f06d1b70c81a4233a1`，首轮候选为 `feff50901f77e9834eaf1fa6066c649f7df1221d`，修复候选为 `2e5a6646a6dcc65ab69daf3d8f7c56ae998f099a`。正式依据为 [007 US6、FR-011、FR-014—018、SC-014—016](../../../../../specs/007-dependency-canvas/spec.md) 和 [08 R16、A17—18](../../../../../specs/001-first-release/08-current-spec-and-acceptance.md#graph-layout-acceptance)。

按 Spec Kit v1.4.0 的 specify、plan、tasks 及生效模板增量维护 007 的需求、计划、模型、研究、试读步骤和任务，更新使用说明及 08 快查。analyze 将本批 6 项功能要求与 3 项成功条件全部映射至 T034—040，未发现覆盖缺口。implement 前置定位已有 007，requirements 清单 16/16，各阶段均无扩展 hooks。工程沿用 Vue Flow 端口、视野和既有布局修订。卡面三层轮廓共用一条 SVG 路径，点阵在相同世界网格绘制，小地图只适配自己的边界。布局文件和 HTTP 格式沿用原协议，未新增依赖。局部呈现按 Impeccable 的阅读与操作场景在实图和窄窗核对。

Windows 11（26200），Lenovo 83AS，Ryzen 7 7735HS，AMD Radeon Graphics，Node 24.11.1。改前与候选以同一份实际订单项目 `.local/D027/input` 对照。固定源码 `4be951b2bf9aae434e0acc3e1aeab3e4e0cf0734`，初始布局修订 `645113bd-c001-4481-b2c8-d1bbf4988e02`，缩放 0.7917047465。副本包含四篇讲解、标准库、原组和五个节点坐标。下列目录均位于 `.local/D027/`。

| 实测范围 | 结果与复查入口 |
| --- | --- |
| 构建、类型及候选 | `npm run typecheck`、`npm run build`、`git diff --check` 通过。最终 JS 为 `index-Ukk-c0wr.js`，CSS 为 `index-BFvN1b35.css`。 |
| 79% 读图与点阵 | Edge 1440 × 900。同一取样区有 235 个像素随悬停改变，停稳后连续采样相同，滑入卡片后回到静止图。三条直接关系的曲线、箭头和左右端口在原位可追，阅读讲解返回保持选中与视野。[改前选中](../../../../../.local/D027/before-selected.png) · [候选选中](../../../../../.local/D027/polish-edge-QvMMVd/04-selected.png) · [静止、悬停、进入节点实图](../../../../../.local/D027/polish-edge-QvMMVd/) |
| 拖图、拖节点和组 | 79% 下实拖 `service.mjs`，两个中间位置的三条边与端口测量误差均为 0 CSS px。组拖动约 55 px，组边缘经过同一批格点时颜色改变，格点仍对齐。Tab 聚焦、Enter 选中及两个同名文件长路径的可访问名称、详情、反向边和自环均核过。长路径和自环部分单独使用合成读取响应。Edge 单次拖动采样 21 个 rAF 间隔，中位 16.7 ms，不能外推为真机操作延迟。[几何取证](../../../../../.local/D027/geometry-edge-SSU13z/report.json) |
| 工具与小地图 | `node tests/browser/dependency-canvas-tools.mjs` 串行通过 Edge 157.0.4341.60、Chrome 157.0.8103.79 和 Firefox 159.0。两种工具均验证提前松 Ctrl、下一拖恢复、失焦、组内反向框选、鼠标旁分组、Ctrl+G、输入框 Ctrl+A。地图点击和拖框与主图双向同步，390 px 窗口实点缩放与收起，重开保留坐标，闭环步骤与视野独立。[Edge 报告](../../../../../.local/D027/tools-edge-WH6VjA/report.json) |
| 新组保存与涟漪 | `node tests/browser/dependency-canvas-polish.mjs` 在上述三浏览器串行通过。三个创建入口均比对真实 PUT、磁盘与近远两带逐帧像素。阻住响应时零圈，恢复 200 后一圈。Windows 锁文件产生 `LAYOUT_WRITE_FAILED`，失败时原布局字节相同。重试成功一圈，切页返回、改名、普通平移和减少动态效果均为零圈。减少动态效果时有可见的新组保存文字。重开核实最终组与成员。独审额外覆盖无关旧修订先到及成功回包丢失后重试。[最终报告](../../../../../.local/D027/polish-edge-QvMMVd/report.json) · [重试成功的连续帧时序](../../../../../.local/D027/polish-edge-QvMMVd/快捷键重试-frames.json) |
| 关联回归 | Edge 串行运行 `dependency-canvas`、`canvas-fixes`、`dependency-legends`、`loop-reader` 和 `dependency-canvas-selection` 通过。覆盖已有图更新、循环、自环、草稿恢复和冲突、边缘浮钮、组内外成员、两图分别重开。对应日志为 `regression-*.log`。 |

**首轮修复。** 真实操作已触发两次合法写入。新组创建的较早响应带有旧名，较晚修订已改名或解散。首轮代码从较早快照取提示文字，磁盘结果正确。修复保存成功提示时记住组 ID，在最终布局已确认时取对应名称。三浏览器均复验改名和解散两种情况，独审在同一固定输入上复核。

测试取证中保留了几项失败记录。第一次类型检查定位到 Bézier 参数可选属性，显式传端口坐标后通过。悬停采样改在上一处回弹结束后比较两份稳定图。保存采样区分静态着色与涟漪亮色，并在返回页面时等待画布位图有尺寸。拖动断言改为比较实际卡片或组把手的位移。一次旧闭环样例准备返回 `EPERM`，同输入构造路径在新副本重跑通过。对应日志在 `polish-edge-3uQn4N`、`polish-edge-mdynen`、`polish-edge-9lurSN`、`geometry.log`、`tools-final-firefox.log` 和 `selection-edge.log`。

自测使用真实桌面浏览器引擎与自动化指针。作者的实际设备手感尚待亲验，未运行全仓 `npm test`，未测 macOS 或 Safari。

## 试读服务与交回

换版前确认原 D026 监听进程为 PID 45512。开工取副本后，共用项目的视野曾平移，节点和分组一致。换版直接沿用共用项目当时的布局修订 `9097d867-0880-4e91-b881-84ab02daeff7`，视野为 x = 764.3144、y = 93.9543、缩放 79.17%。原项目 14 份资料在换版前后 SHA-256 逐份一致，四篇讲解、两条闭环、两个书签、三条标注和两篇笔记均读回成功。

4341 由固定构建 `.local/D027/build-2e5a664/cli/main.js` 提供，Node 监听进程为 PID 12504，项目为 `.local/2026-11-19-page-preview/project`。已核 HTTP 首页与 JS、CSS 和受审构建逐字节一致，用新开的 Edge 页面实际点选服务文件，显示 79%、三条直接关系、小地图，零次写请求。试读服务留给作者，所有验证专用浏览器和临时端口已收束。换版进程与哈希保存在 [核验目录](../../../../../.local/D027/preview-2e5a664/)，试读画面见 [4341 实图](../../../../../.local/D027/preview-2e5a664/4341-selected.png)。

本回执为转交主脑的唯一入口。最后的 Git 归档只记录独审原文、清单完成与交回结果。
