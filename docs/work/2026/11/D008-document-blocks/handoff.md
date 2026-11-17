# D008 · 回执

## 当前结论与入口

M01—M06 完成。成果候选为 `4c3b14537c180cfe48e6ef9539d5b643f2571d39`，类型检查、构建及本单测试通过，既有固定取源回归证据按影响复用。独审 R1 的 1 项 P2 已修复，R2 在该候选复核通过并交还写入，原文见 [review.md](review.md)。本回执后续归档仅涉及任务状态、审查原文和索引，复用同一成果审查。

批准入口为 [task.md @ 39a7fdf](task.md)，比较基线 dev `fa6360f`，接单 HEAD `39a7fdf`。当前分支 `codex/feat-document-blocks` 按作者要求保留候选，dev 为 `fa6360f4557d38936813fc369bcc1bf71653f122`。交回完成后由作者将本入口交主脑接回审查，后续整合和分支收尾等待对应授权。本次 Git 操作限该候选分支的实现、修复和归档提交，master/main、远程推送及发布没有本次操作。

可重跑入口为 [003 quickstart](../../../../../specs/003-document-blocks/quickstart.md)，调用参数及输出见 [CLI 契约](../../../../../specs/003-document-blocks/contracts/cli.md)，格式及状态见 [数据模型](../../../../../specs/003-document-blocks/data-model.md)。作者页面及教学体验本单不适用，机械校验通过不判断解释正确性。

### M01—M06

| 项目 | 实际交付与验证 |
| --- | --- |
| M01 | 按项目 current 镜像、完整提交头及既有项目前缀定位，异 cwd、根项目、同名不同目录及扩展名均走真实 CLI |
| M02 | AI 有序清单、两类块、随机 ID 碰撞重试、完整骨架与排他发布，重复/并发保护及写失败注入通过 |
| M03 | CommonMark 顶层解析，保留 Markdown/ID/顺序/行定位，围栏、缩进、列表、引用、HTML 容器及非法结构测试通过 |
| M04 | 逐行完整覆盖、缺行/重叠/逆序/越界/重复 ID，固定头 A 后改变 HEAD 与工作区仍检查 A，读取失败不回退 |
| M05 | 60/61 行、1,200/1,201 Unicode 非 White_Space 码点边界，稳定诊断与普通 Markdown 降级数据，警告保持机械合法 |
| M06 | create-document/validate-document 复用共用用例，完整 CLI 演示及只读文档/ID 验证，填写状态与教学判断分开返回 |

### 技术细化与限制

本单沿批准技术授权定稿首行 document/commit 注释、空文件零行、LF/CRLF/CR 物理行及末尾终止符口径。块外非空内容报错并保留原文，非空源码零块报 SOURCE_GAP，空源码零块合法且 unfilled。填写非空仅为 provided，teachingQuality 始终 unchecked。校验结果失败走 stdout JSON/1，参数或操作失败走 stderr，骨架空正文警告退出 0。

新建在同目录写仅含引用的临时 Markdown，持有 wx 句柄后才负责清理，关闭后用硬链接排他发布。已存在目标不覆盖，现存 symlink/junction 拒绝，校验拒绝文件型硬链接。Windows/NTFS 已实际验证，其他平台和不支持硬链接的文件系统未实测，后者会明确写入失败。Node 标准 fs 不能完全抵抗恶意进程并发置换祖先目录，本单未承诺该保护。突发进程/系统终止可留下仅含骨架的临时文件，完整目标只在发布后出现。

## 依据与验证

### Spec Kit

完整使用 specify/spec-template、plan/plan-template、tasks/tasks-template，resolver 与 setup-plan/setup-tasks 均实际执行，阶段均未配置 extension hooks。User Input 始终为 D008 @ 39a7fdf、M01—M06、001 的现行约束、002 已有能力、后置范围及本单允许材料。specify 逐项核 requirements 16/16。

analyze 前置 RequireSpec/RequireTasks/IncludeTasks 实际成功。只读核查 spec/plan/tasks 与 constitution，FR-001—010 均有覆盖，任务 16 项，歧义、重复、阻断和未映射任务为 0。覆盖映射为 FR-001→T004/T006/T007，002→T003/T005/T007，003→T004/T006/T011，004/005→T008/T010，006→T009/T010/T011，007→T012/T013，008→T010/T011/T013，009→T007/T011/T014，010→T003/T004/T008/T009/T012/T015。构建相关成功条件 SC-001—004 沿这些任务覆盖，无额外性能设施要求。

implement 前置 RequireTasks/IncludeTasks 实际成功，扫描唯一 requirements.md 为 16 项、16 已勾、0 未勾，无自定义 checklist。沿现有单锁文件、ignore 和 node:test 工程。Phase 0 只读研究由独立研究代理完成，结果写 [research](../../../../../specs/003-document-blocks/research.md)，该代理不承担实现独审。新依赖 mdast-util-from-markdown 2.1.0/MIT 安装成功，npm 报告 0 vulnerabilities。任务级 Node 24.11.1 从既有 D007 副本复制，无全局环境变更。

### 初始与失败记录

- 2026-11-17，新增单测先运行，因 dist/core/document-blocks.js 尚未实现而 ERR_MODULE_NOT_FOUND，符合初始红灯预期。
- 初版实现 typecheck/build 通过，单测 10/11。CommonMark 容器样例断言失败，普通注释被内部示例的第一个 `-->` 关闭，后面的 `aftertaste:end` 是真正顶层，实际为 BLOCK_ORPHAN_END。目标解析实际触发，证据为失败测试原样例及代码。修正假设为删除该样例中已经处于注释外的结束标记，保留普通注释中的开始标记示例。仅修测试前提，计该测试问题第 1 轮，产品解析不改。随后 typecheck/build 通过，单测 11/11、集成 6/6 通过，测试前提问题已闭合。
- 初版扩充边界后 typecheck/build 和全套串行测试 41/41 通过，155.6 秒。随后针对临时名碰撞注入 EEXIST，断言既有文件保留实际失败，readFile 为 ENOENT，说明 finally 删除了未拥有的临时名。样例为 `.local/D008/run-xPymzY/`，源码和输入均合成，实际触发了写入失败清理。第 1 轮修复假设为以 open(wx) 取得文件句柄，仅在成功取得后标记拥有临时文件，失败清理只处理自己创建的文件。修复 adapter 及受影响失败注入后，typecheck/build 和 D008 集成 8/8 通过，42.6 秒，该问题第 1 轮已闭合。
- R1 @ 105d1a3 独审实际复现 API 接受原型 getter 范围并写盘，返回 mechanicallyValid=false，源码范围为 undefined。原文见 [review.md](review.md)，样例 `.local/D008/run-265sQb/`。回归先在原候选确认 Missing expected rejection。第 1 轮修复精确检查自有可枚举字段名为 start/end，各读取一次形成数值快照，再校验和生成。共用回归核原型 getter 被拒绝且资料未创建，自有 getter 各读取一次并保存合法骨架，同时单测补非枚举端点混入额外字段的反例。修复后 typecheck/build 与 D008 单测/集成 21/21 通过，40.1 秒。R2 @ 4c3b145 独立重跑该用例 1/1 并做内存反例断言，通过且关闭该问题，累计第 1 轮成功。

### 最终行为自测证据

2026-11-17，Windows、Node 24.11.1、npm 11.6.4、Git 2.50.1.windows.1、TypeScript 5.9.3。命令在仓库根运行，为 npm 子进程临时将 `.local/D008/runtime/` 置于 PATH 首位。未改全局 Node。

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd test
node --test --test-concurrency=1 tests/integration/document-blocks.test.mjs
node --test --test-concurrency=1 tests/unit/document-blocks.test.mjs tests/integration/document-blocks.test.mjs
node tests/fixtures/document-blocks.mjs --demo
git diff --check
```

前 3 项在上述全套版本通过，含 12 项 D008 单测、7 项 D008 集成和 22 项既有取源回归。105d1a3 的 adapter 临时文件拥有判定修复后，typecheck/build 及受影响 D008 集成 8/8 再通过。R1 修复后再次 typecheck/build，并串行完成全部 D008 单测/集成 21/21，复用未变化的既有固定取源 22 项证据，当前共 43 项独立测试。所有测试文件串行执行。生成/解析性质枚举 1—8 行全部 255 种连续分界，插入纯讲解，独立占用数组核每行一次与正文保真。覆盖判定另用 111 种有序范围清单，直接展开行序列作独立预期。没有新增测试库。

独立重跑 demo 成功，样例 `.local/D008/run-kDYX8l/`，A 为 `2bf8c94a8acb864b91c3d130fb1e0991529c7732`，generated=true、骨架 unfilled、填写 provided、HEAD/工作区变化后仍依据 A 且机械合法。源码正文只在合成 Git 和测试输入中，工具产物及诊断检查未含取源文本。开发仓库根 `docs/aftertaste/` 不存在。

未验证网页、教学效果、发布包安装、非 Windows 平台和恶意并发目录置换，本单页面与教学体验验收不适用。没有将 A01—A05 的整套页面验收记为完成。

### 独审与作者验收

未参与实现的审查子代理按 Ponytail Review 和 Sharp Edges 对 `105d1a3` 完成 R1，读取完整调用链、规格和证据，确认 P2 后明确交还写入。执行保存原文、修复另提交，审查者对 `4c3b145` 完成 R2，独立验证关闭依据并明确交还写入。两轮均核候选和工作区一致、运行采集已结束，详见唯一原文 [review.md](review.md)。

本单的作者页面及教学体验验收不适用，原因是交付为文档制作与机械检查工具。本单完成情况交作者／主脑接回审查，不记作完整首版页面或教学体验通过。

## 资源与交回

任务运行产物隔离于 `.local/D008/`，测试源码和讲解均为合成内容。任务级 Node、可重跑样例及失败复现保留供接回核查，均可由已提交 fixture 重建，关键证据已在本回执和独审原文。全批没有自建服务或浏览器，测试及审查子进程均已结束。dist 为当前成果候选的本地可重建输出，单文件工具入口和正式资料均已落仓。
