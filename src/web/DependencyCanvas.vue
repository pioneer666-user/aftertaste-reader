<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue';
import { Handle, MarkerType, Position, VueFlow, useVueFlow } from '@vue-flow/core';
import type { Edge, Node, NodeDragEvent, ViewportTransform } from '@vue-flow/core';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import './canvas.css';
import DependencyEdge from './DependencyEdge.vue';
import { groupBounds, maxZoom, minZoom, moveMembers, nodeSize, rearrange, reconcileLayout, updateGroup } from '../core/canvas-layout.js';
import type { CanvasGroup, CanvasLayout, Point } from '../core/canvas-layout.js';
import type { CanvasReading, LayoutWrite } from '../application/dependency-canvas.js';
import type { ReaderProblem } from '../application/file-reader.js';
import { failed, request } from './reader-api.js';
import { problemText, translate } from './i18n.js';
import type { Language } from './i18n.js';

const props = defineProps<{ language: Language }>();
const emit = defineEmits<{ read: [documentPath: string] }>();
const t = (key: string) => translate(props.language, key);
const { setNodes, setEdges, findNode, updateNode, setViewport, viewport } = useVueFlow();
const reading = shallowRef<CanvasReading>();
const layout = shallowRef<CanvasLayout>();
const selected = ref('');
const groupId = ref('');
const groupName = ref('');
const members = ref<string[]>([]);
const loading = ref(false);
const ready = ref(false);
const dirty = ref(false);
const saving = ref(false);
const moving = ref(false);
const dragging = ref(false);
const readProblem = ref<ReaderProblem>();
const saveProblem = ref<ReaderProblem>();
let revision: string | null = null;
let pending: LayoutWrite | undefined;
let dragGroup: { group: CanvasGroup; origin: Point; layout: CanvasLayout } | undefined;

const fileId = (path: string) => 'file:' + encodeURIComponent(path);
const groupNodeId = (id: string) => 'group:' + id;
const editable = computed(() => ready.value && !loading.value && !readProblem.value && !reading.value?.layoutProblem);
const idle = computed(() => !dragging.value && !moving.value);
const selectedNode = computed(() => reading.value?.graph.nodes.find(node => node.path === selected.value));
const documentPath = computed(() => reading.value?.documents.find(entry => entry.sourcePath === selected.value)?.documentPath);
const dependencies = computed(() => reading.value?.graph.edges.filter(edge => edge.dependent === selected.value) ?? []);
const dependents = computed(() => reading.value?.graph.edges.filter(edge => edge.dependency === selected.value) ?? []);
const replaceDraft = computed(() => saveProblem.value?.code === 'LAYOUT_CONFLICT');
const refreshDraft = computed(() => dirty.value && (readProblem.value || ['LAYOUT_GRAPH_CHANGED', 'LAYOUT_GRAPH_UNCONFIRMED', 'GRAPH_NOT_FOUND',
  'GRAPH_INVALID', 'GRAPH_READ_FAILED', 'GRAPH_PATH_UNSAFE'].includes(saveProblem.value?.code ?? '')));
const problems = computed(() => [readProblem.value, reading.value?.layoutProblem, saveProblem.value]
  .filter((problem): problem is ReaderProblem => !!problem));
const statusKey = computed(() => {
  if (saveProblem.value) return 'canvasSaveFailed';
  if (readProblem.value || reading.value?.layoutProblem) return 'canvasSaveBlocked';
  if (saving.value || dirty.value) return 'canvasSaving';
  if (!idle.value) return 'canvasEditing';
  return revision ? 'canvasSaved' : 'canvasDefault';
});

function dimensions(path: string) {
  const measured = findNode(fileId(path))?.dimensions;
  return measured?.width && measured.height ? measured : nodeSize;
}

function render() {
  if (!reading.value || !layout.value) return;
  const { graph } = reading.value;
  const current = layout.value;
  setNodes([
    ...current.groups.map((group): Node => {
      const { x, y, width, height } = groupBounds(current.positions, group.members, dimensions);
      return { id: groupNodeId(group.id), type: 'canvasGroup', position: { x, y }, dragHandle: '.group-handle',
        zIndex: -1, data: { name: group.name }, style: { width: width + 'px', height: height + 'px' } };
    }),
    ...graph.nodes.map((node): Node => ({
      id: fileId(node.path), type: 'canvasFile', position: { ...current.positions[node.path]! }, data: node,
      style: { width: nodeSize.width + 'px', height: nodeSize.height + 'px' },
    })),
  ]);
  setEdges(graph.edges.map((edge): Edge => ({
    id: fileId(edge.dependency) + '→' + fileId(edge.dependent),
    source: fileId(edge.dependency), target: fileId(edge.dependent), sourceHandle: 'out',
    targetHandle: edge.dependency === edge.dependent ? 'self' : 'in', type: 'dependency',
    data: edge, markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: '#486357' },
  })));
}

async function load(mode: 'normal' | 'refresh' | 'discard' = 'normal') {
  if (loading.value || saving.value || !idle.value || (dirty.value && mode === 'normal')) return;
  const carry = dirty.value && mode === 'refresh' ? layout.value : undefined;
  const beforeRevision = revision;
  loading.value = true;
  try {
    const next = await request<CanvasReading>('/api/dependency-canvas');
    readProblem.value = undefined;
    if (dirty.value && next.layoutProblem) {
      readProblem.value = next.layoutProblem;
      return;
    }
    if (carry && beforeRevision !== next.revision && pending?.revision !== next.revision) {
      saveProblem.value = { code: 'LAYOUT_CONFLICT', message: '', nextStep: '', context: {} };
      return;
    }
    const ids = next.graph.nodes.map(node => node.path);
    if (carry) {
      const accountedFor = new Set([...ids, ...next.confirmedRemovals]);
      const unconfirmed = Object.keys(carry.positions).find(path => !accountedFor.has(path));
      if (unconfirmed !== undefined) {
        readProblem.value = { code: 'LAYOUT_GRAPH_UNCONFIRMED', message: '', nextStep: '', context: { field: unconfirmed } };
        return;
      }
    }
    reading.value = next;
    revision = next.revision;
    pending = undefined;
    layout.value = carry ? reconcileLayout(carry, ids) : next.layout;
    dirty.value = !next.layoutProblem && (!!carry || next.reconciled);
    saveProblem.value = undefined;
    if (!next.graph.nodes.some(node => node.path === selected.value)) selected.value = '';
    editGroup('');
    render();
    if (ready.value) await setViewport(layout.value.viewport);
  } catch (error) { readProblem.value = failed(error); }
  finally { loading.value = false; }
  if (dirty.value && editable.value) void save();
}

async function init() {
  if (ready.value || !layout.value) return;
  await setViewport(layout.value.viewport);
  ready.value = true;
  if (dirty.value) void save();
}

async function save() {
  if (!editable.value || saving.value || !dirty.value || replaceDraft.value || refreshDraft.value) return;
  saving.value = true;
  saveProblem.value = undefined;
  try {
    while (dirty.value && layout.value && reading.value) {
      const attempt = pending ??= {
        graphVersion: reading.value.graphVersion, expectedRevision: revision, revision: crypto.randomUUID(), layout: layout.value,
      };
      try {
        const result: { revision: string } = await request('/api/dependency-layout', {
          method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Aftertaste-Layout': '1' },
          body: JSON.stringify(attempt),
        });
        revision = result.revision;
        pending = undefined;
        dirty.value = layout.value !== attempt.layout;
      } catch (error) {
        const problem = failed(error);
        if (problem.code === 'LAYOUT_INVALID') {
          pending = undefined;
          if (layout.value !== attempt.layout) continue;
        }
        saveProblem.value = problem;
        break;
      }
    }
  } finally { saving.value = false; }
}

function changed(next: CanvasLayout) {
  layout.value = next;
  dirty.value = true;
  if (saveProblem.value?.code === 'LAYOUT_INVALID') saveProblem.value = undefined;
  if (!saveProblem.value) void save();
}

function editGroup(id: string) {
  const group = layout.value?.groups.find(item => item.id === id);
  groupId.value = group?.id ?? '';
  groupName.value = group?.name ?? '';
  members.value = group ? [...group.members] : [];
}

function applyGroup() {
  if (!layout.value || !editable.value || !idle.value) return;
  if (members.value.length && !groupName.value.trim()) return;
  const group = { id: groupId.value || crypto.randomUUID(), name: groupName.value.trim(), members: [...members.value] };
  changed({ ...layout.value, groups: updateGroup(layout.value.groups, group) });
  editGroup(group.id);
  render();
}

function startDrag({ node }: NodeDragEvent) {
  if (!editable.value || !layout.value) return;
  dragging.value = true;
  const group = layout.value.groups.find(item => groupNodeId(item.id) === node.id);
  if (group) dragGroup = { group, origin: { ...node.position }, layout: layout.value };
}

function previewDrag({ node }: NodeDragEvent) {
  if (!dragging.value || !layout.value) return;
  if (dragGroup) {
    const moved = moveMembers(dragGroup.layout.positions, dragGroup.group.members, dragGroup.origin, node.position);
    for (const [id, point] of Object.entries(moved)) updateNode(fileId(id), { position: point });
  } else {
    const path = node.data.path as string;
    const group = layout.value.groups.find(item => item.members.includes(path));
    if (!group) return;
    const positions = { ...layout.value.positions, [path]: node.position };
    const { x, y, width, height } = groupBounds(positions, group.members, dimensions);
    updateNode(groupNodeId(group.id), { position: { x, y }, style: { width: width + 'px', height: height + 'px' } });
  }
}

function endDrag(event: NodeDragEvent) {
  if (!dragging.value || !layout.value) return;
  previewDrag(event);
  const nodes = dragGroup?.group.members ?? [event.node.data.path as string];
  const positions = { ...layout.value.positions, ...Object.fromEntries(nodes.map(id => [id, { ...findNode(fileId(id))!.position }])) };
  dragGroup = undefined;
  dragging.value = false;
  changed({ ...layout.value, positions });
  render();
}

function storeViewport(next: ViewportTransform) {
  if (!editable.value || !layout.value) return;
  const current = layout.value.viewport;
  if (current.x !== next.x || current.y !== next.y || current.zoom !== next.zoom) {
    changed({ ...layout.value, viewport: { ...next } });
  }
}

function moved({ flowTransform }: { flowTransform: ViewportTransform }) {
  moving.value = false;
  storeViewport(flowTransform);
}

async function zoom(factor: number) {
  if (!editable.value || !idle.value) return;
  const desired = { ...viewport.value, zoom: Math.min(maxZoom, Math.max(minZoom, viewport.value.zoom * factor)) };
  await setViewport(desired);
  storeViewport(viewport.value);
}

async function relayout() {
  if (!editable.value || !idle.value || !layout.value || !reading.value) return;
  changed(rearrange(layout.value, reading.value.graph.nodes.map(node => node.path)));
  render();
  await setViewport(layout.value.viewport);
}

function discardDraft() {
  if (window.confirm(t('canvasDiscardConfirm'))) void load('discard');
}

onMounted(() => void load());
</script>

<template>
  <main id="canvas-reading" class="canvas-page" tabindex="-1">
    <header class="canvas-header">
      <h1>{{ t('dependencyCanvas') }}</h1>
      <div class="canvas-actions">
        <button type="button" :disabled="loading || saving || dirty || !idle" @click="load()">{{ t('canvasRefresh') }}</button>
        <button v-if="reading?.graph.nodes.length" type="button" :disabled="!editable || !idle" @click="relayout">{{ t('canvasRearrange') }}</button>
      </div>
    </header>
    <p v-if="loading" role="status" class="canvas-status">{{ t('loading') }}</p>
    <p v-else-if="reading" role="status" class="canvas-status" data-testid="layout-status">{{ t(statusKey) }}</p>
    <section v-for="problem in problems" :key="problem.code" class="canvas-problem" role="alert">
      <p>{{ problemText(language, problem).message }} {{ problemText(language, problem).nextStep }}</p>
      <code>{{ problem.code }} {{ problem.context.field }} {{ problem.context.diagnostic }} {{ problem.context.reason }}</code>
    </section>
    <div v-if="dirty && (saveProblem || readProblem)" class="canvas-actions canvas-recovery">
      <button v-if="refreshDraft && !replaceDraft" type="button" :disabled="loading || saving || !idle" @click="load('refresh')">{{ t('canvasRefreshDraft') }}</button>
      <button v-else-if="!replaceDraft" type="button" :disabled="!editable || saving" @click="save">{{ t('canvasRetrySave') }}</button>
      <button v-if="replaceDraft" type="button" :disabled="loading || saving || !idle" @click="discardDraft">{{ t('canvasLoadSaved') }}</button>
    </div>
    <p v-if="reading && !reading.graph.nodes.length" class="canvas-empty">{{ t('canvasEmpty') }}</p>

    <div v-if="reading" v-show="reading.graph.nodes.length" class="canvas-workspace">
      <section class="graph-area" :aria-label="t('dependencyCanvas')">
        <VueFlow :min-zoom="minZoom" :max-zoom="maxZoom" :nodes-connectable="false" :nodes-draggable="editable"
          :elements-selectable="false" :delete-key-code="null" :selection-key-code="null" :multi-selection-key-code="null"
          :disable-keyboard-a11y="true" :pan-on-drag="editable" :zoom-on-scroll="editable" :zoom-on-pinch="editable"
          :zoom-on-double-click="false" :prevent-scrolling="editable"
          @init="init" @node-drag-start="startDrag" @node-drag="previewDrag" @node-drag-stop="endDrag"
          @move-start="moving = true" @move-end="moved">
          <template #node-canvasFile="{ data }">
            <Handle id="in" type="target" :position="Position.Left" />
            <Handle id="self" class="self-handle" type="target" :position="Position.Top" />
            <button type="button" class="file-node" :data-file="data.path"
              :aria-pressed="selected === data.path" :title="data.path" @click="selected = data.path">
              <span>{{ data.path }}</span>
              <small>{{ t(data.analysis === 'unreviewed' ? 'canvasUnreviewed' : 'canvasReviewed') }}</small>
            </button>
            <Handle id="out" type="source" :position="Position.Right" />
          </template>
          <template #node-canvasGroup="{ data, id }">
            <div class="group-frame" :data-group="id">
              <button type="button" class="group-handle" :title="data.name" @click="editGroup(id.slice(6))">{{ data.name }}</button>
            </div>
          </template>
          <template #edge-dependency="edge"><DependencyEdge v-bind="edge" /></template>
        </VueFlow>
        <div class="canvas-zoom">
          <button type="button" :disabled="!editable || !idle || viewport.zoom <= minZoom" :aria-label="t('canvasZoomOut')" @click="zoom(1 / 1.2)">−</button>
          <output>{{ Math.round(viewport.zoom * 100) }}%</output>
          <button type="button" :disabled="!editable || !idle || viewport.zoom >= maxZoom" :aria-label="t('canvasZoomIn')" @click="zoom(1.2)">+</button>
        </div>
      </section>
      <aside class="canvas-inspector">
        <p class="canvas-hint">{{ t('canvasDirection') }}</p>
        <section v-if="selectedNode" class="canvas-selection" :aria-label="t('canvasSelected')">
          <h2>{{ selectedNode.path }}</h2>
          <p>{{ t(selectedNode.analysis === 'unreviewed' ? 'canvasUnreviewed' : dependencies.length ? 'canvasReviewed' : 'canvasNoDependencies') }}</p>
          <button v-if="documentPath" type="button" @click="emit('read', documentPath)">{{ t('canvasRead') }}</button>
          <p v-else>{{ t(reading.documentsUnavailable ? 'canvasDocumentsUnavailable' : 'canvasNoDocument') }}</p>
          <template v-for="[label, edges] in [['canvasDependencies', dependencies], ['canvasDependents', dependents]] as const" :key="label">
            <h3>{{ t(label) }}</h3>
            <ul v-if="edges.length" class="canvas-relations">
              <li v-for="edge in edges" :key="edge.dependency + '→' + edge.dependent">
                <button type="button" @click="selected = label === 'canvasDependencies' ? edge.dependency : edge.dependent">
                  {{ label === 'canvasDependencies' ? edge.dependency : edge.dependent }}
                </button>
                <p>{{ edge.reason }}</p>
              </li>
            </ul>
            <p v-else>{{ t('canvasNoEdges') }}</p>
          </template>
        </section>
        <p v-else class="canvas-hint">{{ t('canvasChoose') }}</p>

        <form class="canvas-groups" @submit.prevent="applyGroup">
          <h2>{{ t('canvasGroups') }}</h2>
          <label for="canvas-group-picker">{{ t('canvasEditGroup') }}</label>
          <select id="canvas-group-picker" :value="groupId" :disabled="!editable || !idle"
            @change="editGroup(($event.target as HTMLSelectElement).value)">
            <option value="">{{ t('canvasNewGroup') }}</option>
            <option v-for="group in layout?.groups" :key="group.id" :value="group.id">{{ group.name }}</option>
          </select>
          <label for="canvas-group-name">{{ t('canvasGroupName') }}</label>
          <input id="canvas-group-name" v-model="groupName" maxlength="160" :disabled="!editable || !idle" />
          <fieldset :disabled="!editable || !idle">
            <legend>{{ t('canvasMembers') }}</legend>
            <label v-for="node in reading.graph.nodes" :key="node.path" class="canvas-member">
              <input v-model="members" type="checkbox" :value="node.path" />{{ node.path }}
            </label>
          </fieldset>
          <button type="submit" :disabled="!editable || !idle || (members.length ? !groupName.trim() : !groupId)">{{ t('canvasApplyGroup') }}</button>
          <p class="canvas-hint">{{ t('canvasGroupHelp') }}</p>
        </form>
      </aside>
    </div>
  </main>
</template>
