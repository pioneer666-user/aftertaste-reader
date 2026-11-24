import type { Point } from './canvas-layout.js';
import type { CardBounds } from './canvas-routing.js';

export interface AlignmentGuide { from: Point; to: Point }

export function alignBounds(moving: CardBounds, targets: readonly CardBounds[], zoom: number) {
  const position = { x: moving.x, y: moving.y };
  const guides: AlignmentGuide[] = [];
  for (const axis of ['x', 'y'] as const) {
    const cross = axis === 'x' ? 'y' : 'x';
    const size = axis === 'x' ? 'width' : 'height';
    const extent = axis === 'x' ? 'height' : 'width';
    let best: { delta: number; gap: number; value: number; target: CardBounds } | undefined;
    for (const target of targets) {
      const gap = Math.max(0, moving[cross] - target[cross] - target[extent], target[cross] - moving[cross] - moving[extent]);
      if (gap * zoom > 360) continue;
      for (const [own, other] of [[0, 0], [1, 1], [.5, .5], [0, 1], [1, 0]] as const) {
        const value = target[axis] + target[size] * other;
        const delta = value - (moving[axis] + moving[size] * own);
        if (Math.abs(delta) * zoom > 5) continue;
        if (!best || Math.abs(delta) < Math.abs(best.delta) || (Math.abs(delta) === Math.abs(best.delta) && gap < best.gap)) {
          best = { delta, gap, value, target };
        }
      }
    }
    if (!best) continue;
    position[axis] += best.delta;
    const from = Math.min(moving[cross], best.target[cross]);
    const to = Math.max(moving[cross] + moving[extent], best.target[cross] + best.target[extent]);
    guides.push(axis === 'x' ? { from: { x: best.value, y: from }, to: { x: best.value, y: to } }
      : { from: { x: from, y: best.value }, to: { x: to, y: best.value } });
  }
  return { position, guides };
}
