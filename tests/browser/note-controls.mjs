// Read the editor's actual plain-text clipboard output, including replaced block references.
export async function editorText(input) {
  await input.press('Control+a');
  return input.evaluate(el => {
    const data = new DataTransfer();
    el.dispatchEvent(new ClipboardEvent('copy', { clipboardData: data, bubbles: true, cancelable: true }));
    return data.getData('text/plain');
  });
}

export async function newQuickNote(page, language = 'zh-CN') {
  await page.locator('.new-note').click();
  await page.locator('#quick-note').getByRole('button', { name: language === 'en' ? 'New note' : '新建笔记', exact: true }).click();
}
