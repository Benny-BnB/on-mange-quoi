// Serveur de test local : sert docs/ ; /data/ vient de DATA_DIR (promos chiffrées de test) sinon de docs/data.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = resolve(fileURLToPath(new URL('../docs', import.meta.url)));
const DATA = process.env.DATA_DIR ? resolve(process.env.DATA_DIR) : join(ROOT, 'data');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png' };
createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const base = p.startsWith('/data/') ? DATA : ROOT;
  const file = normalize(join(base, p.startsWith('/data/') ? p.slice(6) : p === '/' ? 'index.html' : p));
  if (file !== base && !file.startsWith(base + sep)) { res.writeHead(403); return res.end(); }
  try { const buf = await readFile(file); res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(buf); }
  catch { res.writeHead(404); res.end('404'); }
}).listen(Number(process.env.PORT) || 3400, '127.0.0.1', () => console.log('site : http://localhost:' + (process.env.PORT || 3400)));
