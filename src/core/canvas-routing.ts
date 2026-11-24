import type { Point, Size } from './canvas-layout.js';

export interface CardBounds extends Point, Size {}
interface Link { id: string; source: string; target: string }
type Side = 'left' | 'right' | 'top' | 'bottom';
interface Port { point: Point; normal: Point }
const normal = { left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, top: { x: 0, y: -1 }, bottom: { x: 0, y: 1 } };
const horizontal = (side: Side) => side === 'left' || side === 'right';
const along = (a: Point, direction: Point, length: number) => ({ x: a.x + direction.x * length, y: a.y + direction.y * length });
const xy = (p: Point) => p.x + ',' + p.y;

function facing(a: CardBounds, b: CardBounds): [Side, Side] {
  const dx = b.x + b.width / 2 - a.x - a.width / 2;
  const dy = b.y + b.height / 2 - a.y - a.height / 2;
  const xGap = Math.abs(dx) - (a.width + b.width) / 2;
  const yGap = Math.abs(dy) - (a.height + b.height) / 2;
  // Touching facing ports leave no room for a readable arrow. Use exposed
  // sides, with the reverse relationship on the opposite side of the pair.
  if (Math.max(xGap, yGap) < 10) {
    const outside = xGap >= yGap ? (dx >= 0 ? 'top' : 'bottom') : (dy >= 0 ? 'right' : 'left');
    return [outside, outside];
  }
  if (xGap >= yGap) return dx >= 0 ? ['right', 'left'] : ['left', 'right'];
  return dy >= 0 ? ['bottom', 'top'] : ['top', 'bottom'];
}

export function canvasRoutes(cards: Map<string, CardBounds>, links: readonly Link[]) {
  const slots = new Map<CardBounds, Map<Side, { key: string; order: number; port: Port }[]>>();
  function addPort(card: CardBounds, side: Side, peer: CardBounds, key: string) {
    let sides = slots.get(card);
    if (!sides) slots.set(card, sides = new Map());
    const entries = sides.get(side) ?? [];
    const n = normal[side];
    const point = { x: card.x + (1 + n.x) * card.width / 2, y: card.y + (1 + n.y) * card.height / 2 };
    const port = { point, normal: n };
    entries.push({ key, order: horizontal(side) ? peer.y + peer.height / 2 : peer.x + peer.width / 2, port });
    sides.set(side, entries);
    return port;
  }
  const endpoints = [];
  for (const link of links) {
    const a = cards.get(link.source), b = cards.get(link.target);
    if (!a || !b) continue;
    const [out, into] = a === b ? ['right', 'top'] as const : facing(a, b);
    endpoints.push({ link, a, b, start: addPort(a, out, b, link.id), end: addPort(b, into, a, link.id) });
  }
  for (const [card, sides] of slots) for (const [side, entries] of sides) {
    entries.sort((a, b) => a.order - b.order || a.key.localeCompare(b.key));
    const span = horizontal(side) ? card.height * .48 : card.width * .68;
    const step = Math.min(12, span / Math.max(1, entries.length - 1));
    const axis = horizontal(side) ? 'y' : 'x';
    const center = entries[0]!.port.point[axis];
    const room = (span - step * (entries.length - 1)) / 2;
    const mean = entries.reduce((sum, entry) => sum + entry.order, 0) / entries.length;
    const offset = Math.max(-room, Math.min(room, mean - center));
    entries.forEach(({ port }, index) => {
      port.point[axis] += offset + (index - (entries.length - 1) / 2) * step;
    });
  }

  const paths = new Map<string, string>();
  for (const { link, a, b, start, end } of endpoints) {
    const p = start.point, q = end.point;
    if (a === b) {
      // Round the two outside corners, keeping both ends tangent to the card.
      const right = p.x + 30, top = q.y - 30;
      paths.set(link.id, [
        `M ${xy(p)} Q ${right},${p.y} ${right},${p.y - 16}`,
        `L ${right},${top + 12} Q ${right},${top} ${right - 12},${top}`,
        `L ${q.x + 12},${top} Q ${q.x},${top} ${q.x},${top + 12} L ${xy(q)}`,
      ].join(' '));
    } else if (start.normal === end.normal) {
      // An offset pair can touch along just part of a side. Turn beyond both
      // faces so the approach cannot cut through the nearer corner.
      const n = start.normal;
      const offset = (q.x - p.x) * n.x + (q.y - p.y) * n.y;
      const out = along(p, n, 6 + Math.max(0, offset));
      const into = along(q, n, 6 + Math.max(0, -offset));
      paths.set(link.id, `M ${xy(p)} L ${xy(out)} C ${xy(along(out, n, 28))} ${xy(along(into, n, 28))} ${xy(into)} L ${xy(q)}`);
    } else {
      const gap = Math.abs(start.normal.x ? p.x - q.x : p.y - q.y);
      const reach = Math.min(gap * .48, 120);
      const c = along(p, start.normal, reach), d = along(q, end.normal, reach);
      paths.set(link.id, 'M ' + xy(p) + ' C ' + xy(c) + ' ' + xy(d) + ' ' + xy(q));
    }
  }
  return paths;
}
