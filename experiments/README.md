# 按任务组织实验

实验是一次已批准任务的取证过程，按任务保留实现、固定输入和结果证据。

- [D004 · 图画布自由布局与持久恢复](D004-canvas-persistence/README.md)
- [D045 · 从本地安装包开始读真实后端](D045-alpha-first-run/README.md)

```text
docs/work/YYYY/MM/D编号-主题/  # task、有效调整、handoff、review
experiments/D编号-主题/
  README.md                   # 输入、环境、复现、判定与结果入口
  <本实验需要的脚本和配置>
  inputs/                     # 仅需要版本管理的合成输入／固定样例
  .local/<run-id>/             # 可再生成输出，不进入 Git
```

- 与派单共用 D 编号，先有范围与通过条件，再运行；一单多项小实验在同目录分子目录。
- 复制 [_template/README.md](_template/README.md) 到本任务目录，再按实际情况删去无关栏目。不要在模板目录运行实验。
- 脚本、输入和重建说明随 Git 保留；大日志、截图、临时仓库、安装包按任务放 `.local/`，回执保存结论、必要证据摘要及路径。
- 新依赖仅在获批实验边界安装，记录锁定版本与重建方法；依赖目录忽略，产品不引用实验依赖。
- 失败和未验证项如实保留；成功代码经正式任务整理进 src／skills，稳定检查进入 tests，不直接将实验宣布为产品交付。
- 唯一输入／不可重建证据不能只在忽略目录。真实源码仍按固定 Git 引用读取，不另存源码片段、补丁或含源码日志；用合成样例做失败注入。

统一职责见[目录规范](../docs/development/directories.md)，资源与判定规则见[验证约定](../docs/development/verification.md)。
