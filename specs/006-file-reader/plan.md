# Implementation Plan · 本地逐文件源码对照阅读

**Branch** codex/feat-file-reader | **Date** 2026-11-17 | **Spec** [spec.md](spec.md)

**Input** D011 @38b173f 的 W01—W06，已有固定源、块解析与 D010 资料。目标基线 bf15ac7。后置范围沿 spec Assumptions。

## Summary

单个 Node 本地服务提供预构建 Vue 页面和只读 JSON。DocumentService 在同次读取中完成解析、固定取源和覆盖检查，CLI 校验复用这条链。列表发现独立于 Git。页面仅在内存处理内容，以 code/params 翻译诊断。

## Technical Context

**Language/Version** TypeScript 5.9.3，Node 24.11.1 开发验证。

**Primary Dependencies** Fastify 5.12.8，Vue 3.5.45，Vite 8.3.8，@vitejs/plugin-vue 6.0.11，vue-tsc 3.3.14，markdown-it 15.0.3。沿单一 npm 锁文件，Playwright 1.65.1 仅验证。

**Storage** 读取目标项目 current 与 Git 对象。浏览器仅保存 aftertaste.language，内容不落存储和缓存。

**Testing** Node test 串行，真实 CLI/HTTP，Playwright 串行 Edge 主验及 Chrome/Firefox 适用检查。

**Target Platform** Windows 桌面。

**Project Type** 单包 CLI、本地服务、浏览器阅读页。

**Performance Goals** 本批无数值性能承诺。单篇按需读取，切换可取消过期请求。

**Constraints** 回环、单项目、只读、源码只引用、安全 Markdown、离线资源。Git 失败保留讲解阅读。

**Scale/Scope** 一个文件阅读页，三条用户场景，覆盖 W01—W06。

## Constitution Check

| 原则 | Phase 0 与 Phase 1 复核 |
| --- | --- |
| I 已确认需求 | 六项 FR 映射批准 W01—W06，后置能力沿任务范围 |
| II 固定源与资产 | 文档头提交取 Git，失败保留原文，全部 HTTP 为读取，仅语言持久化 |
| III 共用最少机制 | DocumentService 共用 CLI/HTTP 校验，无 CLI 子进程，无新解析器、数据库 |
| IV 分层验证 | 单元、真实 HTTP/CLI、浏览器与独审，作者体验单独待验 |
| V 官方结构 | specify/plan/tasks 解析实际模板，analyze 只读，implement 核 checklist |

研究前及设计后均无原则违例。

## Project Structure

### Documentation (this feature)

spec.md、plan.md、research.md、data-model.md、contracts/cli-http.md、quickstart.md、tasks.md、checklists/requirements.md。

### Source Code (repository root)

~~~text
src/
  core/                 # 既有块、路径、诊断类型
  application/
    document-blocks.ts   # 单次读取与校验
    file-reader.ts       # 发现/阅读用例和传输模型
  adapters/
    reader-directory.ts  # 安全发现及启动项目检查
    document-store.ts    # 复用读取边界
  cli/main.ts            # serve 入口与关闭
  server/reader.ts       # Fastify、来源边界及构建资源
  web/                   # Vue 阅读页、Markdown、中英文文案和样式
tests/
  unit/                 # 翻译、Markdown、单次读取
  integration/          # CLI/HTTP、路径、只读、诊断
  browser/              # 真浏览器路径和状态
~~~

**Structure Decision** 沿 D011 已定单源码根和职责，构建输出 dist/cli、dist/server 与 dist/web。Vite 仅构建页面。

## 页面设计

Read 模式。固定头部提供语言选择与刷新，左侧文件导航呈现完整源码相对路径，主区显示完整文档路径、提交与检查状态。对照块使用相邻双栏及清晰水平分隔，源码浅绿灰底、等宽字和实际行号，正文白底、系统中文字体。控件使用 Inter 自托管字体及中文系统回退。纯讲解块独立居中。绿色用于当前选择与键盘焦点，错误和警告同时配文字。主内容独立滚动使语言切换保持阅读位置，窄屏导航在上、每块源码和讲解上下排列。长行在源码区域横向滚动，正文自动换行。

Impeccable context 已实际运行，依项目适配直接复用现行规格并在此记录局部设计，craft-floor 和真实多视口检查适用。

## Complexity Tracking

本批无需要豁免的原则违例。
