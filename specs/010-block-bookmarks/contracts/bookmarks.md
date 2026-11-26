# HTTP Contract: 项目书签

文件首次创建及替换使用[共用个人记录权限规则](../../011-project-notes/contracts/notes.md#个人记录文件权限d057)。

`GET /api/bookmarks` 返回 `{ ok: true, bookmarks }`。项目由启动服务时选定。路径、块和备注结构见 [数据模型](../data-model.md)。

`PUT /api/bookmarks` 需要 `Content-Type: application/json`、`X-Aftertaste-Bookmarks: 1` 和有效的本机请求来源。GET 与 PUT 均无需查询参数，PUT 成功返回保存后的完整项目列表供页面同步。

| `action` | 其他字段 | 处理 |
| --- | --- | --- |
| `create` | `id, documentPath, blockId, note` | 新 ID 验证当前可定位块。相同 ID 与内容重试返回现有结果，相同 ID 不同内容冲突。 |
| `edit` | `id, previousNote, note` | 验证已存备注等于预期，再改指定记录。已等于请求结果时可直接成功。记录已移除时报告不存在。 |
| `remove` | `id, previousNote` | 验证已存备注等于预期，再删除。记录已移除时可直接成功。 |

仅接受表中的字段。失败沿用阅读服务的 `{ ok: false, error }`。参数错误为 400，来源和路径约束为 403，记录不存在为 404，资料或记录变化为 409。当前块不可定位、资料损坏、读取及保存失败为 422。按 Fastify 既有请求体限制处理超限请求。失败后不发布本次写入。
