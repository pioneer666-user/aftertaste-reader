# D011 · 本地逐文件源码对照阅读回执

## 当前结论与入口

W01—W06 已实现、自测和独审闭合，已获作者明确授权并合入 dev，作者体验待验。行为候选为 984b2917c5ca9cd106a0eb3524ff56b83d7019b5，批准任务为 [task.md @38b173f](task.md)，比较 dev 基线 bf15ac71b3f9bac97b37524598e73d9ec060234b，本批来源为 codex/feat-file-reader。独审 R1 绑定 0b041b0，发现行号对比度不足；第 1 轮修复后三浏览器均为 5.513，原审查者 R2 复核通过。[独审原文](review.md)保留发现和复核。

作者体验入口为 [本机阅读页](http://127.0.0.1:4317)，使用独立 D010 合成首批，项目位于 `.local/D011/author-sample/`。当前只读两篇讲解，源码依据 5394d8f86c961ce1b327674235525f57bf0b982c。作者尚未体验验收，真实项目教学效果待验。

2026-11-17，作者在本执行聊天明确指令“合并到dev”。按此授权将交回提交 028fa57 正常 --no-ff 整合，合并为 b7933d0bdca138eff9ef1cdb9b435737a40ba6cc。该指令记录为合并许可，页面作者体验继续待验。候选提交和原始审查记录可从 dev 合并历史追溯，合成试读资料与服务保留。

Git 停在 dev，已核合并双亲为 bf15ac7 与 028fa57，合并树与 028fa57 一致，既有验证及独审适用。功能分支 codex/feat-file-reader 经包含关系与 worktree 核查后安全删除，当前仅有本地 dev。工作区干净，后续推送及发布待对应授权。

## 依据与验证

| 验收项 | 实现与结果 |
| --- | --- |
| W01 | serve 显式项目、回环监听、预构建页面、异 cwd、启动诊断、Ctrl+C 停止及同端口重启 |
| W02 | current 实际发现、完整镜像路径、同名/异扩展名、空态与错误、完整文档路径/提交、刷新重读 |
| W03 | 两类块、固定 Git 源码、实际行号/空行/长行、同次读取与校验、未完成及超大警告 |
| W04 | 直接校验，安全 Markdown 降级，Git 不可用继续读，真实文件错误，含定位/实际引用的复制及手动复制 |
| W05 | 默认简体中文、英文切换、有效保存值恢复、中文回退、存储失败本次切换、位置保留，code/params 翻译 |
| W06 | 只读入口、来源与路径保护、安全渲染、本地静态资源、no-store、仅语言持久化，38 文件整体只读核对 |

正式材料为 [006 spec](../../../../../specs/006-file-reader/spec.md)、[plan](../../../../../specs/006-file-reader/plan.md)、[quickstart](../../../../../specs/006-file-reader/quickstart.md)。本批完整执行 Spec Kit specify/plan/tasks/analyze/implement，阶段事实和前置见 [evidence.md](evidence.md)。无正式结构偏离。界面采用项目 Impeccable 适配，视觉决定在 plan。

自测包含初轮完整串行 69/69、最终受影响 24/24、Skill 3/3、类型/构建与三浏览器。独立审查与自测分别记录，作者体验单独待验。详细环境、命令、失败前提修正及覆盖边界见 [证据](evidence.md)。

独审以 Ponytail Review 追全调用链，结合 Sharp Edges 与 Impeccable 的适用检查。R1 独立重跑 unit 7/7、真实 HTTP、Edge 与 320px/键盘检查，复用同版其余自测。R2 独立复核实际颜色、390px 英文、断言及构建/样例哈希，关闭唯一发现，均明确交还写入。后续回执归档没有行为变化。

未验证项包括作者体验、真实项目教学、macOS/Linux/Safari、实体触屏、屏幕阅读器、200% 文字缩放和大规模负载。依赖查询/安装及 Firefox 下载沿用宿主已有 TLS 设置，实际提示见证据。当前服务与样例均为本机开发树待验资源。

局部技术细化采用默认端口 4317、浅色双栏及窄屏按块上下排列、类型化双语字典、受限 Markdown 链接与图片替代文本。本批依赖精确固定在唯一锁文件。导出语言、其他主页面和后置能力沿对应任务处理。

## 作者体验与资源

最多关注三点。

1. 源码与讲解是否容易逐块对应。
2. 长内容阅读与文件切换是否顺手。
3. 中英文界面及错误提示是否清楚。

2026-11-18 主脑接回时，原执行服务（PID 40824）所在的 4317 端口已无监听。核对 35 个构建文件与独审 R2 清单一致后，使用原合成样例在原地址恢复待验服务，本次 PID 41004。首页返回 HTTP 200，文档列表返回 rules、service 两篇讲解。普通浏览器直接打开上述地址。

如进程已经关闭，在 Windows PowerShell 运行以下一条命令即可重启。它使用本机已有 Node 24，只读取合成样例，看到 ready 和 URL 表示完成。

```powershell
& 'D:/project/SpecDev Harness/aftertaste-reader/.local/D009/runtime/node.exe' 'D:/project/SpecDev Harness/aftertaste-reader/dist/cli/main.js' serve --project 'D:/project/SpecDev Harness/aftertaste-reader/.local/D011/author-sample'
```

自行重启的服务在该终端 Ctrl+C 停止。主脑恢复的后台服务可在核对端口进程与上述 PID、样例路径一致后停止。验收完成且确认不再复核时可清理 D011 自建样例与截图。D010 原件、沙盒及其他任务资源保留。

可移植使用说明见 [本地阅读](../../../../usage/file-reader.md)。正式运行需要 Node24/Git，当前开发树与本机 Node 路径并非安装发布入口。
