# D045 · 首次安装与 Apache Answer 后端闭环试读回执

## 当前结论与入口

[打开《收藏一次问题后，数据库和响应怎样变化》](http://127.0.0.1:4357/#aftertaste-loop/question-bookmark-request/request)。从「进入收藏接口」沿右栏出口阅读，在「比较现有关系和目标状态」可分别走首次收藏和重复提交。也可直接看[关系插入](http://127.0.0.1:4357/#aftertaste-loop/question-bookmark-request/insert-bookmark)、[计数写回](http://127.0.0.1:4357/#aftertaste-loop/question-bookmark-request/write-count)或[两种响应](http://127.0.0.1:4357/#aftertaste-loop/question-bookmark-request/read-response)。每一步可展开源码对照，标题旁可复制步骤定位。

- **首次安装**使用[根 README](../../../../../README.md#首次安装)和[本地预构建包](../../../../../experiments/D045-alpha-first-run/.local/release-4e8c625/aftertaste-reader-0.0.0.tgz)。包 SHA-256 为 `156a4d5262180c184c972070597f199583539e2c15f7f226abf91d6aecd22559`，大小 490,233 字节。包内已有 CLI、页面、字体和 Skill。生成资料在被读项目，日常可以离线打开。
- **试读**包含 14 篇完整文件讲解、依赖图和一条 16 步闭环，使用 Apache Answer v1.5.0 的固定提交。实际读图、源码对照、复制位置及关停重开已自测。独审 R2 通过，作者的教学体验验收待进行。[上游提交](https://github.com/apache/answer/commit/3f1ed50f6776452c11b6ffdbdc767cd1887d629b)
- **Git** 作者于 2026-11-23 在本对话指示「合并到dev」。本地合并提交为 `5d1149f`，父提交为原 `dev@d1b5652` 和任务尖端 `f4c58f2`。合并结果与任务尖端的文件树一致，沿用成果候选 `4e8c6257739e09fe77665dc2b508fdfe7e8eff6b` 的自测和独审，比较派单 `8bd5e7b`。已切回 `dev` 并正常删除已合入的本地任务分支 `codex/feat-alpha-first-run`。本仓无 `main`、`master` 或远程发布记录。[独审原文](review.md)

## 依据与验证

按 [D045 任务书 @ 8bd5e7b](task.md)执行，无有效调整。安装依据为 08 G5 及 03 U102。固定源码、普通分批生成、已有块选线及闭环阅读依据为 08 R01、R07、R17，关联 005、006、008、009。按 Spec Kit v1.4.0 的 `speckit-plan` 中 Phase 1 的 quickstart 方法增量维护 005 和 006。实际解析官方 plan-template，核扩展配置不存在，保留已有规格和 quickstart 结构。此次处理现有公开入口和验证步骤，未发起新的正式需求、架构方案或实施清单。

### 打包、接收与 Skill

- Windows 11 x64（10.0.26200），Node `24.22.3`、npm `11.6.4`、Git `2.50.1.windows.1`、Edge `158.0.4370.33`。讲解试用与独审分别使用 Codex desktop 中的新代理，显式读取包内 Skill。试验用子进程选择本机已有的 Node 24，使用系统证书，没有修改全局 Node 或 npm 配置。
- 从固定候选的 `git archive` 干净源码快照串行执行 `npm ci`、`npm run typecheck`、`npm pack --pack-destination <实验输出目录>`。包清单 54 项，含 Vite 生成的网页依赖与字体许可说明。Vite 报单个 JS 块大小警告，构建完成。包中排除了开发技能、测试、实验、任务档案和实际试读资料。[包清单](../../../../../experiments/D045-alpha-first-run/.local/release-4e8c625/tar-list.txt) · [Vite 许可清单选项](https://vite.dev/config/build-options.html#build-license)
- 在仓库外的空工具目录运行 `npm install --prefix <工具目录> --omit=dev <包>`。安装产物中按 `SKILL.md` 向上两层定位包根，调用该包的 `dist/cli/main.js`。页面取同包 `dist/web/index.html`。从已安装 CLI 解析出的 `fastify` 和 `mdast-util-from-markdown` 均在该工具目录的 `node_modules`，目标仓库是另一个目录。独审另装一份同校验值的包。[安装路径与字节核对](../../../../../experiments/D045-alpha-first-run/.local/release-4e8c625/installed-paths.json)
- 已读宿主 OpenAI Skill Creator 入口，使用 `python -X utf8 <skill-creator>/scripts/quick_validate.py <安装后 Skill 目录>` 验证初装预验与最终安装，均输出 `Skill is valid!`。首篇生成先使用预验包，两包有 51 个文件逐字节一致，包含 CLI、页面资产及全部 Skill 指南与模板，最终包改了 README 和包清单并补网页许可。主试读的 Edge 首开、后续生成、闭环和独审复走均用最终包。该校验覆盖 Skill 结构，行为证据见下。

### 从首篇到闭环

- 目标项目从没有 `docs/aftertaste/` 开始。新讲解 AI 收到拟公开 README、包内 Skill、目标项目与读者原问题，只补问生成节奏。收到「先一篇，读过再继续」后生成 `internal/controller/collection_controller.go`。在 Edge 实际打开，显示固定提交的 62 行与四块非空讲解。控制器的请求入口块为 `vmi6gwjc`，身份和应答块为 `wpvn4ro6`。浏览器阻断回环外请求，脚本、样式和 Inter 400／600 字体均加载，零外部请求和页面异常。[首篇读回](../../../../../experiments/D045-alpha-first-run/.local/release-4e8c625/edge-first-article.json)
- 读者确认后，讲解 AI 在同一范围按小批连续补 13 篇。14 篇均用已安装工具 `validate-document` 通过固定取源、覆盖和非空检查，零诊断，教学质量保留 `unchecked`。依赖图 `validate-graph` 通过，54 节点、85 边，14 篇已核对，40 个范围外节点只登记。AI 从已校验的讲解提出一条路线，确认前没有闭环成品。读者明确选择后才执行 `create-loop` 并用 `read-loop` 读回。
- 闭环 ID `question-bookmark-request`。16 步、16 条边、10 个引用文件，源码按 `3f1ed50f6776452c11b6ffdbdc767cd1887d629b` 现场从 Git 读取。Edge 实点两个条件出口，浏览全部 16 步及源码，复制出步骤 `choose-branch` 的 `aftertaste-loop-step/v1` JSON。在前台终端以 Ctrl+C 关闭，收到 `status=stopped`。重新用同一安装包启动，Edge 从直达定位再次读到原步骤。终端工具将 Ctrl+C 会话记为退出码 1，关停以应用消息和端口释放核对。[图上分支](../../../../../experiments/D045-alpha-first-run/.local/release-4e8c625/edge-loop-branch.json) · [最终逐步核验](../../../../../experiments/D045-alpha-first-run/.local/release-4e8c625/edge-loop-walk-r2.json) · [重开同一步](../../../../../experiments/D045-alpha-first-run/.local/release-4e8c625/edge-loop-reopen-r2.json)

### 读者要核的三个问题

| 问题 | 在闭环哪里读 | 固定源码结论 |
| --- | --- | --- |
| 哪些值来自前端 | `request-fields` → `fill-identity` → `default-group` | 按钮发送 `object_id`、`group_id`（实际按钮送字符串 `0`）和 `bookmark`。校验通过后，控制器转换问题 ID，从登录上下文取用户 ID。服务用该登录用户的后端默认组主键写入。 |
| 首次怎么落库 | `prepare-bookmark` → `insert-bookmark` → `write-count` | `collection` 存 `id`、`user_id`、`object_id`、`user_collection_group_id`。关系仓库先分配 ID，在事务内按用户和问题复查并插入。返回成功后，问题仓库开启另一个事务，按 `collection.object_id` 统计，按 `question.id` 写回 `question.collection_count`。计数失败时已完成的关系写入不会随请求回滚。 |
| 已经收藏还提交 | `choose-branch` → `already-bookmarked` → `read-response` | 默认组处理和关系查询仍先发生。已有关系且仍请求收藏，服务层直接成功，跳过关系增删和计数。首次修改成功为 HTTP 200 且 `data` 含 `object_collection_count`，重复请求也为 200、`data` 为 `null`。仓储事务内的复查负责决定这一次插入是否仍需执行。 |

`start-service` 的提示给出实际装配、仓储契约及分工。图中的「条件」「实际调用」「数据」「字段映射」「结果回传」区分连线的含义。教学示例假设初始已有两条收藏，首次成功后总数为三。业务行为依据固定源码核对，未运行 Apache Answer 或数据库。[服务](https://github.com/apache/answer/blob/3f1ed50f6776452c11b6ffdbdc767cd1887d629b/internal/service/collection/collection_service.go#L50) · [关系实体](https://github.com/apache/answer/blob/3f1ed50f6776452c11b6ffdbdc767cd1887d629b/internal/entity/collection_entity.go#L24) · [计数](https://github.com/apache/answer/blob/3f1ed50f6776452c11b6ffdbdc767cd1887d629b/internal/repo/question/question_repo.go#L128) · [响应](https://github.com/apache/answer/blob/3f1ed50f6776452c11b6ffdbdc767cd1887d629b/internal/base/handler/handler.go#L33)

### 回归与独审

- 干净归档运行 `npm test` 得 101／102。唯一失败项在移走隔离样例的 `.git` 后期待父仓库的 `OBJECT_UNAVAILABLE`，无父仓库的归档返回 `NOT_REPOSITORY`。同候选在带仓库元数据的正式检出重新构建后，串行重跑 `node --test --test-concurrency=1 tests/integration/file-reader.test.mjs` 为 7／7，普通生成 Skill 回归为 3／3。全量中订单闭环回归通过。[全量记录](../../../../../experiments/D045-alpha-first-run/.local/release-4e8c625/npm-test.tap) · [正式检出重跑](../../../../../experiments/D045-alpha-first-run/.local/release-4e8c625/file-reader-in-checkout.tap) · [Skill 回归](../../../../../experiments/D045-alpha-first-run/.local/release-4e8c625/generation-tests.tap)
- 独立审查者在另一份空工具目录和无讲解的项目副本复走安装、显式 Skill 生成、Edge 首开和关停重开，独立检查作者闭环。R1 发现关系表和计数表的实际表名与列名在图中缺失，并建议补接口的装配证据。写入交还后，执行用已安装 CLI 的 `revise-step` 在原提交上修订三个字段，深比较核其他内容一致，并从最终安装重读 16 步。闭环摘要由 `fc0d075197f4a09b4da8e96041c8e31d9e442154f35b60600d5efa516e914292` 变为 `816716e244a7b0bf0d39cfdd751569b88740f1632c845046ee530fee608a6d08`。这是一次资料修复，包与产品候选仍为上列版本。[修订证据](../../../../../experiments/D045-alpha-first-run/.local/release-4e8c625/repair-loop-r1.json) · [最终资料摘要](../../../../../experiments/D045-alpha-first-run/.local/release-4e8c625/trial-hashes-r2.json) · [审查原文及复核](review.md)
- 独审的低优先发现仍适用：安装包已损坏并缺页面资产时，CLI 的错误提示沿用开发树构建提示。安装用户按[阅读器错误与修复](../../../../../docs/usage/file-reader.md#错误与修复)核对工具路径并重新安装完整包。本次实测为 Windows／Edge 和显式 Skill 加载，其他浏览器、宿主自动发现及数据库实际执行未覆盖。

## 本机资源与重开

作者专用服务由执行会话的独立终端保留，PID `22696`，只监听 `127.0.0.1:4357`。试读项目与工具都在 `$env:TEMP\aftertaste D045 candidate` 下。独审端口 4358 与本次检查浏览器均已关闭。试读后可关闭对应终端。若从另一终端停止服务，先核端口的 PID 和命令行仍指向下方专用安装及项目。作者体验结束后再按任务归属清理。合入 dev 后复核了安装包与闭环摘要、监听进程和闭环接口，仍可读到受审版本的 16 步。[监听归属](../../../../../experiments/D045-alpha-first-run/.local/release-4e8c625/author-service.json)

服务停止后，在本机 PowerShell 重新启动，随后用回执开头的链接回到同一步。

```powershell
$node24 = where.exe node | Where-Object { (& $_ --version) -like 'v24.*' } | Select-Object -First 1
if (-not $node24) { throw '请先准备 Node.js 24 LTS。' }
$trial = Join-Path $env:TEMP 'aftertaste D045 candidate'
$tools = Join-Path $trial 'Aftertaste Reader release'
$cli = Join-Path $tools 'node_modules/aftertaste-reader/dist/cli/main.js'
$project = Join-Path $trial 'apache-answer'
& $node24 $cli serve --project "$project" --port 4357
```

源码副本和试读资料仅留在各自的仓库外隔离项目。包、校验记录及测试日志落本实验 `.local/`。换机可按[实验说明](../../../../../experiments/D045-alpha-first-run/README.md)从固定候选、固定项目提交和读者原问题重建。作者试读后由主脑接回本回执。
