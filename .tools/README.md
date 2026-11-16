# 本地 Spec Kit

下载日期：2026-11-14（Asia/Shanghai）。按作者 U4 下载到当前项目内，供后续直接读取模板与工作流。

2026-11-16 D003 复核：下方压缩包哈希一致，1,055 个解压文件逐一一致，无缺失／变化／额外文件。已用该固定源码通过 uv 隔离 CLI 完成项目级官方 Codex integration；现行技能／模板见 [Spec Kit 接入](../docs/development/spec-kit.md)。用户级 CLI 未升级，产品运行依赖未改变。

| 项目 | 记录 |
| --- | --- |
| 官方仓库 | https://github.com/github/spec-kit |
| 最新稳定版本核实结果 | v1.4.0；2026-11-14 查询官方 releases/latest |
| 发布时间 | 2026-11-10 |
| 对应 Git 提交 | 0019fa14d12f45edabc2cc3176c9168a68bd0f97 |
| 下载地址 | https://codeload.github.com/github/spec-kit/zip/refs/tags/v1.4.0 |
| 本地压缩包 | spec-kit-v1.4.0.zip |
| 本地源码 | spec-kit/ |
| 本次下载压缩包 SHA-256 | E21F526177A3BC3F884B6C92A821713B6EDE9E0B056DEA84B3BB2D2B411DCC99 |
| 许可 | 完整源码随附 MIT LICENSE |

压缩包校验值由本机下载后计算，用于本次副本的重复校验，并非上游发布的签名。

## 常用本地入口

- [上游 README](spec-kit/README.md)
- [需求模板](spec-kit/templates/spec-template.md)
- [需求编写流程](spec-kit/templates/commands/specify.md)
- [澄清流程](spec-kit/templates/commands/clarify.md)
- [设计计划模板](spec-kit/templates/plan-template.md)
- [技术设计流程](spec-kit/templates/commands/plan.md)
- [一致性分析流程](spec-kit/templates/commands/analyze.md)

下载源码作为固定来源保留，不自动更新版本；日常正式文档使用已安装到 `.agents/skills/speckit-*` 与 `.specify/` 的官方入口。用户指令和本项目约定优先，不因安装自动执行产品实现。

本记录进入 Git；压缩包和完整上游源码被忽略，不随本项目克隆恢复。需要重建 CLI 来源时，按上方版本下载并解压到 spec-kit/，保留上游许可并复核哈希。已接入的项目技能／共享文件随 Git 交付；uv 缓存中的开发 CLI 依赖可重建，不是产品运行依赖。未安装或升级全局 CLI。
