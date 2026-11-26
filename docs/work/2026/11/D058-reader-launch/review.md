# D058 · 独立审查原文

## R1 · 2026-11-26

**结论：需修复。** 独审依据为 D058 任务单 `445f6c3`，无有效调整，基线为 `dev@862ef01`，候选为 `d8ef377791515bcc91c8657554c7e8895c47b6d3`。核对了 `445f6c3..d8ef377` 的 CLI、服务、授权、页面、Skill、规格和测试差异。按单个用户在本机使用、允许并发两次启动的场景审查。

1. **P1 · 探测超时会误报停止并丢失登记。** 实例探测把超时、连接拒绝和明确不匹配合为 `false`。若已有阅读服务短时卡顿，第一次探测超时会使停止命令删除登记并返回 `not-running`，打开命令也可能覆盖旧登记。若第一次探测通过，随后停止请求和核验都超时，命令会返回 `stopped` 并删除登记。旧服务恢复后，原私密入口和会话仍可使用，普通停止命令也失去了该实例的登记。应区分已验证、可确认旧实例已失效以及暂时无法确认，遇到最后一种结果时保留登记并报告真实失败。建议用隔离实例超时后恢复的回归覆盖停止和重开。此问题由调用链确认，本轮未注入超时。 [实例管理](<D:/project/SpecDev Harness/aftertaste-reader/src/server/reader-instance.ts:67>)

核对入口只在回环地址监听。已授权同源页面加专用请求头后才能取得私密入口，响应禁缓存。启动、实例探测和停止的签名用途各自区分。CLI 与页面沿用原文件块、闭环步骤定位。Skill 将新成果的自动启动放在本批校验和读回之后，按批次限一次，并保留只给链接及失败后复制路径。 [授权入口](<D:/project/SpecDev Harness/aftertaste-reader/src/server/reader-session.ts:48>) · [产品 Skill](<D:/project/SpecDev Harness/aftertaste-reader/skills/aftertaste-reader/references/tools.md:124>)

核对了 run5 安装包 SHA-256 `C2565FE41F41400170F8866F074C5AA35CB41AB0799BA023342C49BD4B64A9B2` 和定向检查 24/24。run5 的 Edge、Chrome 记录覆盖跨浏览器复制文件块和闭环步骤、普通链接拒绝及私密地址退出。该复制测试的首浏览器由测试直接进入。Windows 原生打开成功有 run3 证据，run5 有一次退回链接，真实聊天点击未走通。全量旧测试提前终止。 [定向检查](<D:/project/SpecDev Harness/aftertaste-reader/.local/D058/run5/reader-checks.log>) · [浏览器复制](<D:/project/SpecDev Harness/aftertaste-reader/.local/D058/run5/copy-browser.log>) · [原生打开](<D:/project/SpecDev Harness/aftertaste-reader/.local/D058/run5/native-browser.log>)

审查结束时 HEAD 与候选一致，工作区干净，本轮未启动浏览器或服务。作者试读与本地合并仍按任务单交接。**采集结束，可以恢复写入。**

## R2 · 2026-11-26

**结论：通过。** 复核候选 `82f138d33b6aef8bfcc85e9ca54b4da9376e3c69`，审查 `d8ef377..82f138d` 的控制探测、停止流程、契约和回归。核对 run6 安装包 SHA-256 `F6BE6CA1F4AA9D7CDD9153FF2A0C3653CCED94639ADCE1C4F8A7BE80F8C2E65A`。

**R1 P1 已关闭。** 首次探测超时会返回 `READER_INSTANCE_UNVERIFIED` 并保留实例登记。已核实实例后，只有收到明确不匹配的应答或连接被拒绝，停止流程才删除登记并报告 `stopped`。停止期间持续无法确认时返回 `READER_STOP_FAILED`，恢复后可再次停止。本轮定向检查 25/25，新增回归覆盖首次探测暂停、停止请求及后续探测暂停、恢复后正常停止并删除登记。端口占用、并发复用和原来源与会话保护回归通过。 [实例管理](<D:/project/SpecDev Harness/aftertaste-reader/src/server/reader-instance.ts:67>) · [定向检查](<D:/project/SpecDev Harness/aftertaste-reader/.local/D058/run6/reader-checks.log>)

run6 的 Windows 原生 Chrome 记录覆盖首页、文件块、闭环步骤各打开一次，仅链接模式未打开浏览器。独立 Edge 与 Chrome 记录覆盖私密入口复制、落到同一位置、普通入口对未授权浏览器的拒绝。测试分别验证系统打开与跨浏览器复制，首个复制浏览器由测试直接进入。前一包的真实 DSH Web 聊天中，点击私密入口收到 403，复制后经地址栏等价导航可进入 `d058-order-limits/limit`，地址栏仅保留普通位置。本次修复未触及这些浏览器和会话入口。 [原生打开](<D:/project/SpecDev Harness/aftertaste-reader/.local/D058/run6/native-browser.log>) · [浏览器复制](<D:/project/SpecDev Harness/aftertaste-reader/.local/D058/run6/copy-browser.log>) · [聊天点击](<D:/project/SpecDev Harness/aftertaste-reader/.local/D058/trial/dsh-web/result.json>)

本轮未重跑全量旧测试，未启动浏览器或服务。结束时 HEAD 与候选一致，工作区干净。作者试读与本地合并仍按任务单交接。**采集结束，可以恢复写入。**
