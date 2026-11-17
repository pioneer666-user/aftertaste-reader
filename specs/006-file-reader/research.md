# Phase 0 研究

2026-11-17 按 speckit-plan 调用只读研究代理，核现有工程与官方 npm registry，研究输入为 D011 @38b173f。无待澄清技术项。

## 依赖与构建

**Decision** 固定 plan 中兼容版本，沿用 TS 和 Node 类型；markdown-it 15 自带类型，界面两语言采用类型化字典。Playwright 仅开发验证，字体本地随构建提供。

**Rationale** Fastify 提供生命周期与请求边界，Vue/Vite 沿已定技术，既有 mdast 继续解析专用块，markdown-it 专管浏览器正文。单包构建页面。

**Alternatives considered** 现有 mdast 不直接提供 DOM 渲染，手写 Markdown 代价高。固定少量文案使用字典足够。预编译 Vue 可用严格 CSP。

官方核查 [Fastify LTS](https://fastify.dev/docs/latest/Reference/LTS/)、[Vite](https://vite.dev/guide/)、[Vue TypeScript](https://vuejs.org/guide/typescript/overview)。精确版本、engines、peerDependencies 经 npm view 逐包实读。查询环境沿用了已有 NODE_TLS_REJECT_UNAUTHORIZED=0，未改变系统设置。

## 安全与只读

**Decision** 明确路由白名单，回环监听，精确 Host 与 Origin，Fetch Metadata 辅助检查，全部 no-store，无访问日志。动态资源只从文档读取链获得。Markdown html:false，图片呈现替代文本，受限协议链接与安全 rel，CSP 禁外部资源和内联脚本。

**Rationale** 请求无需任意磁盘接口，静态资源只来自产品构建。源码只在内存，Git 不可用时独立返回已有讲解。原始文本插值显示源码和诊断。

**Alternatives considered** 通用静态项目目录、CLI 子进程、关闭所有失败阅读均不满足当前调用边界和降级要求。

官方依据 [Fastify Server](https://fastify.dev/docs/latest/Reference/Server/)、[Hooks](https://fastify.dev/docs/latest/Reference/Hooks/)、[markdown-it safety](https://github.com/markdown-it/markdown-it/blob/master/docs/safety.md)、[RFC 9111](https://www.rfc-editor.org/rfc/rfc9111.html#section-5.2.2.5)、[CSP3](https://www.w3.org/TR/CSP3/)、[Fetch Metadata](https://www.w3.org/TR/fetch-metadata/)。

## 验证

**Decision** Node test 串行覆盖共用用例与 HTTP，Playwright 依次启动 Edge/Chrome/Firefox。样例重建复制 D010 原件，截图及磁盘变更仅用合成项目。

**Rationale** 真实组件、浏览器存储、异步切换和脚本边界需要实际浏览器操作。浏览器版本及缺环境据实记录。

**Alternatives considered** 组件静态快照不足以证明连续操作，作者体验单独待验。

官方依据 [Playwright browsers](https://playwright.dev/docs/browsers)。
