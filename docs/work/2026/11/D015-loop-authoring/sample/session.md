# 订单闭环试讲

这是执行会话用产品 Skill 和真实 CLI 走完的一次合成订单试讲。以下读者来回应来自受控演练。可直接打开[保存后读回的讲解](order-quantity.md)。

## 选定前

读者的问题是“想串起来看看数量校验怎样决定集合会不会改变”。按 [Skill](../../../../../../skills/aftertaste-reader/SKILL.md) 读现有偏好及方向，沿用“想看职责和取舍”。目标项目使用 [D010 两篇讲解](../../D010-generation-skill/sample/README.md) 及订单固定样例。执行用 `pin --revision` 选原讲解头记录的提交 `5394d8f86c961ce1b327674235525f57bf0b982c`。由 `query-graph`、`validate-document` 和固定 `read` 核到两篇有效讲解及真实首尾。

给读者的候选为“从 `createOrder` 收到输入开始，跟着数量进入规则。合法时回到服务，看订单怎样加入集合并返回。非法时看异常在哪一步让创建停下。读完能判断调用后集合会不会变化。”

另核到接口 `src/api.mjs` 已登记为未核对节点，尚无逐块讲解。要从 HTTP 入口走到响应会在接口转换处缺材料。候选路线从服务开始，追到服务的返回或异常即可完整回答这次问题。阶段结束时磁盘无 `loops`，没有创建接口文档。

## 读者选定后

演练答复为“就讲数量校验怎样决定集合会不会改变”。执行以 [订单输入](../../../../../../tests/fixtures/loop-order.json) 为本次串讲，通过 `create-loop` 保存 `order-quantity`。新进程用 `read-loop` 读回五个节点和四条连线，所有参与块按原引用取源。Markdown 由 `read-loop --format markdown` 生成，无源码副本。保存前后，原依赖图、两篇讲解、偏好和阅读方向逐字节一致。

这条订单路线没有用库图例。另用实际用到 `node:path` 的合成文件验证选用的图例用法随闭环冻结，见 [集成用例](../../../../../../tests/integration/loops.test.mjs)。

[Quickstart](../../../../../../specs/008-loop-authoring/quickstart.md) 可重建固定项目和 Markdown。执行的阶段摘要保存在 `.local/D015/skill-trial-f1ad955f/` 的 `selection-check.json` 和 `creation-check.json`。
