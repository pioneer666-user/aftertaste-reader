# Quickstart · D011

需要 Node 24、Git 2.45+ 及已安装的根 npm 依赖。正式源码构建后由一个服务提供页面，无需另起 Vite。

在产品根执行 npm run typecheck、npm run build，再执行 node dist/cli/main.js serve --project <目标项目绝对路径>。默认地址 http://127.0.0.1:4317，端口占用可指定 --port。终端 Ctrl+C 关闭，看到 stopped 后可重启。

D010 合成样例使用 tests/fixtures/reader-project.mjs 重建到全新隔离目录，复制 D010 两篇原件并核固定提交。实际作者入口、可复制命令与资源归属见 [D011 handoff](../../docs/work/2026/11/D011-file-reader/handoff.md)。

## 可复核场景

1. 从产品根以外 cwd 启动，选择 rules 和 service，核文档路径、提交、行号和 Markdown 示例。
2. 修改样例工作区及 HEAD，刷新仍取头部提交。改讲解再刷新，显示新正文和对应检查。
3. 切换英文并刷新，保留已保存语言。屏蔽 localStorage 后仍可切换，明确保存失败。
4. 结构错误及范围遗漏按普通 Markdown 展示并可复制无源码诊断。移走样例 Git 后仍能列出并阅读讲解。不可读文件显示读取错误。
5. 测试路径、Host/Origin、恶意 Markdown，核接口 no-store、CSP 和目标目录前后字节。
6. 停服务再启动，重开仍可读。自动化依次使用 npm test 与 npm run test:browser，浏览器串行。

样例是合成教学资料，真实项目教学与作者体验状态由 handoff 单独记录。
