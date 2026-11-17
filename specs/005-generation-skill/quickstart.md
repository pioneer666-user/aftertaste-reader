# 005 验证入口

## 前置

Node 24、Git 2.45+、当前开发树已安装锁定依赖并构建。按 [使用说明](../../docs/usage/generation-skill.md) 显式加载入口，工具可在目标项目以外的 cwd 调用。

## 可重跑场景

从回味仓库根依次执行，每次只运行一个检查。

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

## 结果与试读

[D010 证据](../../docs/work/2026/11/D010-generation-skill/evidence.md) 保存环境、候选、实际输入／动作／输出和可复建说明。[作者试读入口](../../docs/work/2026/11/D010-generation-skill/sample/README.md) 链接正式保存的讲解和固定源码定位。教学效果由作者试读判断。
