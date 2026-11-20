export function dependencySaved(scope) {
  return scope.locator('[data-testid="layout-status"][data-state="canvasSaved"]').waitFor({ state: 'attached' });
}

export async function dependencyOptions(page, label = '图操作') {
  const summary = page.locator('#canvas-reading summary').filter({ hasText: label });
  if (!await summary.evaluate(element => element.parentElement.open)) await summary.click();
  return summary.locator('..');
}

export async function refreshDependency(page) {
  const options = await dependencyOptions(page);
  await options.getByRole('button', { name: '刷新图和布局', exact: true }).click();
}

export async function openDependencyGroups(page) {
  const scope = page.locator('#canvas-reading');
  if (await scope.locator('#canvas-group-picker').isVisible()) return;
  const options = await dependencyOptions(page);
  await options.getByRole('button', { name: '编辑分组', exact: true }).click();
}
