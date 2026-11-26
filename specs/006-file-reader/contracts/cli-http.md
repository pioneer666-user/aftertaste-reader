# CLI 与 HTTP 契约

## 启动和停止

node <产品根>/dist/cli/main.js serve --project <绝对目录> [--port <1..65535>]

默认端口 4317。仅监听 127.0.0.1，输出 JSON ready 含 URL、projectRoot，Ctrl+C/SIGTERM 优雅关闭，退出 0。非法参数退出 2，其余启动失败退出 1，error.code 稳定。端口占用为 PORT_IN_USE，项目目录失败为 PROJECT_UNAVAILABLE/PROJECT_PATH_UNSAFE，构建缺失为 WEB_BUILD_UNAVAILABLE。不终止已占用进程。

## 启动授权

现有前台 `serve` 启动方式继续适用。前台服务由原终端管理。

## AI 启动与停止

- `node <产品根>/dist/cli/main.js open-reader --project <绝对目录> [--port <1..65535>] [--mode <open|link>] [--target <位置片段>]`
- `node <产品根>/dist/cli/main.js stop-reader --project <绝对目录>`

省略位置时打开项目首页。文件块用 `#aftertaste-block/<encodeURIComponent(完整文档镜像路径)>/<块ID>`，闭环用 `#aftertaste-loop/<闭环ID>/<步骤ID>`。首选端口默认 4317，已有可验证的兼容后台实例优先于首选端口；首选端口被占时由系统分配实际端口。已就绪的实例在命令退出后继续服务。

启动成功输出一行 JSON，含 `ok:true`、`status:"ready"`、`projectRoot`、`reused`、普通 `location` 及 `browser:"requested"|"failed"|"skipped"`。默认 `open` 将入口交给系统默认浏览器，`requested` 表示系统接受打开请求。终端可见时也输出私密 `url`。仅链接模式或打开失败时，即便调用方重定向输出，仍返回私密 `url`。启动失败沿 CLI 错误格式和退出码，不返回 URL。登记或后台进程不可用分别为 `READER_INSTANCE_UNAVAILABLE` 或 `READER_WORKER_UNAVAILABLE`。停止返回 `stopped` 或 `not-running`，无法完成已确认实例的停止时返回 `READER_STOP_FAILED`。

已有实例探测超时或结果暂不能确认时，打开及停止均返回 `READER_INSTANCE_UNVERIFIED` 并保留登记。停止请求发出后直到确认旧监听已失效才报告 `stopped`；无法确认时保留登记，可重试。

授权页面从同源 `GET /api/reader-entry` 请求入口路径，附 `X-Aftertaste-Entry: 1`；响应不可缓存。加入本页最初的普通位置片段后供读者复制。启动步骤、来源、匿名拒绝和会话过期规则见下。

## 浏览器会话

交付的 `url` 为私密入口。普通地址和深链仅含位置。浏览器打开入口后自动完成 HTTP Basic 握手。程序客户端对同一入口发送 GET、Accept: application/json，取得 username、password 后仅向同一来源发送 Basic Authorization。服务退出后启动和会话凭据均失效。来源或会话无效统一返回 403 和通用提示；只有持有效令牌的浏览器握手可收到 401 挑战。

## 读取

- GET / 返回预构建页面。构建 assets 使用显式资源表。
- GET /api/documents 返回 {ok:true, projectRoot, documents:[{documentPath,sourcePath}], problems:[]}。
- GET /api/document?path=<编码的完整文档镜像路径> 返回 {ok:true,result:ReadingDocument}。
- 读取失败返回 {ok:false,error:{code,message,nextStep,context}}，非法输入 400，越界/来源 403，读取失败 422，未知接口 404，不支持方法 405。

不接受项目、Git 提交、磁盘资源路径覆盖参数。path 只解码一次，编码残留和任何不规范路径按共用路径规则检查。源路径只从镜像推导，提交只从文档头读取。

文件清单和单篇讲解独立读取。文件清单返回时更新可选入口和诊断；若发出请求后已选篇，保留该次选篇的正文与读取状态。

D012 的依赖图读取和布局写入另见 [依赖画布契约](../../007-dependency-canvas/contracts/graph-layout.md)。文件讲解接口仍只读。

D022 的文件树和块目录使用现有清单及单篇讲解返回值。读取请求和响应字段沿上述契约，导航状态仅保存在浏览器的本页中。书签、批注和笔记的读写与失败反馈分别沿 [D019](../../../docs/work/2026/11/D019-block-bookmarks/handoff.md)、[D021](../../../docs/work/2026/11/D021-understanding-marks/handoff.md)和 [D020](../../../docs/work/2026/11/D020-project-notes/handoff.md)的现有入口。

D023 的项目资料使用上述既有清单和单篇读取。当前文件阅读页向系统剪贴板提供 [U73](../../001-first-release/05-reading-feedback.md#u73--复制文档块定位-v1作者授权-ai-定稿) 定义的纯文本。浏览器拒绝写入时在当前页提供同文手动复制，文档缺少必填字段时走下方诊断。操作使用已加载的当前结果，无额外服务请求和资料写入。

D026 共用顶栏的用户界面约定见 [FR-011](../spec.md#functional-requirements)。通过既有页态进入各页面，文件读取、回访与服务请求格式沿上述契约。

D028 的顶栏、站内访问与失效位置恢复见 [FR-011、015—016](../spec.md#functional-requirements)。返回使用已有文档、记录和图的读接口。页内位置留在内存，个人资料的保存沿各自契约。

## 访问及缓存边界

Host 必须为 127.0.0.1 或 localhost 且端口与实际监听一致。Origin 若存在须精确等于该 Host 的 http 来源，Sec-Fetch-Site 若存在须为 same-origin/none。跨源读取返回通用拒绝提示，无 CORS 授权。所有响应 Cache-Control no-store，nosniff，禁止 frame，CSP 仅自身脚本/样式、连接自身、禁外部图片及对象。Markdown 原生 HTML 按文本处理，图片按替代文本，链接仅允许锚点或明确 http/https/mailto，点击外链使用安全 rel，普通磁盘相对链接按文本。

动态内容在请求和页面内存中处理。无请求日志、服务 Worker、缓存 API 或正文浏览器持久化。

## 诊断

共用 SOURCE_*、BLOCK_*、DOCUMENT_* code 和 params 原样传输，页面以 code 映射中英文问题及建议。sourceError 保留 Git 错误上下文，复制信息仅包含位置/引用与问题，不含源码或正文。读取错误同样提供可手动选择复制的文本。
