# 固定取源数据模型

## ProjectMapping

- projectRoot 为首次 pin 定位的普通目录完整绝对规范路径，Windows 必须含盘符或 UNC 根。固定后读取允许该目录消失。
- repositoryRoot 为 Git 返回并经链接检查的绝对仓库根。
- projectPrefix 为相对仓库根的 `/` 路径，根项目使用空串。

## FixedSource

继承 ProjectMapping，增加 commit，必须为完整小写 40 或 64 位十六进制提交 ID，且 Git 实际解析的完整提交 ID 必须等于输入。固定后可序列化。read 校验字段、规范前缀以及 projectRoot 与 repositoryRoot/projectPrefix 的精确组合关系，再核仓库根身份。当前子项目不参与定位，源码只沿提交树读取。

## ProjectSource

只有 projectRoot 与 commit 的便捷读取输入。完整提交和文件路径先校验，由同一 service.read 定位现存项目一次并构成 FixedSource。提供 repositoryRoot/projectPrefix 时必须成对出现，按完整固定引用校验，禁止缺一项时回落到重新定位。

## SourceFile

包含固定引用各字段、path（项目相对规范路径）、repositoryPath（prefix + path）、blob（内容对象 ID）、encoding（固定 utf-8）、content（保留原文的字符串）。源码仅在返回值内存中存在。

## SourceError

Error 子类，包含 code、message、nextStep、context。context 只存项目/仓库/提交/路径、失败阶段和系统状态码等定位，不附原始 Git stderr 或源码。具体 code 与传输见 contracts/cli.md。

## 状态流

项目输入 → 映射 → 固定提交 → FixedSource。后续 `read(fixed, path)` → 核固定引用、映射关系及原仓库根 → 核实提交身份 → 路径各段类型 → blob → 严格文本 → SourceFile。便捷 ProjectSource 输入先定位项目一次，随后复用同一读取链。任一失败抛 SourceError，已发出的 FixedSource 无自动更新、缓存或回退。
