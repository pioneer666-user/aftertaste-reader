# D025 · 独立审查原文

## R1 · 2026-11-19

**结论：需修复。** 默认 Git 配置下，独立重建、笔记回访和原项目保护均通过。两项受支持的 Git 配置会让新环境的重建中途失败，原因都是合成提交受宿主配置影响。

- **范围。** 批准依据为 [D025 派单](task.md) `4698278f85e135a224df947405d8164a72085ad9`，无有效调整。比较基线为 `dev@61c4bfe100001bc42d9bbe60e585ddf41c842802`，候选为 `ccb08e395c3f02a6030320a1df33b4335491a765`。检查了批准版本后的九个变更文件，以及固定取源、稳定块 ID、图布局、闭环与个人记录的现行规则和关联调用方。
- **入口和样例来源。** 阅读说明可直接打开 4341，图例、闭环、服务和合成试读均指向同一个维护章节。五份新固定输入与 D010 源文件的 Git blob 一致，D010 原件及专用测试无差异。
- **独立重建。** 用 `git archive --format=tar -o <归档> ccb08e3 tests/fixtures tests/README.md docs/usage/file-reader.md package.json` 将候选摘出至 `.local/D025/review/snapshot`。复制已有构建并接入现有运行依赖，确认隔离树没有 `docs/work` 或历史运行时。从该树根执行提交版 `tests/README.md` 的完整重建命令块，并用 `node tests/fixtures/reader-project.mjs <新目录>` 单独复核阅读器入口。环境为 Windows 11、Node 24.22.3 和 Git 2.50.1.windows.1。证据为 `.local/D025/review/rebuild.log` 和 `reader-only.log`。
- **回访和保护。** 独审脚本 `node independent-preview.mjs` 通过真实 CLI `serve --project <副本> --port 4356` 启动。四篇讲解的源码逐篇与 `git show` 对齐，订单依赖图包含「订单处理」分组和 `node:path` 图例，两条闭环及其固定源码可读。读取到两条书签、三条带批注的理解标记和两篇笔记。用 Edge 157.0.4341.60 打开笔记《数量无效时，订单去哪了？》，点击「数量规则承担转换与边界检查」，焦点到达 `src/rules.mjs#x4y6az2y`。在笔记中保存「D025 独审确认笔记重建保护」后，重跑说明命令收到已有资料提示，直接运行 `node tests/fixtures/loop-reader.mjs <已有项目>` 收到 `EEXIST` 并退出 1。`docs/aftertaste` 的 13 个文件重试前后 SHA-256 一致，含修改后的笔记和原有布局。证据在 `.local/D025/review/preview.log`、`retry.log`、`direct-retry.log`、`before.sha256` 和 `after.sha256`。
- **发现 1。固定合成提交受 Git 配置影响。** `tests/fixtures/generation-project.mjs` 的初始化和首个提交用于匹配固定讲解中的 `5394d8f86c961ce1b327674235525f57bf0b982c`。只给复验进程设置 `init.defaultObjectFormat=sha256` 后，在新目录运行同一说明命令，生成器的 40 位断言失败。只设置 `i18n.commitEncoding=ISO-8859-1` 时，首个提交变为 `ac7e684a2d12860f5f9b8d075b89b0e80863f174`，讲解仍引用原 SHA，订单闭环创建报 `LOOP_BLOCK_INVALID` 和 `VERSION_MISMATCH`。两个场景都在初始阅读记录落盘前中止，留下部分生成的目录。建议在合成生成器的 `git init` 显式指定 `--object-format=sha1`，在首个提交命令设置 `-c i18n.commitEncoding=UTF-8`，保持已有固定资料对同一个合成提交的引用。证据为 `.local/D025/review/sha256-rebuild.log` 和 `commit-encoding.log`。
- **未验范围。** 核对了执行的五个集成文件、三个 Edge 回归及 D010 归档测试通过日志。独审没有重复运行这些回归，也没有覆盖全量测试、其他系统或浏览器、作者资料体验和发布。
- **写入交还。** 复核候选 HEAD 与工作区一致，独审 Edge 会话及 4356 服务均已关闭。4341 仍由原 PID 35968 监听，独审未访问作者项目。采集结束，可以恢复写入。

## R2 · 2026-11-19

**结论：通过。** R1 发现 1 已关闭。两项 Git 配置同时生效时，候选仍能重建原固定首提交，并完成试读、笔记回访和已有资料保护。

- **复核范围。** 固定候选 `68f250504745559a0286c2e6d7d4bc84eec914d4`，与 R1 候选 `ccb08e395c3f02a6030320a1df33b4335491a765` 的差异仅涉及合成项目生成器和一项回归测试。生成器为 `git init` 显式指定 SHA-1，为首提交指定 UTF-8。产品源码、固定资料、D010 归档和使用说明与 R1 一致，复用同一产品构建。
- **原失败路径。** 用 `git archive` 从新候选摘出固定样例和说明至 `.local/D025/review-R2/snapshot`。确认隔离树没有 `docs/work` 或历史运行时。在 Windows 11、Node 24.22.3、Git 2.50.1.windows.1 下，用进程级 `GIT_CONFIG_*` 同时设置 `init.defaultObjectFormat=sha256` 和 `i18n.commitEncoding=ISO-8859-1`，从隔离树根执行 `tests/README.md` 的完整重建命令块。`git rev-parse --show-object-format` 返回 `sha1`，`git rev-list --max-parents=0 HEAD` 返回原固定首提交 `5394d8f86c961ce1b327674235525f57bf0b982c`，两条闭环及三份个人记录均生成成功。另运行 `node --test tests/skills/generation-static.test.mjs`，两项通过。证据为 `.local/D025/review-R2/rebuild-git-settings.log` 和 `generation-static.log`。
- **固定取源、回访和保护。** 在相同配置下运行 `node independent-preview.mjs`，通过真实 CLI 在 4356 启动隔离副本。确认四篇讲解的源码与各自固定提交的 `git show` 输出吻合，依赖图有分组和库图例，两条闭环可读，并载入两条书签、三条带批注的理解标记和两篇笔记。在 Edge 157.0.4341.60 点击笔记链接，焦点到达 `src/rules.mjs#x4y6az2y`，随后修改笔记并确认已保存。重跑说明命令收到已有资料提示，直接运行 `node tests/fixtures/loop-reader.mjs <已有项目>` 得到 `EEXIST`、退出 1。试读目录内 `docs/aftertaste` 的 13 个文件重试前后 SHA-256 一致，含修改后的笔记和原有布局。证据为 `.local/D025/review-R2/preview.log`、`retry.log`、`direct-retry.log`、`before.sha256` 和 `after.sha256`。
- **未验范围。** 本轮复核覆盖 R1 两项触发配置及相关行为。其余范围沿用 R1 审查和执行证据。未运行全量回归、其他系统或浏览器、作者资料体验或发布。
- **写入交还。** 核对 HEAD 仍为 `68f250504745559a0286c2e6d7d4bc84eec914d4`，工作区干净。独审 Edge 会话及 4356 服务均已关闭，4341 仍由原 PID 35968 监听。采集结束，可以恢复写入。
