// Serveur de dev du banc d'essai : sert artifact/index.html enveloppé comme le fait la plateforme + une fausse base `db`.
import { createServer } from 'node:http';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const DB_FILE = process.env.DEV_DB || join(here, 'dev-db.json');
const docs = new Map(existsSync(DB_FILE) ? Object.entries(JSON.parse(readFileSync(DB_FILE, 'utf8'))) : []);
const persist = () => writeFileSync(DB_FILE, JSON.stringify(Object.fromEntries(docs)));
const SKELETON = (inner) => `<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${inner}</body></html>`;
createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/__harness.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(readFileSync(join(here, 'harness.js'))); }
  if (url.pathname.startsWith('/__db/')) {
    const body = await new Promise((ok) => { let s = ''; req.on('data', (c) => (s += c)); req.on('end', () => ok(JSON.parse(s || '{}'))); });
    const op = url.pathname.slice(6);
    res.writeHead(200, { 'content-type': 'application/json' });
    if (op === 'list') { const pre = body.c + '/'; return res.end(JSON.stringify({ docs: [...docs].filter(([p]) => p.startsWith(pre) && !p.slice(pre.length).includes('/')).map(([p, b]) => ({ id: p.slice(pre.length), body: b })) })); }
    if (op === 'get') return res.end(JSON.stringify({ doc: docs.has(body.path) ? { id: body.path.split('/').pop(), body: docs.get(body.path) } : null }));
    if (op === 'set') { docs.set(body.path, body.body); persist(); return res.end('{}'); }
    if (op === 'delete') { docs.delete(body.path); persist(); return res.end('{}'); }
  }
  const html = readFileSync(join(here, '..', 'index.html'), 'utf8');
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(SKELETON('<script src="/__harness.js"></script>' + html));
}).listen(Number(process.env.PORT) || 3300, '127.0.0.1', () => console.log('banc d\'essai : http://localhost:' + (process.env.PORT || 3300)));
