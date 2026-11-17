# D007 · 独立审查原文

审查者为未参与实现的 `/root/d007_review`。以下为实际返回原文。

## R1 · 2026-11-17

### 审查范围与结论

**结论为通过。**

本次修复核实完整提交身份，使历史读取可复用原仓库映射，并将目标解析集中到共用用例。审查未发现需要修复的问题。

- 批准依据为 `docs/work/2026/11/D007-fixed-source-hardening/task.md@05daca6f463a8cd0ab8a2e04c7e8640b8c6d0ad3`，无有效调整文件。
- 比较基线为 `4ecb7ca36a68ae1909fec0ad52937b38b006107c`，固定候选为 `0bec4741cc137436f128aa5fc4d82de1ca65bed2`。
- 实际检查 application、Git adapter、CLI、全部调用方、测试及 fixture、002 正式材料和回执。采用 Ponytail Review，并按 Sharp Edges 检查参数、路径、固定引用和错误分支。
- 按本地单文件读取用例评估，无吞吐承诺或负载测试要求。

### 要求符合度

| 要求 | 审查结果 |
| --- | --- |
| H01 | read 比较实际解析出的完整 ID，后续沿核定 ID 和树返回的对象 ID 读取。同形移动分支拒绝，pin 仍支持版本名，SHA-1/SHA-256 正常对象可读 |
| H02 | 完整引用先校验字段及根／前缀关系，再核原仓库。当前子目录消失或替换为 junction 时仍读提交树。篡改、越界、元数据、链接及 gitlink 均拒绝 |
| H03 | bare 检测先于祖先 `.git` 搜索。独立 bare 与普通非仓库的诊断可区分 |
| H04 | CLI 只传递参数。便捷输入定位项目一次，完整输入只定位仓库根一次，必要对象与边界检查保留 |
| H05 | unit 使用当前平台生成的绝对路径，Windows 无盘符拒绝及 C/D 跨盘成功用例保留 |

Git 仍使用参数数组，继承的 `GIT_*` 被隔离，禁止 lazy fetch、replace 和工作区替代。失败输出使用稳定 code/reason，未发现源码正文泄漏或目标写入路径。

002 的 spec、plan、tasks 保留官方结构与 D006 完成记录，新增要求、模型、契约和实施任务能够对应。此次按同主题增量维护，未发现扩大业务范围或原则冲突。T022 在被审候选中保持待完成，符合审查进行中的实际状态。

### 独立验证

实际使用 Windows、Node 24.11.1 和 Git 2.50.1.windows.1，串行运行以下检查。

```powershell
node --test --test-concurrency=1 tests/unit/fixed-source.test.mjs
node --test --test-concurrency=1 --test-name-pattern='D007|SHA256|Windows 无盘符' tests/integration/fixed-source.test.mjs
```

- unit 为 5/5，通过，零跳过。
- 定向 integration 为 8/8，通过，零跳过，耗时 70.6 秒。覆盖 H01—H03、历史映射边界、参数配对、原仓库／对象不可用、SHA-256 和 Windows 跨盘。
- 另用合成 fixture 验证完整提交 ID 同名分支指向 B 时仍读取 A。删除 A 的 blob，并建立同名 tag 指向另一 blob 后，读取返回 `GIT_READ_FAILED`，未替换内容。额外样例 `run-ykh6Zl` 已清理。
- 独立 bare 样例为 `C:\Users\Lenovo\AppData\Local\Temp\aftertaste-D007-hcmzGp`，结束后确认目录不存在。
- 复用执行者同候选的 typecheck、build、完整 22/22 测试及 quickstart 证据，核对最新测试日志摘要一致。保留其修复前失败、测试布局修正和累计轮次记录。

### 限制与写入交还

Linux/macOS、实际 UNC 仓库、超时／输出上限和权限拒绝注入未独立验证。页面、教学体验和完整 A01 仍超出本次审查范围，作者体验验收不适用。

审查结束时 HEAD 仍为 `0bec4741cc137436f128aa5fc4d82de1ca65bed2`，工作区干净，未发现被审输入漂移。未修改产品、规范或构建，未启动服务或浏览器。正式测试生成的可重建合成样例按既有约定保留在 `.local/D007/run-*`，额外探查和外部临时样例已清理。

**采集结束，可以恢复写入。**
