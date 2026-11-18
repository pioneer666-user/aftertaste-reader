# 依赖画布 HTTP 契约

继承 [D011 本机边界](../../006-file-reader/contracts/cli-http.md)。启用专用 PUT，其他页面和资料接口仍只读。

- GET `/api/dependency-canvas`，无参数。成功返回 `{ok:true, graph, graphVersion, confirmedRemovals, nodeRemovals, documents, layout, revision, reconciled, layoutProblem, documentsUnavailable}`。graph 原样为 D009 内容。confirmedRemovals 为匹配当前快照的已确认缺席路径，nodeRemovals 为在图节点已知的移除标记，两者均用于保护未保存草稿。documents 是实际讲解条目，revision 未保存时为 null。reconciled 表示已有布局需协调，包括名单变化与同路径重加。layoutProblem 无故障时为 null，布局读取失败时提供默认预览，移除未确认时提供当前图预览。两种预览均暂停布局保存。documentsUnavailable 表示讲解目录无法完整确认。
- graphVersion 绑定图原文和当前移除凭据，保存前及发布前均重读核对。
- PUT `/api/dependency-layout`，无参数。JSON 请求必须包含 `{graphVersion, expectedRevision, revision, layout}`，另带 `X-Aftertaste-Layout: 1`。每次尝试使用新的 UUID。同一尝试丢失响应可按同一内容重放，当前磁盘上已是该修订和布局时直接确认。成功返回 `{ok:true,revision}`。
- PUT 的 `layout.positions` 必须使用 `[[路径, {x, y}], ...]`。路径必须唯一并与当前节点完整匹配。服务升级后仍打开旧页面的读者需重新加载页面，取得识别同路径重加的客户端逻辑。GET 和磁盘继续使用坐标对象。
- 格式错误返回 400，越界或写来源不符 403，已变更修订、图摘要冲突或无法确认节点移除返回 409，其他可诊断读取／写入失败 422。错误沿 `{ok:false,error:{code,message,nextStep,context}}`。
- 相邻写入在同一阅读服务串行执行。服务校验项目资料真实目录和目标普通单链接文件，同目录独占临时文件写入、同步、关闭，重读与核对当前图和目标，原子发布。只有发布完成才确认。多服务进程同时写同一项目以及外部文件系统竞争不属于此协议的同步保证。同一项目使用一个服务供多标签页访问。
- 写失败时保留页面最新操作和已保存文件，可重试。服务明确拒绝无效输入后，页面以修正后的布局开启新尝试。修订冲突禁止静默覆盖，可显式放弃本页草稿读取磁盘。图摘要冲突需刷新图。布局坏文件只报告并保留文件，修复原件后刷新。
