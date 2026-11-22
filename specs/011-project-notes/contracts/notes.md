# HTTP Contract: 项目笔记

`GET /api/notes` 返回 `{ ok: true, notes }`。项目由本机服务启动参数决定。

`PUT /api/notes` 需要 `application/json`、`X-Aftertaste-Notes: 1` 与有效本机来源。两个入口均无查询参数。

| action | 其他字段 | 成功响应 |
| --- | --- | --- |
| save | `id, previousRevision, revision, body, tags, title?` | `{ ok: true, note }` |
| remove | `id, previousRevision` | `{ ok: true, note: null }` |

新建时 `previousRevision` 为 null。编辑和移除使用已读修订。相同 `id`、`revision` 和内容的提交可原样重试。移除不存在的笔记直接成功。不同记录可依次写入，同一条陈旧写入返回 409。请求体参数错误返回 400，来源或项目路径非法返回 403，超限沿用服务的 413，存档损坏或读写失败返回 422。响应错误沿用 `{ ok: false, error }`。资料范围及格式见[数据模型](../data-model.md)。
