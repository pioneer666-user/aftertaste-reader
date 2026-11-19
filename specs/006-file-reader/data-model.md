# 读取模型

## 项目与发现

启动项目使用规范化的绝对目录，无链接祖先。资料发现读取 docs/aftertaste/current，缺失目录返回空集，存在但非法/不可读返回结构化问题。条目包含 documentPath 与 sourcePath，保留目录与扩展名。非法条目单独报告，合法条目仍可选择。

## 单次阅读

DocumentService.read 返回 DocumentResult 及可选 sourceLines。raw、blocks、commit、diagnostics 均派生自同一次 UTF-8 读取。取源沿 FixedSourceService，项目到仓库映射由适配器解析，各文档独立使用头部完整提交。sourceLines 保留全部物理行，终止换行不凭空增加一行。

comparison 模式只在机械校验有效时使用，源码缺失或结构/覆盖错误为 markdown 模式。源码不可用带 sourceError，文档不可读是请求错误。空正文和超阈值沿既有 warning 语义。

修复内容由 documentPath、sourcePath、实际 commit、diagnostics、sourceError 组成，包含块/行/params、问题与下一步，排除 raw、body 和 sourceLines。

## 页面状态

列表 loading/ready/empty/error。阅读 idle/loading/ready/error。切换和刷新使用单调请求序号及 AbortController，过期结果不提交。语言独立于阅读模型，切换仅更新文案并恢复滚动位置。

界面语言枚举 zh-CN/en。读取有效本地存储值，否则中文。存储异常保留当前选择并显示本页有效提示。翻译按稳定 code/params，缺键回退中文。用户内容保持原文。

## D022 导航与回访状态

| 状态／条目 | 字段与有效条件 | 状态变化 |
| --- | --- | --- |
| 文件树 | 目录键为完整源码相对目录，叶由已有文档路径、源码路径和文件名组成 | 清单更新时由合法条目重建。选择或回访时展示当前叶与祖先，收栏时保留展开状态 |
| 块目录 | 当前有效对照结果的文档路径、块 ID、原序及显示标签 | 仅与当前正文共用结果。切换或加载错误清除旧条目，接收有效结果后重建，滚动或显式跳转更新当前块 |
| 标签 | 教学原文纯文本，或行范围／序号 | 块首标题取可读文本，无标题取首句短摘。无合适文字时对照块采用已有真实行范围，纯讲解块采用文档内从 1 开始的块序号 |
| 记录回访 | 文档路径与块 ID，书签另含记录 ID | 目标仍有效时展开并定位。普通导航使用同一阅读结果，列表回访失败走已有错误反馈 |

上述状态只在本页使用。记录继续沿 [书签](../010-block-bookmarks/spec.md)、[批注](../012-understanding-marks/spec.md)与[项目笔记](../011-project-notes/spec.md)管理各自的持久资料。
