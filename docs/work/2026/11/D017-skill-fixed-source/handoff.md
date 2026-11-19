# D017 · 回执

## 当前结论与入口

- 讲解 AI 按固定提交从仓库根列树，并用完整目录边界筛出项目相对路径。分批生成指南链接到实际枚举和读回示例。首次用 `pin` 固定，续批直接接收原映射，两次都用 `read` 在内存接收完整 JSON。接收上限按正文最坏两倍转义开销计算，另计路径和映射字段。
- 行为候选 `4544cacca9fc305b4ebd1b2b3b4f91221976c10f`。自测覆盖正式说明的四组行为以及 20 项既有 Skill 和固定取源回归。独审 R2 通过，R1 发现已关闭。[审查原文](review.md)
- 作者验收待进行。入口是 [分批生成的固定取源步骤](../../../../../skills/aftertaste-reader/references/generation.md#2-读固定源码并选批次) 和 [实际调用示例](../../../../../skills/aftertaste-reader/references/tools.md#固定文件枚举)。可关注列出的项目路径是否符合范围，以及换上下文续批时是否仍使用固定提交的内容。
- 候选保留在 `codex/fix-skill-fixed-source`，工作区干净，待作者决定是否合入 `dev`。交回只归档证据。本地分支未整合，未推送或发布。

## 依据与验证

批准依据为 [D017 任务单](task.md) `65e199f4efea12edff85d61d8689b7f44598c32f` 和作者本次指令。比较基线 `dev@58402cbdea3efd0dc1f9b4c7ffc40f674d3f8b06`。依据 [005 FR-002、FR-008](../../../../../specs/005-generation-skill/spec.md) 和 [固定取源 CLI 契约](../../../../../specs/002-fixed-source/contracts/cli.md) 做小维护。技术细化集中在 Skill 中同一组 JavaScript 示例，测试逐段执行原代码，只注入项目、版本、选中文件和断言。

在 Windows 11 `10.0.26200`、Node `24.22.3`、Git `2.50.1.windows.1` 串行运行。自测使用 `dist/cli/main.js`，用 Node 24 执行 `node_modules/typescript/bin/tsc --outDir .local/D017/self/build` 后核对 CLI 入口、固定取源用例及 Git 适配器的编译产物，三者与根 `dist` 的对应文件逐字节一致。

- `node --test --test-concurrency=1 tests/skills/fixed-source-example.test.mjs` 通过。样例提交 A 为 `aaec08454c61b33b3b6b00522e39fd6a7d54c00b`，B 为 `5f7fdc8fe81dc269f8fef3184115e1f09825e1d4`。旧式 Git 调用在本地启用 A → B 对象替换时返回 B 的文件集合，单独把宿主 `GIT_DIR` 指向另一个仓库时退出 128。在两种条件下，现行示例均列出 A 的完整集合。根项目包含 `根 A.txt`、`包 空间/子 项目/唯 一 A.txt`、`包 空间/子 项目/较大 文件.txt`、`包 空间/子 项目-相邻/邻居.txt`。子项目恰有 `唯 一 A.txt` 与 `较大 文件.txt`，相似前缀的相邻目录与 B 独有文件均未进入子项目清单。分别选中根、子项目 A 独有的普通 UTF-8 文件，核对项目映射、路径、固定提交和完整正文。
- 新上下文续批验证了两条路径。未提供已有映射且版本缺省时固定 HEAD 的 B。传入原 A 映射时，枚举集合、选定路径、提交和正文仍与 A 一致。
- 同一测试通过正式 CLI `pin → read` 读回含中文、回车、换行、引号、反斜杠和制表符的合成样例。正文 792,000 字节，CLI 的 JSON 1,152,526 字节。核对了路径、提交和逐字相等的正文，正文 SHA-256 为 `528e36a6b4f94c566dba965eefca03660a1fd8b13d0b42f995e35196b5067d6d`。将接收上限降至 Node 默认的 1 MiB 复现 `ENOBUFS`，另请求 A 中缺失的文件得到退出 1 和 `FILE_NOT_FOUND`。两种失败均只返回诊断，异常没有原始输出字段。
- 使用同一参数逐文件执行 `tests/skills/generation-static.test.mjs`（2 项）、`tests/skills/generation-sample.test.mjs`（1 项）和 `tests/integration/fixed-source.test.mjs`（17 项），均通过。Skill 结构使用 `python -X utf8 quick_validate.py skills/aftertaste-reader` 校验通过，本机默认 GBK 读取不适用于该校验器。R2 重跑了正式说明和 Skill 静态检查，CLI 取源回归及已有试读样例的入口和输入未变，沿用 R1 结果。暂存差异检查通过。

R1 候选 `641fe20054b2d94ebc0b6971152bcf474f11b744` 独审发现公开示例续批会重新固定 HEAD。R2 显式接收已有映射，在原样执行的回归中加了 HEAD 为 B 的对照。补验及独立复核均通过，累计一轮修复，审查已交还写入。

本次实测范围为 Windows 开发树、隔离 Git 样例和超过默认缓冲的小型正文。64 MiB 正文极值按 CLI 接收上限推导，未创建该体积样例。其他操作系统、宿主自动发现和安装包未测。

## 资源与交回

可从仓库根使用 Node 24 重跑上述测试。最终示例及静态检查的自测输出在 `.local/D017/self-r2/`，其合成仓库在 `.local/D017/example-skOW26/`。R1 回归输出和隔离编译在 `.local/D017/self/`。本次未启动服务，既有 D016 试读服务和根 `dist` 保持原状。合成仓库和日志可重建，用于候选复核期间保留。
