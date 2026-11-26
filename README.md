# Aftertaste Reader · 回味

用浏览器对照 Git 固定提交的源码和 AI 讲解。可以逐文件读，也可以沿跨文件的闭环追一次请求如何传递、写入和返回。讲解、闭环与个人阅读记录保存在你的项目里。

**首个公开试用版 `v0.1.0-alpha.1`。** 已在 Windows 上用真实的后端收藏请求走通安装、逐文件阅读、闭环分支和关闭后重开。欢迎带一个你正在读的项目试用。[下载预构建安装包](https://github.com/pioneer666-user/aftertaste-reader/releases/download/v0.1.0-alpha.1/aftertaste-reader-0.1.0-alpha.1.tgz) · [发行说明与校验值](https://github.com/pioneer666-user/aftertaste-reader/releases/tag/v0.1.0-alpha.1) · [反馈使用体验](https://github.com/pioneer666-user/aftertaste-reader/issues)

## 首次安装

准备 Node.js 24 LTS、npm、Git 2.45+、一个已有 Git 提交的本地项目，以及能读取本机文件和运行终端命令的 AI。确认 `node --version` 显示 `v24.x`，再用 `npm --version` 和 `git --version` 检查工具可用。

拿到回味的 `aftertaste-reader-*.tgz` 后，在 PowerShell 执行以下命令。按提示粘贴包的完整路径，再输入项目目录。npm 联网安装运行依赖。工具安装在独立目录，项目保留在原来的位置。

```powershell
$package = (Resolve-Path -LiteralPath (Read-Host '回味安装包的完整路径') -ErrorAction Stop).Path
$tools = Join-Path $env:LOCALAPPDATA 'Aftertaste Reader'
New-Item -ItemType Directory -Path $tools -Force | Out-Null
npm install --prefix "$tools" --omit=dev "$package"
if ($LASTEXITCODE -ne 0) { throw '安装失败，请查看 npm 输出。' }
$project = (Resolve-Path -LiteralPath (Read-Host '要阅读的 Git 项目目录') -ErrorAction Stop).Path
$installed = Join-Path $tools 'node_modules/aftertaste-reader'
$skill = Join-Path $installed 'skills/aftertaste-reader/SKILL.md'
$skill
$project
```

把最后两行输出填入下面这句话，发给 AI。把引号里的困惑换成你真正想读的问题。

> 请显式读取「Skill 完整路径」，为「Git 项目完整路径」生成回味讲解。我想先读「例如登录后的数据如何保存」。先只生成一小批，读过再继续。请告诉我怎样打开第一篇。

AI 会确认缺失的范围和节奏。项目还没有讲法时，AI 会给三种讲法并等你选定，后续文件讲解和闭环沿用这一选择。默认固定开始时的 HEAD，要读其他版本可以给出本地 Git 提交。生成讲解后，可以请 AI “从已有讲解里找一条能回答我的问题的闭环路线”。看过路线后选定，AI 再保存。

## 日常打开与关闭

新开 PowerShell 时输入同一个项目目录。用安装后的 CLI 启动阅读器。

```powershell
$tools = Join-Path $env:LOCALAPPDATA 'Aftertaste Reader'
$cli = Join-Path $tools 'node_modules/aftertaste-reader/dist/cli/main.js'
$project = (Resolve-Path -LiteralPath (Read-Host '要阅读的 Git 项目目录') -ErrorAction Stop).Path
node "$cli" serve --project "$project"
```

在自己的终端找到启动输出中的 `url`，直接在浏览器打开。这个私密入口只供自己使用。进入后可收藏地址栏里的普通链接，在本次服务和同一浏览器中重开。更换浏览器或重启服务后，请从启动终端重新进入。从左栏选一篇讲解，或从顶栏「闭环阅读」打开已保存的闭环。即使断网，页面、字体和已有讲解也由本机提供，源码从原项目的 Git 提交读取。

端口占用时可在启动命令后加 `--port 4318` 或指定另一个空闲端口。在启动终端按 Ctrl+C，看到 `status=stopped` 即已关闭。下次执行同一条启动命令，便可继续读同一项目。

进一步操作见[阅读器使用说明](docs/usage/file-reader.md)和[生成讲解与闭环](docs/usage/generation-skill.md)。

## 构建本地包

维护者在干净的仓库检出中使用 Node.js 24 和唯一的锁文件。把包输出到独立目录，供读者安装。

```powershell
npm ci
npm run typecheck
$packageDir = Join-Path ([System.IO.Path]::GetTempPath()) 'aftertaste-pack'
New-Item -ItemType Directory -Path $packageDir -Force | Out-Null
npm pack --pack-destination "$packageDir"
```

`npm pack` 会先编译命令工具并构建页面。读者运行已经打包的成果，只需 Node.js、npm 和 Git。仓库中的包保持私有配置。

## 开发与沿革

- [协作入口](AGENTS.md) · [现行规格](specs/001-first-release/08-current-spec-and-acceptance.md) · [项目待办](docs/product/backlog.md)
- [Git 固定提交](specs/002-fixed-source/quickstart.md) · [讲解文档](specs/003-document-blocks/quickstart.md) · [文件依赖图](specs/004-dependency-graph/quickstart.md)
- [开发规范交接](docs/work/2026/11/D002-directory-layout/handoff.md) · [Spec Kit 接入](docs/development/spec-kit.md) · [实验](experiments/README.md)

2026-11-16 的设计交接、仓库初始化和早期 AR1 原话索引保存在本仓库历史中，可用 `git show 8bd5e7b:README.md` 查阅。现行产品行为以当前规格和后续确认的任务为准。

## 开源许可

回味自有的代码、产品 Skill、文档、设计和开发记录采用 MIT，允许使用、修改、再分发和商用。分发时请保留版权与许可声明。[MIT 许可证](LICENSE)

第三方开发技能、Spec Kit、字体及网页依赖各有原作者与许可。安装包内的 `dist/web/third-party-licenses.md` 收录网页构建所用依赖，另附 Vue Flow 已内嵌依赖的声明。[开发技能来源](.agents/README.md) · [Spec Kit 许可证](.specify/LICENSE-SpecKit.txt) · [补充第三方声明](THIRD-PARTY-NOTICES.md)
