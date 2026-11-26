import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repository = fileURLToPath(new URL('../../', import.meta.url));

const sessions = new Map();
const authorizedContexts = new WeakMap();

export async function registerEntry(entryUrl) {
  const { origin, hostname } = new URL(entryUrl);
  assert.equal(hostname, '127.0.0.1');
  const response = await fetch(entryUrl, { headers: { accept: 'application/json' }, redirect: 'error' });
  assert.equal(response.status, 200);
  const { username, password } = await response.json();
  const authorization = 'Basic ' + Buffer.from(username + ':' + password).toString('base64');
  sessions.set(origin, { entryUrl, authorization });
  return origin;
}

export async function startTestReader(project, port, buildDir = process.env.AFTERTASTE_BUILD ?? 'dist') {
  const { startReader } = await import(pathToFileURL(path.resolve(repository, buildDir, 'server/reader.js')));
  const reader = await startReader(project, port);
  try {
    await registerEntry(reader.entryUrl);
  } catch (error) {
    await reader.server.close();
    throw error;
  }
  reader.server.server.once('close', () => sessions.delete(reader.url));
  return reader;
}

function sessionFor(url) {
  const session = sessions.get(new URL(url).origin);
  assert.ok(session, 'reader instance has a terminal entry');
  return session;
}

export function readerFetch(url, options = {}) {
  const headers = new Headers(options.headers);
  headers.set('authorization', sessionFor(url).authorization);
  return fetch(url, { ...options, headers, redirect: 'error' });
}

export function fetchReaderRoute(route) {
  const request = route.request();
  return route.fetch({ headers: { ...request.headers(), authorization: sessionFor(request.url()).authorization }, maxRedirects: 0 });
}

export async function openReader(page, url) {
  const { entryUrl } = sessionFor(url);
  const context = page.context();
  const known = authorizedContexts.get(context) ?? new Set();
  if (known.has(entryUrl)) {
    await page.goto(url);
    return;
  }
  try {
    await page.goto(entryUrl + new URL(url).hash);
  } catch {
    throw new Error('无法打开终端的私密入口');
  }
  await page.locator('meta[name="reader-editor-style"]').waitFor({ state: 'attached' });
  known.add(entryUrl);
  authorizedContexts.set(context, known);
}
