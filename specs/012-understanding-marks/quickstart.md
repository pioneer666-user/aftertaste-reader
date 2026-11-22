# Quickstart: 块级理解标注与批注

在项目根用 Node.js 24、Git、仓库依赖和 Windows Edge。串行运行：

```powershell
npm run typecheck
npm run build
node --test tests/unit/understanding-marks.test.mjs
node --test tests/integration/understanding-marks.test.mjs
node tests/browser/understanding-marks.mjs
node --test tests/skills/understanding-marks.test.mjs
```

浏览器用两个同 ID 的隔离讲解文件。从不理解和疑问开始，加入书签后重开，从标注筛选回访。改为已理解后原问句仍在，退出不理解筛选。改写批注、退回未标记再重开，最后清空批注。检查同块书签及既有项目笔记。另一文件只标不理解，留空批注。检查同 ID 改写、新 ID 和暂不可读的提示与恢复。

在隔离资料上使用 Windows 文件锁触发安全替换失败，或用两页同时打开同块批注后先后保存。核对错误、草稿、旧文件和重试。按 [Skill 指南](../../skills/aftertaste-reader/references/feedback.md) 读回已理解旧问句、未标记有批注。正式源码版本更新由其任务联验。

## D041 · 三页详情对齐

在 D041 隔离项目串行运行 `tests/browser/record-details.mjs`、`tests/browser/understanding-marks.mjs`。核不理解筛选、三态显示、只含批注的纯讲解块、无批注、失效重试以及原位回访和后退。
