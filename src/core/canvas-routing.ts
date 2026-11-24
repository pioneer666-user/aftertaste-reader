import type { Point, Size } from './canvas-layout.js';

export interface CardBounds extends Point, Size {}
interface Link { id: string; source: string; target: string }
type Side = 'left' | 'right' | 'top' | 'bottom';
interface Port { point: Point; normal: Point; lane: number }
const normal = { left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, top: { x: 0, y: -1 }, bottom: { x: 0, y: 1 } };
const horizontal = (side: Side) => side === 'left' || side === 'right';
const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);
const along = (a: Point, direction: Point, length: number) => ({ x: a.x + direction.x * length, y: a.y + direction.y * length });
const mix = (a: Point, b: Point, t = .5) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
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

// Open-rectangle segment intersection. A path may run along a boundary.
function crosses(a: Point, b: Point, rect: CardBounds) {
  let enter = 0, leave = 1;
  for (const axis of ['x', 'y'] as const) {
    const low = rect[axis], high = low + (axis === 'x' ? rect.width : rect.height);
    const delta = b[axis] - a[axis];
    if (!delta) {
      if (a[axis] <= low || a[axis] >= high) return false;
    } else {
      const t1 = (low - a[axis]) / delta, t2 = (high - a[axis]) / delta;
      enter = Math.max(enter, Math.min(t1, t2));
      leave = Math.min(leave, Math.max(t1, t2));
    }
  }
  return enter < leave;
}

function curveHits(a: Point, b: Point, c: Point, d: Point, rect: CardBounds, depth = 0): boolean {
  const points = [a, b, c, d];
  if (points.every(p => p.x <= rect.x) || points.every(p => p.x >= rect.x + rect.width) ||
      points.every(p => p.y <= rect.y) || points.every(p => p.y >= rect.y + rect.height)) return false;
  if (depth === 8) return crosses(a, d, rect);
  const ab = mix(a, b), bc = mix(b, c), cd = mix(c, d);
  const abc = mix(ab, bc), bcd = mix(bc, cd), mid = mix(abc, bcd);
  return curveHits(a, ab, abc, mid, rect, depth + 1) || curveHits(mid, bcd, cd, d, rect, depth + 1);
}

function corners(r: CardBounds, margin: number) {
  return [r.x - margin, r.x + r.width + margin].flatMap(x =>
    [r.y - margin, r.y + r.height + margin].map(y => ({ x, y })));
}

// Search the visibility graph lazily. Only a blocked curve pays for a detour.
function detour(start: Point, end: Point, cards: CardBounds[], margin: number) {
  const points = [start, end, ...cards.flatMap(r => corners(r, margin))];
  const cost = new Map([[0, 0]]);
  const previous = new Map<number, number>();
  const open = new Set([0]);
  while (open.size) {
    let current = -1, best = Infinity;
    for (const i of open) {
      const estimate = cost.get(i)! + distance(points[i]!, end);
      if (estimate < best) { current = i; best = estimate; }
    }
    if (current === 1) {
      const path = [end];
      while (previous.has(current)) {
        current = previous.get(current)!;
        path.push(points[current]!);
      }
      return path.reverse();
    }
    open.delete(current);
    const a = points[current]!;
    for (let i = 1; i < points.length; i++) {
      const b = points[i]!, next = cost.get(current)! + distance(a, b);
      if (next >= (cost.get(i) ?? Infinity) || cards.some(r => crosses(a, b, r))) continue;
      cost.set(i, next);
      previous.set(i, current);
      open.add(i);
    }
  }
}

// Start with the cards in the way. A bend that meets another card brings its
// corners into the next search, without expanding distant parts of the graph.
function clearDetour(start: Point, end: Point, cards: CardBounds[], margin: number) {
  const blockers = new Set(cards.filter(r => crosses(start, end, r)));
  while (true) {
    const path = detour(start, end, [...blockers], margin);
    if (!path) return;
    const before = blockers.size;
    for (let i = 1; i < path.length; i++) {
      for (const r of cards) if (crosses(path[i - 1]!, path[i]!, r)) blockers.add(r);
    }
    if (before === blockers.size) return path;
  }
}

function rounded(points: Point[], cards: CardBounds[]) {
  let path = 'M ' + xy(points[0]!);
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1]!, b = points[i]!, c = points[i + 1]!;
    const ab = distance(a, b), bc = distance(b, c);
    if (!ab || !bc) continue;
    const radius = Math.min(22, ab / 2, bc / 2);
    const before = mix(b, a, radius / ab), after = mix(b, c, radius / bc);
    path += cards.some(r => crosses(before, after, r)) ? ' L ' + xy(b)
      : ' L ' + xy(before) + ' Q ' + xy(b) + ' ' + xy(after);
  }
  return path + ' L ' + xy(points.at(-1)!);
}

export function canvasRoutes(cards: Map<string, CardBounds>, links: readonly Link[]) {
  const slots = new Map<CardBounds, Map<Side, { key: string; order: number; port: Port }[]>>();
  function addPort(card: CardBounds, side: Side, peer: CardBounds, key: string) {
    let sides = slots.get(card);
    if (!sides) slots.set(card, sides = new Map());
    const entries = sides.get(side) ?? [];
    const n = normal[side];
    const point = { x: card.x + (1 + n.x) * card.width / 2, y: card.y + (1 + n.y) * card.height / 2 };
    const port = { point, normal: n, lane: 0 };
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
      port.lane = (index - (entries.length - 1) / 2) * step;
      port.point[axis] += offset + (index - (entries.length - 1) / 2) * step;
    });
  }

  const paths = new Map<string, string>();
  const bounds = [...cards.values()];
  for (const { link, a, b, start, end } of endpoints) {
    const p = start.point, q = end.point;
    const gap = Math.abs(start.normal.x ? p.x - q.x : p.y - q.y);
    const reach = start.normal === end.normal ? 36 : Math.min(gap * .48, 120);
    const c = along(p, start.normal, reach), d = along(q, end.normal, reach);
    let path = 'M ' + xy(p) + ' C ' + xy(c) + ' ' + xy(d) + ' ' + xy(q);
    // A self-loop goes outside both straight sides, around the top-right corner.
    if (a === b) {
      const outer = { x: p.x + 30, y: q.y - 30 };
      const loop = [p, along(p, start.normal, 30), outer, along(q, end.normal, 30), q];
      if (!loop.slice(1).some((pt, i) => bounds.some(r => crosses(loop[i]!, pt, r)))) {
        paths.set(link.id, rounded(loop, bounds));
        continue;
      }
    }
    if (a === b || bounds.some(r => curveHits(p, c, d, q, r))) {
      // Keep approach tangents short enough to use a narrow open gap.
      const stub = (port: Port) => {
        let length = 12;
        while (length >= 1 && bounds.some(r => crosses(port.point, along(port.point, port.normal, length), r))) length /= 2;
        return along(port.point, port.normal, length);
      };
      const margin = 14 + Math.max(-7, Math.min(15, (end.lane || start.lane) / 2));
      const middle = clearDetour(stub(start), stub(end), bounds, margin) ?? clearDetour(p, q, bounds, 0);
      if (middle) path = rounded([p, ...middle, q], bounds);
    }
    paths.set(link.id, path);
  }
  return paths;
}
