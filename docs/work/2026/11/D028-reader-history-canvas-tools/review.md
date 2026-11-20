# D028 · 独立审查原文

## R1 · 2026-11-20

**结论：需修复。** 审查依据为 D028 派单 `f00becb` 和底部横向毛玻璃摘要调整。产品基线为 `1be9d52`，固定候选为 `c0124ab6d7f759aba966ec62cb96b53d3b1224d4`。审查范围包括共用顶栏、访问历史、依赖图浮层、闭环回访、记录保存与恢复，以及对应的 006、007、009 规格。后收到的左侧工具图标和相邻文字调整归下一候选。

按项目适配使用 Ponytail Review 和 Impeccable，追踪了导航、布局、保存及记录读写代码。Win 11 `10.0.26200`、Node `24.11.1`、Edge `157.0.4341.60` 上，用 `.local/D028/build-c0124ab` 和 `.local/D028/frozen-input` 的隔离副本执行 `node tests/browser/reader-history.mjs`。实点打开 `api.mjs` 讲解、滚到块内、切书签并完整往返，恢复块内偏移 92 px、所选节点和画布视野。实点文件与 `node:path` 的底部详情、闭环右栏源码和分支理由。1600 × 900 顶栏页签及小地图底边位移均为 0 CSS px，画布边界和视野在详情开合保持一致。桌面横向毛玻璃摘要与窄窗可关闭详情符合本轮调整。证据在 `.local/D028/history-edge-Pv9jnW/report.json` 及同目录截图。

1. **慢速回图会覆盖已经完成的新操作。** `src/web/DependencyCanvas.vue:170–209`。从讲解后退到图，暂扣图 GET，点 `support/audit.mjs` 并缩放，布局保存成功返回 200。释放图 GET 后，选中回到 `src/api.mjs`，视野从 95.0% 退回 79.2%。应保留回图期间发生的新选择及视野动作，并继续保护已保存布局。证据在 `.local/D028/independent-edge-UjOezr/probe.json` 的 `graphLateRead`。
2. **笔记回访读取失败后，显示的「重试」没有发请求。** `src/web/ProjectNotes.vue:147`、`src/web/notes-editor.ts:47–50`。笔记已有本地读取结果，离开再后退，阻断新发出的笔记 GET。点「重试」后 GET 次数仍为 1，告警持续。重试应重新读取并继续保护草稿。证据在 `.local/D028/independent-edge-QeyD2J/probe.json` 的 `notesRetry`。
3. **书签回访遇到在途刷新，会遗漏目标失效提示。** `src/web/App.vue:364–368、394–398、549–560`。访问书签并返回，延迟一次刷新，前进到讲解后再后退，随后释放已移除原书签的响应。列表从两条变一条，原书签消失，未给出原因。回访判定应等在途读取，按当前列表定位或给出失效提示。标注具有相同的提前返回路径，动态复现仅覆盖书签。证据在 `.local/D028/independent-edge-QeyD2J/probe.json` 的 `removedBookmark`。
4. **窄窗切换首帧顶栏横向溢出。** `src/web/style.css:24–25、322–326`、`src/web/App.vue:304–311、835–839`。从 1600 缩到 390 CSS px，三次首帧均实测文档宽 459 px，桌面菜单还无 `popover` 属性。收纳稳定后文档宽恢复 390 px。窄窗媒体样式应立即约束旧桌面行，保留收纳与焦点交接。证据在 `.local/D028/independent-edge-UjOezr/probe.json` 的 `resize`。

沿 006、007、009 与 08 核对了批准行为和验收交叉引用，未发现本批改变项目持久化格式或服务端契约。首个故障探针曾使用错误的审计文件路径，定向重跑用实际 `support/audit.mjs` 得到第 1、4 项证据。独审未测真实触屏硬件、作者观感或 4341 换版。

候选提交、固定构建及冻结输入保持原状。所有本轮浏览器和临时服务已关闭。**采集结束，可以恢复写入。**
