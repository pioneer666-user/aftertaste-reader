import { isSourcePath } from './source-path.js';

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
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1e9) invalid(field);
  return value;
}

export function parseLayout(value: unknown): CanvasLayout {
  const { positions, groups, viewport } = layoutObject(value, ['positions', 'groups', 'viewport'], '$.layout');
  if (!positions || typeof positions !== 'object' || Array.isArray(positions)) invalid('$.layout.positions');
  const entries = Object.entries(positions).map(([id, value]) => {
    const field = `$.layout.positions[${JSON.stringify(id)}]`;
    if (!isSourcePath(id)) invalid(field);
    const { x, y } = layoutObject(value, ['x', 'y'], field);
    return [id, { x: coordinate(x, field + '.x'), y: coordinate(y, field + '.y') }] as const;
  });
  const coordinates = Object.fromEntries(entries);
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

export function reconcileLayout(layout: CanvasLayout, ids: readonly string[]): CanvasLayout {
  const current = new Set(ids);
  const right = Object.values(layout.positions).reduce((max, point) => Math.max(max, point.x + nodeSize.width), 0);
  let added = 0;
  const positions = Object.fromEntries(ids.map(id => [id, Object.hasOwn(layout.positions, id) ? layout.positions[id]! :
    { x: right + 58, y: 64 + added++ * 112 }]));
  const groups = layout.groups.map(group => ({ ...group, members: group.members.filter(id => current.has(id)) }))
    .filter(group => group.members.length);
  return { ...layout, positions, groups };
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
