import { randomBytes } from 'node:crypto';
import { lstat, mkdir, realpath } from 'node:fs/promises';
import { request } from 'node:http';
import { homedir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout as delay } from 'node:timers/promises';
import { ReaderError, type ReaderProblem } from '../application/file-reader.js';
import { systemCode } from '../adapters/data-directory.js';
import { readerProject } from '../adapters/reader-directory.js';
import { readerProblem, startReader } from './reader.js';
import { instanceSignature, matches, readerEntryPath } from './reader-session.js';

export type InstanceOperation = 'open-reader' | 'stop-reader';
export type InstanceReply =
  | { ok: true; status: 'ready'; origin: string; entryPath: string; projectRoot: string; reused: boolean }
  | { ok: true; status: 'stopped' | 'not-running'; projectRoot: string }
  | { ok: false; error: ReaderProblem };

interface Instance {
  readonly port: number;
  readonly secret: string;
}

function origin(port: number) {
  return new URL(`http://127.0.0.1:${port}`).origin;
}

function stateError(reason: string) {
  return new ReaderError('READER_INSTANCE_UNAVAILABLE', '本机阅读实例登记不可用。', '检查用户目录的位置和权限后重试。', { reason });
}

async function localEntry(filename: string) {
  try { return await lstat(filename); }
  catch (error) {
    if (systemCode(error) !== 'ENOENT') throw error;
  }
}

async function registry(projectRoot: string) {
  const directory = path.join(await realpath(homedir()), '.aftertaste-reader');
  for (let candidate = projectRoot; ; candidate = path.dirname(candidate)) {
    const repository = await localEntry(path.join(candidate, '.git'));
    const relative = path.relative(candidate, directory);
    const inside = relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
    if (inside && (candidate === projectRoot || repository)) {
      throw stateError('STATE_INSIDE_PROJECT');
    }
    if (repository || candidate === path.dirname(candidate)) break;
  }
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const info = await lstat(directory);
  if (!info.isDirectory() || (process.getuid && (info.uid !== process.getuid() || (info.mode & 0o077) !== 0))) {
    throw stateError('INVALID_STATE_DIRECTORY');
  }
  const filename = path.join(directory, 'instances.sqlite');
  const file = await localEntry(filename);
  if (file && (!file.isFile() || file.nlink !== 1)) throw stateError('INVALID_STATE_FILE');
  return new DatabaseSync(filename);
}

function validInstance(row: Record<string, unknown> | undefined): row is Instance & Record<string, unknown> {
  return !!row && typeof row.port === 'number' && Number.isInteger(row.port) && row.port >= 1 && row.port <= 65535 &&
    typeof row.secret === 'string' && /^[a-f0-9]{64}$/u.test(row.secret);
}

type Contact = 'confirmed' | 'gone' | 'unknown';

function contact(instance: Instance, stop = false): Promise<Contact> {
  const challenge = randomBytes(16).toString('hex');
  const headers: Record<string, string> = { 'X-Aftertaste-Challenge': challenge };
  if (stop) headers['X-Aftertaste-Stop'] = instanceSignature(instance.secret, 'stop', challenge);
  return new Promise(resolve => {
    // Contact the listener directly even if the calling terminal configured an HTTP proxy.
    const call = request({ hostname: '127.0.0.1', port: instance.port, method: stop ? 'POST' : 'HEAD',
      agent: false, headers, signal: AbortSignal.timeout(1500) }, response => {
      response.resume();
      const proof = response.headers['x-aftertaste-proof'];
      const confirmed = response.statusCode === (stop ? 204 : 403) &&
        matches(typeof proof === 'string' ? proof : undefined, instanceSignature(instance.secret, 'proof', challenge));
      resolve(confirmed ? 'confirmed' : 'gone');
    });
    call.once('error', error => resolve(systemCode(error) === 'ECONNREFUSED' ? 'gone' : 'unknown'));
    call.end();
  });
}

async function stopInstance(instance: Instance) {
  const deadline = Date.now() + 5000;
  await contact(instance, true);
  while (Date.now() < deadline) {
    if (await contact(instance) === 'gone') return;
    await delay(50);
  }
  throw new ReaderError('READER_STOP_FAILED', '未能确认阅读服务已停止。', '稍后再次执行 stop-reader。');
}

async function manage(operation: InstanceOperation, input: string, port: number): Promise<InstanceReply> {
  const projectRoot = await readerProject(input);
  let reader: Awaited<ReturnType<typeof startReader>> | undefined;
  let database: DatabaseSync | undefined;
  let writingRegistry = true;
  try {
    database = await registry(projectRoot);
    database.exec('PRAGMA busy_timeout = 10000');
    // The OS releases the SQLite write lock even if a launcher dies mid-start.
    database.exec('BEGIN IMMEDIATE');
    database.exec('CREATE TABLE IF NOT EXISTS instances_v1 (project TEXT PRIMARY KEY, port INTEGER, secret TEXT)');
    const previous = database.prepare('SELECT port, secret FROM instances_v1 WHERE project = ?').get(projectRoot);
    writingRegistry = false;
    const registered = validInstance(previous) ? previous : undefined;
    const presence = registered ? await contact(registered) : 'gone';
    if (presence === 'unknown') {
      throw new ReaderError('READER_INSTANCE_UNVERIFIED', '已有阅读实例暂时无法核实。', '稍后重试。原实例登记已保留。');
    }
    const running = presence === 'confirmed' ? registered : undefined;
    if (operation === 'stop-reader') {
      if (running) await stopInstance(running);
      writingRegistry = true;
      database.prepare('DELETE FROM instances_v1 WHERE project = ?').run(projectRoot);
      database.exec('COMMIT');
      return { ok: true, status: running ? 'stopped' : 'not-running', projectRoot };
    }
    if (running) {
      return { ok: true, status: 'ready', origin: origin(running.port),
        entryPath: readerEntryPath(instanceSignature(running.secret, 'entry')), projectRoot, reused: true };
    }
    const secret = randomBytes(32).toString('hex');
    let stopping = false;
    const stop = () => {
      if (stopping) return;
      stopping = true;
      void reader?.server.close().catch(() => { process.exitCode = 1; });
    };
    const control = { key: secret, stop };
    try {
      reader = await startReader(projectRoot, port, control);
    } catch (error) {
      if (!(error instanceof ReaderError) || error.code !== 'PORT_IN_USE') throw error;
      reader = await startReader(projectRoot, 0, control);
    }
    writingRegistry = true;
    const address = reader.server.server.address();
    if (!address || typeof address === 'string') throw new Error('LISTENER_NOT_BOUND');
    database.prepare('INSERT OR REPLACE INTO instances_v1 VALUES (?, ?, ?)').run(projectRoot, address.port, secret);
    database.exec('COMMIT');
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    return { ok: true, status: 'ready', origin: origin(address.port),
      entryPath: readerEntryPath(instanceSignature(secret, 'entry')), projectRoot, reused: false };
  } catch (error) {
    await reader?.server.close();
    if (writingRegistry && !(error instanceof ReaderError)) throw stateError(systemCode(error));
    throw error;
  } finally {
    database?.close();
  }
}

const [operation, project, port] = process.argv.slice(2);
if (process.send && project && (operation === 'open-reader' || operation === 'stop-reader')) {
  const reply = await manage(operation, project, Number(port)).catch((error: unknown): InstanceReply =>
    ({ ok: false, error: readerProblem(error) }));
  if (process.connected) {
    process.send(reply);
    process.disconnect?.();
  }
}
