# 研究决定

## CommonMark 上下文

决定采用 mdast-util-from-markdown 2.1.0，MIT，锁定直接版本及传递包。只访问 root.children 中 html 节点，以 offset 和原文行确认独占行。代码、列表、引用及 HTML 容器中的标记保留正文。坏的保留前缀注释仍有结构诊断。正文由原文切片保真。

理由是仓库标准库无法判断完整 CommonMark 容器语义。研究代理通过 npm view 核定版本与许可，包内置类型。维护成本为该包及其传递依赖，更新需重跑上下文测试。[包说明](https://github.com/syntax-tree/mdast-util-from-markdown)、[CommonMark HTML blocks](https://spec.commonmark.org/0.31.2/#html-blocks)、[unist position](https://github.com/syntax-tree/unist#position)

备选包括 markdown-it 15.0.3 的 token 流，以及 micromark 4.0.3 底层事件。前者带渲染器职责，后者需手工处理容器事件。此处选直接输出 AST 的最小调用。

## 创建与路径

决定逐段 lstat/realpath 拒绝现存链接和 junction，验证项目、镜像目录和最终目标，缺失的父目录逐段创建。完整临时 Markdown 写完并关闭后，用 link 发布目标，EEXIST 失败，finally 清理临时名。临时文件没有源码。

理由是 wx 直接写目标在中途失败时可能留下半文件，rename 会替换旧目标。link 的排他发布保护并发创建，链接不支持的文件系统会明确失败。标准 Node fs 缺少基于目录句柄的完整 openat 操作，无法承诺抵抗恶意进程并发替换祖先目录，测试覆盖现存链接和创建竞争。[Node 24 fs](https://nodejs.org/docs/latest-v24.x/api/fs.html)

## 格式与行数

决定文档首行固定提交注释，块格式沿 06。LF、CRLF、CR 为行终止符，末尾终止符不增加虚构空行，空串零行。块外仅空白，非空内容结构错误并保留原文。空源码允许零块，非空源码零对照块报告覆盖缺失。空正文以独立填写状态和警告呈现。

理由是精确定位与普通 Markdown 降级需要可重复判定。无整套版本注册表，不推断教学完成。
