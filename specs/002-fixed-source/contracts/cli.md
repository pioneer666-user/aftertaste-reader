# 固定取源调用约定

## 共用用例

唯一业务入口为 `src/application/fixed-source.ts` 的 `FixedSourceService`。构造时传 `SourceRepository` 端口，真实实现为 `src/adapters/git-source.ts` 的 `GitSourceRepository`。

- `pin(projectRoot, revision?)` 返回 `Promise<FixedSource>`。省略 revision 取当时 HEAD，显式版本接受本地 Git revision，空值和以 `-` 开头的值拒绝。
- `read(fixed, path)` 返回 `Promise<SourceFile>`。完整 commit 必填，逐次复用同一 fixed。失败抛 `SourceError`。

模型见 [data-model.md](../data-model.md)。绝对 projectRoot 必填，避免 cwd 改变含义。file path 用 `/`，支持中文、空格、方括号、`*` 和前导 `-` 等字面字符，在操作系统可建立这些名称的前提下可读。禁止空段、`.`、`..`、绝对路径、反斜杠、冒号、控制字符和 `.git` 段。暂不支持 bare、linked worktree、子模块目标和含链接/junction 的项目根。提交树中的普通文件即使工作区已删除或变为链接仍可读，树中的链接和 gitlink 拒绝。

## CLI

运行环境为 Node.js 24 LTS 与本地 Git 2.45+。旧 Git 不支持禁止自动取源选项时返回 GIT_READ_FAILED。

```text
node dist/cli/main.js pin --project <absolute-path> [--revision <local-revision>]
node dist/cli/main.js read --project <absolute-path> --commit <full-id> --path <project-relative-path>
```

`read` 用明确 project 与 commit 重建并核验固定引用，调用同一 service.read，用例不会再解析 HEAD。选项值与名称作为独立 argv，接受以 `-` 开头的路径值。重复、未知、多余及缺少选项失败。每个 Git 子进程最多等待 30 秒，超时或单次输出超过 64 MiB 返回 GIT_READ_FAILED。

成功退出 0，stdout 一行 JSON，pin 为 `{ok:true,source:FixedSource}`，read 为 `{ok:true,file:SourceFile}`，stderr 为空。content 中 JSON 转义仅为传输，解析后逐字节还原原文。输出可能包含源码，应由调用 AI 在内存中消费。

失败 stdout 为空，stderr 一行 JSON `{ok:false,error:{code,message,nextStep,context}}`。参数类退出 2，其余已知操作错误退出 1，未预期异常退出 1 并返回 `INTERNAL_ERROR`，不直接打印异常正文。

## 稳定问题标识

| code | 含义与下一步 |
| --- | --- |
| INVALID_ARGUMENT | 检查命令选项、绝对项目路径、版本或固定引用字段 |
| INVALID_PATH | 使用项目内规范相对路径 |
| PROJECT_UNAVAILABLE | 确认项目目录存在且可访问 |
| UNSUPPORTED_TARGET | 使用普通本地仓库及无链接的项目目录 |
| NOT_REPOSITORY | 指向本地非 bare Git 仓库内的项目 |
| GIT_UNAVAILABLE | 安装 Git 或修正 PATH |
| NO_COMMIT | 项目尚无 HEAD 提交，先由用户准备提交 |
| INVALID_REVISION | 选择本地有效提交引用 |
| OBJECT_UNAVAILABLE | 确认引用对象本地可读，工具不自动获取 |
| FILE_NOT_FOUND | 核对该提交内的项目相对路径 |
| UNSUPPORTED_FILE_TYPE | 选择普通文件，链接/子模块/目录不支持 |
| UNSUPPORTED_ENCODING | 使用严格 UTF-8，排除二进制控制字节 |
| GIT_READ_FAILED | 核对权限/对象可读性及 context 的阶段、状态，含 64 MiB 输出限制 |
| INTERNAL_ERROR | 保留定位，交给维护者检查 |

定位 context 包含已知的 projectRoot、repositoryRoot、commit、path、repositoryPath，以及可选 operation/status/reason。中文 message 和 nextStep 可演进，程序判断使用 code。
