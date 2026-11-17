# Feature Specification · 单篇讲解文档骨架与校验

**Feature Branch** `codex/feat-document-blocks`

**Created** 2026-11-17

**Status** Approved

**Input** [D008 task.md @ 39a7fdf](../../docs/work/2026/11/D008-document-blocks/task.md) 的 M01—M06。遵守 [001 现行规格](../001-first-release/08-current-spec-and-acceptance.md) R01—R06、U101 和 [06 块格式](../001-first-release/06-document-blocks.md)，复用 [002 固定取源](../002-fixed-source/contracts/cli.md)。允许新增本目录设计及本单代码、测试和回执。后置范围包含自动讲解、产品 Skill、批次与更新事务、网页、依赖图、个人记录、闭环和导出。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 创建单篇骨架 (Priority P1)

AI 提供固定源码引用和有序分块清单，工具在指定项目生成可继续填写的单篇讲解。

**Why this priority** 提供稳定定位，减少手写标记和 ID 错误。

**Independent Test** 用合成文件和混合清单核镜像路径、提交、ID、范围及重复创建保护。

**Acceptance Scenarios**

1. **Given** A 的三行源码，**When** 按 1—1、纯讲解、2—3 创建，**Then** 三个唯一合法 ID 和成对标记，正文留空且明确待填写。
2. **Given** 已有讲解或无效范围，**When** 创建，**Then** 返回问题且旧文件完整。
3. **Given** 子项目映射，**When** 从另一 cwd 创建不同目录同名或不同扩展名文件，**Then** 各文档位于指定项目镜像位置。

### User Story 2 - 解析并检查已有讲解 (Priority P1)

AI 填正文后校验，消费者获得正文、顺序、定位、机械有效性和修复线索。

**Why this priority** 后续阅读器需要同一判定依据。

**Independent Test** 校验手写合法、缺行和畸形文档，核结果及原文件字节。

**Acceptance Scenarios**

1. **Given** 合法块及代码、列表、引用内的标记示例，**When** 解析，**Then** 仅顶层独行标记定界，正文逐字保留，标题不分块。
2. **Given** 重复字段、坏 ID、错 lines、嵌套或缺配对，**When** 检查，**Then** 稳定诊断含文档、行、可识别块及修复线索，原文保留供降级。
3. **Given** 每行按序恰好覆盖，**When** 工作区及 HEAD 变化后校验，**Then** 仍以文档头 A 检查。

### User Story 3 - 识别警告与未完成检查 (Priority P2)

调用者区分超大警告、结构错误、待填写和源码检查未完成。

**Why this priority** 避免将骨架或不可用源码误报完成。

**Independent Test** 分别检查边界长度、空文件及取源失败。

**Acceptance Scenarios**

1. **Given** 源码 60/61 行或讲解 1,200/1,201 个非空白 Unicode 码点，**When** 检查，**Then** 仅超过阈值警告，机械有效性保持。
2. **Given** Git 引用不可读，**When** 检查，**Then** 源码检查未完成且保留实际取源问题。
3. **Given** 空源码，**When** 空清单或纯讲解块，**Then** 覆盖零行，空正文明确待填写。

### Edge Cases

- 空文件、空白和注释，LF、CRLF、独立 CR，末尾有无换行。
- 围栏、缩进代码、松紧列表、引用和 HTML 容器中的示例，以及相邻 HTML 注释。
- 漏行、重叠、逆序、越界、重复 ID、块外内容和无有效块。
- Windows 路径、符号链接、junction、旧目标、并发创建和写入失败。
- 缺头、重复头、坏完整提交和原 Git 对象缺失。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001** 文档 MUST 按 `docs/aftertaste/current/<源码相对路径>.md` 映射，头记录完整提交，源码路径由镜像推导。M01。
- **FR-002** 创建 MUST 接受固定引用和有序两类块清单，检查完整覆盖、顺序及边界，生成同篇唯一 8 位随机小写字母数字 ID，碰撞重试，失败不保存源码。M02。
- **FR-003** 创建 MUST 保护旧目标，校验 MUST 只读且保留 ID，路径与链接不得逃逸项目及资料目录。M02、M06。
- **FR-004** 解析 MUST 沿 06 顶层成对注释规则保留正文、ID、范围、顺序及位置，代码与容器示例不定界。M03。
- **FR-005** 非法字段、范围、ID、重复、嵌套及配对错误 MUST 有明确稳定诊断，错 lines 不得变为纯讲解块。M03、M05。
- **FR-006** 校验 MUST 从头部固定提交核每行按序恰好一次，包含空白及注释，纯讲解块不占行，取源失败明确未完成。M04。
- **FR-007** 源码超过 60 行或讲解超过 1,200 个非 White_Space Unicode 码点 MUST 仅警告，正文 Markdown 和示例计数，结构元信息排除。M05。
- **FR-008** 结果 MUST 保留原文、结构与取源判定、警告、稳定问题码及修复线索，供有效对照与普通 Markdown 降级。M05。
- **FR-009** 共用用例及真实命令 MUST 支持创建与校验，区分骨架、机械合法和填写状态，合成项目能重跑完整路径。M06。
- **FR-010** 测试 MUST 覆盖边界、往返及独立覆盖性质，并回归已有取源。M01—M06 验证要求。

### Key Entities

- **固定引用** 沿用 002 的项目根、仓库根、前缀及完整提交。
- **单篇文档** 镜像路径、提交头、原文与有序块。
- **讲解块** ID、可选源码范围、正文和位置。
- **校验结果** 结构、源码检查、填写状态、降级及问题列表。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001** 合成项目走通固定 A、创建、填写、校验、修改工作区和 HEAD 后再校验，全程依据 A。
- **SC-002** 所列结构及覆盖反例均定位问题，合法混排保留全部正文及已有 ID。
- **SC-003** 重复、并发创建和链接越界保护旧目标，产物及诊断没有工具复制的源码。
- **SC-004** 60/61 与 1,200/1,201 边界准确，空文件零行，取源失败始终明确未完成。

## Assumptions

- 头语法、物理行口径、空文件、块外内容、退出状态和创建保护方式属 D008 技术授权，在模型和契约落实。
- 复用 002 唯一取源入口，保留当前子项目目录缺失的历史读取。
- 本单作者页面及教学体验验收不适用。
