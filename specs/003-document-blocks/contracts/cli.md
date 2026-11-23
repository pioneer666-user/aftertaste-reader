# 单篇文档调用契约

## 共用用例

DocumentService 使用 FixedSourceService 和 DocumentStore。create(fixed, sourcePath, blocks) 返回生成路径及 ValidationResult，输入 fixed 须完整沿用 pin 映射。validate(mapping, documentPath) 返回 ValidationResult，调用 mapping 必须含项目、仓库、前缀三项。文档路径为项目相对规范镜像路径。详细字段见 [模型](../data-model.md)。

## 命令

```text
node dist/cli/main.js create-document --project <absolute> --repository <absolute> --prefix <prefix> --commit <full-id> --path <source-path> --blocks <JSON-array>
node dist/cli/main.js validate-document --project <absolute> --repository <absolute> --prefix <prefix> --document <document-path>
```

blocks 示例为 `[{"lines":{"start":1,"end":2}},{},{"lines":{"start":3,"end":3}}]`。根项目 prefix 使用空串。参数值独立 argv，未知、重复、缺值、缺必填和额外字段拒绝。命令不会从 cwd 或安装目录猜项目。原 pin/read 契约继续有效。

成功 stdout 一行 JSON，stderr 空。create 为 `{ok:true,generated:true,result}`，validate 为 `{ok:true,result}`。validate 的结构或覆盖失败及源码不可读属于完成诊断，仍输出 stdout `{ok:false,result}` 并退出 1。机械合法含超大或空正文警告时退出 0，填写与教学状态从 result 判断。create 无效清单及操作失败不创建目标。

操作或输入失败 stdout 空，stderr `{ok:false,error:{code,message,nextStep,context}}`。参数问题 INVALID_ARGUMENT/INVALID_PATH/BLOCK_PLAN_INVALID 退出 2。DOCUMENT_EXISTS、DOCUMENT_PATH_UNSAFE、DOCUMENT_READ_FAILED、DOCUMENT_WRITE_FAILED、ID_GENERATION_FAILED 和原取源操作错误退出 1。未预期异常 INTERNAL_ERROR，不打印原异常正文。

所有结果不包含提取源码，raw 仅为输入讲解原文。调用者可能手工在讲解中粘贴源码，工具不承担语义识别。所有诊断 params/context 无源码正文，校验不改原文和 ID。

D043 增加同提交 revise-document。输入、普通块与明确重新分块的参数见[修订命令](../../../skills/aftertaste-reader/references/tools.md#revise-current)。原文摘要、固定源码校验和发布后读回都成功后报告完成。
