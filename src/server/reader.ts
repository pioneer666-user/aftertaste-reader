import { randomBytes } from 'node:crypto';
import Fastify from 'fastify';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { DocumentService } from '../application/document-blocks.js';
import { FixedSourceService, SourceError } from '../application/fixed-source.js';
import { DocumentError } from '../core/document-blocks.js';
import { FileReaderService, ReaderError } from '../application/file-reader.js';
import type { ReaderProblem } from '../application/file-reader.js';
import { DocumentFileStore } from '../adapters/document-store.js';
import { GitSourceRepository } from '../adapters/git-source.js';
import { ReaderFileDirectory, readerProject } from '../adapters/reader-directory.js';
import { systemCode } from '../adapters/data-directory.js';
import { DependencyCanvasService } from '../application/dependency-canvas.js';
import { LayoutFileStore } from '../adapters/layout-store.js';
import { LoopFileStore } from '../adapters/loop-store.js';
import { GraphFileStore } from '../adapters/graph-store.js';
import { GraphService } from '../application/dependency-graph.js';
import { LoopService } from '../application/loops.js';
import { LoopReaderService } from '../application/loop-reader.js';
import { LoopError } from '../core/loops.js';
import { GraphError } from '../core/dependency-graph.js';
import { CanvasError } from '../core/canvas-layout.js';
import { BookmarkError } from '../core/bookmarks.js';
import { BookmarkService } from '../application/bookmarks.js';
import { BookmarkFileStore } from '../adapters/bookmark-store.js';
import { NoteError } from '../core/notes.js';
import { NotesService } from '../application/notes.js';
import { NotesFileStore } from '../adapters/notes-store.js';
import { invalidMarkEdit, MarkError } from '../core/understanding-marks.js';
import { UnderstandingMarkService } from '../application/understanding-marks.js';
import { UnderstandingMarkFileStore } from '../adapters/understanding-marks-store.js';

export function readerProblem(error: unknown): ReaderProblem {
  if (error instanceof GraphError) {
    const first = error.diagnostics[0];
    return { code: error.code, message: error.message, nextStep: error.nextStep,
      context: { ...error.context, ...(first ? { field: first.field, diagnostic: first.code } : {}) } };
  }
  if (error instanceof SourceError || error instanceof DocumentError || error instanceof ReaderError ||
      error instanceof CanvasError || error instanceof LoopError || error instanceof BookmarkError || error instanceof NoteError || error instanceof MarkError) {
    return { code: error.code, message: error.message, nextStep: error.nextStep, context: error.context };
  }
  return { code: 'INTERNAL_ERROR', message: '阅读服务发生未预期错误。', nextStep: '将问题标识和操作交给维护者检查。', context: {} };
}

export async function startReader(projectRoot: string, port: number = 4317) {
  const project = await readerProject(projectRoot);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new SourceError('INVALID_ARGUMENT', '端口参数无效。', '使用 1 至 65535 的整数端口。');
  }
  const assets = new Map<string, { content: Buffer; type: string }>();
  const webRoot = fileURLToPath(new URL('../web/', import.meta.url));
  try {
    assets.set('/', { content: await readFile(path.join(webRoot, 'index.html')), type: 'text/html; charset=utf-8' });
    for (const name of await readdir(path.join(webRoot, 'assets'))) {
      const types: Record<string, string> = { '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.woff': 'font/woff' };
      const type = types[path.extname(name)];
      if (type && /^[\w.-]+$/u.test(name)) assets.set(`/assets/${name}`, { content: await readFile(path.join(webRoot, 'assets', name)), type });
    }
  } catch {
    throw new ReaderError('WEB_BUILD_UNAVAILABLE', '预构建阅读页面不可用。', '在产品根完成构建后重新启动。');
  }
  const source = new FixedSourceService(new GitSourceRepository());
  const documents = new DocumentService(source, new DocumentFileStore());
  const reader = new FileReaderService(project, new ReaderFileDirectory(), documents);
  const bookmarks = new BookmarkService(new BookmarkFileStore(project), documentPath => reader.read(documentPath));
  const notes = new NotesService(new NotesFileStore(project));
  const marks = new UnderstandingMarkService(new UnderstandingMarkFileStore(project), documentPath => reader.read(documentPath));
  const graphStore = new GraphFileStore();
  const canvas = new DependencyCanvasService(reader, graphStore, new LayoutFileStore(project));
  const loopStore = new LoopFileStore();
  const loops = new LoopReaderService(project, new LoopService(source, documents, new GraphService(source, graphStore), loopStore),
    loopStore, relativePath => new LayoutFileStore(project, relativePath));
  const contentPolicy = "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; font-src 'self'; img-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
  const server = Fastify({ logger: false, trustProxy: false, exposeHeadRoutes: false });
  server.addHook('onRequest', async (request, reply) => {
    reply.headers({
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'X-Frame-Options': 'DENY',
      'Content-Security-Policy': contentPolicy,
    });
    const address = server.server.address();
    const actualPort = typeof address === 'object' && address ? address.port : port;
    const host = request.headers.host;
    const origin = request.headers.origin;
    const site = request.headers['sec-fetch-site'];
    if (![`127.0.0.1:${actualPort}`, `localhost:${actualPort}`].includes(host ?? '') ||
        (origin !== undefined && origin !== `http://${host}`) ||
        (site !== undefined && site !== 'same-origin' && site !== 'none')) {
      return reply.code(403).send({ ok: false, error: readerProblem(new ReaderError('ACCESS_DENIED',
        '请求来源不允许访问本地阅读资料。', '直接打开启动命令输出的本机阅读地址。')) });
    }
    const requestPath = request.url.split('?')[0] ?? '';
    if (request.method === 'PUT' && requestPath === '/api/bookmarks') {
      if (request.headers['x-aftertaste-bookmarks'] !== '1') return reply.code(403).send({ ok: false,
        error: readerProblem(new ReaderError('ACCESS_DENIED', '书签写入请求缺少本机页面标识。', '从本机阅读页面保存书签。')) });
      return;
    }
    if (request.method === 'PUT' && requestPath === '/api/notes') {
      if (request.headers['x-aftertaste-notes'] !== '1') return reply.code(403).send({ ok: false,
        error: readerProblem(new ReaderError('ACCESS_DENIED', '笔记写入请求缺少本机页面标识。', '从本机阅读页面保存笔记。')) });
      return;
    }
    if (request.method === 'PUT' && requestPath === '/api/understanding-marks') {
      if (request.headers['x-aftertaste-understanding-marks'] !== '1') return reply.code(403).send({ ok: false,
        error: readerProblem(new ReaderError('ACCESS_DENIED', '标注写入请求缺少本机页面标识。', '从本机阅读页面保存标注。')) });
      return;
    }
    if (request.method === 'PUT' && (requestPath === '/api/dependency-layout' || /^\/api\/loops\/[^/]+\/layout$/u.test(requestPath))) {
      if (request.headers['x-aftertaste-layout'] !== '1') return reply.code(403).send({ ok: false,
        error: readerProblem(new ReaderError('ACCESS_DENIED', '布局写入请求缺少本机页面标识。', '从本机阅读页面保存布局。')) });
      return;
    }
    if (request.method !== 'GET') return reply.code(405).send({ ok: false,
      error: readerProblem(new ReaderError('METHOD_NOT_ALLOWED', '阅读接口仅支持读取。', '使用页面中的文件选择或刷新。')) });
  });
  server.setErrorHandler((error, request, reply) => {
    if (error instanceof Error && 'statusCode' in error &&
        (error.statusCode === 400 || error.statusCode === 413 || error.statusCode === 415)) {
      const route = request.url.split('?')[0];
      if (route === '/api/understanding-marks') return reply.code(error.statusCode).send({ ok: false, error: readerProblem(invalidMarkEdit()) });
      const nextStep = route === '/api/bookmarks' ? '使用本机阅读页面提交书签。' :
        route === '/api/notes' ? '使用本机阅读页面提交笔记。' : '使用本机阅读页面提交布局。';
      return reply.code(error.statusCode).send({ ok: false, error: readerProblem(
        new ReaderError('INVALID_ARGUMENT', '请求体无效。', nextStep)) });
    }
    const problem = readerProblem(error);
    const status = ['INVALID_ARGUMENT', 'INVALID_PATH', 'LAYOUT_INVALID', 'MARK_ARGUMENT_INVALID'].includes(problem.code) ? 400 :
      problem.code.endsWith('_PATH_UNSAFE') ? 403 : ['LAYOUT_CONFLICT', 'LAYOUT_GRAPH_CHANGED', 'LAYOUT_GRAPH_UNCONFIRMED', 'BOOKMARK_CONFLICT', 'NOTE_CONFLICT', 'MARK_CONFLICT'].includes(problem.code) ? 409 :
      ['LOOP_NOT_FOUND', 'BOOKMARK_NOT_FOUND'].includes(problem.code) ? 404 : problem.code === 'INTERNAL_ERROR' ? 500 : 422;
    reply.code(status).send({ ok: false, error: problem });
  });
  server.setNotFoundHandler((_request, reply) => reply.code(404).send({ ok: false,
    error: readerProblem(new ReaderError('NOT_FOUND', '该阅读资源不存在。', '从阅读页面选择已有讲解。')) }));
  for (const [url, asset] of assets) server.get(url, async (_request, reply) => {
    reply.type(asset.type);
    if (url !== '/') return reply.send(asset.content);
    const nonce = randomBytes(18).toString('base64');
    reply.header('Content-Security-Policy', contentPolicy.replace("style-src 'self'", `style-src 'self' 'nonce-${nonce}'`));
    return reply.send(asset.content.toString('utf8').replace('__READER_STYLE_NONCE__', nonce));
  });
  server.get('/api/documents', async request => {
    if (Object.keys(request.query as object).length > 0) throw new SourceError('INVALID_ARGUMENT', '列表参数无效。', '直接读取当前项目的资料列表。');
    return { ok: true, ...await reader.list() };
  });
  server.get('/api/document', async request => {
    const query = request.query as Record<string, unknown>;
    if (Object.keys(query).length !== 1 || typeof query.path !== 'string') {
      throw new SourceError('INVALID_ARGUMENT', '文档参数无效。', '仅提供一个 current 镜像文档 path。');
    }
    return { ok: true, result: await reader.read(query.path) };
  });
  server.get('/api/bookmarks', async request => {
    if (Object.keys(request.query as object).length) throw new BookmarkError('INVALID_ARGUMENT', '书签列表参数无效。', '读取所选项目的书签。');
    return { ok: true, bookmarks: await bookmarks.list() };
  });
  server.put('/api/bookmarks', async request => {
    if (Object.keys(request.query as object).length || request.headers['content-type']?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
      throw new BookmarkError('INVALID_ARGUMENT', '书签操作参数无效。', '使用本机阅读页面提交单条书签操作。');
    }
    return { ok: true, bookmarks: await bookmarks.save(request.body) };
  });
  server.get('/api/notes', async request => {
    if (Object.keys(request.query as object).length) throw new NoteError('INVALID_ARGUMENT', '笔记列表参数无效。', '读取所选项目的笔记。');
    return { ok: true, notes: await notes.list() };
  });
  server.put('/api/notes', async request => {
    if (Object.keys(request.query as object).length || request.headers['content-type']?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
      throw new NoteError('INVALID_ARGUMENT', '笔记操作参数无效。', '使用本机阅读页面提交单条笔记操作。');
    }
    return { ok: true, note: await notes.save(request.body) };
  });
  server.get('/api/understanding-marks', async request => {
    if (Object.keys(request.query as object).length) throw invalidMarkEdit();
    return { ok: true, marks: await marks.list() };
  });
  server.put('/api/understanding-marks', async request => {
    if (Object.keys(request.query as object).length || request.headers['content-type']?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
      throw invalidMarkEdit();
    }
    return { ok: true, marks: await marks.save(request.body) };
  });
  server.get('/api/dependency-canvas', async request => {
    if (Object.keys(request.query as object).length) throw new ReaderError('INVALID_ARGUMENT', '图参数无效。', '读取当前项目的依赖图。');
    return { ok: true, ...await canvas.read() };
  });
  server.put('/api/dependency-layout', async request => {
    if (Object.keys(request.query as object).length || request.headers['content-type']?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
      throw new ReaderError('INVALID_ARGUMENT', '保存参数无效。', '使用本机页面提交当前依赖图布局。');
    }
    return { ok: true, ...await canvas.save(request.body) };
  });
  server.get('/api/loops', async request => {
    if (Object.keys(request.query as object).length) throw new ReaderError('INVALID_ARGUMENT', '闭环列表参数无效。', '从本机阅读器打开闭环。');
    return { ok: true, ...await loops.list() };
  });
  server.get<{ Params: { id: string } }>('/api/loops/:id', async request => {
    if (Object.keys(request.query as object).length) throw new ReaderError('INVALID_ARGUMENT', '闭环读取参数无效。', '从本机阅读器打开闭环。');
    return { ok: true, ...await loops.read(request.params.id) };
  });
  server.get<{ Params: { id: string } }>('/api/loops/:id/route', async request => {
    if (Object.keys(request.query as object).length) throw new ReaderError('INVALID_ARGUMENT', '闭环路径参数无效。', '从本机阅读器选择闭环。');
    return { ok: true, ...await loops.route(request.params.id) };
  });
  server.put<{ Params: { id: string } }>('/api/loops/:id/layout', async request => {
    if (Object.keys(request.query as object).length || request.headers['content-type']?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
      throw new ReaderError('INVALID_ARGUMENT', '闭环保存参数无效。', '使用本机页面提交当前闭环布局。');
    }
    return { ok: true, ...await loops.save(request.params.id, request.body) };
  });
  try {
    const url = await server.listen({ host: '127.0.0.1', port });
    return { server, url, projectRoot: project };
  } catch (error) {
    await server.close();
    if (systemCode(error) === 'EADDRINUSE') throw new ReaderError('PORT_IN_USE', '阅读端口已被占用。', '指定其他端口，或在原终端关闭属于自己的阅读服务。', { port });
    throw new ReaderError('SERVER_START_FAILED', '阅读服务启动失败。', '检查本机监听权限后重试。', { reason: systemCode(error) });
  }
}
