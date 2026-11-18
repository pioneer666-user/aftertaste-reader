# D016 · 回执

## 当前结论与入口

- D016 已实现本地闭环阅读。可按推荐顺序或实际连线读完订单的两条结果，分别选中和摆放引用同一原块的两个步骤。闭环与依赖图共用布局交互，各自保存坐标、组和视野。
- [打开本机试读](http://127.0.0.1:4336)。顶部进入「闭环阅读」，可选「订单数量校验怎样决定集合会不会改变」和「路径工具怎样处理文件名」。同一试读项目的「文件依赖图」也有 `node:path` 图例。
- 行为候选 `3866952edfa0063ac8c08286603fdd8734459b4f`。Windows 三浏览器自测和关联的 26 项回归通过。[独立审查原文](review.md)记录了切图落盘的独立实测。列表诊断发现已修复，R2 复核通过。
- 作者体验待验。优先看数量校验两条连线是否好跟读，分别摆放两个服务步骤，再将 `node:path` 在两图设成不同位置和组，重启后查看恢复。
- 2026-11-18，作者指令「合并到dev」授权本地整合。D016 已通过 `947c386604e46ec25a76ab1025dc8881297c21aa` 合入 `dev`。合并树与来源分支顶端 `29f2808` 一致，复用自测与 R2 独审证据。当前工作区停在 `dev`，按任务单保留受审分支 `codex/feat-loop-reader` 供作者体验验收。

## 依据与验证

批准依据为 [D016 任务单](task.md) `1b5a1c83dc4cbfbea8620a6283bc6569e1d51af3`，无有效调整。覆盖 V01–V04 和现行规格 R16–R18、A17–A19 的本单范围。行为实现以 `e6c417e6103a1d6bc18c691cbc7d9ef446228c97` 送审，`3866952` 补齐列表故障诊断。正式材料入口为 [009 规格](../../../../../specs/009-loop-reader/spec.md)、[方案](../../../../../specs/009-loop-reader/plan.md)和[任务](../../../../../specs/009-loop-reader/tasks.md)。

- Spec Kit v1.4.0 使用 specify、plan、tasks、analyze、implement，实际解析需求、方案与任务模板，使用 `setup-plan.ps1`、`check-prerequisites.ps1`。需求清单 16/16。编码前的只读分析覆盖 7 项 FR 和 4 项 SC，对应 12 项任务，未发现歧义、重复或原则冲突。功能路径固定为 `specs/009-loop-reader`，阶段检查无扩展 hooks。
- 技术细化将闭环个人布局保存到 `docs/aftertaste/loops/<id>/layout.json`，闭环步骤使用成品节点 ID。每张已打开图保有自己的草稿和请求目标。选中闭环图例后，可按参与文件查看保存的用法，闭环连线用曲线区分两条订单分支。
- Windows `10.0.26200`、Node `24.22.3`、Git `2.50.1.windows.1`、Playwright `1.65.1`。运行 `tsc --noEmit`、`vue-tsc --noEmit -p tsconfig.web.json`，并用 `tsc --outDir` 和 `vite build --outDir` 生成隔离构建。旧回归的静态导入用本地模块加载脚本指向隔离构建，根目录 `dist` 保持原状。
- 串行 `node --test --test-concurrency=1` 运行 `tests/unit/canvas-layout.test.mjs` 及 `tests/integration/` 下的 `file-reader`、`dependency-canvas`、`dependency-legends`、`loops`、`loop-reader` 测试，共 **26/26**。验证旧依赖布局和移除凭证、旧 D015 成品、图身份与修订校验、连续与并发写入、拒绝布局硬链接、固定源码失读时继续阅读和保存。受审的服务端与 CLI 源码在诊断修复前后相同。日志为 `.local/D016/candidate/regressions-rerun.log`。
- 在最终隔离构建上串行运行 `node tests/browser/loop-reader.mjs`。每个浏览器 **8 组通过**，用正式 CLI 重建两条路线。场景包括两条订单分支和同块双步骤、三张图重启恢复、A 的真实读写响应在 B 打开后放行、B 的布局状态及磁盘修订、同图多标签冲突、注入写失败后保草稿并重试、固定源码失读及列表双语坏字段诊断。布局操作前后，两份成品与依赖图内容字节一致。
- Impeccable 采用现有页面的阅读与操作样式。检查键盘焦点、双语反馈、1650px 桌面与 390px 窄屏。机械检查回报空数组，现有 08 规格和任务单提供产品上下文。

| 最终浏览器 | 版本 | 实测报告目录 |
| --- | --- | --- |
| Edge | 157.0.4341.60 | `.local/D016/browser-edge-hHDUnN/` |
| Chrome | 157.0.8103.79 | `.local/D016/browser-chrome-SflGv2/` |
| Firefox | 159.0 | `.local/D016/browser-firefox-syf2zl/` |

Edge 目录有订单分支和窄屏截图。写失败的页面检查使用注入的 `EACCES` 响应，实际磁盘保护用硬链接和既有发布检查验证。本次浏览器执行在 Windows。D015 样例发布曾返回 `LOOP_WRITE_FAILED / EPERM`，发生在浏览器启动前，同构建在新隔离目录重跑成功，原始失败日志保留在 `.local/D016/candidate/{edge,chrome}-final.log`。Windows 测试加载脚本初次用盘符绝对路径触发 ESM 启动错误，改用相对 `--import` 后回归全过。R1 诊断缺口处理和复验见审查记录，修复验证一轮。

## 资源与交回

- 试读服务由 D016 执行启动，进程 `38156`，目录 `.local/D016/trial-3866952/project`，用 `.local/D016/candidate/build-r2` 和 Node 24。试读项目固定提交 `4be951b2bf9aae434e0acc3e1aeab3e4e0cf0734`。服务日志在 `.local/D016/trial-3866952/reader.log`。
- 结束试读后可停止该进程。重新启动时在回味仓库的 PowerShell 中运行下列命令，保留目标项目目录便会恢复已保存的排布。前台启动后按 Ctrl+C 停止。

```powershell
$readerNode = (Get-Command node -All | Where-Object { $_.Version.Major -eq 24 } | Select-Object -First 1).Source
& $readerNode '.local/D016/candidate/build-r2/cli/main.js' serve --project (Join-Path $PWD '.local/D016/trial-3866952/project') --port 4336
```

- 试读 [重建和自动验证入口](../../../../../specs/009-loop-reader/quickstart.md)。作者体验验收后再确认试读资源和受审分支的清理。
