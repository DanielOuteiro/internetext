import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listCatalog, render, warmable } from './lib/registry.js';

const PORT = +(process.env.PORT || 8888);
const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), 'public');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.otf': 'font/otf', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

const json = (res, code, body) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname === '/api/pages') {
      return json(res, 200, listCatalog());
    }
    const m = url.pathname.match(/^\/api\/page\/(\d{3})$/);
    if (m) {
      const p = await render(+m[1]);
      return p ? json(res, 200, p) : json(res, 404, { error: 'not found', num: +m[1] });
    }
    const file = normalize(join(ROOT, url.pathname === '/' ? 'index.html' : url.pathname));
    if (!file.startsWith(ROOT)) return json(res, 403, { error: 'forbidden' });
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(data);
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'EISDIR') return json(res, 404, { error: 'not found' });
    console.error(err);
    json(res, 500, { error: 'internal' });
  }
}).listen(PORT, () => {
  console.log(`Internetext on http://localhost:${PORT}`);
  // Warm the cache sequentially so first views are instant without tripping rate limits.
  (async () => { for (const n of warmable()) await render(n); })();
});
