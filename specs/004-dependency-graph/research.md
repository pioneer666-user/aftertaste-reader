# Phase 0 Research: 文件图维护

输入为 D009 @ c4010db，沿 002/003 与 D008 证据。研究代理 storage_research 只读核 src/application/fixed-source.ts、adapters/git-source.ts、document-store.ts 及 D007/D008 证据，未参与实现或独审。没有待澄清技术前提。

## 固定依据与空图

- Decision: 提取 Git 适配器已有的 commit 身份检查，readFile 与新增 verify 入口共用；完整映射字段校验复用，仍只定位 repositoryRoot，不重定位已固定的子项目。
- Rationale: D007 证明 40/64 hex 也可能是分支，必须比较实际 commit 与输入；空图不能借没有文件绕过该检查。固定子项目工作区消失时，历史读取语义仍有效。
- Alternatives considered: 用 pin/HEAD 会偷换依据；只正则校验漏对象与别名；resolveCommit 后比较也可行，但会把固定对象失败混为首次版本选择。

## 资料目录保护

- Decision: 提取 D008 的祖先 lstat、逐层 bigint dev/ino + realpath 目录核验，文档与图实际共用；文件类型/路径/错误仍各自处理。
- Rationale: 普通 Docs/AfterTaste 大小写别名合法，symlink/junction 不合法，不能统一小写源码身份。直接复用文档 create 会错误拒绝更新。
- Alternatives considered: 复制整段会形成两个安全规则；通用存储框架没有实际需求。

## 单文件发布

- Decision: open(wx) 完整写入并关闭同目录临时文件；首次 link 排他发布，更新 rename 替换；发布前复查旧图原文，已变化则拒绝。只有成功 open 后拥有临时文件，清理失败报告 published。
- Rationale: 创建不覆盖突然出现的目标，更新不先截断旧图；同目录发布避免跨盘移动。旧图读取失败不当空图。
- Alternatives considered: 直接 writeFile 会截断；先删再写有丢失窗口；数据库、锁服务、备份恢复超范围。
- Boundary: 单进程串行操作；原文复查不是多进程协调或恶意目录并发置换防御。Node 标准 fs 的既有边界保留；断电持久性、其他文件系统与大小写敏感目录无承诺。

## 输入与局部状态

- Decision: 一个 JSON 更新文件，register、reviews、remove 显式分工；reviews 项必须 analysis=reviewed 且提供完整 dependencies；冲突删除/引用拒绝。删除导致存续使用者失边时恢复 unreviewed，返回受影响路径与移除边。
- Rationale: 缺项不能表示空依赖，未提交使用者保持；删除后的分析完整性不可冒充。重复提交规范化为稳定路径/关系顺序，便于复核和幂等。
- Alternatives considered: 通用补丁语言不必要；按未出现节点删除会伤旧成果；拓扑排序会错误拒绝环。

## 验证方法

- Decision: 沿 node:test，无新库；对有限多节点关系集合枚举，独立断言幂等、未提交入边保持、删除引用一致与失边状态；保留显式例子。
- Rationale: property-based-testing 的 invariant/idempotence/oracle 方法适用于纯关系规则，穷举小域可确定重现。真实 CLI 及存储失败另验，不能靠纯规则替代。
