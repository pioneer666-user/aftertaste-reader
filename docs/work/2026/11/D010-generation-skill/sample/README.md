# D010 作者试读

这是独立模拟使用代理从产品 Skill 实际生成的**合成项目首批讲解**。它用于观察工具链与初版教法，真实项目教学效果仍待作者指定项目并试读。

## 阅读顺序

1. [数量规则](current/src/rules.mjs.md) 解释输入转换、数量约束及调用者依赖的契约。
2. [创建服务](current/src/service.mjs.md) 衔接职责拆分、编号条件、集合更新顺序与辅助调用。

模拟使用者说明“我会写简单接口，想看职责和取舍”，代理据此生成。可查看本批 [偏好](preferences.md)、[阅读方向](reading-direction.md) 和 [依赖图](dependency-graph.json)。下一批安排是接口入口，此首批保留两篇完整讲解。

## 固定源码定位

提交为 `5394d8f86c961ce1b327674235525f57bf0b982c`，来源是已提交 [合成项目生成器](../../../../../../tests/fixtures/generation-project.mjs)。当前可读取项目在回味开发仓库的 `.local/D010/batch/`，该目录可重建。

| 讲解 | 源码路径 | 固定行范围 | 块 ID |
| --- | --- | --- | --- |
| 数量规则 | `src/rules.mjs` | 1—7 | `x4y6az2y` |
| 服务依赖 | `src/service.mjs` | 1—3 | `zhidif44` |
| 校验与对象 | `src/service.mjs` | 4—6 | `m3vuiqzi` |
| 状态变化与返回 | `src/service.mjs` | 7—10 | `cj9208pf` |

工作区的 rules 文件特意与提交不同。对照源码请让 AI 读取 [Skill 入口](../../../../../../skills/aftertaste-reader/SKILL.md)，使用上述提交、项目和文件路径的 read 工具返回内容。讲解与本目录只保存引用。

## 实际校验

执行者已对首批真实产物复核。两篇均 `mechanicallyValid=true`、`sourceCheck=completed`、`contentStatus=provided`，源码行数分别为 7、10，无诊断或超大警告，教学质量字段均为 `unchecked`。图校验有效，rules／service 为 reviewed，范围外 audit 为 unreviewed，未生成其讲解。未提交的工作区新增文件也未生成讲解。

在回味仓库根使用 Node 24，已有构建后可重新创建独立合成项目并校验本目录原件。命令只在 `.local/D010/` 新建本次核验沙盒。

```powershell
node --test tests/skills/generation-sample.test.mjs
```

## 试读关注点

- 职责与取舍是否解释清楚，能否联系自己会写的简单接口。
- 例子是否便于从输入跟到结果，前后联系是否帮助阅读。
- 哪一块需要增减说明，可附文档路径和块 ID。

当前作者尚未试读验收。完整行为输入、真实命令与未验证范围见 [evidence.md](../evidence.md)。
