# D011 · 本地逐文件源码对照阅读回执

## 当前结论与入口

W01—W06 已实现并完成自测。独审 R1 绑定 0b041b0，发现行号对比度不足，已加深并通过三浏览器复验，当前准备固定修复候选复核。批准任务为 [task.md @38b173f](task.md)，比较 dev 基线 bf15ac71b3f9bac97b37524598e73d9ec060234b，接续 codex/feat-file-reader。[独审原文](review.md)保留原发现。

作者体验入口为 [本机阅读页](http://127.0.0.1:4317)，使用独立 D010 合成首批，项目位于 `.local/D011/author-sample/`。当前只读两篇讲解，源码依据 5394d8f86c961ce1b327674235525f57bf0b982c。作者尚未体验验收，真实项目教学效果待验。

保留功能分支与待验资源。后续由作者将本回执交回主脑，体验及整合按单独决定推进。

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

局部技术细化采用默认端口 4317、浅色双栏及窄屏按块上下排列、类型化双语字典、受限 Markdown 链接与图片替代文本。本批依赖精确固定在唯一锁文件。导出语言、其他主页面和后置能力沿对应任务处理。

## 作者体验与资源

最多关注三点。

1. 源码与讲解是否容易逐块对应。
2. 长内容阅读与文件切换是否顺手。
3. 中英文界面及错误提示是否清楚。

自建待验服务在当前开发树运行，端口 4317，PID 40520，执行工具终端会话 90416。服务与 dist 构建、合成样例均须保持对应候选。普通浏览器直接打开上述地址。

如进程已经关闭，在 Windows PowerShell 运行以下一条命令即可重启。它使用本机已有 Node 24，只读取合成样例，看到 ready 和 URL 表示完成。

```powershell
& 'D:/project/SpecDev Harness/aftertaste-reader/.local/D009/runtime/node.exe' 'D:/project/SpecDev Harness/aftertaste-reader/dist/cli/main.js' serve --project 'D:/project/SpecDev Harness/aftertaste-reader/.local/D011/author-sample'
```

自行重启的服务在该终端 Ctrl+C 停止。当前执行创建的服务可交执行按归属关闭，或先核端口进程为上述 PID 后停止该进程。验收完成且确认不再复核时可清理 D011 自建样例与截图。D010 原件、沙盒及其他任务资源保留。

可移植使用说明见 [本地阅读](../../../../usage/file-reader.md)。正式运行需要 Node24/Git，当前开发树与本机 Node 路径并非安装发布入口。
