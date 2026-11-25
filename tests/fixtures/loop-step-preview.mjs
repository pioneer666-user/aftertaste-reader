import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cli } from './dependency-canvas.mjs';
import { createExampleProject, exampleId } from './loop-examples.mjs';
import { fixedArgs } from './loop-authoring.mjs';
import { readJSON, writeJSON } from './dependency-legends.mjs';
import { loopLayout } from './loop-reader.mjs';

export const previewId = 'quantity-preview';
export async function createPreviewProject(target) {
  const project = await createExampleProject(target);
  const dir = path.dirname(project.projectRoot);
  const input = await readJSON(path.join(dir, 'quantity-examples.json'));
  input.title = '从空集合到第一条订单';
  const step = id => input.nodes.find(item => item.id === id);
  step('build').explanation = '校验返回 `4`，新订单的数量就取这个值。假设集合起初为空，订单编号为 `1`。\n\n**此时集合仍是空的。** 下一步追加时，订单才会出现在列表里。';
  step('append').explanation = '现在追加这条订单。\n\n- 之前集合为空。\n- 追加后集合有 **一条订单**。\n\n```js\norders.push(order);\n```\n\n[回到本步](#aftertaste-loop/quantity-preview/append)';
  step('reject').explanation += [
    '', '假设集合起初为空，先分清两个判断：',
    '- 文本 `"4.5"` 可以转成数值，转换能得到 `4.5`。\n- 数值有小数部分，`Number.isInteger(quantity)` 返回 `false`。',
    '整数检查失败后，规则会抛错。服务还在等待数量，连订单编号都没有计算，自然也没有对象可以追加。',
    '**集合仍为空。** 对照成功示例：数量文本 `"04"` 能得到整数 4，服务才会继续建单。',
  ].join('\n\n');
  const inputPath = path.join(dir, 'preview-input.json');
  await writeJSON(inputPath, input);
  execFileSync(process.execPath, [cli, 'create-loop', ...fixedArgs(project), '--id', previewId, '--input', inputPath], { windowsHide: true });
  const layout = await readJSON(loopLayout(project, exampleId));
  await writeJSON(loopLayout(project, previewId), { ...layout, graph: 'loop:' + previewId });
  return project;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const project = await createPreviewProject(process.argv[2]);
  console.log(project.projectRoot, project.commit);
}
