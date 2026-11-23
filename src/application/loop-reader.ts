import { createHash } from 'node:crypto';
import { isLegendKey, legendKey } from '../core/dependency-graph.js';
import { isNodeId, LoopError, parseSavedLoop } from '../core/loops.js';
import { CanvasLayoutService } from './canvas-layout.js';
import type { LayoutReading, LayoutStore, LayoutTarget } from './canvas-layout.js';
import { SourceError, type SourceRepository } from './fixed-source.js';
import { checkLoopId } from './loops.js';
import type { LoopService, LoopStore, ReadingLoop } from './loops.js';
import type { ReaderProblem } from './file-reader.js';

export interface LoopEntry {
  id: string;
  title: string;
  goal: string;
  steps: string[];
  fileCount: number;
  edges: { from: string; to: string }[];
}

export interface LoopRoute {
  title: string;
  source_commit: string;
  paths: string[];
  mappingProblem?: ReaderProblem;
}

export interface LoopCanvasReading extends LayoutReading {
  result: ReadingLoop;
}

export class LoopReaderService {
  private readonly layouts = new CanvasLayoutService();

  constructor(private readonly projectRoot: string, private readonly loops: LoopService,
    private readonly store: Pick<LoopStore, 'read'> & { listIds(projectRoot: string): Promise<string[]> },
    private readonly layoutStore: (relativePath: string) => LayoutStore, private readonly repository: Pick<SourceRepository, 'locate'>) {}

  async list(): Promise<{ loops: LoopEntry[]; problems: ReaderProblem[] }> {
    const loops: LoopEntry[] = [];
    const problems: ReaderProblem[] = [];
    for (const id of await this.store.listIds(this.projectRoot)) {
      try {
        const { raw } = await this.store.read(this.projectRoot, id);
        const loop = parseSavedLoop(raw, id);
        loops.push({
          id, title: loop.title, goal: loop.goal, steps: loop.reading_order,
          fileCount: new Set(loop.nodes.map(node => node.path)).size,
          edges: loop.edges.map(({ from, to }) => ({ from, to })),
        });
      } catch (error) {
        // A directory without current/loop.json isn't a published result.
        if (!(error instanceof LoopError)) throw error;
        if (error.code !== 'LOOP_NOT_FOUND') {
          problems.push({ code: error.code, message: error.message, nextStep: error.nextStep,
            context: { ...error.context, loopId: id } });
        }
      }
    }
    return { loops, problems };
  }

  async route(id: string): Promise<LoopRoute> {
    checkLoopId(id);
    const { raw } = await this.store.read(this.projectRoot, id);
    const loop = parseSavedLoop(raw, id);
    const route: LoopRoute = { title: loop.title, source_commit: loop.source_commit, paths: [...new Set(loop.nodes.map(node => node.path))] };
    try {
      const { projectPrefix } = await this.repository.locate(this.projectRoot);
      if (loop.project_prefix !== projectPrefix) {
        route.mappingProblem = { code: 'LOOP_PREFIX_MISMATCH', message: '闭环与当前项目的仓库内路径不同。', nextStep: '',
          context: { saved: loop.project_prefix, current: projectPrefix } };
      }
    } catch (error) {
      if (!(error instanceof SourceError)) throw error;
      route.mappingProblem = { code: error.code, message: error.message, nextStep: error.nextStep, context: error.context };
    }
    return route;
  }

  private async graph(id: string) {
    const { raw, projectRoot } = await this.store.read(this.projectRoot, id);
    const loop = parseSavedLoop(raw, id);
    const ids = new Set([...loop.reading_order, ...loop.legends.map(legend => legendKey(legend.id))]);
    const graphVersion = createHash('sha256').update(JSON.stringify([projectRoot, id, raw])).digest('hex');
    const relations = { order: [loop.entry, ...loop.reading_order.filter(id => id !== loop.entry)],
      edges: loop.edges.map(({ from, to }) => ({ from, to })),
      libraries: loop.legends.map(legend => ({ id: legendKey(legend.id),
        targets: loop.nodes.filter(node => node.library_uses?.some(use => use.id === legend.id)).map(node => node.id) })) };
    return { loop, projectRoot, ids, graphVersion, relations, nodeRemovals: {}, confirmed: new Set<string>() };
  }

  private target(id: string): LayoutTarget {
    checkLoopId(id);
    const directory = `docs/aftertaste/loops/${id}`;
    const layoutPath = `${directory}/layout.json`;
    return {
      graph: `loop:${id}`, graphPath: `${directory}/current/loop.json`, layoutPath,
      store: this.layoutStore(layoutPath), acceptsId: id => isNodeId(id) || isLegendKey(id),
      readGraph: () => this.graph(id),
    };
  }

  async read(id: string): Promise<LoopCanvasReading> {
    const target = this.target(id);
    const graph = await this.graph(id);
    return { ...await this.layouts.read(target, graph), result: await this.loops.readSources(graph.projectRoot, graph.loop) };
  }

  save(id: string, input: unknown) {
    return this.layouts.save(this.target(id), input);
  }
}
