import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer, type RequestListener } from 'node:http';

export const contentPolicy = "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; font-src 'self'; img-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const denied = '请打开本次阅读的私密入口。';

export function matches(value: string | undefined, expected: string): boolean {
  if (!value || value.length !== expected.length) return false;
  const bytes = Buffer.from(value);
  const reference = Buffer.from(expected);
  return bytes.length === reference.length && timingSafeEqual(bytes, reference);
}

export interface ReaderControl {
  readonly key: string;
  readonly stop: () => void;
}

export function instanceSignature(key: string, purpose: 'entry' | 'proof' | 'stop', challenge = ''): string {
  return createHmac('sha256', key).update(purpose + ':' + challenge).digest('base64url');
}

export function readerEntryPath(token: string): string {
  return '/reader-session?token=' + token;
}

export function readerSession(control?: ReaderControl) {
  const entryPath = readerEntryPath(control ? instanceSignature(control.key, 'entry') : randomBytes(32).toString('base64url'));
  const password = randomBytes(32).toString('base64url');
  const authorization = 'Basic ' + Buffer.from('reader:' + password).toString('base64');

  // Check the raw request before the router can decode a path or report a bad URL.
  function serverFactory(dispatch: RequestListener) {
    return createServer((request, response) => {
      response.setHeaders(new Headers({
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'Cross-Origin-Resource-Policy': 'same-origin',
        'X-Frame-Options': 'DENY',
        'Content-Security-Policy': contentPolicy,
      }));
      const { host, origin, 'sec-fetch-site': site } = request.headers;
      const port = request.socket.localPort;
      const localHost = host === `127.0.0.1:${port}` || host === `localhost:${port}` ||
        (port === 80 && (host === '127.0.0.1' || host === 'localhost'));
      const local = localHost &&
        (origin === undefined || origin === `http://${host}`) &&
        (site === undefined || site === 'same-origin' || site === 'none');
      const session = matches(request.headers.authorization, authorization);
      const challenge = request.headers['x-aftertaste-challenge'];
      if (control && local && request.url === '/' && typeof challenge === 'string' && /^[a-f0-9]{32}$/u.test(challenge)) {
        if (request.method === 'HEAD') {
          response.setHeader('X-Aftertaste-Proof', instanceSignature(control.key, 'proof', challenge));
        } else if (request.method === 'POST' &&
            matches(typeof request.headers['x-aftertaste-stop'] === 'string' ? request.headers['x-aftertaste-stop'] : undefined,
              instanceSignature(control.key, 'stop', challenge))) {
          response.setHeader('X-Aftertaste-Proof', instanceSignature(control.key, 'proof', challenge));
          response.once('finish', control.stop);
          response.writeHead(204).end();
          return;
        }
      }
      if (local && request.method === 'GET' && matches(request.url, entryPath)) {
        if (request.headers['x-aftertaste-session'] === '1') {
          // Keep one protection space per origin so re-entry replaces its cached password.
          if (!session) response.setHeader('WWW-Authenticate', 'Basic realm="aftertaste-reader"');
          response.writeHead(session ? 204 : 401).end();
          return;
        }
        if (request.headers.accept === 'application/json') {
          response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ username: 'reader', password }));
          return;
        }
        const nonce = randomBytes(18).toString('base64');
        response.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Security-Policy': contentPolicy.replace("script-src 'self'", `script-src 'nonce-${nonce}'`),
        }).end(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>回味</title><body><noscript>${denied}</noscript>
<script nonce="${nonce}">
const entry = location.pathname + location.search;
history.replaceState(null, '', '/' + location.hash);
const session = new XMLHttpRequest();
session.open('GET', entry, true, 'reader', '${password}');
session.setRequestHeader('X-Aftertaste-Session', '1');
const failed = () => { document.body.textContent = '${denied}'; };
session.onerror = failed;
session.onload = () => { if (session.status === 204) location.reload(); else failed(); };
session.send();
</script></body></html>`);
        return;
      }
      if (!local || !session || request.url?.split('?')[0] === '/reader-session') {
        response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' }).end(denied);
        return;
      }
      if (request.method === 'GET' && request.url === '/api/reader-entry' && request.headers['x-aftertaste-entry'] === '1') {
        response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true, entryPath }));
        return;
      }
      dispatch(request, response);
    });
  }
  return { entryPath, serverFactory };
}
