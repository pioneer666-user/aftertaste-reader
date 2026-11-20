<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch, watchPostEffect } from 'vue';
import { Handle, MarkerType, Position, VueFlow, useVueFlow } from '@vue-flow/core';
import type { Edge, Node, NodeDragEvent, ViewportTransform } from '@vue-flow/core';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import './canvas.css';
import DependencyEdge from './DependencyEdge.vue';
import DependencyMiniMap from './DependencyMiniMap.vue';
import DependencyDots from './DependencyDots.vue';
import DependencyCard from './DependencyCard.vue';
import LoopReading from './LoopReading.vue';
import { groupBounds, maxZoom, minZoom, moveMembers, nodeSize, rearrange, reconcileLayout, renewedPaths, updateGroup } from '../core/canvas-layout.js';
import type { CanvasGroup, CanvasLayout, Point } from '../core/canvas-layout.js';
import { canvasIds, isLegendKey, legendKey } from '../core/dependency-graph.js';
import type { LibraryLegend } from '../core/dependency-graph.js';
import type { CanvasReading } from '../application/dependency-canvas.js';
import type { LayoutWrite } from '../application/canvas-layout.js';
import type { LoopCanvasReading } from '../application/loop-reader.js';
import type { ReaderProblem } from '../application/file-reader.js';
import { failed, request } from './reader-api.js';
import { fitFloatingAxis } from './floating-position.js';
import { problemText, translate } from './i18n.js';
import type { Language } from './i18n.js';

const props = defineProps<{ language: Language; active: boolean; loopId?: string }>();
const emit = defineEmits<{ read: [documentPath: string] }>();
const t = (key: string) => translate(props.language, key);
// The parent keys each retained canvas by graph, including its in-flight requests and draft.
const loopRoute = props.loopId ? '/api/loops/' + encodeURIComponent(props.loopId) : '';
const readRoute = loopRoute || '/api/dependency-canvas';
const writeRoute = loopRoute ? loopRoute + '/layout' : '/api/dependency-layout';
const flowId = props.loopId ? 'loop-canvas-' + props.loopId : 'dependency-canvas';
const groupControl = props.loopId ? flowId + '-group' : 'canvas-group';
const { setNodes, setEdges, findNode, updateNode, setViewport, viewport, getNodes, dimensions: paneSize, paneDragging } = useVueFlow({ id: flowId });
const reading = shallowRef<CanvasReading | LoopCanvasReading>();
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
const graphArea = ref<HTMLElement>();
const toolsMenu = ref<HTMLDetailsElement>();
const groupPicker = ref<HTMLSelectElement>();
const groupEditor = ref(false);
const selectionPanel = ref<HTMLElement>();
const selectionInput = ref<HTMLInputElement>();
const box = shallowRef<{ pointer: number; start: Point; end: Point }>();
const boxAnchor = shallowRef<Point>();
const boxMembers = ref<string[]>([]);
const naming = ref(false);
const selectionName = ref('');
const fixedTool = ref<'hand' | 'select'>('hand');
const ctrlHeld = ref(false);
const mapOpen = ref(!window.matchMedia('(max-width: 760px)').matches);
const mapDragging = ref(false);
const dots = ref<InstanceType<typeof DependencyDots>>();
const newGroups = new Set<string>();
const savedGroupName = ref('');
let revision: string | null = null;
let pending: LayoutWrite | undefined;
let dragGroup: { group: CanvasGroup; origin: Point; layout: CanvasLayout } | undefined;

const nodeId = (id: string) => isLegendKey(id) ? id : 'file:' + encodeURIComponent(id);
const groupNodeId = (id: string) => 'group:' + id;
const legendKind = (kind: LibraryLegend['kind']) => t(kind === 'standard' ? 'canvasStandardLibrary' : 'canvasThirdPartyLibrary');
const canSave = computed(() => !!reading.value && !loading.value && !readProblem.value && !reading.value.layoutProblem);
const editable = computed(() => props.active && ready.value && canSave.value);
const idle = computed(() => !dragging.value && !moving.value && !paneDragging.value && !mapDragging.value);
const effectiveTool = computed(() => box.value ? 'select' : paneDragging.value ? 'hand' :
  ctrlHeld.value ? (fixedTool.value === 'hand' ? 'select' : 'hand') : fixedTool.value);
const mapNodes = computed(() => getNodes.value.map(node => ({
  id: node.id, type: node.type ?? '', selected: !!selected.value && node.data.key === selected.value,
  x: node.position.x, y: node.position.y, width: node.dimensions.width, height: node.dimensions.height,
})));
const dotGroups = computed(() => mapNodes.value.filter(node => node.type === 'canvasGroup').map(node => ({
  ...node, id: node.id.slice(6),
})));
const dependency = computed(() => reading.value && 'graph' in reading.value ? reading.value : undefined);
const loop = computed(() => reading.value && 'result' in reading.value ? reading.value.result : undefined);
const nodes = computed(() => loop.value ?
  loop.value.loop.nodes.map(node => ({ key: node.id, label: node.title, entry: node.id === loop.value?.loop.entry })) :
  (dependency.value?.graph.nodes ?? []).map(node => ({ key: node.path, label: node.path, analysis: node.analysis })));
const ids = computed(() => reading.value ? readingIds(reading.value) : []);
const selectedNode = computed(() => dependency.value?.graph.nodes.find(node => node.path === selected.value));
const legends = computed(() => loop.value?.loop.legends ?? dependency.value?.graph.legends ?? []);
const selectedLegend = computed(() => legends.value.find(legend => legendKey(legend.id) === selected.value));
const usedLibraries = computed(() => legends.value.flatMap(legend => {
  const use = legend.uses.find(use => use.path === selected.value);
  return use ? [{ legend, reason: use.reason }] : [];
}));
const hasNodes = computed(() => ids.value.length > 0);
const documentPath = computed(() => dependency.value?.documents.find(entry => entry.sourcePath === selected.value)?.documentPath);
const dependencies = computed(() => dependency.value?.graph.edges.filter(edge => edge.dependent === selected.value) ?? []);
const dependents = computed(() => dependency.value?.graph.edges.filter(edge => edge.dependency === selected.value) ?? []);
const replaceDraft = computed(() => saveProblem.value?.code === 'LAYOUT_CONFLICT');
const refreshDraft = computed(() => dirty.value && (readProblem.value || ['LAYOUT_GRAPH_CHANGED', 'LAYOUT_GRAPH_UNCONFIRMED', 'GRAPH_NOT_FOUND',
  'GRAPH_INVALID', 'GRAPH_READ_FAILED', 'GRAPH_PATH_UNSAFE', 'LOOP_NOT_FOUND', 'LOOP_INVALID', 'LOOP_READ_FAILED',
  'LOOP_PATH_UNSAFE'].includes(saveProblem.value?.code ?? '')));
const problems = computed(() => [readProblem.value, reading.value?.layoutProblem, saveProblem.value]
  .filter((problem): problem is ReaderProblem => !!problem));
const statusKey = computed(() => {
  if (saveProblem.value) return 'canvasSaveFailed';
  if (readProblem.value || reading.value?.layoutProblem) return 'canvasSaveBlocked';
  if (saving.value || dirty.value) return 'canvasSaving';
  if (!idle.value) return 'canvasEditing';
  return revision ? 'canvasSaved' : 'canvasDefault';
});
const showDetails = computed(() => !!selectedNode.value || !!selectedLegend.value);
const selectionRect = computed(() => box.value && rectangle(box.value.start, box.value.end));
const picked = computed(() => new Set(boxMembers.value));
const transfers = computed(() => {
  const labels = new Map(legends.value.map(legend => [legendKey(legend.id), legend.name + ' · ' + legendKind(legend.kind)]));
  return (layout.value?.groups ?? []).flatMap(group =>
    group.members.filter(id => picked.value.has(id)).map(id => ({ id, label: labels.get(id) ?? id, group: group.name })));
});

function dimensions(id: string) {
  const measured = findNode(nodeId(id))?.dimensions;
  return measured?.width && measured.height ? measured : nodeSize;
}

function readingIds(value: CanvasReading | LoopCanvasReading): string[] {
  if ('graph' in value) return canvasIds(value.graph);
  const { reading_order, legends } = value.result.loop;
  return [...reading_order, ...legends.map(legend => legendKey(legend.id))];
}

function render() {
  if (!reading.value || !layout.value) return;
  const current = layout.value;
  setNodes([
    ...current.groups.map((group): Node => {
      const { x, y, width, height } = groupBounds(current.positions, group.members, dimensions);
      return { id: groupNodeId(group.id), type: 'canvasGroup', position: { x, y }, dragHandle: '.group-handle',
        zIndex: -1, data: { name: group.name }, style: { width: width + 'px', height: height + 'px' } };
    }),
    ...nodes.value.map((node): Node => ({
      id: nodeId(node.key), type: 'canvasFile', position: { ...current.positions[node.key]! }, data: node,
      style: { width: nodeSize.width + 'px', height: nodeSize.height + 'px' },
    })),
    ...legends.value.map((legend): Node => ({
      id: legendKey(legend.id), type: 'canvasLegend', position: { ...current.positions[legendKey(legend.id)]! },
      data: { ...legend, key: legendKey(legend.id) },
      style: { width: nodeSize.width + 'px', height: nodeSize.height + 'px' },
    })),
  ]);
  renderEdges();
}

function renderEdges() {
  const edge = (from: string, to: string, reason: string, library = false): Edge => {
    const direct = !loopRoute && (from === selected.value || to === selected.value);
    const muted = !loopRoute && !!selected.value && !direct;
    const color = library ? (direct ? '#675289' : '#817498') : (direct ? '#286347' : '#486357');
    return {
      id: nodeId(from) + '→' + nodeId(to), source: nodeId(from), target: nodeId(to), sourceHandle: 'out',
      targetHandle: from === to ? 'self' : 'in', type: 'dependency', data: { reason, loop: !!loopRoute, direct },
      class: [library && 'library-use-edge', direct && 'direct-relation'].filter(Boolean).join(' '),
      ...(!loopRoute && { style: { stroke: color, strokeWidth: direct ? 2.8 : 1.9, opacity: muted ? .43 : 1 } }),
      markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color },
      ariaLabel: reason,
    };
  };
  const graph = dependency.value?.graph;
  setEdges(graph ? [
    ...graph.edges.map(({ dependency, dependent, reason }) => edge(dependency, dependent, reason)),
    ...legends.value.flatMap(legend => legend.uses.map(use => edge(legendKey(legend.id), use.path, use.reason, true))),
  ].sort((a, b) => Number(a.data.direct) - Number(b.data.direct)) :
    (loop.value?.loop.edges ?? []).map(({ from, to, reason }) => edge(from, to, reason)));
}

watch(selected, () => { if (!loopRoute) renderEdges(); });

async function load(mode: 'normal' | 'refresh' | 'discard' = 'normal') {
  if (loading.value || saving.value || !idle.value || box.value || (dirty.value && mode === 'normal')) return;
  if (!loopRoute) {
    closeTools(true);
    clearSelection();
  }
  const carry = dirty.value && mode === 'refresh' ? layout.value : undefined;
  const beforeRevision = revision;
  loading.value = true;
  try {
    const next = await request<CanvasReading | LoopCanvasReading>(readRoute);
    readProblem.value = undefined;
    if (dirty.value && next.layoutProblem) {
      readProblem.value = next.layoutProblem;
      return;
    }
    if (carry && beforeRevision !== next.revision && pending?.revision !== next.revision) {
      saveProblem.value = { code: 'LAYOUT_CONFLICT', message: '', nextStep: '', context: {} };
      return;
    }
    const ids = readingIds(next);
    if (carry) {
      const accountedFor = new Set([...ids, ...('graph' in next ? next.confirmedRemovals : [])]);
      const unconfirmed = Object.keys(carry.positions).find(path => !accountedFor.has(path));
      if (unconfirmed !== undefined) {
        readProblem.value = { code: 'LAYOUT_GRAPH_UNCONFIRMED', message: '', nextStep: '', context: { field: unconfirmed } };
        return;
      }
    }
    const renewed = 'graph' in next ? renewedPaths(ids, dependency.value?.nodeRemovals ?? {}, next.nodeRemovals) : undefined;
    layout.value = carry ? reconcileLayout(carry, ids, renewed) : next.layout;
    if (!carry) {
      newGroups.clear();
      savedGroupName.value = '';
    }
    reading.value = next;
    revision = next.revision;
    pending = undefined;
    dirty.value = !next.layoutProblem && (!!carry || next.reconciled);
    saveProblem.value = undefined;
    if (!ids.includes(selected.value)) selected.value = loop.value?.loop.entry ?? '';
    editGroup('');
    render();
    if (ready.value) await setViewport(layout.value.viewport);
  } catch (error) { readProblem.value = failed(error); }
  finally { loading.value = false; }
  if (dirty.value) void save();
}

async function init() {
  if (ready.value || !layout.value) return;
  await setViewport(layout.value.viewport);
  ready.value = true;
}

async function save() {
  if (!canSave.value || saving.value || !dirty.value || replaceDraft.value || refreshDraft.value) return;
  saving.value = true;
  saveProblem.value = undefined;
  try {
    while (dirty.value && layout.value && reading.value) {
      const attempt = pending ??= {
        graphVersion: reading.value.graphVersion, expectedRevision: revision, revision: crypto.randomUUID(), layout: layout.value,
      };
      try {
        const result: { revision: string } = await request(writeRoute, {
          method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Aftertaste-Layout': '1' },
          body: JSON.stringify({ ...attempt, layout: { ...attempt.layout, positions: Object.entries(attempt.layout.positions) } }),
        });
        revision = result.revision;
        for (const group of attempt.layout.groups) {
          if (newGroups.delete(group.id) && props.active) {
            dots.value?.ripple(group.id);
            savedGroupName.value = group.name;
          }
        }
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
  savedGroupName.value = '';
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
  if (members.value.length ? !groupName.value.trim() : !groupId.value) return;
  const group = { id: groupId.value || crypto.randomUUID(), name: groupName.value.trim(), members: [...members.value] };
  commitGroup(group);
  editGroup(group.id);
}

function commitGroup(group: CanvasGroup) {
  if (!layout.value) return;
  if (!loopRoute && !layout.value.groups.some(item => item.id === group.id)) newGroups.add(group.id);
  changed({ ...layout.value, groups: updateGroup(layout.value.groups, group) });
  render();
}

function closeTools(restoreFocus = false) {
  if (!toolsMenu.value?.open) return;
  toolsMenu.value.open = false;
  if (restoreFocus) toolsMenu.value.querySelector('summary')?.focus();
}

function outsideTools(event: PointerEvent) {
  if (event.target instanceof Element && !toolsMenu.value?.contains(event.target)) closeTools();
}

function selectDetail(id: string) {
  groupEditor.value = false;
  selected.value = id;
}

async function openGroupEditor(id: string) {
  editGroup(id);
  if (loopRoute) return;
  closeTools();
  clearSelection();
  groupEditor.value = true;
  await nextTick();
  groupPicker.value?.focus({ preventScroll: true });
}

function closeInspector() {
  if (groupEditor.value) groupEditor.value = false;
  else selected.value = '';
  graphArea.value?.focus({ preventScroll: true });
}

function rectangle(start: Point, end: Point) {
  return { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) };
}

function boxPoint(event: PointerEvent, pane: DOMRect): Point {
  return { x: Math.max(0, Math.min(pane.width, event.clientX - pane.left)),
    y: Math.max(0, Math.min(pane.height, event.clientY - pane.top)) };
}

function clearSelection(restoreFocus = false) {
  const pointer = box.value?.pointer;
  box.value = undefined;
  if (pointer !== undefined && graphArea.value?.hasPointerCapture(pointer)) graphArea.value.releasePointerCapture(pointer);
  boxMembers.value = [];
  boxAnchor.value = undefined;
  naming.value = false;
  selectionName.value = '';
  if (restoreFocus) graphArea.value?.focus({ preventScroll: true });
}

function startSelection(event: PointerEvent) {
  const area = graphArea.value;
  const target = event.target;
  if (loopRoute || !area || !(target instanceof Element) || !target.closest('.vue-flow') || event.button !== 0 || box.value) return;
  clearSelection();
  ctrlHeld.value = event.ctrlKey;
  if (!editable.value || !idle.value || effectiveTool.value !== 'select' ||
      target.closest('.vue-flow__node:not(.vue-flow__node-canvasGroup), .group-handle')) return;
  event.preventDefault();
  event.stopPropagation();
  const start = boxPoint(event, area.getBoundingClientRect());
  area.focus({ preventScroll: true });
  area.setPointerCapture(event.pointerId);
  box.value = { pointer: event.pointerId, start, end: start };
}

function moveSelection(event: PointerEvent) {
  const area = graphArea.value;
  if (!area || box.value?.pointer !== event.pointerId) return;
  box.value = { ...box.value, end: boxPoint(event, area.getBoundingClientRect()) };
}

function finishSelection(event: PointerEvent) {
  const area = graphArea.value;
  if (!area || box.value?.pointer !== event.pointerId) return;
  const pane = area.getBoundingClientRect();
  const end = boxPoint(event, pane);
  const bounds = rectangle(box.value.start, end);
  box.value = undefined;
  boxMembers.value = Array.from(area.querySelectorAll<HTMLButtonElement>('.file-node')).flatMap(node => {
    const rect = node.getBoundingClientRect();
    const id = node.dataset.file ?? (node.dataset.legend ? legendKey(node.dataset.legend) : undefined);
    return id && rect.left >= pane.left + bounds.x && rect.top >= pane.top + bounds.y &&
      rect.right <= pane.left + bounds.x + bounds.width && rect.bottom <= pane.top + bounds.y + bounds.height ? [id] : [];
  });
  if (boxMembers.value.length) boxAnchor.value = { x: pane.left + end.x, y: pane.top + end.y };
}

function cancelPointer(event: PointerEvent) {
  if (box.value?.pointer === event.pointerId) clearSelection();
}

async function nameSelection() {
  if (!editable.value || !idle.value || naming.value || !boxMembers.value.length) return;
  naming.value = true;
  await nextTick();
  selectionInput.value?.focus({ preventScroll: true });
}

function applySelection() {
  const name = selectionName.value.trim();
  if (!layout.value || !editable.value || !idle.value || !boxMembers.value.length || !name) return;
  commitGroup({ id: crypto.randomUUID(), name, members: [...boxMembers.value] });
  if (groupEditor.value) {
    if (groupId.value && !layout.value.groups.some(group => group.id === groupId.value)) {
      groupEditor.value = false;
      editGroup('');
    } else {
      members.value = members.value.filter(member => !picked.value.has(member));
    }
  }
  clearSelection(true);
}

function selectionKeys(event: KeyboardEvent) {
  if (loopRoute || !props.active || event.isComposing) return;
  if (event.key === 'Escape' && (box.value || boxAnchor.value)) {
    event.preventDefault();
    event.stopPropagation();
    clearSelection(true);
  } else if (editable.value && idle.value && boxAnchor.value && !naming.value && event.ctrlKey && !event.altKey &&
      !event.shiftKey && !event.metaKey && event.key.toLowerCase() === 'g' &&
      !(event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable]'))) {
    event.preventDefault();
    event.stopPropagation();
    void nameSelection();
  }
}

watch(() => props.active, active => {
  if (active || loopRoute) return;
  ctrlHeld.value = false;
  newGroups.clear();
  savedGroupName.value = '';
  if (mapDragging.value && layout.value) void setViewport(layout.value.viewport);
  mapDragging.value = false;
  clearSelection();
  closeTools();
}, { flush: 'sync' });

function trackControl(event: KeyboardEvent) {
  if (event.key !== 'Control' || !props.active) return;
  const editing = event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable]');
  ctrlHeld.value = event.type === 'keydown' && !editing;
}

function releaseControl() { ctrlHeld.value = false; }

function mapNavigate(next: ViewportTransform, commit: boolean) {
  if (!editable.value) return;
  void setViewport(next);
  if (commit) storeViewport(next);
}

watchPostEffect(onCleanup => {
  const panel = selectionPanel.value;
  const anchor = boxAnchor.value;
  if (!panel || !anchor) return;
  const place = () => {
    panel.style.left = fitFloatingAxis(anchor.x, panel.offsetWidth, window.innerWidth) + 'px';
    panel.style.top = fitFloatingAxis(anchor.y, panel.offsetHeight, window.innerHeight) + 'px';
  };
  place();
  const observer = new ResizeObserver(place);
  observer.observe(panel);
  window.addEventListener('resize', place);
  onCleanup(() => {
    observer.disconnect();
    window.removeEventListener('resize', place);
  });
});

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
    for (const [id, point] of Object.entries(moved)) updateNode(nodeId(id), { position: point });
  } else {
    const id = node.data.key as string;
    const group = layout.value.groups.find(item => item.members.includes(id));
    if (!group) return;
    const positions = { ...layout.value.positions, [id]: node.position };
    const { x, y, width, height } = groupBounds(positions, group.members, dimensions);
    updateNode(groupNodeId(group.id), { position: { x, y }, style: { width: width + 'px', height: height + 'px' } });
  }
}

function endDrag(event: NodeDragEvent) {
  if (!dragging.value || !layout.value) return;
  previewDrag(event);
  const nodes = dragGroup?.group.members ?? [event.node.data.key as string];
  const positions = { ...layout.value.positions, ...Object.fromEntries(nodes.map(id => [id, { ...findNode(nodeId(id))!.position }])) };
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
  storeViewport(desired);
  await setViewport(desired);
}

async function relayout() {
  if (!editable.value || !idle.value || !layout.value || !reading.value) return;
  clearSelection();
  changed(rearrange(layout.value, ids.value));
  render();
  await setViewport(layout.value.viewport);
}

function discardDraft() {
  if (window.confirm(t('canvasDiscardConfirm'))) void load('discard');
}

onMounted(() => {
  if (!loopRoute) {
    window.addEventListener('keydown', trackControl);
    window.addEventListener('keyup', trackControl);
    window.addEventListener('blur', releaseControl);
  }
  void load();
});
onUnmounted(() => {
  window.removeEventListener('keydown', trackControl);
  window.removeEventListener('keyup', trackControl);
  window.removeEventListener('blur', releaseControl);
});
</script>

<template>
  <main :id="loopId ? flowId + '-reading' : 'canvas-reading'" class="canvas-page"
    :class="loopId ? 'loop-canvas' : { 'dependency-canvas': true, 'canvas-active': active }"
    :aria-label="loopId ? undefined : t('dependencyCanvas')" tabindex="-1" @pointerdown.capture="outsideTools">
    <header class="canvas-header">
      <h1 v-if="loopId">{{ loop?.loop.title ?? t('loops') }}</h1>
      <div class="canvas-actions">
        <button v-if="loopId" type="button" :disabled="loading || saving || dirty || !idle" @click="load()">{{ t('canvasRefresh') }}</button>
        <button v-if="hasNodes" type="button" :disabled="!editable || !idle || !!box" @click="relayout">{{ t('canvasRearrange') }}</button>
        <details v-if="!loopId" ref="toolsMenu" class="canvas-tools" @keydown.esc.stop="closeTools(true)">
          <summary>{{ t('canvasTools') }}</summary>
          <div class="canvas-tools-menu">
            <button type="button" :disabled="loading || saving || dirty || !idle || !!box" @click="load()">{{ t('canvasRefresh') }}</button>
            <button type="button" :disabled="!hasNodes || !editable || !idle || !!box" @click="openGroupEditor('')">{{ t('canvasEditGroup') }}</button>
            <p class="canvas-hint">{{ t('canvasGestures') }}</p>
            <p class="canvas-hint">{{ t(legends.length ? 'canvasLibraryDirection' : 'canvasDirection') }}</p>
          </div>
        </details>
      </div>
      <p v-if="loading" role="status" class="canvas-status">{{ t('loading') }}</p>
      <p v-else-if="reading" v-show="loopId || (statusKey !== 'canvasSaved' && statusKey !== 'canvasDefault')" role="status"
        class="canvas-status" data-testid="layout-status" :data-state="statusKey">{{ t(statusKey) }}</p>
      <p v-if="!loopId && savedGroupName && statusKey === 'canvasSaved'" class="canvas-group-saved" role="status">
        {{ t('canvasGroupSaved').replace('{name}', savedGroupName) }}
      </p>
    </header>
    <section v-for="problem in problems" :key="problem.code" class="canvas-problem" role="alert">
      <p>{{ problemText(language, problem).message }} {{ problemText(language, problem).nextStep }}</p>
      <code>{{ problem.code }} {{ problem.context.field }} {{ problem.context.diagnostic }} {{ problem.context.reason }}</code>
    </section>
    <div v-if="dirty && (saveProblem || readProblem)" class="canvas-actions canvas-recovery">
      <button v-if="refreshDraft && !replaceDraft" type="button" :disabled="loading || saving || !idle" @click="load('refresh')">{{ t('canvasRefreshDraft') }}</button>
      <button v-else-if="!replaceDraft" type="button" :disabled="!canSave || saving" @click="save">{{ t('canvasRetrySave') }}</button>
      <button v-if="replaceDraft" type="button" :disabled="loading || saving || !idle" @click="discardDraft">{{ t('canvasLoadSaved') }}</button>
    </div>
    <p v-if="reading && !hasNodes" class="canvas-empty">{{ t('canvasEmpty') }}</p>

    <div v-if="reading" v-show="hasNodes" class="canvas-workspace" :class="{ 'file-detail-open': !loopId && showDetails && !groupEditor }">
      <section ref="graphArea" class="graph-area" :aria-label="t(loopId ? 'loopGraph' : 'dependencyCanvas')"
        :data-tool="loopId ? undefined : effectiveTool"
        :tabindex="loopId ? undefined : 0" @keydown="selectionKeys"
        @pointerdown.capture="startSelection" @pointermove="moveSelection" @pointerup="finishSelection"
        @pointercancel="cancelPointer" @lostpointercapture="cancelPointer">
        <div v-if="boxAnchor" ref="selectionPanel" class="selection-float canvas-group-float">
          <button v-if="!naming" type="button" class="selection-float-action" aria-keyshortcuts="Control+G"
            @click="nameSelection">{{ t('canvasGroups') }}</button>
          <form v-else class="canvas-selection-form" @submit.prevent="applySelection">
            <p>{{ t('canvasSelectionCount').replace('{count}', String(boxMembers.length)) }}</p>
            <label for="canvas-selection-name">{{ t('canvasGroupName') }}</label>
            <input id="canvas-selection-name" ref="selectionInput" v-model="selectionName" maxlength="160" />
            <div v-if="transfers.length" class="canvas-transfers">
              <p>{{ t('canvasTransferSelection') }}</p>
              <ul tabindex="0">
                <li v-for="item in transfers" :key="item.id">{{ item.label }} · {{ item.group }}</li>
              </ul>
            </div>
            <div class="canvas-actions">
              <button type="submit" :disabled="!editable || !idle || !selectionName.trim()">{{ t('canvasConfirmGroup') }}</button>
              <button type="button" @click="clearSelection(true)">{{ t('canvasCancelGroup') }}</button>
            </div>
          </form>
        </div>
        <DependencyDots v-if="!loopId" ref="dots" :active="active && hasNodes" :quiet="!idle || !!box"
          :viewport="viewport" :groups="dotGroups" />
        <VueFlow :id="flowId" :min-zoom="minZoom" :max-zoom="maxZoom" :nodes-connectable="false" :nodes-draggable="editable"
          :pan-activation-key-code="loopId ? 'Space' : fixedTool === 'select' && editable ? 'Control' : null"
          :elements-selectable="false" :delete-key-code="null" :selection-key-code="null" :multi-selection-key-code="null"
          :disable-keyboard-a11y="true" :pan-on-drag="editable" :zoom-on-scroll="editable && !box" :zoom-on-pinch="editable && !box"
          :zoom-on-double-click="false" :prevent-scrolling="editable"
          @init="init" @node-drag-start="startDrag" @node-drag="previewDrag" @node-drag-stop="endDrag"
          @move-start="moving = !paneDragging" @move-end="moved">
          <template #node-canvasFile="{ data }">
            <Handle id="in" type="target" :position="Position.Left" />
            <Handle id="self" class="self-handle" type="target" :position="Position.Top" />
            <DependencyCard v-if="!loopId" :label="data.key" :kind="data.analysis" :data-file="data.key"
              :status="t(data.analysis === 'unreviewed' ? 'canvasReviewPending' : 'canvasReviewed')"
              :aria-pressed="selected === data.key" :data-box-selected="picked.has(data.key) || undefined" @click="selectDetail(data.key)" />
            <button v-else type="button" class="file-node" :data-step="data.key" :aria-pressed="selected === data.key"
              :title="data.label" @click="selectDetail(data.key)">
              <span>{{ data.label }}</span>
              <small v-if="data.entry">{{ t('loopEntry') }}</small>
            </button>
            <Handle id="out" type="source" :position="Position.Right" />
          </template>
          <template #node-canvasLegend="{ data }">
            <DependencyCard v-if="!loopId" :label="data.name" kind="library" :status="legendKind(data.kind)" :data-legend="data.id"
              :aria-pressed="selected === data.key" :data-box-selected="picked.has(data.key) || undefined" @click="selectDetail(data.key)" />
            <button v-else type="button" class="file-node library-node" :data-legend="data.id" :aria-pressed="selected === data.key"
              :title="data.name" @click="selectDetail(data.key)">
              <span>{{ data.name }}</span>
              <small>{{ legendKind(data.kind) }}</small>
            </button>
            <Handle id="out" type="source" :position="Position.Right" />
          </template>
          <template #node-canvasGroup="{ data, id }">
            <div class="group-frame" :data-group="id">
              <button type="button" class="group-handle" :title="data.name" @click="openGroupEditor(id.slice(6))">{{ data.name }}</button>
            </div>
          </template>
          <template #edge-dependency="edge"><DependencyEdge v-bind="edge" /></template>
        </VueFlow>
        <div v-if="selectionRect" class="canvas-selection-rect" aria-hidden="true" :style="{
          left: selectionRect.x + 'px', top: selectionRect.y + 'px',
          width: selectionRect.width + 'px', height: selectionRect.height + 'px',
        }"></div>
        <div :class="{ 'canvas-dock': !loopId }">
          <DependencyMiniMap v-if="!loopId && active && mapOpen" :nodes="mapNodes" :viewport="viewport" :size="paneSize"
            :label="t('canvasMap')" :hint="t('canvasMapHint')" :enabled="editable"
            @dragging="mapDragging = $event" @navigate="mapNavigate" />
          <div class="canvas-zoom">
            <template v-if="!loopId">
              <button type="button" :title="t('canvasMap')" :aria-label="t('canvasMap')" :aria-expanded="mapOpen" @click="mapOpen = !mapOpen">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 5 6-2 6 3 6-2v15l-6 2-6-3-6 2z M9 3v15m6-12v15" /></svg>
              </button>
              <button type="button" :disabled="!editable" :title="t('canvasHand')" :aria-label="t('canvasHand')"
                :aria-pressed="effectiveTool === 'hand'" @click="fixedTool = 'hand'">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 12V7.5a1.5 1.5 0 0 1 3 0V11 4.5a1.5 1.5 0 0 1 3 0V11 5.5a1.5 1.5 0 0 1 3 0V12 8a1.5 1.5 0 0 1 3 0v6c0 4.5-2.5 7-6.5 7-2.7 0-4.2-1.4-5.8-3.6l-3.1-4.2a1.6 1.6 0 0 1 2.3-2.1L7 12Z" /></svg>
              </button>
              <button type="button" :disabled="!editable" :title="t('canvasSelect')" :aria-label="t('canvasSelect')"
                :aria-pressed="effectiveTool === 'select'" @click="fixedTool = 'select'">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3.5 19.5 13l-7 1.1-3.2 6.4z" /></svg>
              </button>
            </template>
            <button type="button" :disabled="!editable || !idle || viewport.zoom <= minZoom" :aria-label="t('canvasZoomOut')" @click="zoom(1 / 1.2)">−</button>
            <output>{{ Math.round(viewport.zoom * 100) }}%</output>
            <button type="button" :disabled="!editable || !idle || viewport.zoom >= maxZoom" :aria-label="t('canvasZoomIn')" @click="zoom(1.2)">+</button>
          </div>
        </div>
      </section>
      <aside v-if="loopId || showDetails || groupEditor" class="canvas-inspector">
        <button v-if="!loopId" type="button" class="canvas-inspector-close" @click="closeInspector">
          {{ t(groupEditor ? 'canvasCloseGroups' : 'canvasCloseDetails') }}
        </button>
        <LoopReading v-if="loop" :reading="loop" :language="language" :selected="selected" @select="selected = $event" />
        <section v-if="selectedNode && !groupEditor" class="canvas-selection" :aria-label="t('canvasSelected')">
          <div class="detail-file">
            <h2>{{ selectedNode.path }}</h2>
            <p>{{ t(selectedNode.analysis === 'unreviewed' ? 'canvasUnreviewed' : dependencies.length || usedLibraries.length ? 'canvasReviewed' : 'canvasNoDependencies') }}</p>
            <button v-if="documentPath" type="button" @click="emit('read', documentPath)">{{ t('canvasRead') }}</button>
            <p v-else>{{ t(dependency?.documentsUnavailable ? 'canvasDocumentsUnavailable' : 'canvasNoDocument') }}</p>
          </div>
          <div v-for="[label, edges] in [['canvasDependencies', dependencies], ['canvasDependents', dependents]] as const" :key="label">
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
          </div>
          <div v-if="usedLibraries.length">
            <h3>{{ t('canvasUsedLibraries') }}</h3>
            <ul class="canvas-relations">
              <li v-for="{ legend, reason } in usedLibraries" :key="legend.id">
                <button type="button" @click="selected = legendKey(legend.id)">{{ legend.name }} · {{ legendKind(legend.kind) }}</button>
                <p>{{ reason }}</p>
              </li>
            </ul>
          </div>
        </section>
        <section v-else-if="selectedLegend && !groupEditor" class="canvas-selection" :aria-label="t('canvasSelectedLibrary')">
          <div class="detail-file">
            <h2>{{ selectedLegend.name }}</h2>
            <p class="canvas-hint">{{ legendKind(selectedLegend.kind) }}</p>
            <p class="library-description">{{ selectedLegend.description }}</p>
          </div>
          <div>
            <h3>{{ t(loopId ? 'loopLibraryFiles' : 'canvasDependents') }}</h3>
            <ul v-if="selectedLegend.uses.length" class="canvas-relations">
              <li v-for="use in selectedLegend.uses" :key="use.path">
                <code v-if="loopId">{{ use.path }}</code>
                <button v-else type="button" @click="selected = use.path">{{ use.path }}</button>
                <p>{{ use.reason }}</p>
              </li>
            </ul>
            <p v-else>{{ t('canvasNoEdges') }}</p>
          </div>
        </section>
        <form v-if="loopId || groupEditor" class="canvas-groups" @submit.prevent="applyGroup">
          <h2>{{ t('canvasGroups') }}</h2>
          <label :for="groupControl + '-picker'">{{ t('canvasEditGroup') }}</label>
          <select :id="groupControl + '-picker'" ref="groupPicker" :value="groupId" :disabled="!editable || !idle"
            @change="editGroup(($event.target as HTMLSelectElement).value)">
            <option value="">{{ t('canvasNewGroup') }}</option>
            <option v-for="group in layout?.groups" :key="group.id" :value="group.id">{{ group.name }}</option>
          </select>
          <label :for="groupControl + '-name'">{{ t('canvasGroupName') }}</label>
          <input :id="groupControl + '-name'" v-model="groupName" maxlength="160" :disabled="!editable || !idle" />
          <fieldset :disabled="!editable || !idle">
            <legend>{{ t('canvasMembers') }}</legend>
            <label v-for="node in nodes" :key="node.key" class="canvas-member">
              <input v-model="members" type="checkbox" :value="node.key" />{{ node.label }}
            </label>
            <label v-for="legend in legends" :key="legendKey(legend.id)" class="canvas-member">
              <input v-model="members" type="checkbox" :value="legendKey(legend.id)" />{{ legend.name }} · {{ legendKind(legend.kind) }}
            </label>
          </fieldset>
          <button type="submit" :disabled="!editable || !idle || (members.length ? !groupName.trim() : !groupId)">{{ t('canvasApplyGroup') }}</button>
          <p class="canvas-hint">{{ t(loopId ? 'canvasGroupHelp' : 'canvasGroupEditorHelp') }}</p>
        </form>
      </aside>
    </div>
  </main>
</template>
