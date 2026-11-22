# Quickstart: 试读与验证

在 Windows 下从回味仓库 PowerShell 用 Node.js 24 和现有依赖执行 `npm run typecheck` 与 `npm run build`。运行材料放项目下的 `.local/D019/<run-id>/`。

## 自动检查

逐个运行 `node --test tests/unit/bookmarks.test.mjs`、`node --test tests/integration/bookmarks.test.mjs`，再用 `$env:AFTERTASTE_BROWSER='edge'; node tests/browser/bookmarks.mjs`。Edge 覆盖 Windows 资料被占用后的保存重试。兼容浏览器单独运行。HTTP 测试使用真实本机监听及合成项目。

## 试读

用 `node tests/fixtures/bookmark-project.mjs <新隔离项目绝对路径>` 创建从正式阅读样例派生的合成项目。用 `node dist/cli/main.js serve --project <隔离项目绝对路径> --port <空闲端口>` 启动，打开输出地址。

1. 在 `src/rules.mjs` 的第二个块添加有备注及空备注两条书签，在 `src/service.mjs` 的纯讲解块留一条。两文件各有 ID 相同的块。
2. 关闭页面与服务后重开同一项目。在顶栏书签列表分别选择三条，读完整理由。从列表及详情的「回原文」出发，核文件、块、滚动与所选备注的焦点，编辑一条、移除一条，再重开核页面和磁盘。
3. 在隔离样例改块正文或顺序并保留 ID，核回访。暂时移走文档、破坏格式或换掉块 ID，再点该书签的「回原文」。应提示暂不可定位，原定位、备注和磁盘应保留。还原文件再回访。
4. 隔离文件被占用时修改备注，核失败提示、输入与磁盘原件。解除后在当前页面刷新资料，切换讲解再回到原块，核原草稿仍可保存。同 ID 的其他文件应有独立的输入。两个浏览器页面各自保存时，复查最终资料保留两个操作。

正式更新确认删除的降级与解绑由版本更新任务联验。
