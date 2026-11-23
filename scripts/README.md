# 仓库辅助脚本

回味预构建包通过根包清单的 `prepack` 调用正式构建。`build-web.mjs` 沿用 Vite 的页面构建配置，同时生成随页面和字体交付的第三方许可说明。构建和打包命令见 [README](../README.md#构建本地包)。

产品业务命令归 `src/cli/`，共用业务规则归 src 内对应层；实验专用脚本留在该任务的 experiments 目录。固定第三方技能自带脚本保留原包，现有 `.agents/verify-sources.ps1` 继续与技能来源清单相邻，不另造副本。

完整职责见[目录规范](../docs/development/directories.md)。执行任务首次引入工具配置时同时明确输入、输出和可重跑命令。
