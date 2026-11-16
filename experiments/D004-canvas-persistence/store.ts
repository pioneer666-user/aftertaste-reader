import { randomUUID } from 'node:crypto'
import { lstat, mkdir, open, readFile, rename, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { validateState } from './src/model.ts'
import type { SavedCanvas } from './src/model.ts'

export async function prepareRun(root: string, runId: string) {
  if (!/^[a-z0-9][a-z0-9-]{0,70}$/.test(runId)) throw new Error('RUN_ID 只允许小写字母数字和短横线')
  const local = join(root, '.local')
  const directory = join(local, runId)
  for (const path of [local, directory]) {
    await mkdir(path, { recursive: true })
    if ((await lstat(path)).isSymbolicLink()) throw new Error('实验数据目录不能是链接')
  }
  return directory
}

export async function readSaved(directory: string): Promise<SavedCanvas | null> {
  try {
    const file = join(directory, 'layout.json')
    if ((await lstat(file)).isSymbolicLink()) throw new Error('布局文件不能是链接')
    const saved: unknown = JSON.parse(await readFile(file, 'utf8'))
    if (!saved || typeof saved !== 'object' || !('revision' in saved) || !('state' in saved)) throw new Error('保存文件结构无效')
    if (!Number.isSafeInteger(saved.revision) || Number(saved.revision) < 1) throw new Error('保存版本无效')
    validateState(saved.state)
    return saved as SavedCanvas
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

export async function writeSaved(directory: string, saved: SavedCanvas, fail: boolean) {
  validateState(saved.state)
  const temporary = join(directory, `layout-${randomUUID()}.tmp`)
  try {
    const handle = await open(temporary, 'wx')
    try {
      await handle.writeFile(JSON.stringify(saved, null, 2) + '\n', 'utf8')
      await handle.sync()
    } finally {
      await handle.close()
    }
    if (fail) throw new Error('实验注入：临时文件写完后、替换前写入失败')
    await rename(temporary, join(directory, 'layout.json'))
  } finally {
    await unlink(temporary).catch(error => {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    })
  }
}
