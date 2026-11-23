import { createHash } from 'node:crypto';
import { checkDocument, parseDocument } from '../core/document-blocks.js';
import { parseSavedLoop } from '../core/loops.js';
import type { DocumentService } from './document-blocks.js';
import type { LoopService, LoopStore } from './loops.js';

export class RevisionError extends Error {
  readonly nextStep = '核对指定项目、目标和最新原文，再决定是否重试。';
  constructor(readonly code: string, message: string, readonly context: Record<string, string> = {}) { super(message); }
}

function checkBase(raw: string, actual: string | undefined, commit: string, expected: string) {
  if (actual !== commit) throw new RevisionError('REVISION_VERSION', '定位与当前成品的固定提交不同。');
  if (createHash('sha256').update(raw).digest('hex') !== expected) throw new RevisionError('REVISION_CONFLICT', '当前讲解与形成修订时的原文不同。');
}

type Replace = (project: string, relative: string, expected: string, candidate: string) => Promise<void>;

export async function reviseDocument(documents: DocumentService, replace: Replace, project: string, path: string,
  commit: string, expected: string, ids: string[], reblock: boolean, text: string) {
  const current = await documents.read({ projectRoot: project }, path);
  checkBase(current.raw, current.commit, commit, expected);
  if (!current.mechanicallyValid) throw new RevisionError('REVISION_INVALID', '当前文档或固定源码未通过校验。',
    { reason: current.sourceError?.code ?? current.diagnostics.find(d => d.severity === 'error')?.code ?? '' });
  const first = current.blocks.findIndex(block => block.id === ids[0]);
  if (first < 0 || ids.some((id, i) => current.blocks[first + i]?.id !== id)) {
    throw new RevisionError('REVISION_TARGET', '指定块不存在或不是按原序相邻的块。');
  }
  const lines = current.raw.match(/[^\r\n]*(?:\r\n|\r|\n|$)/gu)!;
  const start = current.blocks[first]!.startLine - (reblock ? 1 : 0);
  const end = current.blocks[first + ids.length - 1]!.endLine - (reblock ? 0 : 1);
  const newline = current.raw.match(/\r\n|\r|\n/u)?.[0] ?? '\n';
  const body = text.replace(/\r\n|\r|\n/gu, newline);
  const candidate = lines.slice(0, start).join('') + body + (body.endsWith(newline) ? '' : newline) + lines.slice(end).join('');
  const checked = checkDocument(parseDocument(candidate, path), current.sourceLineCount);
  const count = checked.blocks.length - current.blocks.length + ids.length;
  const changed = checked.blocks.slice(first, first + count);
  const oldIds = new Set(current.blocks.map(b => b.id));
  const validIds = reblock ? count > 0 && changed.every(b => !oldIds.has(b.id)) :
    count === 1 && changed[0]?.id === ids[0];
  if (!checked.mechanicallyValid || !validIds || !changed.every(b => b.body.trim()) ||
      current.blocks.slice(first + ids.length).some((b, i) => checked.blocks[first + count + i]?.id !== b.id)) {
    throw new RevisionError('REVISION_INVALID', '候选的块身份、正文或源码覆盖校验失败。',
      { reason: checked.diagnostics.find(d => d.severity === 'error')?.code ?? 'BLOCK_ID_OR_BODY' });
  }
  await replace(project, path, expected, candidate);
  const saved = await documents.read({ projectRoot: project }, path);
  if (saved.raw !== candidate || !saved.mechanicallyValid) throw new RevisionError('REVISION_READBACK', '发布后的读回与候选不符。');
  return { document: path, blocks: changed.map(b => b.id), source_commit: commit, mechanicallyValid: true, diagnostics: saved.diagnostics };
}

export async function reviseStep(loops: LoopService, store: Pick<LoopStore, 'read'>, replace: Replace,
  project: string, id: string, step: string, field: string, commit: string, expected: string, text: string) {
  const saved = await store.read(project, id);
  const loop = parseSavedLoop(saved.raw, id);
  checkBase(saved.raw, loop.source_commit, commit, expected);
  const node = loop.nodes.find(n => n.id === step);
  if (!node || (field !== 'explanation' && field !== 'hint') || (field === 'hint' && !node.hint)) {
    throw new RevisionError('REVISION_TARGET', '指定步骤或讲解字段不存在。');
  }
  // Preserve the saved object's fields and order. Runtime sources never enter the candidate.
  const data = JSON.parse(saved.raw.replace(/^\uFEFF/u, '')) as typeof loop;
  data.nodes.find(n => n.id === step)![field] = text;
  const newline = saved.raw.includes('\r\n') ? '\r\n' : '\n';
  const candidate = (saved.raw.startsWith('\uFEFF') ? '\uFEFF' : '') +
    JSON.stringify(data, null, 2).replace(/\n/gu, newline) + newline;
  const checked = await loops.readSources(saved.projectRoot, parseSavedLoop(candidate, id), step);
  if (!checked.mechanicallyValid) throw new RevisionError('REVISION_INVALID', '闭环固定源码校验失败。',
    { reason: checked.sources.find(s => s.status === 'unavailable')?.error.code ?? '' });
  await replace(project, `docs/aftertaste/loops/${id}/current/loop.json`, expected, candidate);
  const result = await store.read(project, id);
  if (result.raw !== candidate) throw new RevisionError('REVISION_READBACK', '发布后的读回与候选不符。');
  return { loop_id: id, step_id: step, field, source_commit: commit, mechanicallyValid: true };
}
