# HTTP Contract: 项目笔记

## 个人记录文件权限（D057）

笔记、书签和自评沿同一保存适配器。首次创建只给当前系统用户及平台必要账号访问权。已有文件的授权范围、明确共享和原来受限的访问在再次保存时保留。承载正文的同目录临时文件从首字节起使用相应权限。无法取得或保留权限时沿原保存失败诊断，保留原文、原权限和页面未保存输入。数据位置和 JSON 格式沿现有契约。

## 接口

`GET /api/notes` 返回 `{ ok: true, notes }`。项目由本机服务启动参数决定。

`PUT /api/notes` 需要 `application/json`、`X-Aftertaste-Notes: 1` 与有效本机来源。两个入口均无查询参数。

| action | 其他字段 | 成功响应 |
| --- | --- | --- |
| save | `id, previousRevision, revision, body, tags, title?` | `{ ok: true, note }` |
| remove | `id, previousRevision` | `{ ok: true, note: null }` |

新建时 `previousRevision` 为 null。编辑和移除使用已读修订。相同 `id`、`revision` 和内容的提交可原样重试。移除不存在的笔记直接成功。不同记录可依次写入，同一条陈旧写入返回 409。请求体参数错误返回 400，来源或项目路径非法返回 403，超限沿用服务的 413，存档损坏或读写失败返回 422。响应错误沿用 `{ ok: false, error }`。资料范围及格式见[数据模型](../data-model.md)。
