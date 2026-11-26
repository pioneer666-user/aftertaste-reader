# D058 · 独立审查原文

## R1 · 2026-11-26

**结论：需修复。** 独审依据为 D058 任务单 `445f6c3`，无有效调整，基线为 `dev@862ef01`，候选为 `d8ef377791515bcc91c8657554c7e8895c47b6d3`。核对了 `445f6c3..d8ef377` 的 CLI、服务、授权、页面、Skill、规格和测试差异。按单个用户在本机使用、允许并发两次启动的场景审查。

1. **P1 · 探测超时会误报停止并丢失登记。** 实例探测把超时、连接拒绝和明确不匹配合为 `false`。若已有阅读服务短时卡顿，第一次探测超时会使停止命令删除登记并返回 `not-running`，打开命令也可能覆盖旧登记。若第一次探测通过，随后停止请求和核验都超时，命令会返回 `stopped` 并删除登记。旧服务恢复后，原私密入口和会话仍可使用，普通停止命令也失去了该实例的登记。应区分已验证、可确认旧实例已失效以及暂时无法确认，遇到最后一种结果时保留登记并报告真实失败。建议用隔离实例超时后恢复的回归覆盖停止和重开。此问题由调用链确认，本轮未注入超时。 [实例管理](<D:/project/SpecDev Harness/aftertaste-reader/src/server/reader-instance.ts:67>)

核对入口只在回环地址监听。已授权同源页面加专用请求头后才能取得私密入口，响应禁缓存。启动、实例探测和停止的签名用途各自区分。CLI 与页面沿用原文件块、闭环步骤定位。Skill 将新成果的自动启动放在本批校验和读回之后，按批次限一次，并保留只给链接及失败后复制路径。 [授权入口](<D:/project/SpecDev Harness/aftertaste-reader/src/server/reader-session.ts:48>) · [产品 Skill](<D:/project/SpecDev Harness/aftertaste-reader/skills/aftertaste-reader/references/tools.md:124>)

核对了 run5 安装包 SHA-256 `C2565FE41F41400170F8866F074C5AA35CB41AB0799BA023342C49BD4B64A9B2` 和定向检查 24/24。run5 的 Edge、Chrome 记录覆盖跨浏览器复制文件块和闭环步骤、普通链接拒绝及私密地址退出。该复制测试的首浏览器由测试直接进入。Windows 原生打开成功有 run3 证据，run5 有一次退回链接，真实聊天点击未走通。全量旧测试提前终止。 [定向检查](<D:/project/SpecDev Harness/aftertaste-reader/.local/D058/run5/reader-checks.log>) · [浏览器复制](<D:/project/SpecDev Harness/aftertaste-reader/.local/D058/run5/copy-browser.log>) · [原生打开](<D:/project/SpecDev Harness/aftertaste-reader/.local/D058/run5/native-browser.log>)

审查结束时 HEAD 与候选一致，工作区干净，本轮未启动浏览器或服务。作者试读与本地合并仍按任务单交接。**采集结束，可以恢复写入。**
