import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

async function filesDigest(root) {
  const hash = createHash('sha256');
  for (const name of (await readdir(root, { recursive: true, withFileTypes: true }))
    .filter(item => item.isFile()).map(item => path.join(item.parentPath, item.name)).sort()) {
    hash.update(name).update(await readFile(name));
  }
  return hash.digest('hex');
}

export async function checkAnonymous(origin, project, build) {
  const data = path.join(project, 'docs/aftertaste');
  const before = await filesDigest(data);
  const assets = await readdir(path.join(build, 'web/assets'));
  const loop = '/api/loops/order-quantity';
  const reads = ['/', ...assets.map(name => '/assets/' + name), '/api/documents',
    '/api/document?path=docs%2Faftertaste%2Fcurrent%2Fsrc%2Frules.mjs.md', '/api/dependency-canvas',
    '/api/loops', loop, loop + '/route', '/api/bookmarks', '/api/notes', '/api/understanding-marks',
    '/reader-session', '/reader-session?token=wrong', '/missing/private-name', '/api/loops/%xx', '/api/document?bogus=1'];
  const writes = { '/api/bookmarks': 'bookmarks', '/api/notes': 'notes', '/api/understanding-marks': 'understanding-marks',
    '/api/dependency-layout': 'layout', [loop + '/layout']: 'layout' };
  const message = '请打开本次阅读的私密入口。';
  async function check(route, options) {
    const response = await fetch(origin + route, options);
    assert.equal(response.status, 403, route);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('www-authenticate'), null);
    assert.ok((await response.text()) === message, 'generic denial without request data');
  }
  for (const route of reads) await check(route);
  for (const [route, marker] of Object.entries(writes)) await check(route, {
    method: 'PUT', headers: { 'content-type': 'application/json', ['x-aftertaste-' + marker]: '1' },
    body: JSON.stringify({ action: 'save', id: randomUUID(), previousRevision: null, revision: randomUUID(), body: 'anonymous', tags: [] }),
  });
  await check('/unknown', { method: 'PATCH' });
  await check('/api/notes', { headers: { authorization: 'Basic invalid' } });
  assert.equal(await filesDigest(data), before);
  return assets.length;
}
