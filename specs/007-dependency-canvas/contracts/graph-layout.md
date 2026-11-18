# 依赖画布 HTTP 契约

继承 [D011 本机边界](../../006-file-reader/contracts/cli-http.md)。启用专用 PUT，其他页面和资料接口仍只读。

- GET `/api/dependency-canvas`，无参数。成功返回 `{ok:true, graph, graphVersion, documents, layout, revision, reconciled, layoutProblem, documentsUnavailable}`。graph 原样为 D009 内容，documents 是实际讲解条目，revision 未保存时为 null。reconciled 表示已有布局与有效节点名单发生增删。layoutProblem 为无故障时 null，读取布局失败时返回诊断与不可写的默认预览。documentsUnavailable 表示讲解目录无法完整确认。
- PUT `/api/dependency-layout`，无参数。JSON 请求必须包含 `{graphVersion, expectedRevision, layout}`，另带 `X-Aftertaste-Layout: 1`。仅接收专用格式的布局字段与当前图的完整位置名单。成功返回 `{ok:true,revision}`。
- 格式错误返回 400，越界或写来源不符 403，已变更修订或图摘要冲突 409，其他可诊断读取／写入失败 422。错误沿 `{ok:false,error:{code,message,nextStep,context}}`。
- 相邻写入在同一阅读服务串行执行。服务校验项目资料真实目录和目标普通单链接文件，同目录独占临时文件写入、同步、关闭，重读与核对当前图和目标，原子发布。只有发布完成才确认。多服务进程同时写同一项目以及外部文件系统竞争不属于此协议的同步保证。同一项目使用一个服务供多标签页访问。
- 写失败时保留页面最新操作和已保存文件，可重试。修订冲突禁止静默覆盖，可显式放弃本页草稿读取磁盘；图摘要冲突需刷新图。布局坏文件只报告并保留文件，修复原件后刷新。
