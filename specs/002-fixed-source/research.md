# 固定提交取源研究

## 环境与依赖

选择 Node.js 24 LTS 与 TypeScript 5.9.3、@types/node 24.10.1。Node 24 为既定方向，TS 版本支持 strict/NodeNext，类型依赖匹配目标主版本。npm registry 已核精确版本及 TS 的 Node >=14.17 要求。运行时使用内置 child_process、fs、path、util，测试使用内置 test/assert，足以处理本批。现有宿主 Node 为 22.23.2，另以任务级 Node 24 验证，禁止升级全局环境。

## Git 对象依据

选择 `rev-parse --verify --end-of-options <revision>^{commit}` 固定版本，读取只接受完整十六进制提交 ID。以 `cat-file -t` 检查对象、`ls-tree -z` 逐段查类型、最终 `cat-file blob <oid>` 读内容。逐段检查能定位中间符号链接和 gitlink。原始对象读取避开过滤器和工作区转换。`--literal-pathspecs` 与参数数组处理路径。

Git 子进程清除继承的 GIT_*，设置禁 lazy fetch、replace、optional locks、terminal prompt 及关闭 fsmonitor。使用 Git 2.45+ 的全局 `--no-lazy-fetch`，旧 Git 无法识别时直接失败，避免旧版忽略环境变量而自动获取对象。失败仅返回本工具构造的中文诊断与阶段/退出码，原始 Git stderr 丢弃以免泄露源码或配置内容。

[Git rev-parse 官方文档](https://git-scm.com/docs/git-rev-parse)、[Git ls-tree 官方文档](https://git-scm.com/docs/git-ls-tree)、[Git cat-file 官方文档](https://git-scm.com/docs/git-cat-file)、[Git 环境变量](https://git-scm.com/docs/git)

## 路径与只读边界

选择必填完整绝对项目路径（Windows 含盘符或 UNC 根），文件使用项目相对的 `/` 分隔规范路径，拒绝空段、点段、反斜杠、冒号、控制字符和 `.git` 段。逐级 lstat 项目目录祖先拒绝链接/junction。普通 `.git` 目录仓库及其普通子目录可用，`.git` 文件所表示的 linked worktree/子模块暂不支持并明确诊断。读取文件只沿 Git 树，不访问当前工作区源码路径，所以工作区删除或链接替换不影响结果。

选择每次 read 重新核映射，校验固定引用的所有字段并对比。完整 commit 校验后只查该对象，允许引用序列化传递，拒绝把 HEAD 放进 read。全局环境配置和路径均不由用户以额外 CLI 开关传入。

## 文本保真

选择 `TextDecoder('utf-8', { fatal: true, ignoreBOM: true })` 保留 BOM 并拒绝非法 UTF-8，拒绝 NUL 及除 TAB/LF/CR 外的 C0 控制字节和 DEL，作为本批二进制判断边界。空文件可读，合法文本中的 U+FFFD 原样保留。文本不 trim、不换行转换。合法 UTF-8 且符合控制字符规则的字节流按文本处理，文件扩展名不决定类型。

[Node TextDecoder 官方文档](https://nodejs.org/docs/latest-v24.x/api/util.html#class-utiltextdecoder)
