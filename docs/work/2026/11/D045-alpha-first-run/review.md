# D045 · 独立审查原文

## R1 · 2026-11-23

**结论：需修复。** 冻结包的独立安装、首篇生成、Edge 打开及重开均通过。作者闭环的请求、分支、事务顺序和响应已与固定源码核对。当前闭环缺少读者回答「哪张表存哪几个关键字段」所需的物理表名和列名。

### 审查对象与依据

- 批准任务为 `8bd5e7b:docs/work/2026/11/D045-alpha-first-run/task.md`，无调整。产品基线 `dev@d1b5652`，实际比较 `8bd5e7b..4e8c625`。固定候选为 `4e8c6257739e09fe77665dc2b508fdfe7e8eff6b`，包含预构建打包、README、使用说明、Skill 定位和实验验证入口。按 Ponytail Review 核对运行调用链、R01／R07／R17／G5 和相关 quickstart。
- 实际审查 `aftertaste-reader-0.0.0.tgz`，SHA-256 为 `156a4d5262180c184c972070597f199583539e2c15f7f226abf91d6aecd22559`。归档 54 项与清单逐项一致，包含 CLI、同包 Skill 及模板、预构建 JS／CSS／字体和 Web 第三方许可。独立安装具有运行依赖 `fastify`、`mdast-util-from-markdown`。Vue、Vite、Playwright 无需装进读者工具目录。实际服务从自身模块解析 `dist/web/`，监听本机回环地址。
- 作者闭环 `question-bookmark-request` 固定 Apache Answer `3f1ed50f6776452c11b6ffdbdc767cd1887d629b`。成品为 `docs/aftertaste/loops/question-bookmark-request/current/loop.json`，SHA-256 为 `fc0d075197f4a09b4da8e96041c8e31d9e442154f35b60600d5efa516e914292`。冻结清单中的 18 项资料全部匹配。

### 独立复走和源码核对

- 在 Windows／Codex desktop 使用 Node `24.22.3`、npm `11.6.4` 和 Git `2.50.1.windows.1`。只凭公开 README 和 `.tgz` 在空工具目录安装，目标仓库开始时没有 `docs/aftertaste/`。为隔离文件，在安装进程临时指定工具目录和 npm 缓存，并使用宿主已有的 Node 24 和系统证书。显式打开安装路径下的 Skill，向上两层确认同一个 `aftertaste-reader` 包和 `dist/cli/main.js`。Codex 的 Node REPL 环境未提供 shell 的 Node／Git 路径，因此用已核实的 Node 24 绝对路径及明确的 Git 路径运行子进程。公开的 PowerShell 启动流程可用。
- 依照 Skill 只补问读者生成节奏，收到「逐批、先读入口一篇」后，从固定提交生成 `internal/controller/collection_controller.go`。文档 5 个源码对照块覆盖 62 行，另有一个假设例子。文档机械校验、取源和非空正文检查均通过，依赖图亦通过。用独立安装 CLI 在 `4358` 启动两次，Edge `158.0.4370.33` 两次显示同一篇讲解及 62 行源码，页面接口取得的源码逐行等于固定 Git。JS、CSS 和 Inter 字体均由本机加载，两次均无外部请求或页面错误。
- 独立安装 CLI 只读读回作者闭环。16 步、16 边，10 个来源文件。每步保存的块 ID、行范围和原块讲解都与对应原稿一致。每段读回源码都逐行等于独立 Apache Answer 副本中同一提交的对应范围。连线能区分数据传递、实际调用、条件、字段映射和结果回传。复用了执行方的 Edge 证据，覆盖 16 步、两个分支出口、复制 `choose-branch` 步骤定位及关停后重新打开同一步。[分支](<D:/project/SpecDev Harness/aftertaste-reader/experiments/D045-alpha-first-run/.local/release-4e8c625/edge-loop-branch.json>) · [逐步核验](<D:/project/SpecDev Harness/aftertaste-reader/experiments/D045-alpha-first-run/.local/release-4e8c625/edge-loop-walk.json>) · [重开](<D:/project/SpecDev Harness/aftertaste-reader/experiments/D045-alpha-first-run/.local/release-4e8c625/edge-loop-reopen-r1.json>)
- 三项业务问题的独立答案已核。前端送 `object_id`、字符串 `0` 的 `group_id` 和布尔 `bookmark`，用户 ID 来自登录上下文，写入所用分组主键来自后端默认组。首次收藏先由服务决定新增，仓库分配 ID，在自己的事务内按用户和问题复查并插入。成功返回后，问题仓库在另一事务按问题汇总收藏关系并写回计数。重发同一请求在确保默认组、查到关系后提前成功。两次均返回 HTTP 200，第一次的 `data` 有 `object_collection_count`，重发为 `null`。例子明确假设小林的默认组已存在、初始有两条关系，首次总数因此为 3。

### 发现

1. **须修复 · 作者闭环缺少实际表名和关键列。** 沿首次收藏出口打开 `insert-bookmark` 和 `write-count`，串讲与固化原块给出了业务字段和 `collection_count`，读者仍找不到关系表的实际名称及列名。闭环也没有指向实体定义的步骤。这直接影响批准任务的第二个问题。将 `collection` 的 `id`、`user_id`、`object_id` 和 `user_collection_group_id` 写入插入步，并在计数步点明按 `collection.object_id` 聚合、按 `question.id` 写回 `question.collection_count`。固定证据为上游 `internal/entity/collection_entity.go` 第 26–31、41–43 行，`internal/entity/question_entity.go` 第 70、80–82 行，以及 `internal/repo/question/question_repo.go` 第 128–149 行。
2. **建议同次补齐 · 仓储边界的用途。** `start-service`、`prepare-bookmark` 和 `refresh-count` 已能引导读者找到具体仓库。补一句真实装配和契约会更贴近任务要求，说明服务根据「存在标记或错误」决定分支，锁、事务与 ORM 在具体仓储中执行。同一条路线可由 `cmd/wire_gen.go` 第 166、177、182、219–220 行核对接口如何接到实现。
3. **低优先 · 预构建资源错误的排查提示。** 已安装副本若缺页面资产，[阅读服务错误分支](<D:/project/SpecDev Harness/aftertaste-reader/src/server/reader.ts:63>) 仍提示到产品根构建。读者拿到的包不含构建树。可在该诊断中与公开说明对齐，提示安装用户核对工具路径并重装完整 `.tgz`，开发树用户先构建。冻结包实际打开正常，此项不阻塞试读。

### 证据范围和写入交还

- 执行方在无 `.git` 的源码归档运行套件得到 101／102。失败测试移走样例 `.git` 后期待从父仓库回报 `OBJECT_UNAVAILABLE`，归档没有父仓库，实际得到 `NOT_REPOSITORY`。同候选在实际 Git 检出中的文件阅读回归 7／7、Skill 回归 3／3。执行方使用宿主 OpenAI Skill Creator 对实际安装结构校验通过。我另做了真实安装和显式 Skill 试用。作者 14 篇原稿的额外整批 CLI 校验在审查宿主超时，此轮有完整结果的是独立首篇、作者闭环、闭环涉及的 16 处原块及其固定源码。
- Apache Answer 服务与数据库未启动。本轮覆盖固定源码与阅读器行为，作者实际试读及其他浏览器兼容性仍待各自确认。Git 合并、发布与授权各按原任务处理。
- 交还前复核候选、包摘要、上游 HEAD、作者闭环摘要和全部 18 项冻结资料一致。独立服务两次 Ctrl+C 均输出 `ok:true,status:stopped`，终端工具将 Ctrl+C 会话记为退出码 1。最终 `4358` 无监听、无本次 Edge 进程或 Playwright 临时目录。执行方已关闭作者试读验证服务。审查期间没有写入产品、Git 或作者资料。**采集结束，可以恢复写入。**

## R2 · 2026-11-23

**结论：通过。** R1 的表列映射和仓储边界两项发现均已关闭。

- **候选与改动范围。** 代码为 `4e8c6257739e09fe77665dc2b508fdfe7e8eff6b`，安装包 SHA-256 为 `156a4d5262180c184c972070597f199583539e2c15f7f226abf91d6aecd22559`。作者闭环 `question-bookmark-request` 的 R2 SHA-256 为 `816716e244a7b0bf0d39cfdd751569b88740f1632c845046ee530fee608a6d08`。18 项资料与 R2 清单一致。将三个修订字段在内存中还原为 R1 文本后，序列化摘要与 R1 原件完全一致，确认改动范围仅为 `start-service.hint`、`insert-bookmark.explanation`、`write-count.explanation`。
- **表列和时序。** 插入步已说明 `collection.id`、`user_id`、`object_id`、`user_collection_group_id` 的各自来源。计数步已说明按 `collection.object_id` 统计并按 `question.id` 写回 `question.collection_count`。对照上游 `3f1ed50f6776452c11b6ffdbdc767cd1887d629b` 的实体映射和仓储实现，记录 ID 分配、关系事务内复查及插入、独立的计数事务与失败影响均准确。
- **仓储装配。** `start-service` 新提示说明服务怎样用存在标记和错误控制分支，以及锁、事务和 XORM 写入由具体仓储承担。核对 `internal/service/collection_common/collection.go` 第 28–37 行与 `cmd/wire_gen.go` 第 166、177、182、219–220 行，接口契约和装配关系均准确。
- **复验及证据沿用。** 独立安装 CLI 读回 16 步、16 边，机械校验及取源通过。三处修改步骤的源码与独立副本固定提交逐行相同。R1 的安装、首篇打开和重开证据继续适用。R2 的 Edge `158.0.4370.33` 记录覆盖全部 16 步及三处修订术语，重开后可直接读到 `choose-branch` 并复制定位。R1 的低优先资源缺失提示作为已披露限制保留，公开阅读说明提供了重装完整 `.tgz` 的排查方法。[逐步核验](<D:/project/SpecDev Harness/aftertaste-reader/experiments/D045-alpha-first-run/.local/release-4e8c625/edge-loop-walk-r2.json>) · [重开](<D:/project/SpecDev Harness/aftertaste-reader/experiments/D045-alpha-first-run/.local/release-4e8c625/edge-loop-reopen-r2.json>)
- **写入交还。** 已复核候选、包摘要、上游提交和作者资料摘要。独审本轮仅作只读检查，无自建服务或浏览器。`4357` 上的回环服务由执行方保留给作者试读。**采集结束，可以恢复写入。**
