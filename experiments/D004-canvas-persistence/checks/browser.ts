import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import type { Browser, Page } from 'playwright'
import { groupBounds } from '../src/model.ts'
import type { CanvasState, SavedCanvas } from '../src/model.ts'
import { prepareRun } from '../store.ts'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const channel = process.env.BROWSER ?? 'msedge'
if (!['msedge', 'chrome'].includes(channel)) throw new Error('本脚本只调用已安装的 Edge 或 Chrome')
const runId = process.env.RUN_ID ?? `browser-${channel}-${Date.now()}`
const directory = await prepareRun(root, runId)
const url = 'http://127.0.0.1:4317'
const stages: { name: string; saved: SavedCanvas; rendered: unknown }[] = []
const errors: string[] = []
let server: ChildProcess | undefined
let browser: Browser | undefined
let page!: Page
let serverLog = ''

async function poll<T>(operation: () => Promise<T>, timeout = 10000): Promise<T> {
  const deadline = Date.now() + timeout
  let lastError: unknown
  while (Date.now() < deadline) {
    try { return await operation() } catch (error) { lastError = error }
    await new Promise(resolve => setTimeout(resolve, 75))
  }
  throw lastError
}

async function startServer() {
  let startupLog = ''
  server = spawn(process.execPath, ['server.ts'], {
    cwd: root, env: { ...process.env, RUN_ID: runId, PORT: '4317' }, windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  server.stdout!.on('data', chunk => { serverLog += chunk.toString(); startupLog += chunk.toString() })
  server.stderr!.on('data', chunk => { serverLog += chunk.toString() })
  await poll(async () => {
    if (server!.exitCode !== null) throw new Error(`服务提前退出 ${serverLog}`)
    assert.ok(startupLog.includes(`"pid":${server!.pid}`), '等待本脚本服务确认监听成功')
    const response = await fetch(`${url}/api/state`)
    assert.equal(response.status, 200)
    return response.status
  })
}

async function stopServer() {
  if (!server || server.exitCode !== null) return
  const closed = new Promise(resolve => server!.once('exit', resolve))
  server.kill()
  await closed
  await assert.rejects(fetch(`${url}/api/state`))
}

async function openPage() {
  browser = await chromium.launch({ channel, headless: process.env.HEADED !== '1' })
  page = await browser.newPage({ viewport: { width: 1440, height: 960 } })
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(url)
  await page.locator('[data-node="a"], [data-node="c"]').first().waitFor()
}

async function uiState(): Promise<CanvasState> {
  return JSON.parse((await page.getByTestId('state').textContent())!)
}

async function disk(): Promise<SavedCanvas> {
  return JSON.parse(await readFile(join(directory, 'layout.json'), 'utf8'))
}

async function settled() {
  return poll(async () => {
    assert.match((await page.getByTestId('save-status').textContent())!, /^已保存/)
    const saved = await disk()
    assert.deepEqual(saved.state, await uiState())
    return saved
  })
}

function near(actual: number, expected: number) { assert.ok(Math.abs(actual - expected) < 0.02, `${actual} ≠ ${expected}`) }

async function verifyRender(state: CanvasState) {
  const rendered = await page.locator('.vue-flow').evaluate(element => {
    const nodes = [...element.querySelectorAll<HTMLElement>('.vue-flow__node')].map(node => {
      const matrix = new DOMMatrixReadOnly(getComputedStyle(node).transform)
      return { id: node.dataset.id, x: matrix.m41, y: matrix.m42, width: node.offsetWidth, height: node.offsetHeight, label: node.textContent }
    })
    const pane = element.querySelector<HTMLElement>('.vue-flow__transformationpane')!
    const transform = new DOMMatrixReadOnly(getComputedStyle(pane).transform)
    return { nodes, viewport: { x: transform.m41, y: transform.m42, zoom: transform.a } }
  })
  for (const node of state.graph.nodes) {
    const actual = rendered.nodes.find(n => n.id === node.id)!
    assert.ok(actual, `缺少渲染节点 ${node.id}`)
    near(actual.x, state.positions[node.id].x)
    near(actual.y, state.positions[node.id].y)
    assert.equal(actual.label, node.label)
  }
  assert.equal(rendered.nodes.length, state.graph.nodes.length + state.groups.length)
  for (const group of state.groups) {
    const actual = rendered.nodes.find(n => n.id === `group:${group.id}`)!
    const expected = groupBounds(state, group)
    near(actual.x, expected.x)
    near(actual.y, expected.y)
    assert.ok(Math.abs(actual.width - expected.width) <= 1)
    assert.ok(Math.abs(actual.height - expected.height) <= 1)
    assert.equal(actual.label, group.name)
  }
  near(rendered.viewport.x, state.viewport.x)
  near(rendered.viewport.y, state.viewport.y)
  near(rendered.viewport.zoom, state.viewport.zoom)
  assert.equal(await page.locator('.vue-flow__edge').count(), state.graph.edges.length)
  return rendered
}

async function record(name: string) {
  return poll(async () => {
    const saved = await settled()
    const rendered = await verifyRender(saved.state)
    stages.push({ name, saved, rendered })
    return saved
  })
}

async function drag(selector: string, dx: number, dy: number) {
  const box = await page.locator(selector).boundingBox()
  assert.ok(box)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 12 })
  await page.mouse.up()
}

async function reopen(expected: SavedCanvas, name: string) {
  await page.screenshot({ path: join(directory, `${name}-before.png`) })
  await page.close()
  await browser!.close()
  browser = undefined
  await stopServer()
  assert.deepEqual(await disk(), expected)
  await startServer()
  await openPage()
  const actual = await record(name)
  assert.deepEqual(actual, expected, '重开不能触发初始化写入或重排')
  await page.screenshot({ path: join(directory, `${name}-after.png`) })
}

try {
  await startServer()
  await openPage()
  const browserVersion = browser!.version()
  const initial = await record('initial')
  const inside = initial.state.positions.c
  const bounds = groupBounds(initial.state, initial.state.groups[0])
  assert.ok(inside.x > bounds.x && inside.y > bounds.y && inside.x + 170 < bounds.x + bounds.width && inside.y + 64 < bounds.y + bounds.height)

  await drag('[data-node="a"]', -45, 60)
  const free = await record('free-drag')
  assert.notDeepEqual(free.state.positions.a, initial.state.positions.a)
  assert.deepEqual(free.state.positions.b, initial.state.positions.b)
  await page.getByLabel('组名', { exact: true }).fill('独立分组·验证')
  await page.getByRole('button', { name: '保存组名和成员', exact: true }).click()
  const named = await record('named')
  assert.equal(named.state.groups[0].name, '独立分组·验证')
  await drag('[data-group="group:reading"]', 80, 40)
  const moved = await record('group-drag')
  const delta = {
    x: moved.state.positions.a.x - named.state.positions.a.x,
    y: moved.state.positions.a.y - named.state.positions.a.y,
  }
  assert.ok(delta.x > 0 && delta.y > 0)
  for (const id of ['a', 'b']) {
    near(moved.state.positions[id].x - named.state.positions[id].x, delta.x)
    near(moved.state.positions[id].y - named.state.positions[id].y, delta.y)
  }
  assert.deepEqual(moved.state.positions.c, named.state.positions.c)
  assert.deepEqual(moved.state.positions.d, named.state.positions.d)

  if (channel === 'msedge') {
    await page.locator('input[value="b"]').uncheck()
    await page.locator('input[value="c"]').check()
    await page.getByRole('button', { name: '保存组名和成员', exact: true }).click()
    const members = await record('membership-change')
    assert.deepEqual(members.state.groups[0].members, ['a', 'c'])
    assert.deepEqual(members.state.positions, moved.state.positions)
    await page.locator('input[value="b"]').check()
    await page.locator('input[value="c"]').uncheck()
    await page.getByRole('button', { name: '保存组名和成员', exact: true }).click()
    await record('membership-restored')
  }

  const canvas = await page.locator('.canvas').boundingBox()
  await page.mouse.move(canvas!.x + 700, canvas!.y + 650)
  await page.mouse.down()
  await page.mouse.move(canvas!.x + 750, canvas!.y + 680, { steps: 10 })
  await page.mouse.up()
  await page.mouse.wheel(0, -120)
  const view = await record('pan-zoom')
  assert.notEqual(view.state.viewport.zoom, initial.state.viewport.zoom)
  assert.notEqual(view.state.viewport.x, initial.state.viewport.x)
  await reopen(view, 'restored-layout')

  if (channel === 'msedge') {
    await page.getByRole('button', { name: '更新文案和边', exact: true }).click()
    const content = await record('content-edges')
    assert.deepEqual(content.state.positions, view.state.positions)
    assert.notDeepEqual(content.state.graph.edges, view.state.graph.edges)
    await page.getByRole('button', { name: '新增 e', exact: true }).click()
    const added = await record('added-node')
    for (const [id, position] of Object.entries(content.state.positions)) assert.deepEqual(added.state.positions[id], position)
    assert.ok(added.state.positions.e.x > Math.max(...Object.values(content.state.positions).map(p => p.x + 170)))
    const originalFile = await readFile(join(directory, 'layout.json'), 'utf8')
    await page.getByRole('button', { name: '模拟图读取失败', exact: true }).click()
    assert.match((await page.getByRole('alert').textContent())!, /读取失败/)
    await page.getByRole('button', { name: '提交不完整图', exact: true }).click()
    assert.match((await page.getByRole('alert').textContent())!, /完整/)
    assert.equal(await readFile(join(directory, 'layout.json'), 'utf8'), originalFile)
    assert.deepEqual(await uiState(), added.state)

    await page.getByRole('button', { name: '注入写入失败', exact: true }).click()
    await drag('[data-node="d"]', 35, 50)
    await poll(async () => assert.match((await page.getByTestId('save-status').textContent())!, /^保存失败/))
    assert.equal(await readFile(join(directory, 'layout.json'), 'utf8'), originalFile)
    const unsaved = await uiState()
    assert.notDeepEqual(unsaved.positions.d, added.state.positions.d)
    await verifyRender(unsaved)
    await page.screenshot({ path: join(directory, 'write-failure.png') })
    await writeFile(join(directory, 'failure-evidence.json'), JSON.stringify({ oldFile: JSON.parse(originalFile), unsaved, status: await page.getByTestId('save-status').textContent() }, null, 2))
    await page.getByRole('button', { name: '恢复写入', exact: true }).click()
    await page.getByRole('button', { name: '重试保存', exact: true }).click()
    const retried = await record('retry-saved')
    assert.deepEqual(retried.state, unsaved)
    await reopen(retried, 'restored-after-failure')

    await page.getByRole('button', { name: '重新布局（保留分组）', exact: true }).click()
    const relayout = await record('relayout-preserves-groups')
    assert.deepEqual(relayout.state.groups, retried.state.groups)
    assert.notDeepEqual(relayout.state.positions, retried.state.positions)
    await page.getByRole('button', { name: '删除 a', exact: true }).click()
    const deletedA = await record('delete-a')
    assert.deepEqual(deletedA.state.groups[0].members, ['b'])
    for (const node of deletedA.state.graph.nodes) assert.deepEqual(deletedA.state.positions[node.id], relayout.state.positions[node.id])
    await page.getByRole('button', { name: '删除 b', exact: true }).click()
    const deletedB = await record('delete-b-empty-group')
    assert.deepEqual(deletedB.state.groups, [])
    for (const node of deletedB.state.graph.nodes) assert.deepEqual(deletedB.state.positions[node.id], deletedA.state.positions[node.id])
    await reopen(deletedB, 'restored-after-updates')
  }
  assert.deepEqual(errors, [])
  const evidence = { runId, channel, browserVersion, node: process.version, platform: process.platform, viewport: { width: 1440, height: 960 }, stages, pageErrors: errors, result: 'passed' }
  await writeFile(join(directory, 'evidence.json'), JSON.stringify(evidence, null, 2) + '\n')
  console.log(JSON.stringify({ runId, channel, browserVersion, stages: stages.map(stage => stage.name), result: 'passed' }))
} catch (error) {
  if (page) {
    await page.screenshot({ path: join(directory, 'failed.png') }).catch(() => {})
    await writeFile(join(directory, 'failed-page.html'), await page.content()).catch(() => {})
  }
  await writeFile(join(directory, 'failed.json'), JSON.stringify({ message: String(error), stages, pageErrors: errors }, null, 2))
  throw error
} finally {
  await browser?.close()
  await stopServer()
  await writeFile(join(directory, 'server.log'), serverLog)
}
