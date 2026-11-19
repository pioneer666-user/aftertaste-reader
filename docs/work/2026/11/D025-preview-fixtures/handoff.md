# D025 · 回执

## 当前结论与入口

- [阅读说明](../../../../usage/file-reader.md)已统一指向 [4341 共用试读](http://127.0.0.1:4341/)和[换版、首次重建说明](../../../../../tests/README.md#页面改版共用试读)。已有记录继续从共用项目读取。新副本默认建在 `.local/page-preview-copy/project`，可用 4342 单独打开。
- 阅读器和画布重建共用 [order-reading](../../../../../tests/fixtures/order-reading/) 的五份固定输入。源码生成器、块 ID、闭环生成器和初始个人记录沿用既有内容。D010 原件及专门校验其原件的测试均无差异。
- 成果候选 `68f250504745559a0286c2e6d7d4bc84eec914d4`，比较基线 `dev@61c4bfe100001bc42d9bbe60e585ddf41c842802`。候选自测通过。独审复核通过，已明确交还写入。
- 本批仅改使用说明和测试样例，无新增作者页面体验验收。保留 `codex/test-preview-fixtures` 供主脑接回。归档提交仅包含本回执和独审原文。工作区干净，dev 仍在基线，未推送、发布或合并。

## 依据与验证

[批准任务](task.md)固定于 `4698278f85e135a224df947405d8164a72085ad9`，无生效调整。按[现行规格](../../../../../specs/001-first-release/08-current-spec-and-acceptance.md)验证固定提交取源、块定位、笔记回访、依赖图和闭环。五份固定输入与批准版本中的 D010 对应文件 Git blob 相同。

执行在 Windows 11（26200）、PowerShell 7.6.9、Node 24.22.3、Git 2.50.1.windows.1 和 Edge 157.0.4341.60 验证。本次执行进程用 PATH 选择 Node 24。构建从本批产品源码在 `.local/D025/self/tree` 运行，依次执行 `node node_modules/typescript/bin/tsc`、`node node_modules/vite/bin/vite.js build`，复用仓内安装的运行依赖。隔离树没有 `docs/work` 或历史任务运行时，两轮验证树的改动文件分别与送审版本逐文件相同。产品源码和依赖锁文件自基线无差异，两轮使用同一构建。

下表为首个送审候选 `ccb08e395c3f02a6030320a1df33b4335491a765` 的自测。最终候选的复验见下文。

| 实际操作 | 结果 | 本机证据（相对 `.local/D025/self/`） |
| --- | --- | --- |
| 核阅读说明的链接与目标锚点，按 `tests/README.md` 在隔离树根执行首次重建 PowerShell 段 | 五处导向同一共用试读章节，两份说明指向 4341。空目录建成初始项目，固定源码提交为 `4be951b2bf9aae434e0acc3e1aeab3e4e0cf0734`。 | `rebuild.log`、`tree/.local/page-preview-copy/project/` |
| 启动 `node dist/cli/main.js serve --project $trialProject --port 4342`，用 `node verify-preview.mjs` 检查 HTTP 资料与 Edge 回访、保存 | `src/api.mjs`、`src/rules.mjs`、`src/service.mjs`、`support/audit.mjs` 的讲解机械校验通过，返回源码逐行匹配 `git show`。依赖图有「订单处理」组和 `node:path` 图例，两条闭环均可读取。初始有两条书签、三条带批注的标记、两篇笔记。点击初始笔记中「先校验数量，再建立待加入集合的对象」，焦点落在 `src/service.mjs#m3vuiqzi`。编辑第二篇笔记并确认页面报已保存、磁盘含识别文字。 | `preview.log`、`tree/verify-preview.mjs` |
| 执行 `check-protection.ps1`，重跑同一段首次重建命令，再直接运行 `node tests/fixtures/loop-reader.mjs $trialProject` | 说明中的守卫报已有资料，生成器在现有目录处报 `EEXIST` 并退出 1。个人修改、原布局和其余试读资料共 13 个文件，操作前后路径及 SHA-256 一致。 | `protection.log`、`check-protection.ps1` |
| 在无归档的隔离树，逐个运行 `node --test tests/integration/<名称>.test.mjs` | `file-reader` 7 项、`dependency-canvas` 6 项、`dependency-legends` 3 项、`loops` 6 项、`loop-reader` 1 项，共 23 项通过。 | 对应的 `*.integration.log` |
| 同一隔离树中依次运行 `node tests/browser/<名称>.mjs`，设置 `AFTERTASTE_BROWSER=edge`、`AFTERTASTE_TEST_TASK=D025`、`AFTERTASTE_CANVAS_PORT=4352` | `file-reader`、`dependency-canvas`、`loop-reader` 的 Edge 检查均通过。 | 三份 `*.edge.log` |
| 在另一个含 D010 原件的隔离树运行 `node --test tests/skills/generation-sample.test.mjs`，核候选相对批准版本的归档差异 | 原件测试 1 项通过，D010 原件与负责校验它们的测试无 Git 差异。 | `archive.integration.log`、`archive-check/` |

首次自测中，PowerShell 通过 `Push-Location` 切换到隔离树后，`[IO.File]::Copy` 仍从进程原目录解析相对目标，导致讲解已生成而初始记录复制失败，仓库原目录未写入记录。第一轮修复将 `$trialProject` 解析为绝对路径。用新目录执行说明中的原命令通过，失败副本保存于 `tree/.local/page-preview-copy-before-path-fix/`。

## 独审发现与最终候选复验

[独审原文](review.md)保留首轮与复核。首轮在两种 Git 配置下分别触发重建失败。SHA-256 默认对象格式导致 40 位提交断言失败，非 UTF-8 提交编码导致首提交变动、闭环引用不匹配。第一轮修复为合成 Git 仓库显式使用 SHA-1，为首提交显式指定 UTF-8，并在已有稳定提交测试增加双配置回归。D010 固定引用及个人记录关联均沿用原值。

- 在 `.local/D025/self-R2/tree` 的无归档环境，仅对执行进程配置 `init.defaultObjectFormat=sha256` 与 `i18n.commitEncoding=ISO-8859-1`，重跑 README 的首次重建段。用 `git rev-parse --show-object-format` 和 `git rev-list --max-parents=0 HEAD` 核对对象格式为 `sha1`、首提交为 `5394d8f86c961ce1b327674235525f57bf0b982c`。四篇讲解、依赖图、两条闭环和初始个人记录全部读取通过。Edge 回访同一链接仍到达 `src/service.mjs#m3vuiqzi`。保存个人修改后重跑，13 个资料文件哈希一致。证据为 `.local/D025/self-R2/` 下的 `rebuild-git-settings.log`、`preview.log` 和 `protection.log`。
- 使用最终候选生成器串行运行 `node --test tests/skills/<名称>.test.mjs`，`generation-static`、`generation-sample`、`validation-example` 共 4 项通过。证据在 `.local/D025/self-R2/`。常规回归沿用首个候选的 23 项集成结果和 3 份 Edge 结果，补上最终候选的全链及受影响 Skill 样例验证。
- 独审复核在独立候选快照和相同的两项 Git 配置下复现完整重建，另从笔记回访 `src/rules.mjs#x4y6az2y` 并核对重试前后的资料。原问题关闭，独审已明确交还写入。独审证据位于 `.local/D025/review/` 和 `.local/D025/review-R2/`。

未跑全量测试、Chrome、Firefox 或其他操作系统。

## 资源与交回

回访和回归使用的自建浏览器、服务均已关闭。核对 4341 的监听 PID 仍为 `35968`，使用 D023 的 `candidate-8ec77c4` 构建，目标是 `.local/2026-11-19-page-preview/project`。执行没有打开、重启或写入该共用项目。隔离样例、脚本和日志留在 `.local/D025/`，可用本回执与已提交输入重跑。主脑可从本回执接回候选。合并和发布依照各自授权。
