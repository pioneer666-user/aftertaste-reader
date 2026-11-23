// Sample the rendered screenshot so translucent surfaces, SVG corners and glass
// are measured against the color actually behind the text.
export async function textContrast(page, png, selectors, { selection = false } = {}) {
  return page.evaluate(async ({ encoded, selectors, selection }) => {
    const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const luminance = c => c.reduce((sum, v, i) => {
      const x = v / 255;
      return sum + [0.2126, 0.7152, 0.0722][i] * (x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4);
    }, 0);
    const contrast = (a, b) => {
      const [low, high] = [luminance(a), luminance(b)].sort((x, y) => x - y);
      return (high + .05) / (low + .05);
    };
    const result = [];
    for (const selector of selectors) {
      const el = [...document.querySelectorAll(selector)].find(item => item.checkVisibility());
      if (!el) continue;
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode()) && !node.textContent.trim()) {}
      if (!node) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const rect = range.getClientRects()[0];
      if (!rect || rect.left < 0 || rect.right > innerWidth || rect.top < 0 || rect.bottom > innerHeight) continue;
      const top = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      if (!el.contains(top)) continue;
      const rgb = getComputedStyle(node.parentElement, selection ? '::selection' : null).color.match(/[\d.]+/g).slice(0,3).map(Number);
      const data = ctx.getImageData(Math.floor(rect.x), Math.floor(rect.y), Math.ceil(rect.width), Math.ceil(rect.height)).data;
      const colors = new Map();
      for (let i = 0; i < data.length; i += 4) {
        const key = data.slice(i, i + 3).join(',');
        colors.set(key, (colors.get(key) ?? 0) + 1);
      }
      const background = [...colors].sort((a,b) => b[1] - a[1])[0][0].split(',').map(Number);
      const distance = c => c.reduce((n,v,i) => n + Math.abs(v - rgb[i]), 0);
      const foreground = [...colors.keys()].map(key => key.split(',').map(Number)).sort((a,b) => distance(a) - distance(b))[0];
      result.push({ selector, foreground, cssInk: rgb, background, ratio: contrast(rgb, background), minimum: 4.5 });
      if (selection) {
        const adjacent = getComputedStyle(el.closest('.source-line').querySelector('.line-number')).backgroundColor.match(/\d+/g).map(Number);
        result.push({ selector: 'source selection boundary', foreground: background, background: adjacent,
          ratio: contrast(background, adjacent), minimum: 3 });
      }
    }
    const card = document.querySelector('#canvas-reading [data-route-member][aria-pressed=true]');
    if (card?.checkVisibility() && selectors.includes('.route-read')) {
      const rect = card.getBoundingClientRect();
      const x = Math.round(rect.x + rect.width / 2), y = Math.round(rect.y);
      const pixel = offset => Array.from(ctx.getImageData(x, y + offset, 1, 1).data.slice(0, 3));
      const outside = pixel(-5), stroke = pixel(0), inside = pixel(5);
      for (const background of [outside, inside]) result.push({ selector: 'selected route outline', foreground: stroke,
        background, ratio: contrast(stroke, background), minimum: 3 });
      // Nearby group wash is already composited in the screenshot. Include attenuation of indirect relations.
      for (const edge of document.querySelectorAll('#canvas-reading .vue-flow__edge-path')) {
        const style = getComputedStyle(edge);
        const alpha = Number(style.opacity);
        const foreground = style.stroke.match(/[\d.]+/g).slice(0, 3).map((v, i) => Math.round(alpha * Number(v) + (1 - alpha) * outside[i]));
        result.push({ selector: edge.parentElement.getAttribute('aria-label') ?? 'edge', foreground, background: outside,
          ratio: contrast(foreground, outside), minimum: 3 });
      }
    }
    return result;
  }, { encoded: png.toString('base64'), selectors, selection });
}
