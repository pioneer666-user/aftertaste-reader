# 005 验证入口

## 前置

Node 24、Git 2.45+。首用路径按[首次安装](../../README.md#首次安装)将真实 `.tgz` 安装到独立工具目录，从 npm 安装所得的绝对路径显式加载入口。按[使用说明](../../docs/usage/generation-skill.md)提交目标项目和阅读请求。工具可在目标项目以外的 cwd 调用。

按 [D045 实验](../../experiments/D045-alpha-first-run/README.md)准备无讲解的固定 Git 输入，检查首次生成的非空讲解和源码对照，再从已有块选择、生成及重读闭环。源码、工具安装和生成资料分别核对位置。

## 可重跑场景

以下开发回归从回味仓库根执行，先按锁文件安装依赖，每次只运行一个检查。

```powershell
npm run build
```

```powershell
node --test tests/skills/generation-static.test.mjs
```

```powershell
node --test tests/skills/generation-sample.test.mjs
```

```powershell
node tests/fixtures/generation-project.mjs .local/D010/try-reading
```

fixture 输出绝对目标路径和固定提交，产物为合成项目。将这些实际值连同 Skill 入口和阅读请求交给使用代理，按 [行为用例](../../tests/skills/generation.md) 串行运行。源码只在工具返回中消费。

检查范围／节奏缺失时没有资料写入，明确选择后分别验证逐批与连续节奏、固定来源、范围外依赖、资料保护、失败报告和偏好维护。执行者核命令结果、非空正文、完整覆盖、图状态及方向语义。

首次讲法、项目间隔离与跨会话复用，按 [D050 行为用例](../../tests/skills/generation.md#项目讲法)用隔离安装包走真实对话，选择前后核资料字节。

## 结果与试读

[D010 证据](../../docs/work/2026/11/D010-generation-skill/evidence.md) 保存环境、候选、实际输入／动作／输出和可复建说明。[作者试读入口](../../docs/work/2026/11/D010-generation-skill/sample/README.md) 链接正式保存的讲解和固定源码定位。教学效果由作者试读判断。
