import { isCanvasId } from './dependency-graph.js';
import type { RemovalMarks } from './dependency-graph.js';

export interface Point { x: number; y: number }
export interface Size { width: number; height: number }
export interface Viewport extends Point { zoom: number }
export interface CanvasGroup { id: string; name: string; members: string[] }
export interface CanvasLayout {
  positions: Record<string, Point>;
  groups: CanvasGroup[];
  viewport: Viewport;
}

export const nodeSize = { width: 212, height: 56 };
export const minZoom = 0.25;
export const maxZoom = 2;
const coordinateLimit = 1e9;
export const layoutFormat = 'aftertaste-canvas-layout/v1';
export const layoutPath = 'docs/aftertaste/dependency-layout.json';
export const layoutGraph = 'dependency';

export class CanvasError extends Error {
  constructor(readonly code: string, message: string, readonly nextStep: string,
    readonly context: Readonly<Record<string, string | number>> = {}) {
    super(message);
  }
}

function invalid(field: string): never {
  throw new CanvasError('LAYOUT_INVALID', '布局字段不符合协议。', '保留原文件，按字段检查布局内容。', { layoutPath, field });
}

export function layoutObject(value: unknown, keys: readonly string[], field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) invalid(field);
  return value as Record<string, unknown>;
}

export function isRevision(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(value);
}

function coordinate(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > coordinateLimit) invalid(field);
  return value;
}

export function parseLayout(value: unknown, source: 'file' | 'request' = 'file', acceptsId: (id: string) => boolean = isCanvasId): CanvasLayout {
  const { positions, groups, viewport } = layoutObject(value, ['positions', 'groups', 'viewport'], '$.layout');
  const positionsField = '$.layout.positions';
  if (!positions || typeof positions !== 'object' || Array.isArray(positions) !== (source === 'request')) invalid(positionsField);
  let entries: [string, unknown][];
  if (Array.isArray(positions)) {
    entries = Array.from(positions, (entry: unknown, index) => {
      if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string') invalid(`${positionsField}[${index}]`);
      return [entry[0], entry[1]];
    });
  } else entries = Object.entries(positions);
  const coordinates = Object.fromEntries(entries.map(([id, value]) => {
    const field = `$.layout.positions[${JSON.stringify(id)}]`;
    if (!acceptsId(id)) invalid(field);
    const { x, y } = layoutObject(value, ['x', 'y'], field);
    return [id, { x: coordinate(x, field + '.x'), y: coordinate(y, field + '.y') }] as const;
  }));
  if (Object.keys(coordinates).length !== entries.length) invalid(positionsField);
  const groupIds = new Set<string>();
  const membership = new Set<string>();
  if (!Array.isArray(groups)) invalid('$.layout.groups');
  const parsedGroups = Array.from(groups, (group: unknown, index): CanvasGroup => {
    const field = `$.layout.groups[${index}]`;
    const { id, name, members } = layoutObject(group, ['id', 'name', 'members'], field);
    if (!isRevision(id) || groupIds.has(id)) invalid(field + '.id');
    groupIds.add(id);
    if (typeof name !== 'string' || !name.isWellFormed() || !name.trim() || name !== name.trim() || name.length > 160 ||
        /[\x00-\x1f\x7f]/u.test(name)) invalid(field + '.name');
    if (!Array.isArray(members) || !members.length) invalid(field + '.members');
    return { id, name, members: Array.from(members, (member: unknown, memberIndex) => {
      if (typeof member !== 'string' || !Object.hasOwn(coordinates, member) || membership.has(member)) invalid(`${field}.members[${memberIndex}]`);
      membership.add(member);
      return member;
    }) };
  });
  const { x, y, zoom } = layoutObject(viewport, ['x', 'y', 'zoom'], '$.layout.viewport');
  if (typeof zoom !== 'number' || !Number.isFinite(zoom) || zoom < minZoom || zoom > maxZoom) invalid('$.layout.viewport.zoom');
  return { positions: coordinates, groups: parsedGroups,
    viewport: { x: coordinate(x, '$.layout.viewport.x'), y: coordinate(y, '$.layout.viewport.y'), zoom } };
}

export interface LayoutRelations {
  edges: { from: string; to: string }[];
  libraries: { id: string; targets: string[] }[];
  order?: string[];
}

const maxRows = 6;
const rowHeight = 104;

// Collapse strongly connected components before assigning longest-path layers.
// Iterative DFS also handles long import chains without using the JS call stack.
function layeredPositions(ids: readonly string[], relations: LayoutRelations) {
  const libraries = new Set(relations.libraries.map(item => item.id));
  const order = relations.order ?? [...ids].sort();
  const nodes = order.filter(id => !libraries.has(id));
  const outgoing = new Map(nodes.map(id => [id, [] as string[]]));
  const incoming = new Map(nodes.map(id => [id, [] as string[]]));
  for (const { from, to } of relations.edges) {
    outgoing.get(from)!.push(to);
    incoming.get(to)!.push(from);
  }
  const seen = new Set<string>();
  const finished: string[] = [];
  for (const root of nodes) {
    if (seen.has(root)) continue;
    seen.add(root);
    const stack = [{ id: root, next: 0 }];
    while (stack.length) {
      const frame = stack[stack.length - 1]!;
      const next = outgoing.get(frame.id)![frame.next++];
      if (next === undefined) { finished.push(frame.id); stack.pop(); }
      else if (!seen.has(next)) { seen.add(next); stack.push({ id: next, next: 0 }); }
    }
  }
  const component = new Map<string, number>();
  const groups: string[][] = [];
  for (const root of finished.reverse()) {
    if (component.has(root)) continue;
    const index = groups.length;
    groups.push([]);
    const stack = [root];
    component.set(root, index);
    while (stack.length) {
      for (const previous of incoming.get(stack.pop()!)!) {
        if (!component.has(previous)) { component.set(previous, index); stack.push(previous); }
      }
    }
  }
  // Order inside cycles by the author's reading order, or by stable file path.
  for (const id of nodes) groups[component.get(id)!]!.push(id);
  const starts = groups.map(() => 0);
  const layers = new Map<string, number>();
  groups.forEach((members, index) => {
    const end = starts[index]! + members.length;
    members.forEach((id, offset) => {
      layers.set(id, starts[index]! + offset);
      for (const to of outgoing.get(id)!) {
        const target = component.get(to)!;
        if (target !== index) starts[target] = Math.max(starts[target]!, end);
      }
    });
  });

  const bands = new Map<number, string[]>();
  const add = (id: string, layer: number) => {
    const members = bands.get(layer);
    if (members) members.push(id);
    else bands.set(layer, [id]);
  };
  if (relations.order) {
    for (const id of nodes) add(id, layers.get(id)!);
  } else {
    // Read backwards from the deepest consumers so related roots share nearby
    // rows. The longest chain is visible together at the top of the file graph.
    const byDepth = (a: string, b: string) => layers.get(b)! - layers.get(a)! || (a < b ? -1 : a > b ? 1 : 0);
    const stack = [...nodes].sort(byDepth).reverse();
    const visited = new Set<string>();
    while (stack.length) {
      const id = stack.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);
      add(id, layers.get(id)!);
      for (const parent of incoming.get(id)!.sort(byDepth).reverse()) stack.push(parent);
    }
  }
  const hidden = [];
  for (const { id, targets } of [...relations.libraries].sort((a, b) => a.id.localeCompare(b.id))) {
    if (relations.order && !targets.length) hidden.push(id);
    else add(id, -1);
  }

  // Balance each band over short columns. Each column straddles the same midline.
  const points = new Map<string, Point>();
  let tallest = 1;
  let widest = 1;
  for (const band of bands.values()) {
    const columns = Math.ceil(band.length / maxRows);
    tallest = Math.max(tallest, Math.ceil(band.length / columns));
    widest = Math.max(widest, columns);
  }
  let x = 72;
  const pitch = 82, within = 32, between = 108;
  for (const [, band] of [...bands].sort(([a], [b]) => a - b)) {
    const columns = Math.ceil(band.length / maxRows);
    let index = 0;
    for (let col = 0; col < columns; col++) {
      const rows = Math.ceil((band.length - index) / (columns - col));
      for (let row = 0; row < rows; row++) {
        points.set(band[index++]!, { x, y: 80 + ((tallest - rows) / 2 + row) * pitch });
      }
      x += nodeSize.width + (col + 1 === columns ? between : within);
    }
  }
  // File-only loop legends keep a layout identity without reserving visible space.
  hidden.forEach((id, i) => points.set(id, { x, y: 80 + i * pitch }));
  return { points, zoom: widest > 1 ? .78 : 1 };
}

export function defaultLayout(ids: readonly string[], relations: LayoutRelations = { edges: [], libraries: [] }): CanvasLayout {
  const { points, zoom } = layeredPositions(ids, relations);
  return { positions: Object.fromEntries(points), groups: [], viewport: { x: 0, y: 0, zoom } };
}

export function rearrange(layout: CanvasLayout, ids: readonly string[], relations?: LayoutRelations): CanvasLayout {
  const next = defaultLayout(ids, relations);
  for (const library of relations?.libraries ?? []) {
    if (!library.targets.length && relations?.order && Object.hasOwn(layout.positions, library.id)) {
      next.positions[library.id] = layout.positions[library.id]!;
    }
  }
  return { ...next, groups: layout.groups };
}

export function renewedPaths(ids: readonly string[], before: RemovalMarks, after: RemovalMarks): Set<string> {
  return new Set(ids.filter(id => Object.hasOwn(after, id) && before[id] !== after[id]));
}

export function reconcileLayout(layout: CanvasLayout, ids: readonly string[], renewed: ReadonlySet<string> = new Set(),
  relations: LayoutRelations = { edges: [], libraries: [] }): CanvasLayout {
  const current = new Set(ids.filter(id => !renewed.has(id)));
  const missing = ids.filter(id => renewed.has(id) || !Object.hasOwn(layout.positions, id));
  // A re-add must land the same way even if a page already pruned deleted nodes.
  const anchors = renewed.size ? Object.entries(layout.positions).filter(([id]) => current.has(id)).map(([, point]) => point) :
    Object.values(layout.positions);
  const placements = new Map<string, Point>();
  if (missing.length) {
    const { points: ideal } = layeredPositions(ids, relations);
    const linked = new Map(ids.map(id => [id, [] as string[]]));
    const connect = (from: string, to: string) => { linked.get(from)!.push(to); linked.get(to)!.push(from); };
    relations.edges.forEach(({ from, to }) => connect(from, to));
    relations.libraries.forEach(({ id, targets }) => targets.forEach(target => connect(id, target)));
    const pending = new Set(missing);
    const queue = [...ideal.keys()].filter(id => !pending.has(id));
    const occupied = [...anchors];
    function place(id: string, desired: Point) {
      const x = desired.x;
      let y = desired.y;
      while (Math.abs(x) <= coordinateLimit && Math.abs(y) <= coordinateLimit &&
        occupied.some(point => Math.abs(point.x - x) < nodeSize.width + 20 && Math.abs(point.y - y) < nodeSize.height + 20)) y += rowHeight;
      const point = Math.abs(x) <= coordinateLimit && Math.abs(y) <= coordinateLimit ? { x, y } : outsidePoint(occupied);
      placements.set(id, point);
      occupied.push(point);
      pending.delete(id);
      queue.push(id);
    }
    let cursor = 0;
    function extend() {
      while (cursor < queue.length) {
        const anchor = queue[cursor++]!;
        const saved = placements.get(anchor) ?? layout.positions[anchor]!;
        const reference = ideal.get(anchor)!;
        for (const id of linked.get(anchor)!) {
          if (!pending.has(id)) continue;
          const offset = ideal.get(id)!;
          place(id, { x: saved.x + offset.x - reference.x, y: saved.y + offset.y - reference.y });
        }
      }
    }
    extend();
    for (const id of ideal.keys()) {
      if (!pending.has(id)) continue;
      place(id, outsidePoint(occupied));
      extend();
    }
  }
  const positions = Object.fromEntries(ids.map(id => [id, current.has(id) && Object.hasOwn(layout.positions, id) ? layout.positions[id]! :
    placements.get(id)!]));
  const groups = layout.groups.map(group => ({ ...group, members: group.members.filter(id => current.has(id)) }))
    .filter(group => group.members.length);
  return { ...layout, positions, groups };
}

function outsidePoint(existing: Point[]): Point {
  let left = 0, right = 0, top = 0, bottom = 0;
  for (const point of existing) {
    left = Math.min(left, point.x);
    right = Math.max(right, point.x + nodeSize.width);
    top = Math.min(top, point.y);
    bottom = Math.max(bottom, point.y + nodeSize.height);
  }
  if (right + 58 <= coordinateLimit) return { x: right + 58, y: 64 };
  if (left - 270 >= -coordinateLimit) return { x: left - 270, y: 64 };
  if (bottom + 58 <= coordinateLimit) return { x: 30, y: bottom + 58 };
  if (top - 112 >= -coordinateLimit) return { x: 30, y: top - 112 };

  // All four outer sides reach the coordinate limit. Use unoccupied slots in a central column.
  const blocked = new Set<number>();
  for (const point of existing) {
    if (point.x + nodeSize.width <= 30 || point.x >= 30 + nodeSize.width) continue;
    const first = Math.floor((point.y - nodeSize.height - 64) / 112) + 1;
    const last = Math.ceil((point.y + nodeSize.height - 64) / 112) - 1;
    for (let slot = first; slot <= last; slot++) blocked.add(slot);
  }
  let slot = 0;
  while (blocked.has(slot)) slot++;
  return { x: 30, y: 64 + slot * 112 };
}

export function updateGroup(groups: CanvasGroup[], next: CanvasGroup): CanvasGroup[] {
  const assigned = new Set(next.members);
  const previous = groups.map(group => group.id === next.id ? next :
    { ...group, members: group.members.filter(id => !assigned.has(id)) });
  if (!groups.some(group => group.id === next.id)) previous.push(next);
  return previous.filter(group => group.members.length);
}

export function groupBounds(positions: Record<string, Point>, members: readonly string[], sizeOf: (id: string) => Size) {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const id of members) {
    const point = positions[id]!;
    const size = sizeOf(id);
    left = Math.min(left, point.x - 20);
    top = Math.min(top, point.y - 44);
    right = Math.max(right, point.x + size.width + 20);
    bottom = Math.max(bottom, point.y + size.height + 20);
  }
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function moveMembers(positions: Record<string, Point>, members: readonly string[], from: Point, to: Point) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return Object.fromEntries(members.map(id => [id, { x: positions[id]!.x + dx, y: positions[id]!.y + dy }]));
}
