# CLI 与 HTTP 契约

## 启动和停止

node <产品根>/dist/cli/main.js serve --project <绝对目录> [--port <1..65535>]

默认端口 4317。仅监听 127.0.0.1，输出 JSON ready 含 URL、projectRoot，Ctrl+C/SIGTERM 优雅关闭，退出 0。非法参数退出 2，其余启动失败退出 1，error.code 稳定。端口占用为 PORT_IN_USE，项目目录失败为 PROJECT_UNAVAILABLE/PROJECT_PATH_UNSAFE，构建缺失为 WEB_BUILD_UNAVAILABLE。不终止已占用进程。

## 读取

- GET / 返回预构建页面。构建 assets 使用显式资源表。
- GET /api/documents 返回 {ok:true, projectRoot, documents:[{documentPath,sourcePath}], problems:[]}。
- GET /api/document?path=<编码的完整文档镜像路径> 返回 {ok:true,result:ReadingDocument}。
- 读取失败返回 {ok:false,error:{code,message,nextStep,context}}，非法输入 400，越界/来源 403，读取失败 422，未知接口 404，不支持方法 405。

不接受项目、Git 提交、磁盘资源路径覆盖参数。path 只解码一次，编码残留和任何不规范路径按共用路径规则检查。源路径只从镜像推导，提交只从文档头读取。

文件清单和单篇讲解独立读取。文件清单返回时更新可选入口和诊断；若发出请求后已选篇，保留该次选篇的正文与读取状态。

D012 的依赖图读取和布局写入另见 [依赖画布契约](../../007-dependency-canvas/contracts/graph-layout.md)。文件讲解接口仍只读。

D022 的文件树和块目录使用现有清单及单篇讲解返回值。读取请求和响应字段沿上述契约，导航状态仅保存在浏览器的本页中。书签、批注和笔记的读写与失败反馈分别沿 [D019](../../../docs/work/2026/11/D019-block-bookmarks/handoff.md)、[D021](../../../docs/work/2026/11/D021-understanding-marks/handoff.md)和 [D020](../../../docs/work/2026/11/D020-project-notes/handoff.md)的现有入口。

## 访问及缓存边界

Host 必须为 127.0.0.1 或 localhost 且端口与实际监听一致。Origin 若存在须精确等于该 Host 的 http 来源，Sec-Fetch-Site 若存在须为 same-origin/none。跨源读取返回 ACCESS_DENIED，无 CORS 授权。所有响应 Cache-Control no-store，nosniff，禁止 frame，CSP 仅自身脚本/样式、连接自身、禁外部图片及对象。Markdown 原生 HTML 按文本处理，图片按替代文本，链接仅允许锚点或明确 http/https/mailto，点击外链使用安全 rel，普通磁盘相对链接按文本。

动态内容在请求和页面内存中处理。无请求日志、服务 Worker、缓存 API 或正文浏览器持久化。

## 诊断

共用 SOURCE_*、BLOCK_*、DOCUMENT_* code 和 params 原样传输，页面以 code 映射中英文问题及建议。sourceError 保留 Git 错误上下文，复制信息仅包含位置/引用与问题，不含源码或正文。读取错误同样提供可手动选择复制的文本。
