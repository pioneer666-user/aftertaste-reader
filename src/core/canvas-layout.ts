import { isSourcePath } from './source-path.js';
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

export function parseLayout(value: unknown, source: 'file' | 'request' = 'file'): CanvasLayout {
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
    if (!isSourcePath(id)) invalid(field);
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

export function defaultLayout(ids: readonly string[]): CanvasLayout {
  return rearrange({ positions: {}, groups: [], viewport: { x: 0, y: 0, zoom: 1 } }, ids);
}

export function rearrange(layout: CanvasLayout, ids: readonly string[]): CanvasLayout {
  const grouped = new Set(layout.groups.flatMap(group => group.members));
  const columns = [...layout.groups.map(group => group.members), ...ids.filter(id => !grouped.has(id)).map(id => [id])];
  const entries: [string, Point][] = [];
  let y = 64;
  for (let row = 0; row < columns.length; row += 3) {
    const blocks = columns.slice(row, row + 3);
    blocks.forEach((block, col) => block.forEach((id, index) => {
      entries.push([id, { x: 30 + col * 270, y: y + index * 112 }]);
    }));
    y += Math.max(...blocks.map(block => block.length)) * 112 + 36;
  }
  return { ...layout, positions: Object.fromEntries(entries), viewport: { x: 0, y: 0, zoom: 1 } };
}

export function renewedPaths(ids: readonly string[], before: RemovalMarks, after: RemovalMarks): Set<string> {
  return new Set(ids.filter(id => Object.hasOwn(after, id) && before[id] !== after[id]));
}

export function reconcileLayout(layout: CanvasLayout, ids: readonly string[], renewed: ReadonlySet<string> = new Set()): CanvasLayout {
  const current = new Set(ids.filter(id => !renewed.has(id)));
  const missing = ids.filter(id => renewed.has(id) || !Object.hasOwn(layout.positions, id));
  // A re-add must land the same way even if a page already pruned deleted nodes.
  const anchors = renewed.size ? Object.entries(layout.positions).filter(([id]) => current.has(id)).map(([, point]) => point) :
    Object.values(layout.positions);
  const placements = placeNewNodes(anchors, missing);
  const positions = Object.fromEntries(ids.map(id => [id, current.has(id) && Object.hasOwn(layout.positions, id) ? layout.positions[id]! :
    placements.get(id)!]));
  const groups = layout.groups.map(group => ({ ...group, members: group.members.filter(id => current.has(id)) }))
    .filter(group => group.members.length);
  return { ...layout, positions, groups };
}

function placeNewNodes(existing: Point[], ids: string[]): Map<string, Point> {
  if (!ids.length) return new Map();
  let left = 0, right = 0, top = 0, bottom = 0;
  for (const point of existing) {
    left = Math.min(left, point.x);
    right = Math.max(right, point.x + nodeSize.width);
    top = Math.min(top, point.y);
    bottom = Math.max(bottom, point.y + nodeSize.height);
  }
  const column = (x: number, y: number) => new Map(ids.map((id, i) => [id, { x, y: y + i * 112 }]));
  if (right + 58 <= coordinateLimit) return column(right + 58, 64);
  if (left - 270 >= -coordinateLimit) return column(left - 270, 64);
  if (bottom + 58 + ids.length * 112 <= coordinateLimit) return column(30, bottom + 58);
  if (top - 58 - ids.length * 112 >= -coordinateLimit) return column(30, top - 58 - ids.length * 112);

  // All four outer sides reach the coordinate limit. Use unoccupied slots in a central column.
  const blocked = new Set<number>();
  for (const point of existing) {
    if (point.x + nodeSize.width <= 30 || point.x >= 30 + nodeSize.width) continue;
    const first = Math.floor((point.y - nodeSize.height - 64) / 112) + 1;
    const last = Math.ceil((point.y + nodeSize.height - 64) / 112) - 1;
    for (let slot = first; slot <= last; slot++) blocked.add(slot);
  }
  let slot = 0;
  return new Map(ids.map(id => {
    while (blocked.has(slot)) slot++;
    return [id, { x: 30, y: 64 + slot++ * 112 }];
  }));
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
