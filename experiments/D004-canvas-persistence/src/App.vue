<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Handle, Position, VueFlow, useVueFlow } from '@vue-flow/core'
import type { NodeDragEvent, ViewportTransform } from '@vue-flow/core'
import { groupBounds, nodeSize, rearrange, reconcileGraph, validateState } from './model.ts'
import type { CanvasState, Point } from './model.ts'

const state = ref<CanvasState>()
const ready = ref(false)
const status = ref('正在读取布局…')
const statusKind = ref('pending')
const error = ref('')
const failWrites = ref(false)
const groupName = ref('')
const selectedMembers = ref<string[]>([])
const { setNodes, setEdges, getNodes, updateNode, setViewport, viewport } = useVueFlow()
const group = computed(() => state.value?.groups[0])
let revision = 0
let generation = 0
let acknowledged = 0
let saving = false
let dragStart: { origin: Point; members: Record<string, Point> } | undefined

async function request(path: string, method = 'GET', body?: unknown) {
  const response = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-D004': 'canvas' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.message ?? `HTTP ${response.status}`)
  return result
}

function renderNodes() {
  const current = state.value!
  setNodes([
    ...current.groups.map(group => {
      const bounds = groupBounds(current, group)
      return {
        id: `group:${group.id}`, type: 'group', position: { x: bounds.x, y: bounds.y },
        data: { label: group.name }, dragHandle: '.group-handle', selectable: false, zIndex: -1,
        style: { width: `${bounds.width}px`, height: `${bounds.height}px` },
      }
    }),
    ...current.graph.nodes.map(node => ({
      id: node.id, type: 'reading', position: { ...current.positions[node.id] }, data: { label: node.label },
      style: { width: `${nodeSize.width}px`, height: `${nodeSize.height}px` },
    })),
  ])
  setEdges(current.graph.edges.map(edge => ({ ...edge, type: 'smoothstep' })))
}

function changed() {
  generation++
  statusKind.value = 'pending'
  status.value = '待保存'
  void save()
}

async function save() {
  if (saving || !state.value) return
  saving = true
  try {
    while (acknowledged < generation) {
      const sending = generation
      const snapshot = JSON.parse(JSON.stringify(state.value)) as CanvasState
      const result = await request('/api/state', 'PUT', { expectedRevision: revision, state: snapshot })
      revision = result.revision
      acknowledged = sending
    }
    statusKind.value = 'saved'
    status.value = `已保存 · 版本 ${revision}`
  } catch (cause) {
    statusKind.value = 'failed'
    status.value = `保存失败 · ${(cause as Error).message}`
  } finally {
    saving = false
  }
}

function startDrag(event: NodeDragEvent) {
  if (!event.node.id.startsWith('group:')) return
  const currentGroup = state.value!.groups.find(group => `group:${group.id}` === event.node.id)!
  const bounds = groupBounds(state.value!, currentGroup)
  dragStart = {
    origin: { x: bounds.x, y: bounds.y },
    members: Object.fromEntries(currentGroup.members.map(id => [id, { ...state.value!.positions[id] }])),
  }
}

function dragging(event: NodeDragEvent) {
  if (dragStart && event.node.id.startsWith('group:')) {
    for (const [id, position] of Object.entries(dragStart.members)) {
      updateNode(id, { position: {
        x: position.x + event.node.position.x - dragStart.origin.x,
        y: position.y + event.node.position.y - dragStart.origin.y,
      } })
    }
  } else {
    state.value!.positions[event.node.id] = { ...event.node.position }
    for (const currentGroup of state.value!.groups) {
      const bounds = groupBounds(state.value!, currentGroup)
      updateNode(`group:${currentGroup.id}`, {
        position: { x: bounds.x, y: bounds.y }, style: { width: `${bounds.width}px`, height: `${bounds.height}px` },
      })
    }
  }
}

function stopDrag(event: NodeDragEvent) {
  dragging(event)
  for (const node of getNodes.value) {
    if (!node.id.startsWith('group:')) state.value!.positions[node.id] = { ...node.position }
  }
  dragStart = undefined
  renderNodes()
  changed()
}

function moved({ flowTransform }: { flowTransform: ViewportTransform }) {
  if (!ready.value) return
  state.value!.viewport = { ...flowTransform }
  changed()
}

function updateGroup() {
  error.value = ''
  const current = state.value!
  const next = { ...current, groups: selectedMembers.value.length
    ? [{ id: 'reading', name: groupName.value.trim(), members: [...selectedMembers.value] }] : [] }
  try { validateState(next) } catch (cause) { error.value = (cause as Error).message; return }
  state.value = next
  renderNodes()
  changed()
}

function updateGraph(action: 'content' | 'add' | 'delete-a' | 'delete-b' | 'invalid') {
  error.value = ''
  const graph = JSON.parse(JSON.stringify(state.value!.graph))
  if (action === 'content') {
    graph.nodes[0].label += '（更新）'
    graph.edges = graph.edges.some((edge: { id: string }) => edge.id === 'cd')
      ? graph.edges.filter((edge: { id: string }) => edge.id !== 'cd')
      : [...graph.edges, { id: 'cd', source: 'c', target: 'd' }]
  }
  if (action === 'add' && !graph.nodes.some((node: { id: string }) => node.id === 'e')) graph.nodes.push({ id: 'e', label: '新增校验节点' })
  if (action.startsWith('delete-')) {
    const id = action.slice(7)
    graph.nodes = graph.nodes.filter((node: { id: string }) => node.id !== id)
    graph.edges = graph.edges.filter((edge: { source: string; target: string }) => edge.source !== id && edge.target !== id)
  }
  if (action === 'invalid') delete graph.edges
  try { state.value = reconcileGraph(state.value!, graph) } catch (cause) { error.value = (cause as Error).message; return }
  selectedMembers.value = group.value?.members.slice() ?? []
  renderNodes()
  changed()
}

async function readFailure() {
  try { await request('/api/graph?fail=1') } catch (cause) { error.value = (cause as Error).message }
}

async function toggleFailure() {
  try {
    const result = await request('/api/failure', 'PUT', { fail: !failWrites.value })
    failWrites.value = result.failWrites
  } catch (cause) { error.value = (cause as Error).message }
}

function relayout() { state.value = rearrange(state.value!); renderNodes(); changed() }
function zoomBy(factor: number) { void setViewport({ ...viewport.value, zoom: Math.min(2, Math.max(0.2, viewport.value.zoom * factor)) }) }

onMounted(async () => {
  try {
    const saved = await request('/api/state')
    validateState(saved.state)
    state.value = saved.state
    revision = saved.revision
    failWrites.value = saved.failWrites
    groupName.value = group.value?.name ?? '读取流程'
    selectedMembers.value = group.value?.members.slice() ?? []
    renderNodes()
    statusKind.value = 'pending'
    status.value = '正在恢复视图…'
  } catch (cause) {
    statusKind.value = 'failed'
    status.value = `读取失败 · ${(cause as Error).message}`
  }
})

async function initialized() {
  if (ready.value) return
  await setViewport(state.value!.viewport)
  ready.value = true
  if (revision === 0) changed()
  else { statusKind.value = 'saved'; status.value = `已保存 · 版本 ${revision}` }
}
</script>

<template>
  <header>
    <h1>回味 · 画布保存实验</h1>
    <p role="status" :class="statusKind" data-testid="save-status">{{ status }}</p>
  </header>
  <main>
    <section class="canvas" aria-label="合成图画布">
      <VueFlow v-if="state" :min-zoom="0.2" :max-zoom="2" :nodes-connectable="false"
        :delete-key-code="null" :selection-key-code="null" :multi-selection-key-code="null"
        :elements-selectable="false" @nodes-initialized="initialized"
        @node-drag-start="startDrag" @node-drag="dragging" @node-drag-stop="stopDrag" @move-end="moved">
        <template #node-group="props"><div class="group-handle" :data-group="props.id">{{ props.data.label }}</div></template>
        <template #node-reading="props">
          <Handle type="target" :position="Position.Left" />
          <div class="reading-node" :data-node="props.id">{{ props.data.label }}</div>
          <Handle type="source" :position="Position.Right" />
        </template>
      </VueFlow>
      <div v-if="ready" class="zoom-controls">
        <button @click="zoomBy(1 / 1.2)" aria-label="缩小">缩小</button>
        <output>{{ Math.round(viewport.zoom * 100) }}%</output>
        <button @click="zoomBy(1.2)" aria-label="放大">放大</button>
      </div>
    </section>
    <aside v-if="state">
      <p class="instruction">拖动节点调整位置。拖动组名移动成员。拖空白平移，滚轮缩放。</p>
      <fieldset :disabled="!ready">
        <legend>分组</legend>
        <label for="group-name">组名</label>
        <input id="group-name" v-model="groupName" maxlength="160" />
        <label v-for="node in state.graph.nodes" :key="node.id" class="member">
          <input v-model="selectedMembers" type="checkbox" :value="node.id" />{{ node.id }} · {{ node.label }}
        </label>
        <button @click="updateGroup">保存组名和成员</button>
      </fieldset>
      <fieldset :disabled="!ready">
        <legend>固定图更新</legend>
        <button @click="updateGraph('content')" :disabled="!state.graph.nodes.some(n => n.id === 'a')">更新文案和边</button>
        <button @click="updateGraph('add')" :disabled="state.graph.nodes.some(n => n.id === 'e')">新增 e</button>
        <button @click="updateGraph('delete-a')" :disabled="!state.positions.a">删除 a</button>
        <button @click="updateGraph('delete-b')" :disabled="!state.positions.b">删除 b</button>
        <button @click="relayout">重新布局（保留分组）</button>
      </fieldset>
      <fieldset :disabled="!ready">
        <legend>失败验证</legend>
        <button @click="toggleFailure">{{ failWrites ? '恢复写入' : '注入写入失败' }}</button>
        <button @click="save">重试保存</button>
        <button @click="readFailure">模拟图读取失败</button>
        <button @click="updateGraph('invalid')">提交不完整图</button>
      </fieldset>
      <p v-if="error" role="alert">{{ error }}</p>
      <p v-if="failWrites" class="failed">写入失败注入已开启</p>
      <details><summary>当前布局数据</summary><pre data-testid="state">{{ JSON.stringify(state, null, 2) }}</pre></details>
    </aside>
  </main>
</template>
