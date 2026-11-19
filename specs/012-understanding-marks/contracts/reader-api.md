# Reader Contract: 块级理解标注与批注

- `GET /api/understanding-marks` 无查询参数，返回 `{ ok: true, marks }`。列表包含所有已持久化条目，定位不可用的条目也保留。
- `PUT /api/understanding-marks` 无查询参数，要求同源、本机站点及 `X-Aftertaste-Understanding-Marks: 1`，提交 JSON，成功返回 `{ ok: true, marks }`。
- 请求包含 `documentPath`、`blockId`、`field`、`previous`、`value` 五个字段。`field` 为 `status` 或 `annotation`，原值和目标值均按该字段校验。界面从上次已知的持久化值取 `previous`。
- 400 表示输入无效，403 表示来源或资料路径不安全，409 表示原值已变化，422 表示目标不可用或资料无法读写。页面保留输入，冲突复读后可对照已存值选择如何处理。
- 讲解 AI 的只读格式见 [模型](../data-model.md)，产品内操作由阅读器完成。
