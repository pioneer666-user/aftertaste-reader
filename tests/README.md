# 正式测试与固定样例

固定提交取源测试见 `unit/fixed-source.test.mjs`、`integration/fixed-source.test.mjs`，合成建库入口为 `fixtures/fixed-source.mjs`。先 `npm run build` 再 `npm test`，文件串行执行，本批临时仓库位于 `.local/D007/run-*`。独立 bare/普通非仓库在系统临时目录建立，先核无外层普通工作仓库，输出绝对路径并在测试结束清理。D007 回归覆盖提交身份、历史子项目、映射边界、共用入口与平台路径。后续按受影响能力建立 e2e、skills 等测试，定义见[目录规范](../docs/development/directories.md)，选择与证据要求见[验证约定](../docs/development/verification.md)。

fixtures 保留必要的合成输入和重建脚本；临时仓库、浏览器产物、实际日志不写回 fixtures。Skill 行为用例验证实际操作和产物，不用关键词命中替代行为结论。稳定的实验用例经正式实现任务接纳后放这里，仍引用实验来源。
