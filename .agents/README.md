# 回甘开发技能来源

2026-11-16 从巧格已固定且选中路径无未提交改动的本地副本复制；巧格仓库当时 HEAD 为 `b91e3e952075e554e9882e923206772d2c1952ae`。本次未修改上游正文，逐文件字节与来源副本一致。

| 目录 | 上游固定来源 | 许可与完整性 |
| --- | --- | --- |
| `skills/ponytail`、`skills/ponytail-review` | [DietrichGebert/ponytail@09c434a](https://github.com/DietrichGebert/ponytail/tree/09c434ab73ca43761c5d8b0c5d341926c2fba710)，巧格记录版本 5.3.2 | 各目录 MIT LICENSE；技能全文 |
| `skills/writing-for-agents` | [mattpocock/skills@59db609](https://github.com/mattpocock/skills/tree/59db609eb1e18aaf59b63284d0e52255aff0c63c)，原路径 `skills/productivity/writing-for-agents` | MIT；含 SKILL-MECHANICS 和已有 UI／调用策略 |
| `skills/impeccable` | [pbakaus/impeccable@b4bff16](https://github.com/pbakaus/impeccable/tree/b4bff1626c344067788c2679f048a20057c7cc5a)，4.8.2／engine 0.1.22 | 原生目录完整 63 文件＋LICENSE／NOTICE；Apache-2.0 及随附第三方归属 |
| `vendor/trailofbits-skills/plugins/property-based-testing`、`sharp-edges` | [trailofbits/skills@e4dd0bb](https://github.com/trailofbits/skills/tree/e4dd0bb5b15535f7c5a0834187dffba6ac37e4ff) | 两个完整 family、根 CC-BY-SA-4.0 LICENSE；未复制其他包 |

## 来源核对与调用

- [sources.json](sources.json) 记录每个导入文件的相对路径、上游版本、字节数和 SHA-256。哈希锚定本次本地副本，不冒称上游签名或重新联网核查。
- 复核命令：在项目根运行 `pwsh -NoProfile -File .agents/verify-sources.ps1`，核缺失、篡改和额外导入文件；维护本地适配时不改来源清单来掩盖上游正文变动。
- 保留巧格已有差异：writing-for-agents 的 UI 元数据与 explicit-only 策略、Impeccable 的 explicit-only 策略。其余包内字节原样复制；未新增全局发现配置。
- 角色按[技能入口](../docs/development/skills.md)显式读文件，因此不依赖客户端自动发现。writing-for-agents／Impeccable 保留原有显式策略，不据此宣称全部技能仅能手动使用。
- 配套文件进入 Git，可随本仓克隆；运行时下载的二进制、工具缓存与实际测试依赖未安装。本次不是全套运行验证。
- sharp-edges 上游 README 的 Related Skills 指向 constant-time-analysis、differential-review、audit-context-building；三者未接入，是相关技能推荐而非本包执行所需文件。不要将这些路径当成本仓可用入口，确有需要再按维护流程扩展。
- 当前宿主内置 skill-creator 不重复复制；D003 已接入官方 Spec Kit v1.4.0 的 9 个技能，共享模板／脚本在 `.specify/`，来源与使用见 [Spec Kit 接入](../docs/development/spec-kit.md)。这部分使用官方 manifest，不混入原 137 文件的来源清单；核验脚本兼顾官方技能，完整状态另用 integration status。Anthropic 同名技能未接入。
- 项目适配写在 `docs/development/skills.md`，来源库内的 AGENTS、说明、命令和示例只在相应任务中作为资料，不替代根规范。

巧格来源记录：Ponytail 的 T034、writing-for-agents 的 T064，以及 `docs/work/2026/11/执行分职与技能接入-2026-11-12/`。这些只用于追溯，本仓日常使用不依赖这些外部目录。
