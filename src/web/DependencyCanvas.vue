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
import LoopRelations from './LoopRelations.vue';
import LoopReading from './LoopReading.vue';
import { groupBounds, maxZoom, minZoom, moveMembers, nodeSize, rearrange, reconcileLayout, renewedPaths, updateGroup } from '../core/canvas-layout.js';
import type { CanvasGroup, CanvasLayout, Point } from '../core/canvas-layout.js';
import { canvasIds, isLegendKey, legendKey } from '../core/dependency-graph.js';
import type { LibraryLegend } from '../core/dependency-graph.js';
import type { CanvasReading } from '../application/dependency-canvas.js';
import type { LayoutWrite } from '../application/canvas-layout.js';
import type { LoopCanvasReading, LoopEntry, LoopRoute } from '../application/loop-reader.js';
import type { ReaderProblem } from '../application/file-reader.js';
import { failed, request } from './reader-api.js';
import { fitFloatingAxis } from './floating-position.js';
import { problemText, translate } from './i18n.js';
import type { Language } from './i18n.js';
import type { CanvasPosition } from './canvas-position.js';

const props = defineProps<{
  language: Language; active: boolean; loopId?: string; routeChoice?: Pick<LoopEntry, 'id' | 'title'> | undefined; toolsCovered?: boolean; openingDocument?: string;
}>();
const emit = defineEmits<{ read: [documentPath: string]; readRoute: []; clearRoute: [] }>();
const t = (key: string) => translate(props.language, key);
// The parent keys each retained canvas by graph, including its in-flight requests and draft.
const loopRoute = props.loopId ? '/api/loops/' + encodeURIComponent(props.loopId) : '';
const readRoute = loopRoute || '/api/dependency-canvas';
const writeRoute = loopRoute ? loopRoute + '/layout' : '/api/dependency-layout';
const flowId = props.loopId ? 'loop-canvas-' + props.loopId : 'dependency-canvas';
const groupControl = props.loopId ? flowId + '-group' : 'canvas-group';
const { setNodes, setEdges, findNode, updateNode, setViewport, viewport, getNodes, getEdges, dimensions: paneSize, paneDragging } = useVueFlow({ id: flowId });
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
const toolsRail = ref<HTMLElement>();
const labelsDismissed = ref(false);
const detailHeading = ref<HTMLElement>();
const inspector = ref<HTMLElement>();
const groupTrigger = shallowRef<HTMLElement>();
const selectedEdgeId = ref('');
const selectedEdge = computed(() => getEdges.value.find(edge => edge.id === selectedEdgeId.value));
const route = shallowRef<LoopRoute>();
const routeProblem = ref<ReaderProblem>();
watch(() => props.routeChoice, async (choice, _, onCleanup) => {
  route.value = undefined;
  routeProblem.value = undefined;
  if (!choice) return;
  const controller = new AbortController();
  onCleanup(() => controller.abort());
  try {
    const result = await request<LoopRoute>('/api/loops/' + encodeURIComponent(choice.id) + '/route', { signal: controller.signal });
    if (!controller.signal.aborted) route.value = result;
  } catch (error) {
    if (!controller.signal.aborted) routeProblem.value = failed(error);
  }
}, { immediate: true, flush: 'sync' });
const panelOpen = ref(false);
const groupMenu = ref<HTMLElement>();
const menuGroup = ref<CanvasGroup>();
const groupNameInput = ref<HTMLInputElement>();
const memberFields = ref<HTMLFieldSetElement>();
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
const savedGroupId = ref('');
const savedGroupName = computed(() => layout.value?.groups.find(group => group.id === savedGroupId.value)?.name);
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
const routeIssue = computed(() => {
  if (!route.value) return '';
  const graph = dependency.value?.graph;
  if (!graph || readProblem.value) return t('routeGraphUnavailable');
  if (graph.source_commit !== route.value.source_commit) {
    return [t('routeVersion'), route.value.source_commit, '≠', graph.source_commit].join(' ');
  }
  const problem = route.value.mappingProblem;
  if (problem) {
    const message = problemText(props.language, problem).message;
    return problem.code === 'LOOP_PREFIX_MISMATCH'
      ? [message, problem.context.saved || '.', '≠', problem.context.current || '.'].join(' ')
      : message;
  }
  const paths = new Set(graph.nodes.map(node => node.path));
  const missing = route.value.paths.filter(path => !paths.has(path));
  return missing.length ? t('routeMissing') + ' · ' + missing.join(', ') : '';
});
const routeFiles = computed(() => new Set(routeIssue.value ? [] : route.value?.paths));
const loop = computed(() => reading.value && 'result' in reading.value ? reading.value.result : undefined);
const stepNavigation = computed(() => {
  const graph = loop.value?.loop;
  if (!graph) return [];
  const index = graph.reading_order.indexOf(selected.value);
  const actions = [{ key: 'entry', label: 'loopEntry', id: graph.entry }];
  if (index >= 0) actions.push(
    { key: 'previous', label: 'loopPrevious', id: graph.reading_order[index - 1] ?? '' },
    { key: 'next', label: 'loopNext', id: graph.reading_order[index + 1] ?? '' },
  );
  return actions.map(action => ({ ...action, title: [t(action.label), graph.nodes.find(node => node.id === action.id)?.title].filter(Boolean).join(' · ') }));
});
const nodes = computed(() => loop.value ?
  loop.value.loop.nodes.map(node => ({ key: node.id, label: node.title, entry: node.id === loop.value?.loop.entry,
    order: loop.value?.loop.reading_order.indexOf(node.id) ?? -1 })) :
  (dependency.value?.graph.nodes ?? []).map(node => ({ key: node.path, label: node.path, analysis: node.analysis })));
const ids = computed(() => reading.value ? readingIds(reading.value) : []);
const selectedNode = computed(() => dependency.value?.graph.nodes.find(node => node.path === selected.value));
const selectedFileName = computed(() => {
  const path = selectedNode.value?.path;
  if (!path) return '';
  const name = basename(path);
  return dependency.value?.graph.nodes.some(node => node.path !== path && basename(node.path) === name) ? path : name;
});
const legends = computed(() => loop.value?.loop.legends ?? dependency.value?.graph.legends ?? []);
const selectedLegend = computed(() => legends.value.find(legend => legendKey(legend.id) === selected.value));
const usedLibraries = computed(() => legends.value.filter(legend => legend.uses.some(use => use.path === selected.value)));
const hasNodes = computed(() => ids.value.length > 0);
const documentPath = computed(() => dependency.value?.documents.find(entry => entry.sourcePath === selected.value)?.documentPath);
const readingExplanation = computed(() => !!documentPath.value && props.openingDocument === documentPath.value);
const dependencies = computed(() => dependency.value?.graph.edges.filter(edge => edge.dependent === selected.value) ?? []);
const dependents = computed(() => dependency.value?.graph.edges.filter(edge => edge.dependency === selected.value) ?? []);
const fileRelations = computed(() => [
  { summary: 'canvasSummaryDependencies', items: dependencies.value.map(edge => edge.dependency) },
  { summary: 'canvasSummaryDependents', items: dependents.value.map(edge => edge.dependent) },
  { summary: 'canvasSummaryLibraries', items: usedLibraries.value.map(legend => legend.name) },
].filter(relation => relation.items.length));
const nodeStatus = computed(() => selectedNode.value?.analysis === 'unreviewed' ? 'canvasUnreviewed' :
  dependencies.value.length || usedLibraries.value.length ? 'canvasReviewed' : 'canvasNoDependencies');
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
const hasSelection = computed(() => !!selectedNode.value || !!selectedLegend.value || !!selectedEdge.value);
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

function basename(path: string): string { return path.slice(path.lastIndexOf('/') + 1); }

function capturePosition(): CanvasPosition {
  const currentViewport = ready.value ? { ...viewport.value } : layout.value?.viewport;
  return {
    selected: selected.value,
    ...(currentViewport && { viewport: currentViewport }),
    edge: selectedEdgeId.value,
    detailScroll: inspector.value?.scrollTop ?? 0,
  };
}

async function restorePosition(position: CanvasPosition, isCurrent = () => true): Promise<boolean> {
  const current = () => props.active && isCurrent();
  const before = reading.value;
  const beforeRevision = revision;
  const beforeLayout = layout.value;
  const beforeSelection = selected.value;
  const beforeEdge = selectedEdgeId.value;
  const beforeGroupEditor = groupEditor.value;
  const beforeViewport = { ...viewport.value };
  let latest: CanvasReading | LoopCanvasReading | undefined;
  try {
    latest = await request<CanvasReading | LoopCanvasReading>(readRoute);
    if (!current()) return false;
    // An unfinished edit keeps its original graph and revision for the existing recovery controls.
    const keepLayout = dirty.value || saving.value || revision !== beforeRevision || layout.value !== beforeLayout;
    if (loading.value || reading.value !== before) latest = reading.value;
    else if (!keepLayout) {
      reading.value = latest;
      layout.value = latest.layout;
      revision = latest.revision;
      readProblem.value = undefined;
      render();
    } else if (latest.graphVersion === before?.graphVersion && !latest.layoutProblem) {
      reading.value = latest;
      readProblem.value = undefined;
    } else {
      readProblem.value = latest.layoutProblem ?? { code: 'LAYOUT_GRAPH_CHANGED', message: '', nextStep: '', context: {} };
    }
  } catch (error) {
    if (!current()) return false;
    readProblem.value = failed(error);
  }
  const changedSelection = selected.value !== beforeSelection || selectedEdgeId.value !== beforeEdge;
  const target = changedSelection ? selected.value : position.selected;
  const available = !target || (ids.value.includes(target) && (!latest || readingIds(latest).includes(target)));
  selected.value = available ? target : loop.value?.loop.entry ?? '';
  const edge = changedSelection ? selectedEdgeId.value : position.edge;
  const edgeAvailable = !edge || getEdges.value.some(item => item.id === edge);
  selectedEdgeId.value = edgeAvailable ? edge : '';
  if (groupEditor.value === beforeGroupEditor) groupEditor.value = false;
  await nextTick();
  if (!current()) return false;
  // Vue Flow's programmatic transform has no user move-end event; only gestures and dock tools save.
  const targetViewport = (available ? position.viewport : undefined) ?? layout.value?.viewport;
  if (targetViewport && viewport.value.x === beforeViewport.x && viewport.value.y === beforeViewport.y &&
      viewport.value.zoom === beforeViewport.zoom) await setViewport(targetViewport);
  if (!current()) return false;
  if (inspector.value && !changedSelection) inspector.value.scrollTop = available ? position.detailScroll : 0;
  return !!latest && available && edgeAvailable;
}

defineExpose({ capturePosition, restorePosition });

function render() {
  if (!reading.value || !layout.value) return;
  const current = layout.value;
  setNodes([
    ...current.groups.map((group): Node => {
      const { x, y, width, height } = groupBounds(current.positions, group.members, dimensions);
      return { id: groupNodeId(group.id), type: 'canvasGroup', position: { x, y }, dragHandle: '.group-handle',
        data: { name: group.name }, style: { width: width + 'px', height: height + 'px' } };
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
  const edge = (from: string, to: string, reason: string, libraryName?: string): Edge => {
    const library = libraryName !== undefined;
    const direct = !loopRoute && (from === selected.value || to === selected.value);
    const muted = !loopRoute && !!selected.value && !direct;
    const color = library ? (direct ? '#675289' : '#817498') : (direct ? '#286347' : '#486357');
    return {
      id: nodeId(from) + '→' + nodeId(to), source: nodeId(from), target: nodeId(to), sourceHandle: 'out',
      targetHandle: from === to ? 'self' : 'in', type: 'dependency', focusable: !!loopRoute,
      data: { from: libraryName ?? from, to, reason, loop: !!loopRoute, direct },
      class: [library && 'library-use-edge', direct && 'direct-relation'].filter(Boolean).join(' '),
      ...(!loopRoute && { style: { stroke: color, strokeWidth: direct ? 2.8 : 1.9, opacity: muted ? .43 : 1 } }),
      markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color },
      ariaLabel: reason,
    };
  };
  const graph = dependency.value?.graph;
  setEdges(graph ? [
    ...graph.edges.map(({ dependency, dependent, reason }) => edge(dependency, dependent, reason)),
    ...legends.value.flatMap(legend => legend.uses.map(use => edge(legendKey(legend.id), use.path, use.reason, legend.name))),
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
      savedGroupId.value = '';
    }
    reading.value = next;
    revision = next.revision;
    pending = undefined;
    dirty.value = !next.layoutProblem && (!!carry || next.reconciled);
    saveProblem.value = undefined;
    if (!ids.includes(selected.value)) {
      selected.value = '';
    }
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
            savedGroupId.value = group.id;
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
  savedGroupId.value = '';
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
  if (loopRoute || groupTrigger.value?.classList.contains('group-more')) closeGroupEditor();
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
  if (menuGroup.value && event.target instanceof Element && !event.target.closest('.loop-group-menu, .group-more')) menuGroup.value = undefined;
  if (event.target instanceof Element && !toolsMenu.value?.contains(event.target)) closeTools();
}

function selectDetail(id: string) {
  menuGroup.value = undefined;
  groupEditor.value = false;
  selectedEdgeId.value = '';
  selected.value = id;
}

async function focusRelationship(id: string) {
  selectDetail(id);
  await nextTick();
  if (inspector.value) inspector.value.scrollTop = 0;
  detailHeading.value?.focus({ preventScroll: true });
}

function selectEdge(id: string) {
  selectDetail('');
  selectedEdgeId.value = id;
}

async function openGroupEditor(id: string, event?: MouseEvent, field?: 'name' | 'members') {
  editGroup(id);
  closeTools();
  clearSelection();
  menuGroup.value = undefined;
  if (event?.currentTarget instanceof HTMLElement) groupTrigger.value = event.currentTarget;
  groupEditor.value = true;
  await nextTick();
  const target = field === 'name' ? groupNameInput.value : field === 'members' ? memberFields.value?.querySelector('input') : groupPicker.value;
  target?.focus({ preventScroll: true });
}

async function openGroupMenu(id: string, event: MouseEvent) {
  if (!(event.currentTarget instanceof HTMLElement)) return;
  groupTrigger.value = event.currentTarget;
  groupEditor.value = false;
  if (menuGroup.value?.id === id) { menuGroup.value = undefined; return; }
  menuGroup.value = layout.value?.groups.find(group => group.id === id);
  await nextTick();
  const menu = groupMenu.value;
  if (!menu || !graphArea.value) return;
  const anchor = groupTrigger.value.getBoundingClientRect();
  const area = graphArea.value.getBoundingClientRect();
  menu.style.left = fitFloatingAxis(anchor.left - area.left, menu.offsetWidth, area.width) + 'px';
  menu.style.top = fitFloatingAxis(anchor.bottom - area.top, menu.offsetHeight, area.height) + 'px';
  menu.querySelector('button')?.focus({ preventScroll: true });
}

function leaveGroupMenu(event: FocusEvent) {
  const next = event.relatedTarget;
  if (next instanceof HTMLElement && next !== groupTrigger.value && !groupMenu.value?.contains(next)) menuGroup.value = undefined;
}

function dissolveGroup() {
  if (!menuGroup.value || !editable.value || !idle.value) return;
  commitGroup({ ...menuGroup.value, members: [] });
  menuGroup.value = undefined;
  graphArea.value?.focus({ preventScroll: true });
}

function closeGroupEditor() {
  menuGroup.value = undefined;
  groupEditor.value = false;
  (groupTrigger.value?.getClientRects().length ? groupTrigger.value : graphArea.value)?.focus({ preventScroll: true });
}

function clearDetail() {
  selected.value = '';
  if (loopRoute && inspector.value) inspector.value.scrollTop = 0;
  selectedEdgeId.value = '';
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
  if (!area || !(target instanceof Element) || !target.closest('.vue-flow') || event.button !== 0 || box.value) return;
  if (target.closest('.group-more, .vue-flow__edge')) return;
  clearSelection();
  ctrlHeld.value = event.ctrlKey;
  if (!editable.value || !idle.value || effectiveTool.value !== 'select' ||
      target.closest('.vue-flow__node:not(.vue-flow__node-canvasGroup), .group-handle, .group-more')) return;
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
    const id = node.dataset.file ?? node.dataset.step ?? (node.dataset.legend ? legendKey(node.dataset.legend) : undefined);
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
  if (!props.active || event.isComposing) return;
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
  if (active) return;
  ctrlHeld.value = false;
  newGroups.clear();
  savedGroupId.value = '';
  if (mapDragging.value && layout.value) void setViewport(layout.value.viewport);
  mapDragging.value = false;
  clearSelection();
  closeTools();
  labelsDismissed.value = false;
}, { flush: 'sync' });

watch(() => props.toolsCovered, covered => { if (covered) menuGroup.value = undefined; });

function trackControl(event: KeyboardEvent) {
  if (!props.active) return;
  if (event.type === 'keydown' && event.key === 'Escape' && !event.defaultPrevented &&
      !props.toolsCovered && !document.querySelector(':popover-open')) {
    const helpOpen = toolsMenu.value?.open;
    if (helpOpen || (!labelsDismissed.value && toolsRail.value?.matches(':hover, :has(:focus-visible)'))) {
      closeTools(true);
      labelsDismissed.value = true;
      if (helpOpen) event.preventDefault();
    }
  }
  if (event.key !== 'Control') return;
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
  window.addEventListener('keydown', trackControl);
  window.addEventListener('keyup', trackControl, true);
  window.addEventListener('blur', releaseControl);
  void load();
});
onUnmounted(() => {
  window.removeEventListener('keydown', trackControl);
  window.removeEventListener('keyup', trackControl, true);
  window.removeEventListener('blur', releaseControl);
});
</script>

<template>
  <main :id="loopId ? flowId + '-reading' : 'canvas-reading'" class="canvas-page"
    :class="loopId ? 'loop-canvas' : { 'dependency-canvas': true, 'canvas-active': active }"
    :aria-label="loopId ? undefined : t('dependencyCanvas')" tabindex="-1" @pointerdown.capture="outsideTools">
    <div v-if="loopId && !reading" class="loop-field">
      <DependencyDots :active="active" :quiet="false" :groups="[]" :viewport="{ x: 0, y: 0, zoom: 1 }" />
    </div>
    <div class="canvas-notices">
      <p v-if="loading || readingExplanation" role="status" class="canvas-status">{{ t('loading') }}</p>
      <p v-else-if="reading" v-show="statusKey !== 'canvasSaved' && statusKey !== 'canvasDefault'" role="status"
        class="canvas-status" data-testid="layout-status" :data-state="statusKey">{{ t(statusKey) }}</p>
      <p v-if="!loopId && savedGroupName && statusKey === 'canvasSaved'" class="canvas-group-saved" role="status">
        {{ t('canvasGroupSaved').replace('{name}', savedGroupName) }}
      </p>
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
    </div>

    <div v-if="!loopId || reading" v-show="!loopId || hasNodes" class="canvas-workspace" :class="{ 'reader-stowed': loopId && !panelOpen }">
      <div ref="toolsRail" :inert="toolsCovered" :id="loopId ? flowId + '-tools' : 'dependency-tools'" class="canvas-rail" role="group"
        :aria-label="t('canvasTools')" :data-labels-dismissed="labelsDismissed || undefined"
        @pointerenter="labelsDismissed = false" @focusin="labelsDismissed = false">
        <button type="button" :aria-label="t('canvasRearrange')"
          :disabled="!hasNodes || !editable || !idle || !!box" @click="relayout">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h12M16 12h5M9 18h12M3 4h4v4H3zM3 10h11v4H3zM3 16h4v4H3z" /></svg>
          <span class="canvas-tool-label" aria-hidden="true" @click.stop.prevent>{{ t('canvasRearrange') }}</span>
        </button>
        <button type="button" :aria-label="t('canvasEditGroup')"
          :disabled="!hasNodes || !editable || !idle || !!box" @click="openGroupEditor('', $event)">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4h6m3 0h2v2m0 3v6m0 3v2h-2m-3 0H9m-3 0H4v-2m0-3V9m0-3V4h2m2 5h5v5H8zM13 11h3v5h-5v-2" /></svg>
          <span class="canvas-tool-label" aria-hidden="true" @click.stop.prevent>{{ t('canvasEditGroup') }}</span>
        </button>
        <button type="button" :aria-label="t('canvasRefresh')"
          :aria-busy="loading" :disabled="loading || saving || dirty || !idle || !!box" @click="load()">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14-5L4 8m0-5v5h5m-5 5a8 8 0 0 0 14 5l2-2m0 5v-5h-5" /></svg>
          <span class="canvas-tool-label" aria-hidden="true" @click.stop.prevent>{{ t('canvasRefresh') }}</span>
        </button>
        <details ref="toolsMenu" class="canvas-tools">
          <summary :aria-label="t('canvasControlsHelp')">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 11v5m0-8v.1" /></svg>
            <span class="canvas-tool-label" aria-hidden="true" @click.stop.prevent>{{ t('canvasControlsHelp') }}</span>
          </summary>
          <div class="canvas-tools-menu">
            <p>{{ t('canvasToolOrder') }}</p>
            <p>{{ t('canvasGestures') }}</p>
            <p>{{ t(legends.length ? 'canvasLibraryDirection' : 'canvasDirection') }}</p>
          </div>
        </details>
      </div>
      <section ref="graphArea" class="graph-area" :aria-label="t(loopId ? 'loopGraph' : 'dependencyCanvas')"
        :data-tool="effectiveTool" tabindex="0" @keydown="selectionKeys"
        @pointerdown.capture="startSelection" @pointermove="moveSelection" @pointerup="finishSelection"
        @pointercancel="cancelPointer" @lostpointercapture="cancelPointer">
        <section v-if="routeChoice" class="route-actions" :inert="toolsCovered" :aria-label="t('loopCatalog')">
          <strong>{{ route?.title ?? routeChoice.title }}</strong>
          <button v-if="route" type="button" class="route-read" @click="emit('readRoute')">{{ t('readRoute') }}</button>
          <button type="button" @click="emit('clearRoute')">{{ t('clearRoute') }}</button>
          <p v-if="routeProblem" role="alert">{{ problemText(language, routeProblem).message }} · {{ routeProblem.code }}</p>
          <p v-else-if="routeIssue || !route" role="status">{{ routeIssue || t('loading') }}</p>
        </section>
        <div v-else :class="{ 'loop-canvas-heading': loop }">
          <button v-if="loop" type="button" class="loop-overview-link" :title="loop.loop.title" :inert="toolsCovered"
            :aria-label="t('loopOpenOverview') + ' · ' + loop.loop.title" @click="panelOpen = true; clearDetail()">{{ loop.loop.title }}</button>
          <p class="canvas-node-hint">{{ t('canvasNodeHint') }}</p>
        </div>
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
        <DependencyDots ref="dots" :active="active && hasNodes" :quiet="!idle || !!box"
          :viewport="viewport" :groups="dotGroups" />
        <VueFlow v-if="reading" v-show="hasNodes" :id="flowId" :min-zoom="minZoom" :max-zoom="maxZoom" :nodes-connectable="false" :nodes-draggable="editable"
          :pan-activation-key-code="fixedTool === 'select' && editable ? 'Control' : null"
          :elements-selectable="false" :delete-key-code="null" :selection-key-code="null" :multi-selection-key-code="null"
          :disable-keyboard-a11y="true" :pan-on-drag="editable" :zoom-on-scroll="editable && !box" :zoom-on-pinch="editable && !box"
          :zoom-on-double-click="false" :prevent-scrolling="editable"
          @init="init" @node-drag-start="startDrag" @node-drag="previewDrag" @node-drag-stop="endDrag"
          @move-start="moving = !paneDragging" @move-end="moved" @pane-click="clearDetail">
          <template #node-canvasFile="{ data }">
            <Handle id="in" type="target" :position="Position.Left" />
            <Handle id="self" class="self-handle" type="target" :position="Position.Top" />
            <DependencyCard v-if="!loopId" :label="data.key" :kind="data.analysis" :data-file="data.key" :data-route-member="routeFiles.has(data.key) || undefined"
              :aria-description="routeFiles.has(data.key) ? t('routeMember') : undefined"
              :status="t(data.analysis === 'unreviewed' ? 'canvasReviewPending' : 'canvasReviewed')"
              :aria-pressed="selected === data.key" :data-box-selected="picked.has(data.key) || undefined" @click="selectDetail(data.key)" />
            <button v-else type="button" class="file-node loop-node" :data-step="data.key" :aria-pressed="selected === data.key"
              :data-box-selected="picked.has(data.key) || undefined" :title="data.label" @click="selectDetail(data.key)">
              <small class="loop-node-number">{{ String(data.order + 1).padStart(2, '0') }}<template v-if="data.entry"> · {{ t('loopEntry') }}</template></small>
              <span>{{ data.label }}</span>
            </button>
            <Handle id="out" type="source" :position="Position.Right" />
          </template>
          <template #node-canvasLegend="{ data }">
            <DependencyCard v-if="!loopId" :label="data.name" kind="library" :status="legendKind(data.kind)" :data-legend="data.id"
              :aria-pressed="selected === data.key" :data-box-selected="picked.has(data.key) || undefined" @click="selectDetail(data.key)" />
            <button v-else type="button" class="file-node library-node" :data-legend="data.id" :aria-pressed="selected === data.key"
              :data-box-selected="picked.has(data.key) || undefined" :title="data.name" @click="selectDetail(data.key)">
              <span>{{ data.name }}</span>
              <small>{{ legendKind(data.kind) }}</small>
            </button>
            <Handle id="out" type="source" :position="Position.Right" />
          </template>
          <template #node-canvasGroup="{ data, id }">
            <div class="group-frame" :data-group="id">
              <div class="loop-group-bar">
                <span class="group-handle" :title="data.name">{{ data.name }}</span>
                <button type="button" class="group-more nodrag nopan" :aria-label="t('loopGroupActions') + ' · ' + data.name"
                  :disabled="!editable || !idle" :aria-expanded="menuGroup?.id === id.slice(6)"
                  @blur="leaveGroupMenu" @click.stop="openGroupMenu(id.slice(6), $event)">⋯</button>
              </div>
            </div>
          </template>
          <template #edge-dependency="edge"><DependencyEdge v-bind="edge" :active="selectedEdgeId === edge.id" @inspect="selectEdge(edge.id)" /></template>
        </VueFlow>
        <div v-if="menuGroup" ref="groupMenu" class="loop-group-menu" @keydown.esc.stop.prevent="closeGroupEditor"
          @focusout="leaveGroupMenu">
          <button type="button" @click="openGroupEditor(menuGroup.id, undefined, 'name')">{{ t('loopRename') }}</button>
          <button type="button" @click="openGroupEditor(menuGroup.id, undefined, 'members')">{{ t('loopMembers') }}</button>
          <button type="button" @click="dissolveGroup">{{ t('loopDissolve') }}<small>{{ t('loopStay') }}</small></button>
        </div>

        <div v-if="selectionRect" class="canvas-selection-rect" aria-hidden="true" :style="{
          left: selectionRect.x + 'px', top: selectionRect.y + 'px',
          width: selectionRect.width + 'px', height: selectionRect.height + 'px',
        }"></div>
        <div v-if="hasNodes" class="canvas-dock">
          <DependencyMiniMap v-if="active && mapOpen" :nodes="mapNodes" :viewport="viewport" :size="paneSize"
            :label="t('canvasMap')" :hint="t('canvasMapHint')" :enabled="editable"
            @dragging="mapDragging = $event" @navigate="mapNavigate" />
          <div class="canvas-zoom">
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
            <button type="button" :disabled="!editable || !idle || viewport.zoom <= minZoom" :aria-label="t('canvasZoomOut')" @click="zoom(1 / 1.2)">−</button>
            <output>{{ Math.round(viewport.zoom * 100) }}%</output>
            <button type="button" :disabled="!editable || !idle || viewport.zoom >= maxZoom" :aria-label="t('canvasZoomIn')" @click="zoom(1.2)">+</button>
          </div>
        </div>
      </section>
      <LoopRelations v-if="loop && selected && !selectedLegend && !groupEditor" :loop="loop.loop" :selected="selected"
        :panel-open="panelOpen" :language="language" @toggle="panelOpen = !panelOpen" :inert="toolsCovered" @select="selectDetail" />
      <button v-if="loop" type="button" class="loop-reader-toggle" :aria-expanded="panelOpen" :aria-controls="flowId + '-inspector'"
        :aria-label="t(panelOpen ? 'loopCollapse' : 'loopExpand')" :inert="toolsCovered"
        @click="panelOpen = !panelOpen"><span aria-hidden="true">{{ panelOpen ? '›' : '‹' }}</span></button>
      <component :is="loopId ? 'aside' : 'div'" v-if="loopId || (hasSelection && !groupEditor)" ref="inspector"
        :id="loopId ? flowId + '-inspector' : undefined" :aria-hidden="loopId && !panelOpen || undefined"
        :class="loopId ? 'canvas-inspector' : ['canvas-panel', { 'canvas-panel-compact': !!selectedNode }]">
        <nav v-if="loop" class="loop-step-nav" :aria-label="t('loopOrder')" :inert="toolsCovered || !panelOpen">
          <button v-for="item in stepNavigation" :key="item.key" type="button" :data-step-nav="item.key" :class="{ 'loop-entry': item.key === 'entry' }"
            :disabled="!item.id" :aria-label="item.title" @click="selectDetail(item.id)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path v-if="item.key === 'entry'" d="M5 20V4h13l-3 4 3 4H5" />
              <path v-else-if="item.key === 'previous'" d="m13 6-6 6 6 6M7 12h13" />
              <path v-else d="m11 6 6 6-6 6M17 12H4" />
            </svg>
            <span aria-hidden="true" class="loop-nav-tip">{{ item.title }}</span>
          </button>
        </nav>
        <LoopReading v-if="loop" :reading="loop" :language="language" :selected="selected" :active="active" :panel-open="panelOpen" :legend-selected="!!selectedLegend" @select="selectDetail" />
        <template v-if="!loopId && hasSelection && !groupEditor">
          <section class="canvas-summary" :aria-label="t(selectedEdge ? 'canvasRelationshipDetails' : selectedNode ? 'canvasSelected' : 'canvasSelectedLibrary')"
            @keydown.esc.stop="clearDetail()">
            <div class="canvas-summary-heading">
              <h2 ref="detailHeading" tabindex="-1" :title="selectedNode?.path">
                {{ selectedEdge ? selectedEdge.data.from + ' → ' + selectedEdge.data.to : selectedNode ? selectedFileName : selectedLegend?.name }}
              </h2>
              <p v-if="selectedEdge" class="edge-reason">{{ selectedEdge.data.reason }}</p>
              <p v-else-if="selectedNode">
                {{ t(nodeStatus) }}<template v-if="!documentPath"> · {{ t(dependency?.documentsUnavailable ? 'canvasDocumentsUnavailable' : 'canvasNoDocument') }}</template>
              </p>
              <p v-else-if="selectedLegend">{{ legendKind(selectedLegend.kind) }}</p>
            </div>
            <ul v-if="fileRelations.length" class="canvas-summary-relations">
              <li v-for="relation in fileRelations" :key="relation.summary" :title="relation.items[0]">
                {{ t(relation.summary) }} <strong>{{ basename(relation.items[0]!) }}</strong>
                <span v-if="relation.items.length > 1"> +{{ relation.items.length - 1 }}</span>
              </li>
            </ul>
            <div class="canvas-summary-actions">
              <button v-if="documentPath" type="button" class="canvas-read" :aria-busy="readingExplanation"
                :disabled="readingExplanation" @click="emit('read', documentPath)">{{ t('canvasRead') }}</button>
              <button type="button" class="canvas-clear-detail" :aria-label="t('canvasClearSelection')" :title="t('canvasClearSelection')" @click="clearDetail">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
              </button>
            </div>
          </section>
          <section v-if="selectedLegend" class="canvas-details canvas-selection" :aria-label="t('canvasSelectedLibrary')">
            <p class="library-description">{{ selectedLegend.description }}</p>
            <h3>{{ t('canvasDependents') }}</h3>
            <ul v-if="selectedLegend.uses.length" class="canvas-relations">
              <li v-for="use in selectedLegend.uses" :key="use.path">
                <button type="button" @click="focusRelationship(use.path)">{{ use.path }}</button>
                <p>{{ use.reason }}</p>
              </li>
            </ul>
            <p v-else class="canvas-hint">{{ t('canvasNoEdges') }}</p>
          </section>
        </template>
        <section v-if="loopId && selectedLegend" :inert="!panelOpen" class="canvas-selection" :aria-label="t('canvasSelectedLibrary')">
          <div class="detail-file">
            <h2>{{ selectedLegend.name }}</h2>
            <p class="canvas-hint">{{ legendKind(selectedLegend.kind) }}</p>
            <p class="library-description">{{ selectedLegend.description }}</p>
          </div>
          <div>
            <h3>{{ t('loopLibraryFiles') }}</h3>
            <ul v-if="selectedLegend.uses.length" class="canvas-relations">
              <li v-for="use in selectedLegend.uses" :key="use.path">
                <code>{{ use.path }}</code>
                <p>{{ use.reason }}</p>
              </li>
            </ul>
            <p v-else>{{ t('canvasNoEdges') }}</p>
          </div>
        </section>
      </component>
      <div v-if="groupEditor" class="canvas-panel canvas-group-panel" :class="{ 'loop-edit-panel': loopId }">
        <form class="canvas-groups" @submit.prevent="applyGroup"
          @keydown.esc.stop.prevent="closeGroupEditor">
          <div class="canvas-group-heading">
            <h2>{{ t('canvasGroups') }}</h2>
            <button type="button" @click="closeGroupEditor">{{ t('canvasCloseGroups') }}</button>
          </div>
          <label :for="groupControl + '-picker'">{{ t('canvasEditGroup') }}</label>
          <select :id="groupControl + '-picker'" ref="groupPicker" :value="groupId" :disabled="!editable || !idle"
            @change="editGroup(($event.target as HTMLSelectElement).value)">
            <option value="">{{ t('canvasNewGroup') }}</option>
            <option v-for="group in layout?.groups" :key="group.id" :value="group.id">{{ group.name }}</option>
          </select>
          <label :for="groupControl + '-name'">{{ t('canvasGroupName') }}</label>
          <input :id="groupControl + '-name'" ref="groupNameInput" v-model="groupName" maxlength="160" :disabled="!editable || !idle" />
          <fieldset ref="memberFields" :disabled="!editable || !idle">
            <legend>{{ t('canvasMembers') }}</legend>
            <label v-for="node in nodes" :key="node.key" class="canvas-member">
              <input v-model="members" type="checkbox" :value="node.key" />{{ node.label }}
            </label>
            <label v-for="legend in legends" :key="legendKey(legend.id)" class="canvas-member">
              <input v-model="members" type="checkbox" :value="legendKey(legend.id)" />{{ legend.name }} · {{ legendKind(legend.kind) }}
            </label>
          </fieldset>
          <button type="submit" :disabled="!editable || !idle || (members.length ? !groupName.trim() : (!!loopId || !groupId))">{{ t('canvasApplyGroup') }}</button>
          <p class="canvas-hint">{{ t(loopId ? 'loopGroupEditorHelp' : 'canvasGroupEditorHelp') }}</p>
        </form>
      </div>
    </div>
  </main>
</template>
