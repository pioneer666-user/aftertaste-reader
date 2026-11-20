const svgNamespace = 'http://www.w3.org/2000/svg';

// As on a dependency node, the Bézier segments meet the straight edges at zero curvature.
function perimeter(x: number, y: number, right: number, bottom: number, radius: number, rightOnly: boolean, edgeOnly = false) {
  const curve = (map: (a: number, b: number) => [number, number]) => {
    const points = [[.565, 0], [.348, 0], [.174, .174], [0, .348], [0, .565], [0, 1]] as const;
    const [a, b, c, d, e, f] = points.map(([u, v]) => map(u * radius, v * radius).join(','));
    return `C${a} ${b} ${c} C${d} ${e} ${f}`;
  };
  const rightEdge = `${curve((a, b) => [right - a, y + b])}
    V${bottom - radius} ${curve((a, b) => [right - b, bottom - a])}`;
  if (edgeOnly) return `M${right - radius},${y} ${rightEdge}`;
  if (rightOnly) return `M${x},${y} H${right - radius} ${rightEdge} H${x} Z`;
  return `M${x + radius},${y} H${right - radius} ${rightEdge} H${x + radius}
    ${curve((a, b) => [x + a, bottom - b])} V${y + radius}
    ${curve((a, b) => [x + b, y + a])} Z`;
}

function appendPath(svg: SVGSVGElement, path: string, fill: string, stroke: string, width: number) {
  const element = document.createElementNS(svgNamespace, 'path');
  element.setAttribute('d', path);
  element.setAttribute('fill', fill);
  element.setAttribute('stroke', stroke);
  element.setAttribute('stroke-width', String(width));
  svg.append(element);
}

function paint(element: HTMLElement, svg: SVGSVGElement) {
  element.removeAttribute('data-reader-corner');
  const width = element.offsetWidth, height = element.offsetHeight;
  if (!width || !height) return;
  const style = getComputedStyle(element);
  const radius = Math.min(parseFloat(style.getPropertyValue('--corner-size')), width / 2, height / 2);
  if (!radius) return;
  const border = parseFloat(style.borderTopWidth), rightBorder = parseFloat(style.borderRightWidth);
  const rightOnly = parseFloat(style.borderTopLeftRadius) === 0;
  const ring = style.outlineStyle === 'solid' ? parseFloat(style.outlineWidth) : 0;
  const offset = parseFloat(style.outlineOffset);
  const outset = ring ? Math.max(0, ring + offset) : 0;
  const key = JSON.stringify([width, height, radius, border, rightBorder, rightOnly, ring, offset,
    style.backgroundColor, style.borderTopColor, style.borderRightColor, style.outlineColor]);
  if (svg.dataset.paint !== key) {
    svg.dataset.paint = key;
    svg.setAttribute('width', String(width + outset * 2));
    svg.setAttribute('height', String(height + outset * 2));
    svg.replaceChildren();
    const path = (edge: number) => perimeter(outset - edge, outset - edge, outset + width + edge,
      outset + height + edge, Math.max(0, radius + edge), rightOnly);
    appendPath(svg, path(-border / 2), style.backgroundColor, style.borderTopColor, border);
    if (rightOnly && rightBorder) {
      const x = outset + width - rightBorder / 2;
      const y = outset;
      const bottom = outset + height;
      // The side panel keeps its single divider along the free edge.
      const edge = perimeter(outset, y, x, bottom, radius, true, true);
      appendPath(svg, edge, 'none', style.borderRightColor, rightBorder);
    }
    if (ring) appendPath(svg, path(offset + ring / 2), 'none', style.outlineColor, ring);
    element.style.setProperty('--reader-corner-image', `-moz-element(#${svg.id}) 0 fill / 0 / ${outset}px`);
  }
  element.setAttribute('data-reader-corner', '');
}

export function paintReaderCorners(root: HTMLElement) {
  if (CSS.supports('corner-shape', 'squircle') || !CSS.supports('border-image-source', '-moz-element(#example)')) return;
  // Use the same scoped selectors that supply the native radius.
  const selector = Array.from(document.styleSheets).flatMap(sheet => Array.from(sheet.cssRules))
    .filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule && !!rule.style.getPropertyValue('--corner-size'))
    .map(rule => rule.selectorText).join(',');
  if (!selector) return;

  const surfaces = document.createElement('div');
  surfaces.className = 'reader-corner-surfaces';
  surfaces.setAttribute('aria-hidden', 'true');
  document.body.append(surfaces);
  const paintings = new Map<HTMLElement, SVGSVGElement>();
  const dirty = new Set<HTMLElement>();
  const forcedColors = matchMedia('(forced-colors: active)');
  let nextId = 0, frame = 0, scan = true;

  function schedule() {
    if (!frame) frame = requestAnimationFrame(render);
  }

  const resize = new ResizeObserver(entries => {
    for (const entry of entries) dirty.add(entry.target as HTMLElement);
    schedule();
  });

  function render() {
    frame = 0;
    if (forcedColors.matches) return;
    if (scan) {
      scan = false;
      const active = new Set(root.querySelectorAll<HTMLElement>(selector));
      for (const [element, svg] of paintings) {
        if (active.has(element)) continue;
        resize.unobserve(element);
        svg.remove();
        paintings.delete(element);
        element.removeAttribute('data-reader-corner');
        element.style.removeProperty('--reader-corner-image');
      }
      for (const element of active) {
        if (!paintings.has(element)) {
          const svg = document.createElementNS(svgNamespace, 'svg');
          svg.id = `reader-corner-${++nextId}`;
          surfaces.append(svg);
          paintings.set(element, svg);
          resize.observe(element, { box: 'border-box' });
        }
        dirty.add(element);
      }
    }
    for (const element of dirty) {
      const svg = paintings.get(element);
      if (svg) paint(element, svg);
    }
    dirty.clear();
  }

  const rescan = () => { scan = true; schedule(); };
  new MutationObserver(rescan).observe(root, {
    childList: true, characterData: true, subtree: true, attributes: true,
    attributeFilter: ['class', 'aria-current', 'aria-expanded', 'data-current-directory', 'disabled'],
  });
  // The focus indicator can belong to an ancestor, as on the source sheet.
  for (const type of ['pointerover', 'pointerout', 'focusin', 'focusout', 'toggle']) {
    root.addEventListener(type, event => {
      for (let element = event.target as HTMLElement | null; element && element !== root; element = element.parentElement) {
        if (paintings.has(element)) dirty.add(element);
      }
      schedule();
    }, true);
  }
  forcedColors.addEventListener('change', rescan);
  schedule();
}
