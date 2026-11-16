# 固定取源数据模型

## ProjectMapping

- projectRoot 为现存普通目录的绝对规范路径。
- repositoryRoot 为 Git 返回并经链接检查的绝对仓库根。
- projectPrefix 为相对仓库根的 `/` 路径，根项目使用空串。

## FixedSource

继承 ProjectMapping，增加 commit，必须为完整小写 40 或 64 位十六进制提交 ID。固定后可序列化，read 对运行时输入与重新解析映射进行核对。read 不接受移动版本名。

## SourceFile

包含固定引用各字段、path（项目相对规范路径）、repositoryPath（prefix + path）、blob（内容对象 ID）、encoding（固定 utf-8）、content（保留原文的字符串）。源码仅在返回值内存中存在。

## SourceError

Error 子类，包含 code、message、nextStep、context。context 只存项目/仓库/提交/路径、失败阶段和系统状态码等定位，不附原始 Git stderr 或源码。具体 code 与传输见 contracts/cli.md。

## 状态流

项目输入 → 映射 → 固定提交 → FixedSource。后续 `read(fixed, path)` → 核固定引用及映射 → 提交对象 → 路径各段类型 → blob → 严格文本 → SourceFile。任一失败抛 SourceError，已发出的 FixedSource 无自动更新、缓存或回退。
