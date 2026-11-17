# D011 · 验证证据

批准 D011 @38b173f，比较 dev bf15ac7。Windows，Node 24.11.1（已有 .local/D009/runtime/node.exe），TS 5.9.3，Git 版本及最终候选在 handoff 绑定。全部产品输入为合成资料。

## 运行与失败记录

- 2026-11-17，测试先行执行新增 unit，缺少尚未实现的 Markdown 模块而失败，符合实施前置状态。
- 初次 vue-tsc 失败，类型引用的 application 文件使用 Node 类型，web 配置补齐类型上下文后通过。产品代码保持 type-only 导入，构建输出核真实依赖。
- 初轮新增 unit 3/3、integration 7/7，通过真实接口及降级、路径、来源、只读检查。
- 首轮完整 npm test 串行 69/69 通过，311.56 秒。随后新增物理行、阈值和翻译测试通过 6/6。
- Skill quick_validate 首次遇到 Windows Python 默认 GBK 解码错误。以 python -X utf8 原脚本重跑通过，未修改产品文档编码或受管脚本。
- 加入读取映射快照后，2026-11-17 unit 4 项在业务调用前被 checkedMapping 拒绝。测试把 Windows 路径写成 D:/synthetic，而现有映射契约要求与 path.join 一致的规范路径。目标动作未触发，依据为 MAPPING_MISMATCH 堆栈。下一轮验证假设是使用平台规范化测试路径后可进入读取，并保持调用时映射。该测试前提修复累计第 1 轮，产品映射规则继续沿现有契约。

后续实际结果按发生顺序追加，最终覆盖摘要另列。

- 映射测试前提修复后 unit 7/7 通过，HTTP integration 扩展到同名路径、Unicode、真实来源前提及重启后 7/7 通过。
- 浏览器脚本首次在模块解析阶段失败，Markdown 围栏反引号与 JS 模板字符串冲突，尚未启动服务或浏览器。修复假设为将不可信 Markdown 样例放入普通字符串，保留同样攻击内容。该脚本语法问题修复累计第 1 轮。

- 浏览器脚本语法修复后完成 Edge 157.0.4341.60 全路径及 Chrome 157.0.8103.79、Firefox 159.0 兼容路径，均无 pageerror 或外部请求，原证据位于 .local/D011/browser-0wn3qi。随后补充了读取失败的可推导源码路径，并增加剪贴板、键盘及列表错误检查。
- 最终受影响 Node 检查 24/24 通过，包含 D008 真实 CLI 回归、reader HTTP 和新增 unit。
- 新增真实剪贴板检查在 Windows 读回时为 CRLF，textarea inputValue 为 LF，JSON 内容相同，原断言比较字符串导致失败。目标复制动作已触发，页面已返回 Copied，原始差异为仅换行终止符。下一轮按接口约定核完整 JSON 语义相等，并继续保留无源码断言及复制失败检查。剪贴板测试前提修复累计第 1 轮，产品复制行为无需修改。失败沙盒为 .local/D011/browser-qgNQQM。

## 最终自测覆盖

| 命令／场景 | 真实结果及证据 |
| --- | --- |
| npm run typecheck，npm run build | Node 24.11.1、TS 5.9.3 通过，预构建页面随服务提供 |
| npm test | 初轮完整串行 69/69 通过，后续变更只影响下行三文件 |
| node --test --test-concurrency=1 tests/unit/file-reader.test.mjs tests/integration/file-reader.test.mjs tests/integration/document-blocks.test.mjs | 最终受影响 24/24 通过，59.47 秒 |
| node --test --test-concurrency=1 tests/skills/generation-static.test.mjs tests/skills/generation-sample.test.mjs | 3/3 通过，D010 两篇原件在重建提交上真实校验 |
| node tests/browser/file-reader.mjs | 修复后最终三浏览器通过，.local/D011/browser-8gpoay/report.json；Edge 157.0.4341.60、Chrome 157.0.8103.79、Playwright Firefox 159.0，行号对比度均为 5.512933884，串行无 pageerror 和外部请求 |
| 真浏览器交互 | 异 cwd 真实 CLI、两篇、固定提交、刷新、快速切换、两类块、61 行/1201 字、长行、空源码/正文、结构/范围降级、Git 不可读、坏 UTF-8、空态、列表错误、键盘 Enter 与可见焦点、中英切换及位置、刷新恢复、非法语言、存储不可用、真实剪贴板成功及失败回退 |
| HTTP 边界 | 非规范路径、编码穿越、保留名、尾点/空格、ADS、任意资源、额外/重复参数、POST、Host/Origin/Fetch Metadata、junction/硬链接均拒绝；合法目录/扩展名/Unicode/空格路径可读 |
| 全项目只读核对 | 作者合成样例含源码、讲解及 .git 共 38 个文件，正常和失败 HTTP 请求前后 SHA256 映射一致；测试接口正常/坏 UTF-8 读取亦核字节未变 |
| 正常停止／重启 | 从 .local/D011 cwd 启动端口 4317，PTY Ctrl+C 输出 stopped，核端口释放，随后同路径同端口重启可读。外层 PowerShell 在 Ctrl+C 后返回 1，服务端停止与端口释放已分别确认 |
| Skill 验证 | python -X utf8 原 quick_validate 通过，仅 tools.md 增补已实现命令 |
| git diff --check | 通过 |

最终截图在 `.local/D011/browser-8gpoay/`，包括 edge-desktop（1440×1000）、edge-mobile（390 宽）、fallback、git-unavailable、read-error，已逐张打开核对真实内容，无空白／错状态。1280 视口验证键盘交互。截图为合成资料且可重建，克隆不含 .local。R1 原图集保留在 browser-nLbuss。

Impeccable context 实际运行一次；按项目正式页面适配将视觉决定记入 plan，craft-floor 与实际 Read 场景已核。detect 实际运行一次，唯一 warning 为 Inter 常见字体。沿本批阅读用途和允许字体保留 Inter，本地自托管，交独审结合可读性复核。

依赖研究、npm 安装和 Playwright Firefox 下载沿用宿主既有 NODE_TLS_REJECT_UNAUTHORIZED=0，工具输出了提示。本任务没有修改全局网络设置。根锁文件 SHA256 为 C9A54F2AC72E15EE761ADCC99D378288EBEFFE74B422EA70AC5B95885C227DF6。构建文件哈希表保存 `.local/D011/build-hashes.json`，送审期间冻结构建和样例。

## Spec Kit 实际流程

按 D011 User Input 运行 specify→plan→tasks→analyze→implement，保留官方栏目。spec resolver、setup-plan、setup-tasks、RequireSpec/RequireTasks/IncludeTasks 前置均实际执行。requirements 内建质量验证 16/16；analyze 只读分析 6 项 FR、17 项任务，覆盖 100%，歧义/重复/严重问题/宪章违例/未映射任务均为 0。各阶段前后检查扩展配置不存在；analyze 与 implement 前置采用进程级 FEATURE_DIRECTORY 和 NO_PERSIST。

沿项目 Impeccable 适配复用既定场景，未另建 PRODUCT/DESIGN 和视觉竞选文件，视觉与交互设计落 plan。正式文档完整工作流，无未解决前置；需求质量清单通过仅表示表达质量。

## 证据边界

真实项目教学效果、作者阅读体验尚待验。Chrome/Firefox 覆盖正常读取、固定源码、中英、刷新恢复与存储仅语言的受影响兼容路径，完整失败矩阵由 Edge 主验。未验证 macOS、Linux、Safari、实体触屏及屏幕阅读器。大规模负载不在本批实际检查范围。

## 独审修复记录

R1 绑定 0b041b0，已确认行号对比度 4.186 低于 4.5，正常阅读已实际触发。取得“采集结束，可以恢复写入”后保存完整原文于 review.md。第 1 轮修复假设为将 #647b6d 加深至 #52685b，理论对比度 5.513；以真实浏览器计算样式复验并加入回归断言。该问题当前修复累计第 1 轮。

第 1 轮结果为类型/构建通过，Edge/Chrome/Firefox 实测均 5.512933884，通过新增至少 4.5 的回归断言及原有浏览器矩阵。修复后 CSS SHA256 为 2460EC2C39B41B2D4E5B21FFF5F479205122BAF1BFA42117AA950A8323549740，JS 字节哈希与 R1 相同。新构建表 `.local/D011/build-hashes-r2.json`。作者服务已用新构建重启，PID 40520、执行终端 90416，样例保持原件。交原审查者绑定新候选复核。

R2 绑定 984b291，原审查者独立 Edge 实测 5.512933884，并核断言、390px 英文、35 个构建文件与 38 个样例文件不漂移，结论通过。采集结束并明确交还写入，原文追加在 review.md。本问题第 1 轮修复成功，无待修复项。
