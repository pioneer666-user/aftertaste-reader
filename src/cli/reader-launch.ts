import { execFile, spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { systemCode } from '../adapters/data-directory.js';
import { ReaderError } from '../application/file-reader.js';
import type { InstanceOperation, InstanceReply } from '../server/reader-instance.js';

type BrowserMode = 'open' | 'link';

function workerUnavailable(reason: string) {
  return new ReaderError('READER_WORKER_UNAVAILABLE', '后台阅读进程未返回就绪结果。', '检查当前终端能否创建本机后台进程后重试。', { reason });
}

function readerInstance(operation: InstanceOperation, projectRoot: string, port: number): Promise<InstanceReply> {
  const workerPath = fileURLToPath(new URL('../server/reader-instance.js', import.meta.url));
  let worker;
  try {
    worker = spawn(process.execPath, [workerPath, operation, projectRoot, String(port)],
      { detached: true, windowsHide: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  } catch (error) {
    throw workerUnavailable(systemCode(error));
  }
  return new Promise((resolve, reject) => {
    const failure = (reason: string) => {
      clearTimeout(deadline);
      reject(workerUnavailable(reason));
    };
    const deadline = setTimeout(() => {
      failure('TIMEOUT');
      worker.kill();
    }, 25_000);
    worker.once('error', error => failure(systemCode(error)));
    worker.once('exit', (code, signal) => failure(signal ?? `EXIT_${code}`));
    worker.once('message', (reply: InstanceReply) => {
      clearTimeout(deadline);
      worker.unref();
      resolve(reply);
    });
  });
}

async function openBrowser(url: string): Promise<'requested' | 'failed'> {
  const run = promisify(execFile);
  const options = { windowsHide: true, timeout: 8000 };
  try {
    if (process.platform === 'win32') {
      const root = process.env.SystemRoot;
      if (!root || !path.isAbsolute(root)) return 'failed';
      const powershell = path.join(root, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
      const encoded = Buffer.from(url, 'utf8').toString('base64');
      await run(powershell, ['-NoProfile', '-NonInteractive', '-Command',
        `Start-Process -FilePath ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}'))) -ErrorAction Stop`], options);
    } else {
      await run(process.platform === 'darwin' ? '/usr/bin/open' : 'xdg-open', [url], options);
    }
    return 'requested';
  } catch {
    // Child-process errors can contain the private URL in their command line.
    return 'failed';
  }
}

export async function launchReader(operation: InstanceOperation, projectRoot: string, port: number, mode: BrowserMode, target: string) {
  const reply = await readerInstance(operation, projectRoot, port);
  if (!reply.ok) throw new ReaderError(reply.error.code, reply.error.message, reply.error.nextStep, reply.error.context);
  if (reply.status !== 'ready') return reply;
  const url = reply.origin + reply.entryPath + target;
  const browser = mode === 'open' ? await openBrowser(url) : 'skipped';
  return { ok: true, status: reply.status, projectRoot: reply.projectRoot, reused: reply.reused, browser,
    location: reply.origin + '/' + target, ...(browser !== 'requested' || process.stdout.isTTY ? { url } : {}) };
}
