# D059 · alpha.2 本地候选回执

## 当前结论与入口

- **[回味 v0.1.0-alpha.2 已公开预发行](https://github.com/pioneer666-user/aftertaste-reader/releases/tag/v0.1.0-alpha.2)。** 2026-11-26 作者确认「确认公开发布 alpha.2」。通过作者本机 Clash 将已验版本同步至 GitHub 的 `main` 和 `dev`，核实标签指向 `7ded4a277f322fe2e44978cb7e1e2f574205b8ee`。北京时间 15:40 公开后，已匿名打开预发行页，下载两个附件并与本地定稿逐字节核对。公开校验文件所列 SHA-256 与实收安装包相符。
- 最终产品候选 `992b8613fb208fa66745223ae9c2d635148d8601`，对照 `dev@88bfe50` 与批准任务 `d017c1d`。定稿包已联网干净安装并走通阅读，122 项单元和集成回归通过，R2 独审通过。
- [安装包](../../../../../.local/D059/rc2/aftertaste-reader-0.1.0-alpha.2.tgz) · [SHA256SUMS.txt](../../../../../.local/D059/rc2/SHA256SUMS.txt) · [README 本地预览](../../../../../.local/D059/rc2/README-preview.html) · [README 原文](../../../../../README.md) · [闭环首图](../../../../../docs/usage/assets/alpha2-bookmark-loop.png) · [源码对照图](../../../../../docs/usage/assets/alpha2-bookmark-source.png)
- SHA-256 `8244c2ce281c95bae869df564ad9a6459c94b7d8bc35040227522d4141af4b6b`，2,296,085 字节。安装后逐文件核对 305 个归档成员，全部与包一致。早期 PowerShell 输出的 CRLF 使 Git 的 `sha256sum -c` 误把行末字符当成文件名，最终校验文件用 ASCII 和 LF，实际执行校验返回 OK。[校验日志](../../../../../.local/D059/rc2/checksum-verification.log)
- 2026-11-26，作者在当前会话回复「合并到dev」，授权本地整合。README 两张图在正文宽度下的观感、分岔讲解和画布排布仍可试读。愿意亲自排布时，可拖动试读画布中的卡片和图例、调整视野，待界面显示布局已保存后把结果交回重拍。
- 本地合并提交 `de661418508645bc9b9ef312eab86220e741e7ef`，两个父提交为 `88bfe50` 和 `fd5df41`。合并树与任务分支尖端一致，沿用候选的自测和独审。确认任务提交均已进入 `dev` 后，以 `git branch -d` 删除本地 `codex/release-alpha-2`。

## 依据与验证

- [批准任务](task.md)以 `d017c1d` 为准，沿用[现行规格](../../../../../specs/001-first-release/08-current-spec-and-acceptance.md#release-order)和 [B002](../../../../product/backlog.md#b002--根-readme-整理为项目介绍)。未修改产品规格、实现或 Skill 内容。GitHub 的 [Mermaid 首页](https://github.com/mermaid-js/mermaid#readme)参考开头的用途和入口，[Difftastic 示例](https://github.com/Wilfred/difftastic#examples)参考截图旁指出可观察的差异。下载入口指向[已有发行列表](https://github.com/pioneer666-user/aftertaste-reader/releases)。
- Windows 11 26200、Git 2.50.1.windows.1、Node.js 24.11.1、npm 11.6.4。用批准树和候选文件组成隔离检出，`npm ci` 按提交锁安装，`npm run typecheck` 和 `npm pack --pack-destination <D059 输出目录> --json` 通过。后者跑了 `tsc` 和 Vite 预构建，包带 CLI、241 个网页资源、产品 Skill、MIT 许可、网页与 Apache Answer 的声明。目录白名单和安装后的文件逐项匹配。成品 README 及四个演示资产都在包中，包未包含测试项目、运行记录、私密入口或开发依赖。按 R1 建议补上自动打开的备用入口后重新构建，最终包 305 个成员与首轮独审包逐项比较，只有 README 字节改变。[类型检查](../../../../../.local/D059/rc1/final-typecheck.log) · [最终打包日志](../../../../../.local/D059/rc2/final-pack.json) · [包清单与核对](../../../../../.local/D059/rc2/package-inspection.json)
- 在空工具目录、空 npm 缓存，用 Node.js 24.22.3 和 npm 11.6.4 按 README 执行 `npm install --prefix "$tools" --omit=dev "$package"`，联网解析，安装 83 个包，含回味自身及 82 个运行依赖实例。最终安装的依赖版本和位置与 R1 相同。直接依赖 Fastify 5.12.8、mdast-util-from-markdown 2.1.0 与仓库锁一致。实际运行树有五处间接依赖的新解析。

  | 依赖 | 仓库锁 | 读者安装 |
  | --- | --- | --- |
  | `@fastify/ajv-compiler` | 4.0.7 | 4.0.8 |
  | `@fastify/error` | 4.2.1 | 4.3.0 |
  | `fast-json-stringify` | 7.3.6 | 7.3.10 |
  | `fast-uri` | 4.2.3 | 4.2.4 |
  | `find-my-way` | 9.10.1 | 9.10.2 |

  [联网安装](../../../../../.local/D059/rc2/final-install.log) · [实际树](../../../../../.local/D059/rc2/actual-npm-ls.json) · [仓库锁对照](../../../../../.local/D059/rc2/package-inspection.json)

- 2026-11-26 用 npm Registry 公告数据做 `npm audit --omit=dev --json` 和仓库锁的 `npm audit --json`，两项均 0。Fastify 的流式超时公告修复线为 5.12.8，fast-uri 对 4.x 的相关主机解析公告修复线为 4.2.3，构建锁与读者实装均达修复线。网页随包交付 Vue 3.5.45、Vue Flow 1.48.2、Markdown-it 15.0.3、Shiki 4.6.0、TextMate 语法 1.32.22、Oniguruma WASM 1.7.0、CodeMirror 及 Inter 字体，按构建许可证清单、补充归属和完整锁核对。Vite 8.3.8、Playwright 1.65.1 和编译工具用于开发与构建，运行安装不含这些工具。公告结论绑定日期、本包和实装版本。Node.js 由读者提供，复验使用当日的 24 LTS 安全更新 24.22.3。[运行审计](../../../../../.local/D059/rc2/runtime-audit.json) · [构建锁审计](../../../../../.local/D059/rc1/build-audit.json) · [Fastify 公告](https://github.com/fastify/fastify/security/advisories/GHSA-3qgw-9275-xf8w) · [fast-uri 公告](https://github.com/fastify/fast-uri/security/advisories/GHSA-wjr9-j795-jxcr) · [Vite 公告](https://github.com/vitejs/vite/security/advisories) · [Markdown-it 发布记录](https://github.com/markdown-it/markdown-it/blob/master/CHANGELOG.md) · [Node.js 安全更新](https://nodejs.org/en/blog/release/v24.22.3)
- Vue Flow 内嵌的 VueUse 10.5.0 和 D3 各模块按其上游 v1.48.2 构建锁检查。该版本组与本仓安装的依赖版本不同，用 npm Bulk Advisory API 另查实装内嵌的 11 个包名与版本，返回空结果。内嵌 d3-color 3.1.0 已达已知公告的修复线。[Vue Flow 上游构建锁](https://github.com/bcakmakoglu/vue-flow/blob/v1.48.2/pnpm-lock.yaml) · [D3 公告](https://github.com/advisories/GHSA-36jr-mh4h-2g58) · [实际公告请求及结果](../../../../../.local/D059/rc1/vue-flow-vendored-audit.json)
- R1 固定候选使用 Node.js 24.11.1 串行执行 `npm test`，即 `node --test --test-concurrency=1 tests/unit/*.test.mjs tests/integration/*.test.mjs`。122/122 通过，失败、取消和跳过均为 0，耗时 905 秒。定稿包的程序、Skill、构建锁和实际运行依赖版本全部一致，沿用此次回归。Node 24.11.1 的 SQLite 实验性提示随日志保留。[全量回归原日志](../../../../../.local/D059/rc1/full-regression.log)
- 从最终安装目录显式读取随包 Skill 和参考，用 Codex 桌面当前会话在新检出的 Apache Answer 中模拟读者。试读者选择第 2 档和逐批阅读，再走 Git 可见性检查。讲解阶段列出三篇文档、依赖图、偏好、阅读方向及暂存路径，闭环阶段单独列出成品和暂存路径。两次检查先退出且资料写入为零，再由相应的模拟读者选择仅本机忽略，工具重查全部为 `ignored` 后生成。三篇讲解经 `validate-document` 机械校验、固定源码和非空正文检查，依赖图经 `validate-graph`，闭环 `bookmark-twice` 经 `read-loop`，全部源码可用。作者未参与此次模拟选择，另一个全新 Codex 会话的独立提示跟随未纳入。[首次可见性](../../../../../.local/D059/rc2/final-skill-check.json) · [讲解产物](../../../../../.local/D059/rc2/final-skill-generate.json) · [闭环可见性](../../../../../.local/D059/rc2/final-skill-check-loop.json) · [闭环读回](../../../../../.local/D059/rc2/final-skill-loop.json)
- 在 Windows 的 Codex 桌面终端用安装包 CLI 打开闭环 `bookmark-twice/decide`。R1 首次系统打开返回 `browser:failed`，其中完整备用入口在 Edge 可用，R1 复跑和定稿包均返回 `browser:requested`。目标文件工作区临时换了返回值，Edge 仍展示固定提交中的原值，结束恢复隔离源文件。Edge 158.0.4370.33 顶栏实际复制私密入口，Chrome 158.0.8127.38 从无授权普通地址得到 403，粘贴后到相同步骤且地址栏去除令牌。Edge 保存笔记得到 HTTP 200，Chrome 在停机重开后用新入口读回相同笔记。同端口重启后旧入口返回 403。Edge 阻断回环外请求仍能读图、讲解和源码。4370／4371 测试端口按项目停止。个人默认浏览器标签未单独采集，Firefox、其他操作系统和其他 AI 宿主本轮未重跑。[首轮回退记录](../../../../../.local/D059/rc1/final-browser-attempt-1.json) · [定稿试读记录](../../../../../.local/D059/rc2/final-browser.json)
- 截图用 Apache Answer v1.5.0，标签解析到 `3f1ed50f6776452c11b6ffdbdc767cd1887d629b`。同一用户、同一问题的第一次成功后，重复请求仍查关系，服务在第 61–63 行提前返回，跳过关系插入和计数更新。首图默认显示五步，Xorm 直接连到查关系，问句展开事务复查一步。判断卡说明展开，查询卡的实机悬停在卡上方。源码图是同一个判断在逐文件讲解中的实际对照。上游 LICENSE 与 NOTICE 的 Git 对象同固定提交一致，两张 PNG 仅 IHDR、IDAT、IEND，画面没有凭据、私密地址、个人记录或本机身份。[固定版本](https://github.com/apache/answer/commit/3f1ed50f6776452c11b6ffdbdc767cd1887d629b) · [源码分岔](https://github.com/apache/answer/blob/3f1ed50f6776452c11b6ffdbdc767cd1887d629b/internal/service/collection/collection_service.go#L57-L63) · [图片和元数据核对](../../../../../.local/D059/rc2/package-inspection.json)
- 截图采集早期留存了四次工具脚本问题。错误给 `stop-reader` 传端口，改按项目停机后成功。源文件栏宽度不足，调整桌面视口并收起导航后首行可完整显示。切到闭环需重新载入入口，补完整导航后读到目标。Xorm 文本同时命中边和卡片，限定实际图例卡后取景成功。第一次试读的笔记已保存，读回探针错误地在只读笔记页寻找编辑器而超时，补实际「编辑」操作后复验成功。README 本地渲染检查了相对链接、图片和标题定位，用 Edge 在约 818 像素正文宽度下读两张图。探针先观察到宽度被渲染为 817.97／817.98，保留原观察并按正文宽度容差核验。当前观感仍由作者试读决定。[README 预览检查](../../../../../.local/D059/rc2/README-preview-check.json) · [预览实机截图](../../../../../.local/D059/rc2/README-preview-screen.png) · [早期运行原件](../../../../../.local/D059/rc1/)
- R1 在 `dced5be3c6c3164adfa70f9278e2784b1b321d75` 上通过，建议在启动说明旁给出自动打开失败的恢复方法。定稿补文、重打包、空目录联网安装和重走试读后，R2 在 `992b8613fb208fa66745223ae9c2d635148d8601` 上复核通过。两轮审查均已交还写入。[独审原文](review.md)

## 试读画布

使用最终包安装在 [Aftertaste Reader](../../../../../.local/D059/rc2/Aftertaste%20Reader/)，作者摆放用的 [隔离 Apache Answer 项目](../../../../../.local/D059/rc2/Final%20Apache%20Answer/) 含三篇讲解、一条闭环及 [个人布局](../../../../../.local/D059/rc2/Final%20Apache%20Answer/docs/aftertaste/loops/bookmark-twice/layout.json)。试读记录及可重跑工具保存在 [D059 本地目录](../../../../../.local/D059/rc2/)，不随 Git 克隆。D045／D046／D058 的项目和原有阅读实例由原任务归属保留。

作者专用服务已就绪，只监听 `127.0.0.1:4372`，交付时 PID 27732。由定稿安装包请求默认浏览器打开「要写入吗？」。服务已实查可读该闭环，未在日志保存私密入口。合入 `dev` 后复查仍由同一安装和项目提供服务，闭环与布局可读。保留到作者看过或重排完成。[脱敏状态](../../../../../.local/D059/rc2/author-canvas.json)

在回味仓库根的 PowerShell 运行下列命令。脚本会打开默认浏览器的「要写入吗？」步骤。收起右侧讲解后，可拖动卡片、图例和视野。

```powershell
& ./.local/D059/rc2/open-canvas.ps1
```

试读后可在仓库根执行同一脚本加 `-Stop` 停止这一个项目的服务，已保存布局下次可恢复。若桌面宿主没有把浏览器带到前台，可用同包命令的 `--mode link` 取得本次私密入口，复制到地址栏。入口仅供本机当次会话。

## GitHub 预发行说明草案

### 回味 v0.1.0-alpha.2

- 闭环更容易顺着读。图会沿关系分层重排，连线可标出分支条件，节点下可读关键说明，也可悬停在节点上先看一小段讲解。用问句按需展开细节，用示例路线对照同一判断的不同结果。
- 文件源码对照新增本地语法高亮。每个项目可以从三种讲法中选择适合自己的层次，逐文件讲解和闭环共用选择。
- 可以请读取回味 Skill 的 AI 打开新讲解或闭环起读处。阅读器顶栏可复制本次私密入口到本机另一浏览器。首次写讲解前，会确认这些资料在 Git 中的可见性。
- Windows PowerShell 安装步骤见 [README](../../../../../README.md#首次安装)。需要当前的 Node.js 24 LTS、npm、Git 2.45+ 和可读本机项目的 AI。已有讲解仍需能读取对应的 Git 提交。跨提交更新和单文件 HTML 导出安排在后续。部分聊天宿主限制自动打开或点击本机链接，可使用终端启动并将私密入口复制到浏览器地址栏。

附件使用 `aftertaste-reader-0.1.0-alpha.2.tgz` 和 `SHA256SUMS.txt`。采用 GitHub 的预发行标记。
