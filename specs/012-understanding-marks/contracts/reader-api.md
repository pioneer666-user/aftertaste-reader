# Reader Contract: 块级理解标注与批注

文件首次创建及替换使用[共用个人记录权限规则](../../011-project-notes/contracts/notes.md#个人记录文件权限d057)。

- `GET /api/understanding-marks` 无查询参数，返回 `{ ok: true, marks }`。列表包含所有已持久化条目，定位不可用的条目也保留。每条额外返回 `annotationRevision`，即批注原文按 UTF-8 编码计算的 SHA-256 小写十六进制摘要。
- `PUT /api/understanding-marks` 无查询参数，要求同源、本机站点及 `X-Aftertaste-Understanding-Marks: 1`，提交 JSON，成功返回 `{ ok: true, marks }`。
- 请求包含 `documentPath`、`blockId`、`field`、`previous`、`value` 五个字段。状态操作的 `previous` 为已知状态。批注操作的 `previous` 为已知 `annotationRevision`，缺记录时使用空字符串原文的 SHA-256。界面用相同长度的摘要提交新建和编辑，保持请求体能容纳的批注字节数一致。`value` 是目标字段的完整新值。
- 400 表示输入无效，403 表示来源或资料路径不安全，409 表示原值已变化，413 表示请求超过服务大小上限，422 表示目标不可用或资料无法读写。页面保留输入，冲突复读后可对照已存值选择如何处理。
- 讲解 AI 的只读格式见 [模型](../data-model.md)，产品内操作由阅读器完成。
