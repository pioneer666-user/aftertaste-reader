# Quickstart: 文件依赖画布

运行前备好 Node 24、Git 和项目根 npm 依赖。构建后按 [试读与保存说明](../../docs/usage/file-reader.md#dependency-canvas) 启动真实服务。

```powershell
npm run typecheck
npm run build
npm test
npm run test:browser:canvas
```

浏览器检查用 D010 固定样例，先沿两条线选 service，阅读并返回，再选 audit。建立两个组，把非成员放进一组范围，缩放后拖组，检查成员与非成员的变化。看到已保存后关闭浏览器与服务，用新的浏览器和服务对比原坐标、视野、成员及磁盘文件。再通过图工具增加并移除节点，核对位置协调、坏图保护及旧标签页冲突。脚本使用独立临时项目，可通过环境变量指定兼容浏览器，证据落 `.local/D012/`。

D013 定向检查运行 `node tests/browser/canvas-fixes.mjs`，用本机临时端口和 `.local/D013/` 下的合成项目。覆盖正式删空再登记、同路径重加的两种页面时序和旧页草稿、合法特殊文件名的持久化、迟到清单与显式选篇。预期按 [F1—F4](../../docs/work/2026/11/D013-canvas-fixes/task.md)。
