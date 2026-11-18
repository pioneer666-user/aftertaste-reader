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

export function readerProblem(error: unknown): ReaderProblem {
  if (error instanceof GraphError) {
    const first = error.diagnostics[0];
    return { code: error.code, message: error.message, nextStep: error.nextStep,
      context: { ...error.context, ...(first ? { field: first.field, diagnostic: first.code } : {}) } };
  }
  if (error instanceof SourceError || error instanceof DocumentError || error instanceof ReaderError ||
      error instanceof CanvasError || error instanceof LoopError) {
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
  const graphStore = new GraphFileStore();
  const canvas = new DependencyCanvasService(reader, graphStore, new LayoutFileStore(project));
  const loopStore = new LoopFileStore();
  const loops = new LoopReaderService(project, new LoopService(source, documents, new GraphService(source, graphStore), loopStore),
    loopStore, relativePath => new LayoutFileStore(project, relativePath));
  const server = Fastify({ logger: false, trustProxy: false, exposeHeadRoutes: false });
  server.addHook('onRequest', async (request, reply) => {
    reply.headers({
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'X-Frame-Options': 'DENY',
      'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; font-src 'self'; img-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
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
    if (request.method === 'PUT' && (requestPath === '/api/dependency-layout' || /^\/api\/loops\/[^/]+\/layout$/u.test(requestPath))) {
      if (request.headers['x-aftertaste-layout'] !== '1') return reply.code(403).send({ ok: false,
        error: readerProblem(new ReaderError('ACCESS_DENIED', '布局写入请求缺少本机页面标识。', '从本机阅读页面保存布局。')) });
      return;
    }
    if (request.method !== 'GET') return reply.code(405).send({ ok: false,
      error: readerProblem(new ReaderError('METHOD_NOT_ALLOWED', '阅读接口仅支持读取。', '使用页面中的文件选择或刷新。')) });
  });
  server.setErrorHandler((error, _request, reply) => {
    if (error instanceof Error && 'statusCode' in error &&
        (error.statusCode === 400 || error.statusCode === 413 || error.statusCode === 415)) {
      return reply.code(error.statusCode).send({ ok: false, error: readerProblem(
        new ReaderError('INVALID_ARGUMENT', '请求体无效。', '使用本机阅读页面提交布局。')) });
    }
    const problem = readerProblem(error);
    const status = ['INVALID_ARGUMENT', 'INVALID_PATH', 'LAYOUT_INVALID'].includes(problem.code) ? 400 :
      problem.code.endsWith('_PATH_UNSAFE') ? 403 : ['LAYOUT_CONFLICT', 'LAYOUT_GRAPH_CHANGED', 'LAYOUT_GRAPH_UNCONFIRMED'].includes(problem.code) ? 409 :
      problem.code === 'LOOP_NOT_FOUND' ? 404 : problem.code === 'INTERNAL_ERROR' ? 500 : 422;
    reply.code(status).send({ ok: false, error: problem });
  });
  server.setNotFoundHandler((_request, reply) => reply.code(404).send({ ok: false,
    error: readerProblem(new ReaderError('NOT_FOUND', '该阅读资源不存在。', '从阅读页面选择已有讲解。')) }));
  for (const [url, asset] of assets) server.get(url, async (_request, reply) => reply.type(asset.type).send(asset.content));
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
