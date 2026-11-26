import { randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer, type RequestListener } from 'node:http';

export const contentPolicy = "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; font-src 'self'; img-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const denied = '请从启动终端打开本次阅读入口。';

function matches(value: string | undefined, expected: string): boolean {
  if (!value || value.length !== expected.length) return false;
  const bytes = Buffer.from(value);
  const reference = Buffer.from(expected);
  return bytes.length === reference.length && timingSafeEqual(bytes, reference);
}

export function readerSession() {
  const entryPath = '/reader-session?token=' + randomBytes(32).toString('base64url');
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
      dispatch(request, response);
    });
  }
  return { entryPath, serverFactory };
}
