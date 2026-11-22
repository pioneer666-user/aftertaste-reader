# D035 · 个人记录工作台与笔记读写回执

## 当前结论与入口

**实施、自测和独立复核均已通过，待作者体验。** 4341 正在原订单试读项目上运行固定候选 `c9f61a4c49624301d9a60bc129dcf824d7b46b87`。三页共用左栏列表与中间详情，桌面可收栏，窄窗选一条后读整宽详情。个人记录格式与存取接口沿用原版。[打开本机试读](http://127.0.0.1:4341/) · [阅读器说明](../../../../usage/file-reader.md) · [独审原文](review.md)

作者体验可看三处：

1. 在笔记搜「回」，选择「回访」，打开《数量无效时，订单去哪了？》的第一处引用。后退后直接按 Tab、Enter，接着读第二篇讲解。
2. 打开笔记先读正文，再点「编辑」。看桌面左右对照与窄窗「编辑／预览」是否顺手，点「完成」回到正文。正文和标签会自动保存。
3. 在书签读「这个边界例子讲得巧」的完整理由，再从「不理解」标注读「为什么要先校验数量？」；分别点列表里的「回原文」，确认落在同一规则块中各自的记录。

## 依据与验证

- 批准提交 `acdcf57`，产品基线 `dev@3ba3f18`，无调整。工作台实现 `55e66b4`，补回键盘测试的启用等待后固定首审候选 `96cd91e`，R1 修复候选为 `c9f61a4`。成果保留在 `codex/feat-personal-record-workbench`，本次在该分支归档回执，未合入 dev、推送或发布。[任务单](task.md)
- 按 Spec Kit 的 specify、plan、tasks 和解析出的生效模板增量维护 006、010、011、012。编码前用 analyze 核对四组场景、要求和实施项，implement 读取的四份需求清单各 16/16。共用导航由 006 FR-020／T066 定义，书签、笔记、标注由各分册 FR-009 与 T016、T017、T015 承接，R1 追加 011 T018。沿用原模型、契约、依赖与保存队列。按项目适配使用 Ponytail full、Impeccable 的 Read／Operate 和实际窗口检查；复用既有视觉系统，未开启上游引擎的设计选稿流程。[导航](../../../../../specs/006-file-reader/spec.md) · [书签](../../../../../specs/010-block-bookmarks/spec.md) · [笔记快验](../../../../../specs/011-project-notes/quickstart.md) · [标注](../../../../../specs/012-understanding-marks/spec.md)
- Windows、Node 24.11.1、Edge 158.0.4370.33。使用 `npm run typecheck`、`npm run build` 和 `node tests/browser/<用例>.mjs`。首审产品版本串行通过 record-workbench、reader-history、notes、bookmarks、understanding-marks、reader-navigation。Windows 文件锁让笔记 PUT 实际返回 422；旧文件完整，失败草稿在切换笔记后仍可重试。另验自动保存后 Ctrl+Z、保存中继续输入、双页冲突、选文新建与明确选篇追加、改标保留批注、同块有／无备注的精确书签焦点。[首轮自测日志](../../../../../.local/D035/selftest/) · [正式回归](../../../../../tests/browser/record-workbench.mjs)
- 长文返回初测发现加载提示改变了原句位置，偏差 37 px。保存点击时的原句偏移后，自测返回前后均为 464.84 px，侧栏保持 1312 px，Tab 接到第二处。测试也校正了长文首行、真实收藏理由全文、标注刷新时按钮可用性三项前置。历史用例在旧错误消失、正文高度变化时核实际原句位置；稳定布局另核精确滚动读数。[长文与窄窗报告](../../../../../.local/D035/workbench-AqI7M5/report.json)
- **独审与修复。** 未参与实现的审查者在另一份订单副本复验长文、读写保存及同块回访。R1 发现长文中段点失效引用时，错误已获焦但在视口上方，顶边约 −2065 px。新增可见区断言在原候选复现后，以一轮产品修复让提示留在当前阅读区。最终候选重跑类型、构建、record-workbench、reader-history 和 notes；独审 R2 实测提示完整位于 113.59–165.39 px，之后可继续访问两处有效引用，零写入。R1 唯一问题已关闭，审查者明确交还写入。[复验日志](../../../../../.local/D035/selftest-r2/) · [独立测量](../../../../../.local/D035/independent-r2/report.json) · [两轮独审原文](review.md)
- 验证覆盖桌面、窄窗及中英文键盘操作。本单未运行全量 Node 单元／集成套件，未实测 Chrome、Firefox、实体触屏或读屏器。Vite 生产构建成功，主 JS 产生约 505 kB 的体积提示。D035 操作手感及 D034 订单教学效果均待作者亲验。

## 资源与交回

换版前核准旧服务 PID 18868 及其项目，待该端口无已建立连接后切换。现有监听为 `127.0.0.1:4341`，PID 19992，项目仍为 `.local/2026-11-19-page-preview/project`。换版前后，项目 HEAD `4be951b2bf9aae434e0acc3e1aeab3e4e0cf0734` 和全部 15 份资料的逐文件 SHA-256 均相同，包含笔记、书签、批注和个人布局。实访 4341 核对首页、JS、CSS 字节与固定构建一致；在原资料只读打开两处引用，首处由旧版约 727 px 上移到 215 px，全程零写请求、零页面异常。[换版前](../../../../../.local/D035/before-switch.json) · [换版后](../../../../../.local/D035/after-switch.json) · [实际服务验证](../../../../../.local/D035/preview.json)

专用服务与 `.local/D035/build-c9f61a4` 保留到下一次授权换版。需重启时，在仓库根使用 PowerShell 运行：

```powershell
.local/D009/runtime/node.exe .local/D035/build-c9f61a4/cli/main.js serve --project (Resolve-Path '.local/2026-11-19-page-preview/project').Path --port 4341
```

其余验证服务与浏览器已关闭。作者可将本回执直接交回主脑。
