# D045 · 从本地安装包开始读真实后端

## 目标与依据

本实验回答两个问题：第一次拿到回味的人能否只凭安装包和读者说明生成第一篇讲解？读者能否沿生成的闭环讲清一次收藏请求怎样变成数据库中的记录、计数和前端响应？通过条件和独审要求见[任务书](../../docs/work/2026/11/D045-alpha-first-run/task.md)。

## 输入与复现

试读项目为 [Apache Answer v1.5.0](https://github.com/apache/answer/commit/3f1ed50f6776452c11b6ffdbdc767cd1887d629b)，固定提交为 `3f1ed50f6776452c11b6ffdbdc767cd1887d629b`。从回味仓库根按 [README 构建本地包](../../README.md#构建本地包)，用 `Get-FileHash -Algorithm SHA256 <包路径>` 与 `tar -tf <包路径>` 记录校验值及清单。包和日志可放在本实验的 `.local/<run-id>/`。目标项目和工具安装目录放在仓库外，彼此独立。

```powershell
$trial = Join-Path ([System.IO.Path]::GetTempPath()) ('Aftertaste D045 ' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $trial | Out-Null
$project = Join-Path $trial 'apache-answer'
& ./experiments/D045-alpha-first-run/prepare-project.ps1 $project
```

按 [首次安装](../../README.md#首次安装)安装。复走时可把命令中的 `$tools` 设为 `Join-Path $trial 'Aftertaste Reader'`，其余安装和日常阅读命令相同。核实际 Skill、CLI 和页面都来自该目录。产品首次使用只依赖公开 README 和包内文件。

把 README、包内 Skill 路径、目标项目路径和下列问题交给一次新的讲解 AI 会话。等待 AI 补问后选择逐批生成，打开第一篇，再确认继续及实际选线。核对答案和作者的试读结果单独保存在[任务回执](../../docs/work/2026/11/D045-alpha-first-run/handoff.md)及独审中。

> 我想读这个项目的后端。先讲收藏问题涉及的文件，我关心前端传什么、谁决定写库、最后返回什么。

维护者可用此仓库的 Playwright 在 Windows／Edge 上辅助检查。以安装后的 CLI 启动服务，从 README 的输出得到 `$url`。在仓库根依次运行，路径、闭环与步骤 ID 取实际生成结果。浏览器阻断回环服务之外的请求，并只输出路径、版本、范围与检查结果。

```powershell
node experiments/D045-alpha-first-run/check-reader.mjs $url $project file <首篇源码路径>
node experiments/D045-alpha-first-run/check-reader.mjs $url $project loop <闭环ID> <分支步骤ID>
# 停止并重开同一个已安装的阅读服务，按新进程输出更新 $url。
node experiments/D045-alpha-first-run/check-reader.mjs $url $project reopen <闭环ID> <分支步骤ID>
```

## 结果与交回

[D045 回执](../../docs/work/2026/11/D045-alpha-first-run/handoff.md)汇总实际结果、独审和作者入口。上游源码、含源码的日志和个人试读资料仅留在隔离环境。
