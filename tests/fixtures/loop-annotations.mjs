import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cli } from './dependency-canvas.mjs';
import { readJSON, writeJSON } from './dependency-legends.mjs';
import { createReadingLayoutProject, denseId } from './canvas-reading-layout.mjs';
import { fixedArgs, orderInput } from './loop-authoring.mjs';
import { loopLayout } from './loop-reader.mjs';

// Extend the same synthetic project so both charts and the original dependency graph can be revisited.
export async function addAnnotationLoops(project) {
  const directory = path.dirname(project.projectRoot);
  const order = structuredClone(orderInput);
  order.title = '数量越界时，订单为什么没有增加？';
  order.nodes.find(node => node.id === 'check').annotation =
    '输入 `"0"` 会转成数字 **0**。它低于下限 1，规则在服务追加订单前抛出异常。';
  order.nodes.find(node => node.id === 'stop').annotation =
    '调用在数量检查处中断。即使集合原本已有订单，这次也**不会追加**。';
  const dense = await readJSON(path.join(directory, denseId + '.json'));
  dense.nodes.find(node => node.id === 'paths').annotation =
    '传入 `uploads/report.csv` 时，**最后一段**是文件名；目录不会进入结果。';
  dense.nodes.find(node => node.id === 'numbers').annotation =
    '转换后再看两个条件：\n\n- **整数**：`2.5` 仍有小数部分。\n- **范围**：`10` 超过上限。\n\n只有两项都通过，才会得到可用的数量。';
  const overview = dense.nodes.find(node => node.id === 'compare');
  overview.block_id = 'overview';
  overview.annotation = '对照两条分支：路径分支保留文件名，数量分支保留符合范围的整数。';
  for (const [id, input] of [['quantity-branches', order], ['annotated-inputs', dense]]) {
    const file = path.join(directory, id + '.json');
    await writeJSON(file, input);
    execFileSync(process.execPath, [cli, 'create-loop', ...fixedArgs(project), '--id', id, '--input', file], { windowsHide: true });
  }
  const manual = await readJSON(loopLayout(project, denseId));
  await writeJSON(loopLayout(project, 'annotated-inputs'), { ...manual, graph: 'loop:annotated-inputs' });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await addAnnotationLoops(await createReadingLayoutProject(process.argv[2]));
}
