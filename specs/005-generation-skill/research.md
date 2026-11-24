# Phase 0 · 接口与资料决策

## 连接现有工具

- Decision — 直接使用 pin/read、create-document/validate-document 和三条图命令，完整参数沿现有契约。
- Rationale — D007—D009 提供固定提交、排他创建与局部关系替换，生成流程只缺 AI 指导。已读三个 contracts/cli.md 和 CLI 入口。
- Alternatives considered — Skill 内增加程序会重复业务规则。自动依赖解析器超出本批范围。

## 开发树工具定位

- Decision — 从已读取 SKILL.md 的包根向上定位开发树 package.json 和 dist/cli/main.js，转换为绝对路径后从任意 cwd 调用。入口不满足时报告构建缺失。
- Rationale — 安装／发布尚未完成，不能凭空声明安装路径或命令。引用当前源码树可重复验证。
- Alternatives considered — 使用当前 cwd 或写死开发机路径会混淆目标与工具。

## 个人教学资料

- Decision — 目标项目 `docs/aftertaste/preferences.md` 与 `reading-direction.md`，UTF-8 Markdown，AI 按模板排他初始化、读后合并。偏好超过 8,000 非空白 Unicode 码点时仅提醒整理。
- Rationale — U74／U75 已定两个小模板，无程序调度需要。阈值是提醒 AI 的技术选择，保留明确要求，不阻断生成。
- Alternatives considered — 数据库、聊天事件或批次状态台账增加维护成本且未获批准。

## 既有版本与续填

- Decision — 生成前枚举真实 current 全部 Markdown 的头和图版本，校验相关文档。相同提交可复用完成文档。只有本次成功 create 的证据及原骨架可确认，才续填同版未完成骨架。
- Rationale — 方向是摘要。只查新文件会漏过一套资料混版。文档头由工具定义，Skill 不更换提交字段。
- Alternatives considered — 仅依据方向继续或删除重建会绕过保护。

## 验证

- Decision — 固定合成项目，对真实使用代理只给入口、最少环境和用户请求。记录完整动作与可重建产物，再由执行者核结果。
- Rationale — 静态检查无法证明代理会遵守节奏或调用链。独审另由未参与实现的代理完成。
- Alternatives considered — 关键词匹配、自称已完成及预填讲解无法证明行为。

以上未知均通过已获授权的局部设计和本地工具契约落实。无新增技术选型，无外部研究依赖。
## D050 · 项目讲法增量

- **Decision** 沿已有项目 Markdown 偏好保存用户选择，在两个生成入口调用同一讲解方法。
- **Rationale** 讲法须结合用户表达与真实源码判断。旧偏好可直接读，CLI 继续负责现有的固定取源与校验。
- **Alternatives considered** 独立设置文件会增加两处读写和冲突处理。会话内保存无法跨会话读回。
