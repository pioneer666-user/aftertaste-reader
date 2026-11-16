# D004 · 独立审查记录

2026-11-16，执行调用未参与实现的子代理 `/root/d004_review`，按审查角色与 Ponytail Review 进行只读独审。以下保留审查者原文。

## 首次审查

# D004 独立审查原文

## 候选与范围

- 批准任务为 `docs/work/D004-canvas-persistence/task.md@1fb8488`，审查候选为 `36b3450b509bda5f66491af22b3f6c08921db3a4`。
- 按审查角色和 Ponytail Review 检查实验源码、调用链、测试、README 及版本化证据。负载假设为单人、单服务、小型合成图。
- 审查期间只读，工作区保持干净。

## 应修复

### 1. 合法的新节点标识可能被误认成已有坐标

位置为 [model.ts 第108行](<D:/project/SpecDev Harness/aftertaste-reader/experiments/D004-canvas-persistence/src/model.ts:108>)。

- **场景与问题**
  向完整有效图加入 `id="constructor"` 的节点，`validateGraph` 接受该输入。`reconcileGraph` 使用 `state.positions[node.id]` 判断旧位置，读取到了普通对象原型上的 `constructor` 函数。
- **实际结果**
  独立纯内存复现得到 `typeof next.positions.constructor === "function"`，随后 `validateState(next)` 报“需要对象”。模型接受的完整图输入因此生成无效布局。
- **建议修复**
  使用 `Object.hasOwn(state.positions, node.id)` 判断存续坐标，补一项新增 `constructor` 节点的回归检查，同时断言旧节点坐标保持。
- **影响范围**
  当前固定 UI 的新增 e 路径已有通过证据。该发现涉及共用模型接受的合法节点标识及其增量布局处理。

## 已核实内容

- 保存链路先写临时文件、同步、关闭、替换，再返回成功。页面保存队列等待服务确认，并保留失败后的当前操作。
- 显式成员决定组移动范围。记录中 a、b 同位移，框内非成员 c 保持原坐标，成员变化后的背景与实际 DOM 一致。
- Edge 证据覆盖三次关闭页面、浏览器与服务后恢复，恢复前后修订号和布局一致。服务日志对应四个不同进程。
- 图文案与边更新、添加 e、删除成员及空组清理有实际操作证据。重排保留组名和成员，实现成本符合本单判断目标。
- Chrome 拖动与恢复兼容证据完整。README 明确记录单组 UI、固定尺寸、单服务和正式协议待设计等边界。

## 验证与结论

- 独立运行 `npm run check` 通过。
- 独立核对 10 个取证源文件哈希，全部与候选一致。批准 task 与 specs 保持原版本。
- 复用已绑定源码的 Edge、Chrome、失败恢复证据及执行者自测结果。
- **结论为需修复第 1 项。** 修复后适合定向复核模型分支与回归结果。

Firefox、干净机器重装、多服务同目录写入、断电恢复和大图性能仍待验证。作者体验待验。

## 修复后复核

# D004 定向复核原文

## 候选与范围

复核候选为 `75441a894bc662a03c1cc1528faaff11cf3744e5`，对照首次候选 `36b3450` 检查模型修复、回归测试和记录更新。负载假设沿用单人、单服务、小型合成图。

## 修复核实

首次发现第 1 项已关闭。

`reconcileGraph` 改用 `Object.hasOwn` 判断存续坐标。合法新节点 `constructor` 获得有效的外围默认坐标，原有节点坐标保持，重复提交相同完整图保持幂等。

独立执行以下检查，结果均通过。

- `npm run check`
- `node --test --test-name-pattern '原型同名' checks/behavior.test.ts`
- 修复差异的 `git diff --check`

首次审查原文已完整保留。README 明确区分完整浏览器取证候选与修复候选。

## 证据复用与结论

其余 8 份取证源文件哈希与原记录一致。浏览器固定 a—e 路径中的存续坐标均为自有属性，修复前后行为一致，可以复用原候选的 Edge、Chrome 和失败恢复证据。

**复核结论为通过。** 本次只读复核期间，工作区保持干净。

Firefox、干净机器重装、多服务同目录写入、断电恢复和大图性能仍待验证。作者体验待验。
