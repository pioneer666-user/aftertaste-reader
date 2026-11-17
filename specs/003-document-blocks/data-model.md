# 数据模型

## Document 与 Block

文档首物理行 `<!-- aftertaste:document commit=<完整小写40或64位十六进制> -->`，允许 UTF-8 BOM，只有 commit 字段，重复头无效。其后沿 06 的块语法，顶层标记可有 0—3 个前导空格及尾随空格，独占物理行。其余块外内容仅空白。

源码路径从项目相对 `docs/aftertaste/current/<path>.md` 推导，完整保留源码扩展名，不存重复 path。调用方显式提供 repositoryRoot/projectRoot/projectPrefix，由 002 核一致性，提交来自文档头。

Block 含 id、可选 lines {start,end}、body 原文、startLine/endLine。ID 必须匹配 `[a-z0-9]{8}`，同篇唯一。范围端点为安全正整数，规范十进制，无前导零，start ≤ end。范围输入必须具有且仅具有 start/end 两个自有可枚举字段，各读取一次构造已校验数值快照。清单元素只允许可选 lines 字段，纯讲解用 `{}`，顶层输入必须为数组。

物理行按 LF、CRLF、CR 计，末尾终止符不额外计行，空串 0，单独换行为一行。范围覆盖包含空白和注释。零源码可零块或纯讲解，不接受 `1-1`。

## Diagnostic

code 稳定，severity 为 error/warning，message 与 nextStep 中文。定位含 documentPath、可选 blockId 和 line，params 保存数值及稳定原因，不含源码。结构类包含 DOCUMENT_HEADER、MARKER_INVALID、BLOCK_ID_INVALID、BLOCK_FIELDS_INVALID、RANGE_INVALID、BLOCK_NESTED、BLOCK_UNCLOSED、BLOCK_ORPHAN_END、BLOCK_ID_DUPLICATE、OUTSIDE_CONTENT。覆盖类包含 SOURCE_GAP、SOURCE_OVERLAP、SOURCE_ORDER、SOURCE_BOUNDS。警告 SOURCE_TOO_LARGE、EXPLANATION_TOO_LARGE、EXPLANATION_EMPTY。取源失败 SOURCE_UNAVAILABLE 保留原 SourceError 的 code/context/nextStep。

## ValidationResult

raw 保留整个原文。blocks 保留可解析块和原文顺序。structureValid 仅指解析结构。sourceCheck 为 completed/unavailable/not-run，后者用于头无效等无法定位情况。mechanicallyValid 要求结构合法、源码检查完成且无 error。renderMode 为 comparison/markdown，后者在机械无效时使用。contentStatus 为 provided/unfilled，只有非空块且每块至少一个非 White_Space 码点才 provided。teachingQuality 固定 unchecked。sourceLineCount 仅源码可读时返回，不返回源码 content。

大小按 06，源码范围 end-start+1，正文按 Unicode 码点排除 White_Space。超过 60/1,200 才警告，警告不改变机械有效性。填写状态只表示有正文。

## 状态与写入

create 验证固定源码和清单 → 生成随机 ID（碰撞重试）→ 生成空正文骨架 → 验证路径 → 排他发布 → 返回 generated 和校验结果。任何创建失败不报告成功，旧目标保留。ID 通过注入生成器可测试碰撞，重试有上限并返回明确失败。

现存文件型硬链接在校验读取时拒绝，避免通过同一 inode 绕过资料边界。创建遇到任何现存普通文件均 DOCUMENT_EXISTS。临时文件先 open(wx) 成功持有句柄才归本次拥有，写完关闭后发布，失败只清理拥有的临时名。清理失败的诊断包含 temporary 和 published（0/1），可以核对是否已经发布目标。

validate 读取文档 → 解析 → 以头部 commit 和调用映射读取原 Git → 校验 → 返回结果，文档字节及 ID 不写。头无效 sourceCheck=not-run，取源失败 unavailable。历史取源本身继续支持当前子项目消失，写骨架所需现存目录检查只在文档存储入口执行。
