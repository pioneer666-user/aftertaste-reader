# D058 · 回执

## 当前结论与入口

讲解 AI 可以打开当前项目首页，或在一批新讲解、闭环校验并读回后打开本批起读位置。读者能从顶栏「阅读链接」复制同次私密入口到本机另一浏览器，也可以要求只给链接。后台实例就绪后可独立阅读、复用和停止，现有前台 `serve` 仍由启动终端管理。

行为候选 `82f138d`，比较基线 `dev@862ef01`，批准依据为 [`445f6c3` 的任务单](task.md)。最终安装包 SHA-256 为 `F6BE6CA1F4AA9D7CDD9153FF2A0C3653CCED94639ADCE1C4F8A7BE80F8C2E65A`。候选包定向 25 项通过。[独审](review.md#r2--2026-11-26)复核通过，R1 的停机超时误报已修复。

作者试读待验。候选和归档保留在 `codex/feat-reader-launch`，本地 `dev` 仍在 `862ef01`，等待作者体验后确认合并。推送与发布均未进行。

## 作者试读

使用 [D058 候选包的 Skill](../../../../../.local/D058/run6/install/node_modules/aftertaste-reader/skills/aftertaste-reader/SKILL.md)、[隔离订单项目](../../../../../.local/D058/trial/reader)及本机的 [Node 24.11.1](../../../../../.local/D009/runtime/node.exe)。试读闭环是「数量等于 9 或 10 时订单列表怎样变化」，起读位置为 `d058-order-limits/limit`。启动和试读只用这份隔离资料，本轮测试结束后已关闭该项目的后台实例。

> 请按 D058 回执的试读配置打开隔离订单项目的「决定上限是否满足」步骤，我会从顶栏「阅读链接」复制到另一款浏览器。

观察默认浏览器能否直接到这一步，第二款浏览器粘贴后能否读到相同步骤。试读后可请 AI 停止这个项目的阅读器。

## 依据与验证

- 沿 Spec Kit 的 specify、plan、tasks 与 analyze 对已有能力增量维护。生效模板通过 resolver 和 setup 取得，前置参数指向 006，现有需求清单 16/16，阶段前后无扩展 hooks。对照 006 FR-006／024、SC-022／023 与 005 FR-015 核批准场景、启停、失败反馈、授权边界及验证覆盖。沿用现有块／步骤定位和项目资料格式。[006 规格](../../../../../specs/006-file-reader/spec.md) · [方案](../../../../../specs/006-file-reader/plan.md) · [契约](../../../../../specs/006-file-reader/contracts/cli-http.md) · [005 规格](../../../../../specs/005-generation-skill/spec.md)
- Windows、Node 24.11.1、Git 2.50.1.windows.1 下类型检查、预构建和压包成功。以干净目录与已核依赖锁运行 `npm ci --offline --ignore-scripts`，换入本包的实际完整性值，安装 83 个包。最终 `node --test --test-concurrency=1` 定向测试 25/25，含项目仓内登记拒绝、并发复用、端口被占、过期登记、打开失败、探测超时保留登记、恢复后停机、跨项目拒绝及重启失效。[安装](../../../../../.local/D058/run6/install.log) · [程序检查](../../../../../.local/D058/run6/reader-checks.log)
- 直接启动用实际 Claude Code 2.1.198 读取安装包 Skill，系统收到打开首页请求，进程退出后服务仍在监听。新文件会话写完 `src/rules.mjs` 讲解后达到调用轮数上限，由执行从原正文接续校验、读回、更新图及方向。随后打开块 `8bi2slar` 一次。执行用同包工具建立、校验并读回新闭环 `d058-order-limits` 后打开 `limit` 一次。仅链接模式返回同一位置的私密入口，入口实测可用。[行为用例](../../../../../tests/skills/reader-launch.md) · [脱敏运行记录](../../../../../.local/D058/trial/skill-sequence.json)
- 最终包原生打开测试从隔离项目的真实入站请求确认，系统默认 Chrome 已授权并读取首页、文件块 `x4y6az2y`、闭环 `order-quantity/check`，三次各收到一次浏览器进入请求，仅链接的进入请求数为零。另用隔离 Edge 158.0.4370.33 与 Chrome 158.0.8127.38 检查实际复制到另一浏览器、键盘开关、剪贴板失败手动复制、未授权普通入口及地址栏清除令牌，查看了桌面和 390px 窄窗脱敏截图。该复制用例通过测试直接进入第一款浏览器。[原生打开](../../../../../.local/D058/run6/native-browser.log) · [跨浏览器复制](../../../../../.local/D058/run6/copy-browser.log)
- DSH Web 0.1.6-alpha.2 的真实聊天生成了同一个私密入口的 Markdown 链接。点击发出请求并得到 403。未授权 Chrome 直接输入普通地址同样拒绝，将完整私密入口作地址栏等价导航后可读 `d058-order-limits/limit`，地址栏只留普通位置。这条来源隔离与前一包相同。D056 Edge、Chrome 和 Firefox 159 的回归复用未变更的浏览器授权、资源和资料路径，241 个静态资源与原读写入口均走过匿名检查。Skill 结构校验通过，原 10 项 Skill 用例通过。[聊天点击](../../../../../.local/D058/trial/dsh-web/result.json) · [原授权回归](../../../../../.local/D058/run3/session-browser.log) · [Skill 回归](../../../../../.local/D058/run3/skill-regression.log)

## 限制与修复记录

- 初版类型检查发现 Windows 子进程选项及 IPC 回调签名问题，下一包通过。run4 登记边界误跨隔离项目自己的 Git 根，修正为最近仓库；打开失败用例的首次注入使 Node 提前退出，改为只让浏览器启动调用失败，run5 两项通过。run4 离线安装遇到缺缓存元数据，改用已核依赖锁并更新本包完整性后重新在空目录安装成功。
- R1 发现探测超时时可能误删登记。修复轮核初探、停机 POST 与后续探测均可保持暂停，恢复前保留登记及已有阅读路径，恢复后成功停止并清除登记。run6 定向检查及独审复核通过。[独审原文](review.md)
- Windows 原生打开在 run5 有一次进入链接回退，具体原因未确认。最终包复验通过。Windows 桌面操作工具无法确认当时的标签 URL，因此原生检查取本次服务的实际浏览器请求。Codex CLI 的本机运行时 provisioning 不可用，DSH Headless 默认沙箱拒绝派生后台进程，两个宿主未完成直接启动。全量旧回归为优先本次影响范围提前结束。macOS、Linux 和未显式加载 Skill 的宿主发现行为未验。

## 资源与交回

保留 run6 安装包、隔离订单仓和脱敏证据供作者试读。可按 [006 quickstart](../../../../../specs/006-file-reader/quickstart.md#d058-ai-启动和复制) 与 [Skill 行为用例](../../../../../tests/skills/reader-launch.md) 重建用例。本地包、截图及运行日志不会随 Git 克隆恢复。试读后如需关闭，请 AI 为同一项目执行 `stop-reader`。
