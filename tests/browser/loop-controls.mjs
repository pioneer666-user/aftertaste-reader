export async function openCatalog(page) {
  const toggle = page.locator('.reader-navigation-toggle');
  if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
}

export async function chooseLoop(page, id) {
  await openCatalog(page);
  await page.locator(`#loop-navigation [data-loop="${id}"]`).click();
}
