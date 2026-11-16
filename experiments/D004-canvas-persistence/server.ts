import Fastify from 'fastify'
import type { FastifyError } from 'fastify'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import graph from './inputs/graph.json' with { type: 'json' }
import { initialState, validateState } from './src/model.ts'
import { prepareRun, readSaved, writeSaved } from './store.ts'

const root = dirname(fileURLToPath(import.meta.url))

export async function createServer(runId: string, port: number) {
  const directory = await prepareRun(root, runId)
  const app = Fastify({ logger: false, bodyLimit: 128 * 1024 })
  let failWrites = false
  let writes: Promise<unknown> = Promise.resolve()
  const origin = `http://127.0.0.1:${port}`

  app.addHook('onRequest', async (request, reply) => {
    if (request.headers.host !== `127.0.0.1:${port}`) return reply.code(403).send({ message: '仅允许实验本机地址' })
    if (request.method !== 'GET' && (request.headers.origin !== origin || request.headers['x-d004'] !== 'canvas')) {
      return reply.code(403).send({ message: '写入须从同源实验页面发起' })
    }
    reply.header('Cache-Control', 'no-store')
  })
  app.setErrorHandler<FastifyError>((error, _request, reply) => {
    const status = error.statusCode && error.statusCode < 500 ? error.statusCode : 500
    reply.code(status).send({ message: error.message })
  })
  app.get('/api/state', async () => {
    const saved = await readSaved(directory)
    return { ...(saved ?? { revision: 0, state: initialState(graph) }), failWrites }
  })
  app.get('/api/graph', async (request, reply) => {
    if ((request.query as { fail?: string }).fail === '1') return reply.code(503).send({ message: '实验注入：图读取失败，保留当前布局' })
    return graph
  })
  app.put('/api/state', async (request, reply) => {
    const body = request.body as { expectedRevision?: unknown; state?: unknown } | null
    if (!body || !Number.isSafeInteger(body.expectedRevision) || Number(body.expectedRevision) < 0) {
      return reply.code(400).send({ message: 'expectedRevision 无效' })
    }
    try { validateState(body.state) } catch (error) {
      return reply.code(400).send({ message: (error as Error).message })
    }
    const state = structuredClone(body.state)
    const operation = writes.then(async () => {
      const current = await readSaved(directory)
      if ((current?.revision ?? 0) !== body.expectedRevision) {
        return reply.code(409).send({ message: '布局已在另一页面更新。当前操作保留在本页，请先保留记录再重新打开。' })
      }
      const saved = { revision: Number(body.expectedRevision) + 1, state }
      await writeSaved(directory, saved, failWrites)
      return { revision: saved.revision }
    })
    writes = operation.catch(() => {})
    return operation
  })
  app.put('/api/failure', async (request, reply) => {
    const body = request.body as { fail?: unknown } | null
    if (!body || typeof body.fail !== 'boolean') return reply.code(400).send({ message: 'fail 须为布尔值' })
    failWrites = body.fail
    return { failWrites }
  })
  app.get('/', async (_request, reply) => reply.type('text/html').send(await readFile(join(root, '.local/build/index.html'))))
  app.get<{ Params: { name: string } }>('/assets/:name', async (request, reply) => {
    const name = request.params.name
    if (!/^[a-zA-Z0-9_-]+\.(js|css)$/.test(name)) return reply.code(404).send()
    return reply.type(name.endsWith('.js') ? 'text/javascript' : 'text/css').send(await readFile(join(root, '.local/build/assets', name)))
  })
  return app
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 4317)
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('PORT 无效')
  const runId = process.env.RUN_ID ?? 'author'
  const app = await createServer(runId, port)
  await app.listen({ host: '127.0.0.1', port })
  console.log(JSON.stringify({ url: `http://127.0.0.1:${port}`, runId, node: process.version, pid: process.pid }))
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { void app.close().then(() => process.exit(0)) })
}
