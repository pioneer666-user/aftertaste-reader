# D030 · 文件树切篇的即时反馈与阅读占位回执

## 当前结论与入口

[4341 共用试读](http://127.0.0.1:4341/) 已换到受审候选 `e5233cd`。打开订单项目的 `src/service.mjs`，从本篇目录跳到「先校验数量，再建立待加入集合的对象」，再点 `src/rules.mjs`。可看目标行的即时反馈、两栏长短交错的骨架和读完后从篇首接读。在约 390 CSS px 窄窗从文件树选篇，可看收栏后先显示一段源码占位，再由讲解占位铺到底。 [4341 等待实图](../../../../../.local/D030/preview-e5233cd/4341-waiting.png) · [窄窗实图](../../../../../.local/D030/edge-aVFEQx/narrow-waiting.png)

快返直接提交新篇。等待超过约 120 毫秒时，在当前视口显示已知文件路径和占位。只有最后一次有效选择能提交。读取失败提示文件路径和原因，保留原篇的目录、读点和书签与批注草稿，可从文件树再选目标重试。

自测通过，[R3 独审复核](review.md#r3--2026-11-20)通过。作者已明确铺满和区分块高两项要求，最新候选的作者体验、实机读屏和实体触屏待验。候选和回执保留在 `codex/feat-reader-file-switch`，工作区干净，等待作者决定后续整合。

## 依据与验证

比较基线为 `dev@51ca38b`，派单 `eadf397`。初版 `95fa7da` 经 R1 通过后上 4341。按作者首条反馈铺满视口的 `33cef23` 在 R2 暴露 3000 CSS px 高视口留白。最终候选 `e5233cda24a0e5c34d790cf1a78a346c11b85b02` 改为随视口增减骨架组数，并按作者第二条反馈交错块高与行宽。用同一挂起响应重新验证高窗，R3 关闭发现。 [派单](task.md) · [两次作者调整](amendments.md) · [各轮独审原文](review.md) · [冻结清单](../../../../../.local/D030/frozen-e5233cd.json)

按 Spec Kit specify、plan、tasks 及生效模板增量维护 006 的 US4、FR-018—019、SC-017、模型、研究、复验步骤和任务。核了路径、计划准备、前置材料和 16/16 项需求检查，阶段前后无扩展 hooks。应用 Ponytail 和 Impeccable 的局部修改流程。 [规格](../../../../../specs/006-file-reader/spec.md#measurable-outcomes) · [复验步骤](../../../../../specs/006-file-reader/quickstart.md#d030-文件树切篇)

- Windows 10.0.26200、Node 24.11.1 下串行通过 `npm run typecheck` 和 `npm run build`。固定构建包含 71 个文件，订单副本 13 份资料及 Git HEAD 经哈希核验。 [类型检查](../../../../../.local/D030/typecheck-varied.log) · [构建日志](../../../../../.local/D030/build-varied.log)
- Edge 157.0.4341.60、Chrome 157.0.8103.79、Firefox 159.0 串行通过 `node tests/browser/reader-file-switch.mjs`。自然响应在本机约 0.72–1.10 秒。用相同服务的真实成功响应验证快分支，首个新篇帧约 18–33 毫秒，直接显示新篇。受控等待从服务原中段验证单一当前项、忙碌状态、稳定外框、旧内容隔离、覆盖、切页、历史及失败后的两份草稿。 [Edge 报告](../../../../../.local/D030/edge-aVFEQx/report.json) · [Chrome 报告](../../../../../.local/D030/chrome-0VQ7I5/report.json) · [Firefox 报告](../../../../../.local/D030/firefox-Jsrc0n/report.json)
- 1440×900 桌面首五个源码骨架分别高约 114、198、93、156、135 CSS px，讲解段落为 147、105、168、84、126 CSS px。将同一次等待拉高至 1440×1200 和 1440×3000，骨架继续延伸。原失败的 3000 高视口，源码最后可见行距底约 8 CSS px，讲解延伸至底边。390×844 窗口的末段讲解占位距底约 3 CSS px。 [桌面实图](../../../../../.local/D030/edge-aVFEQx/desktop-waiting.png) · [高窗实图](../../../../../.local/D030/edge-aVFEQx/desktop-portrait-waiting.png)
- `reader-navigation.mjs`、`reader-history.mjs`、`reader-center.mjs` 在已审的 `95fa7da` 行为上通过。后两次调整集中于等待中的骨架，受影响的切篇、后退和草稿交接在最终候选逐项重验。保留了基线触发、定位器修正及 R2 的实际失败记录。 [文件树回归](../../../../../.local/D030/reader-navigation-final-edge.log) · [历史回归](../../../../../.local/D030/reader-history-edge.log) · [阅读回归](../../../../../.local/D030/reader-center-edge.log) · [修复记录](../../../../../.local/D030/rounds.md)

## 资源与交回

4341 由进程 `45704` 提供固定构建 `.local/D030/build-e5233cd`，使用原订单项目 `.local/2026-11-19-page-preview/project`。首页、JS、CSS 响应哈希匹配构建。实速操作于首帧约 11 毫秒显示待开项，约 129 毫秒显示占位，约 846 毫秒呈现目标。烟测零写请求，换版前后 15 份原项目资料的 SHA-256 逐份一致，覆盖个人记录和布局。 [换版记录](../../../../../.local/D030/preview-e5233cd/preview.json) · [实速帧记录](../../../../../.local/D030/preview-e5233cd/browser.json)

隔离浏览器及临时服务均已关闭。保留 4341 与固定构建、证据供试读。需要重启时，从仓库根使用 `.local/D009/runtime/node.exe` 运行固定构建的 `cli/main.js serve`，以原订单项目绝对路径作为 `--project`，指定 `--port 4341`。
