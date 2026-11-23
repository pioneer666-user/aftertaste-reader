# 本机阅读接口

沿用[依赖图布局契约](../../007-dependency-canvas/contracts/graph-layout.md)的本机来源、写入标识、修订和布局验证规则。

| 请求 | 正常响应（含 `ok: true`） |
| --- | --- |
| `GET /api/loops` | `loops: [{ id, title, goal, steps, edges, fileCount }]` 和 `problems`。无成品返回空列表；坏成果不阻断正常条目 |
| `GET /api/loops/:id` | `result`（闭环和按步骤标记的运行时源码），`graphVersion`、`layout`、`revision`、`reconciled`、`layoutProblem` |
| `PUT /api/loops/:id/layout` | JSON 请求体沿 007 保存结构，返回 `revision`。向其他 ID 提交原图版本会失败 |

ID 按 D015 校验。服务启动时固定项目根。子目录和文件经过路径检查。缺失或无效成品禁止该图写入；一个源码对象失读时仍可阅读与保存布局。同图旧修订冲突返回 409，原文件保留；允许精确重试已提交的修订。依赖图继续使用原接口和磁盘路径。

D031 的讲解直读、源码浮层和画布反馈使用现有 `GET /api/loops/:id` 的 `result.loop` 与按步骤标记的 `result.sources`，本机请求及响应契约不变。预览、固定、关闭、选择和文本滚动不调用 `PUT`，不新增布局字段。

目录按推荐顺序给出步骤 ID 数组 `steps`；`edges` 只返回 `{from,to}`。步数取数组长度，`fileCount` 按步骤引用的源码路径去重。列表不读取个人布局或 Git 源码。

## 参与文件

`GET /api/loops/:id/route` 读取并核验当前闭环，返回 title、source_commit 和去重的 paths。服务按目标项目在 Git 工作区的实际前缀核对成品 project_prefix，位置失配或无法核实时另带 mappingProblem，仍可阅读成品。读取失败沿用闭环诊断。

D043 从笔记打开步骤时使用当前闭环的既有 GET。以闭环 ID 和步骤 ID 核对，成功后展开右栏并进入站内历史；失效时在笔记报告原因。复制定位只读取已加载的步骤。

直接打开带步骤引文片段的本机阅读地址时，使用同一回访路径并以该步骤作为初始阅读位置。

两图 GET 均附分层输入 `relations`，包含有向边端点 `edges` 与库的画布键和目标 `libraries: [{id,targets}]`。闭环另附入口优先的 `order`。旧图仅有文件用法时目标为空；完整个人坐标及组成员仍按原契约往返。
