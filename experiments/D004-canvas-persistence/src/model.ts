export interface Point { x: number; y: number }
export interface Graph {
  nodes: { id: string; label: string }[]
  edges: { id: string; source: string; target: string }[]
}
export interface Group { id: string; name: string; members: string[] }
export interface CanvasState {
  graph: Graph
  positions: Record<string, Point>
  groups: Group[]
  viewport: Point & { zoom: number }
}
export interface SavedCanvas { revision: number; state: CanvasState }

export const nodeSize = { width: 170, height: 64 }

function record(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('需要对象')
}
function text(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > 160) throw new Error('需要 1—160 字文本')
}
function id(value: unknown): asserts value is string {
  text(value)
  if (!/^[a-z][a-z0-9-]*$/.test(value)) throw new Error('节点与组标识须使用小写字母数字和短横线')
}
function point(value: unknown): asserts value is Point {
  record(value)
  if (![value.x, value.y].every(v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1e7)) {
    throw new Error('坐标无效')
  }
}
function unique(values: string[]) {
  if (new Set(values).size !== values.length) throw new Error('标识或成员重复')
}

export function validateGraph(value: unknown): asserts value is Graph {
  record(value)
  if (!Array.isArray(value.nodes) || !Array.isArray(value.edges)) throw new Error('需要完整 nodes 和 edges')
  if (value.nodes.length > 100 || value.edges.length > 300) throw new Error('超出小型实验输入范围')
  for (const node of value.nodes) { record(node); id(node.id); text(node.label) }
  const ids = value.nodes.map(node => node.id as string)
  unique(ids)
  for (const edge of value.edges) {
    record(edge); id(edge.id)
    if (!ids.includes(edge.source as string) || !ids.includes(edge.target as string)) throw new Error('连线端点不存在')
  }
  unique(value.edges.map(edge => edge.id as string))
}

export function validateState(value: unknown): asserts value is CanvasState {
  record(value)
  validateGraph(value.graph)
  record(value.positions)
  const ids = value.graph.nodes.map(node => node.id)
  if (Object.keys(value.positions).length !== ids.length) throw new Error('坐标与节点不一致')
  for (const key of ids) {
    if (!Object.hasOwn(value.positions, key)) throw new Error('缺少节点坐标')
    point(value.positions[key])
  }
  if (!Array.isArray(value.groups) || value.groups.length > 100) throw new Error('分组无效')
  const allMembers: string[] = []
  for (const group of value.groups) {
    record(group); id(group.id); text(group.name)
    if (!Array.isArray(group.members) || !group.members.length) throw new Error('空组不能保存')
    for (const member of group.members) {
      if (typeof member !== 'string' || !ids.includes(member)) throw new Error('成员不存在')
      allMembers.push(member)
    }
  }
  unique(value.groups.map(group => group.id as string))
  // shortcut: 本实验单组归属，正式设计确认多组需求时再调整。
  unique(allMembers)
  record(value.viewport)
  const zoom = value.viewport.zoom
  point(value.viewport)
  if (typeof zoom !== 'number' || !Number.isFinite(zoom) || zoom < 0.2 || zoom > 2) throw new Error('缩放无效')
}

export function initialState(graph: Graph): CanvasState {
  validateGraph(graph)
  return {
    graph: structuredClone(graph),
    positions: { a: { x: 100, y: 140 }, b: { x: 420, y: 340 }, c: { x: 280, y: 240 }, d: { x: 740, y: 200 } },
    groups: [{ id: 'reading', name: '读取流程', members: ['a', 'b'] }],
    viewport: { x: 20, y: 20, zoom: 0.85 },
  }
}

export function groupBounds(state: CanvasState, group: Group) {
  const positions = group.members.map(member => state.positions[member])
  const x = Math.min(...positions.map(p => p.x)) - 24
  const y = Math.min(...positions.map(p => p.y)) - 48
  return {
    x, y,
    width: Math.max(...positions.map(p => p.x)) + nodeSize.width + 24 - x,
    height: Math.max(...positions.map(p => p.y)) + nodeSize.height + 24 - y,
  }
}

export function reconcileGraph(state: CanvasState, input: unknown): CanvasState {
  validateGraph(input)
  const graph = structuredClone(input)
  const positions: Record<string, Point> = {}
  const right = Math.max(0, ...Object.values(state.positions).map(p => p.x + nodeSize.width)) + 100
  let added = 0
  for (const node of graph.nodes) {
    positions[node.id] = state.positions[node.id] ?? { x: right, y: 100 + added++ * 110 }
  }
  const groups = state.groups.map(group => ({ ...group, members: group.members.filter(member => Object.hasOwn(positions, member)) }))
    .filter(group => group.members.length)
  return { ...state, graph, positions, groups }
}

export function rearrange(state: CanvasState): CanvasState {
  const positions: Record<string, Point> = {}
  let x = 100
  for (const group of state.groups) {
    group.members.forEach((member, index) => { positions[member] = { x, y: 140 + index * 110 } })
    x += 290
  }
  for (const node of state.graph.nodes) {
    if (!Object.hasOwn(positions, node.id)) { positions[node.id] = { x, y: 140 }; x += 240 }
  }
  return { ...state, positions }
}
