import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile, writeFile, readdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import graph from '../inputs/graph.json' with { type: 'json' }
import { groupBounds, initialState, rearrange, reconcileGraph, validateState } from '../src/model.ts'
import { createServer } from '../server.ts'
import { prepareRun, readSaved } from '../store.ts'

const root = dirname(dirname(fileURLToPath(import.meta.url)))

test('图更新保持存续坐标，确定删除清组，失败输入不改原状态', () => {
  const original = initialState(graph)
  let seed = 4004
  for (let sample = 0; sample < 50; sample++) {
    const state = structuredClone(original)
    for (const id of Object.keys(state.positions)) {
      seed = (seed * 1664525 + 1013904223) >>> 0
      state.positions[id] = { x: seed % 10000 - 5000, y: (seed >>> 12) % 10000 - 5000 }
    }
    const update = structuredClone(graph)
    update.nodes[0].label = '更新内容'
    update.edges = []
    update.nodes.push({ id: 'e', label: '新增' })
    const next = reconcileGraph(state, update)
    assert.deepEqual(Object.fromEntries(Object.keys(state.positions).map(id => [id, next.positions[id]])), state.positions)
    assert.ok(next.positions.e.x > Math.max(...Object.values(state.positions).map(p => p.x + 170)))
    assert.deepEqual(reconcileGraph(next, update), next, '重复完整图更新幂等')
    assert.deepEqual(next.groups, state.groups)
    const snapshot = structuredClone(state)
    assert.throws(() => reconcileGraph(state, { nodes: [] }))
    assert.deepEqual(state, snapshot)
    const deleted = reconcileGraph(next, { nodes: update.nodes.filter(n => !['a', 'b'].includes(n.id)), edges: [] })
    assert.deepEqual(deleted.groups, [])
    for (const node of deleted.graph.nodes) assert.deepEqual(deleted.positions[node.id], next.positions[node.id])
    const laidOut = rearrange(next)
    validateState(laidOut)
    assert.deepEqual(laidOut.groups, next.groups)
    assert.deepEqual(laidOut.graph, next.graph)
    assert.deepEqual(rearrange(laidOut), laidOut)
    const bounds = groupBounds(next, next.groups[0])
    for (const member of next.groups[0].members) {
      assert.ok(next.positions[member].x >= bounds.x && next.positions[member].y >= bounds.y)
      assert.ok(next.positions[member].x + 170 <= bounds.x + bounds.width)
      assert.ok(next.positions[member].y + 64 <= bounds.y + bounds.height)
    }
  }
})

test('真实保存接口落盘、失败保旧、重试、并发冲突与损坏文件保护', async () => {
  const runId = `checks-${Date.now()}`
  const directory = await prepareRun(root, runId)
  const app = await createServer(runId, 4317)
  const headers = { host: '127.0.0.1:4317', origin: 'http://127.0.0.1:4317', 'x-d004': 'canvas' }
  const state = initialState(graph)
  const put = (expectedRevision: number, body = state) => app.inject({ method: 'PUT', url: '/api/state', headers, payload: { expectedRevision, state: body } })
  try {
    assert.equal((await put(0)).statusCode, 200)
    assert.deepEqual((await readSaved(directory))?.state, state)
    const original = await readFile(join(directory, 'layout.json'), 'utf8')
    await app.inject({ method: 'PUT', url: '/api/failure', headers, payload: { fail: true } })
    state.positions.a.x += 77
    assert.equal((await put(1)).statusCode, 500)
    assert.equal(await readFile(join(directory, 'layout.json'), 'utf8'), original)
    assert.deepEqual((await readdir(directory)).filter(name => name.endsWith('.tmp')), [])
    await app.inject({ method: 'PUT', url: '/api/failure', headers, payload: { fail: false } })
    assert.equal((await put(1)).statusCode, 200)
    assert.deepEqual((await readSaved(directory))?.state, state)
    const race = await Promise.all([put(2), put(2)])
    assert.deepEqual(race.map(r => r.statusCode).sort(), [200, 409])
    const invalid = structuredClone(state)
    invalid.positions.a.x = Infinity
    assert.throws(() => validateState(invalid))
    const duplicate = structuredClone(state)
    duplicate.groups[0].members.push('a')
    assert.equal((await put(3, duplicate)).statusCode, 400)
    const foreign = await app.inject({ method: 'PUT', url: '/api/state', headers: { ...headers, origin: 'https://example.com' }, payload: { expectedRevision: 3, state } })
    assert.equal(foreign.statusCode, 403)
    assert.equal((await app.inject({ method: 'GET', url: '/api/state', headers: { host: 'evil.test:4317' } })).statusCode, 403)
    const beforeReadFailure = await readFile(join(directory, 'layout.json'), 'utf8')
    assert.equal((await app.inject({ method: 'GET', url: '/api/graph?fail=1', headers })).statusCode, 503)
    assert.equal(await readFile(join(directory, 'layout.json'), 'utf8'), beforeReadFailure)
    await writeFile(join(directory, 'layout.json'), '{broken', 'utf8')
    assert.equal((await app.inject({ method: 'GET', url: '/api/state', headers })).statusCode, 500)
    assert.equal((await put(3)).statusCode, 500)
    assert.equal(await readFile(join(directory, 'layout.json'), 'utf8'), '{broken')
    console.log(JSON.stringify({ runId, cases: ['disk', 'failure', 'retry', 'conflict', 'validation', 'origin', 'host', 'read-failure', 'corrupt-file'] }))
  } finally { await app.close() }
})

test('运行目录拒绝越界名称', async () => {
  await assert.rejects(prepareRun(root, '../outside'))
  await assert.rejects(prepareRun(root, 'C:\\outside'))
})
