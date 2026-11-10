// Serveur : API de synchronisation par foyer, lecture du folder, IA facultative, fichiers statiques de la PWA.
import { createServer } from 'node:http';
import { readFile, stat, readdir } from 'node:fs/promises';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { join, extname, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.js';
import { readFolder, runCycle, startScheduler, importManual } from './folder/job.js';
import { aiEnabled, generateRecipe } from './ai.js';
import { folderSlugFor, weekStartFor, addDays, todayStr } from '../shared/util.js';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PUBLIC = join(ROOT, 'public');
const SHARED = join(ROOT, 'shared');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};

export async function buildHash() {
  const h = createHash('sha1');
  for (const dir of [PUBLIC, SHARED]) {
    for (const f of (await readdir(dir, { recursive: true })).sort()) {
      try { const s = await stat(join(dir, f)); if (s.isFile()) h.update(`${f}:${s.mtimeMs}:${s.size}`); } catch { /* ignoré */ }
    }
  }
  return h.digest('hex').slice(0, 10);
}

const sha = (x) => createHash('sha256').update(String(x)).digest();
const PAIR_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans 0/O/1/I : se tape facilement sur un téléphone
const newPairCode = () => Array.from(randomBytes(8), (b) => PAIR_ALPHABET[b % PAIR_ALPHABET.length]).join('');
const normCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

export function createApp({ dbPath = process.env.DB_PATH || join(ROOT, 'data', 'app.db'), log = console.log, env = process.env } = {}) {
  const db = openDb(dbPath);
  // Exposition : en mode public, aucune création de foyer sans code d'accès (données de santé, usage personnel).
  const SIGNUP_CODE = env.SIGNUP_CODE || '';
  const PUBLIC_MODE = env.PUBLIC_MODE === '1';
  const TRUST_PROXY = env.TRUST_PROXY === '1';
  const MAX_HOUSEHOLDS = Number(env.MAX_HOUSEHOLDS) || (PUBLIC_MODE ? 3 : 0);
  const signupMode = () => (SIGNUP_CODE ? 'code' : PUBLIC_MODE ? 'closed' : 'open');
  const pairings = new Map(); // code → { hid, exp }
  const failures = new Map(); // ip → [timestamps] (codes erronés)
  const clientIp = (req) => (TRUST_PROXY ? req.headers['fly-client-ip'] || String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() : '') || req.socket.remoteAddress || '?';
  const tooMany = (map, ip, max, windowMs) => {
    const now = Date.now();
    const recent = (map.get(ip) ?? []).filter((t) => now - t < windowMs);
    map.set(ip, recent);
    return recent.length >= max;
  };
  const noteHit = (map, ip) => map.set(ip, [...(map.get(ip) ?? []), Date.now()]);
  const listeners = new Map(); // hid → Set<res>
  const created = new Map(); // ip → [timestamps]
  let build = 'dev';

  const notify = (hid) => {
    const rev = db.rev(hid);
    for (const res of listeners.get(hid) ?? []) res.write(`data: ${JSON.stringify({ rev })}\n\n`);
  };
  const notifyAll = () => db.householdIds().forEach(notify);

  const SECURITY = {
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'x-frame-options': 'DENY',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  };
  const CSP = "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";
  const json = (res, code, body) => {
    res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...SECURITY });
    res.end(JSON.stringify(body));
  };
  const readBody = (req, max = 2_000_000) =>
    new Promise((ok, ko) => {
      let size = 0; const chunks = [];
      req.on('data', (c) => { size += c.length; if (size > max) { ko(Object.assign(new Error('corps trop volumineux'), { code: 413 })); req.destroy(); } else chunks.push(c); });
      req.on('end', () => { try { ok(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch { ko(Object.assign(new Error('JSON invalide'), { code: 400 })); } });
      req.on('error', ko);
    });
  const auth = (req, url) => {
    const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || url.searchParams.get('t') || '';
    const [hid, token] = bearer.split('.');
    return db.authenticate(hid, token);
  };

  async function api(req, res, url) {
    const path = url.pathname;
    if (path === '/api/config' && req.method === 'GET') {
      return json(res, 200, { ai: aiEnabled(), build, folderSlug: folderSlugFor(weekStartFor(todayStr())), today: todayStr(), signup: signupMode() });
    }
    if (path === '/api/assets' && req.method === 'GET') {
      const files = [];
      for (const [dir, prefix] of [[join(PUBLIC, 'js'), '/js'], [SHARED, '/shared']]) {
        for (const f of await readdir(dir)) if (f.endsWith('.js')) files.push(`${prefix}/${f}`);
      }
      return json(res, 200, files);
    }
    if (path === '/api/households' && req.method === 'POST') {
      const ip = clientIp(req);
      if (signupMode() === 'closed') return json(res, 403, { error: 'Ce serveur n’accepte pas de nouveau foyer (aucun code d’accès défini).', signup: 'closed' });
      if (tooMany(created, ip, 10, 3600_000)) return json(res, 429, { error: 'Trop de créations de foyer, réessayez plus tard.' });
      if (SIGNUP_CODE) {
        if (tooMany(failures, ip, 5, 3600_000)) return json(res, 429, { error: 'Trop d’essais : réessayez dans une heure.' });
        const body = await readBody(req, 10_000);
        const a = sha(normCode(body.code)), b = sha(normCode(SIGNUP_CODE));
        if (!normCode(body.code) || !timingSafeEqual(a, b)) { noteHit(failures, ip); return json(res, 403, { error: 'Code d’accès incorrect.', signup: 'code' }); }
      }
      if (MAX_HOUSEHOLDS && db.householdCount() >= MAX_HOUSEHOLDS) return json(res, 403, { error: 'Nombre maximal de foyers atteint sur ce serveur.', signup: 'closed' });
      noteHit(created, ip);
      const { id, token } = db.createHousehold();
      // le nouveau foyer reçoit tout de suite les promos déjà lues
      for (const f of db.listFolders()) {
        const row = db.getFolder(f.slug);
        if (row?.items_json) {
          const items = JSON.parse(row.items_json);
          db.serverWrite(id, [
            ...items.map((it) => ({ coll: 'promos', id: it.id, data: it })),
            { coll: 'folders', id: f.slug, data: { slug: f.slug, validFrom: f.valid_from, validTo: f.valid_to, fetchedAt: f.fetched_at, status: f.status, message: f.message, count: items.length } },
          ]);
        }
      }
      return json(res, 201, { credentials: `${id}.${token}` });
    }
    // Un nouvel appareil échange un code d'appairage (valable 10 min, un seul usage) contre son propre jeton.
    if (path === '/api/pair/redeem' && req.method === 'POST') {
      const ip = clientIp(req);
      if (tooMany(failures, ip, 8, 3600_000)) return json(res, 429, { error: 'Trop d’essais : réessayez dans une heure.' });
      const body = await readBody(req, 10_000);
      const code = normCode(body.code);
      const p = pairings.get(code);
      if (!p || p.exp < Date.now()) { noteHit(failures, ip); return json(res, 404, { error: 'Code invalide ou expiré.' }); }
      pairings.delete(code);
      if (!db.hasHousehold(p.hid)) return json(res, 404, { error: 'Foyer introuvable.' });
      return json(res, 200, { credentials: `${p.hid}.${db.addToken(p.hid, body.label || 'appareil')}` });
    }
    const h = auth(req, url);
    if (!h) return json(res, 401, { error: 'Foyer inconnu ou jeton invalide.' });

    if (path === '/api/pair' && req.method === 'POST') {
      for (const [c, p] of pairings) if (p.exp < Date.now() || p.hid === h.id) pairings.delete(c);
      const code = newPairCode();
      pairings.set(code, { hid: h.id, exp: Date.now() + 10 * 60_000 });
      return json(res, 200, { code: `${code.slice(0, 4)}-${code.slice(4)}`, expiresInSeconds: 600 });
    }
    if (path === '/api/events' && req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive', 'x-accel-buffering': 'no' });
      res.write(`retry: 3000\ndata: ${JSON.stringify({ rev: db.rev(h.id) })}\n\n`);
      if (!listeners.has(h.id)) listeners.set(h.id, new Set());
      listeners.get(h.id).add(res);
      const ka = setInterval(() => res.write(': ka\n\n'), 25000);
      req.on('close', () => { clearInterval(ka); listeners.get(h.id)?.delete(res); });
      return;
    }
    if (path === '/api/sync' && req.method === 'POST') {
      const body = await readBody(req);
      const out = db.sync(h.id, body.since, Array.isArray(body.changes) ? body.changes.slice(0, 2000) : []);
      if (out.changed) notify(h.id);
      return json(res, 200, { rev: out.rev, records: out.records });
    }
    if (path === '/api/folder/status' && req.method === 'GET') return json(res, 200, { folders: db.listFolders() });
    if (path === '/api/folder/refresh' && req.method === 'POST') {
      const body = await readBody(req);
      const slug = body.slug && /^w\d{2}-\d{4}-fr$/.test(body.slug) ? body.slug : folderSlugFor(weekStartFor(todayStr()));
      const r = await readFolder(db, slug, { force: true });
      notifyAll();
      return json(res, 200, r);
    }
    if (path === '/api/folder/import' && req.method === 'POST') {
      const body = await readBody(req, 1_000_000);
      const slug = body.slug && /^w\d{2}-\d{4}-fr$/.test(body.slug) ? body.slug : folderSlugFor(weekStartFor(todayStr()));
      try {
        const r = importManual(db, { slug, validFrom: body.validFrom, validTo: body.validTo, text: body.text, items: body.items });
        notifyAll();
        return json(res, 200, { ok: true, ...r });
      } catch (e) { return json(res, 400, { error: e.message }); }
    }
    if (path === '/api/ai/recipe' && req.method === 'POST') {
      if (!aiEnabled()) return json(res, 501, { error: 'IA non configurée (ANTHROPIC_API_KEY).' });
      const body = await readBody(req, 100_000);
      try { return json(res, 200, { recipe: await generateRecipe(body) }); }
      catch (e) { return json(res, 422, { error: e.message }); }
    }
    if (path === '/api/export' && req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'content-disposition': 'attachment; filename="on-mange-quoi-export.json"' });
      return res.end(JSON.stringify({ exportedAt: new Date().toISOString(), records: db.exportAll(h.id) }, null, 1));
    }
    if (path === '/api/household' && req.method === 'DELETE') {
      db.deleteHousehold(h.id);
      for (const r of listeners.get(h.id) ?? []) r.end();
      listeners.delete(h.id);
      return json(res, 200, { ok: true });
    }
    return json(res, 404, { error: 'Introuvable' });
  }

  async function serveStatic(req, res, url) {
    let p = decodeURIComponent(url.pathname);
    if (p === '/') p = '/index.html';
    let base = PUBLIC;
    if (p.startsWith('/shared/')) { base = SHARED; p = p.slice('/shared'.length); }
    const file = normalize(join(base, p));
    if (file !== base && !file.startsWith(base + sep)) { res.writeHead(403); return res.end('Interdit'); }
    try {
      let buf = await readFile(file);
      const ext = extname(file);
      if (p === '/sw.js') buf = Buffer.from(buf.toString('utf8').replace('__BUILD__', build));
      res.writeHead(200, {
        'content-type': MIME[ext] || 'application/octet-stream',
        'cache-control': 'no-cache',
        ...SECURITY,
        ...(ext === '.html' ? { 'content-security-policy': CSP } : {}),
        ...(TRUST_PROXY && req.headers['x-forwarded-proto'] === 'https' ? { 'strict-transport-security': 'max-age=31536000' } : {}),
      });
      res.end(buf);
    } catch {
      if (!extname(p)) { // navigation côté client
        try { const buf = await readFile(join(PUBLIC, 'index.html')); res.writeHead(200, { 'content-type': MIME['.html'], ...SECURITY, 'content-security-policy': CSP }); return res.end(buf); } catch { /* 404 */ }
      }
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Introuvable');
    }
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    try {
      if (url.pathname.startsWith('/api/')) await api(req, res, url);
      else await serveStatic(req, res, url);
    } catch (e) {
      log('[erreur]', req.method, url.pathname, e.message);
      if (!res.headersSent) json(res, e.code && Number.isInteger(e.code) && e.code < 600 ? e.code : 500, { error: e.message });
      else res.end();
    }
  });

  return {
    server, db,
    async start(port = Number(process.env.PORT) || 3000, host = process.env.HOST || '0.0.0.0') {
      build = await buildHash();
      await new Promise((ok) => server.listen(port, host, ok));
      return server.address();
    },
    scheduler: () => startScheduler(db, log),
    notifyAll,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = createApp();
  const addr = await app.start();
  console.log(`On mange quoi ce soir ? → http://localhost:${addr.port}`);
  if (process.env.FOLDER_AUTO !== '0') app.scheduler();
  if (!aiEnabled()) console.log('IA désactivée (définissez ANTHROPIC_API_KEY pour générer de nouvelles recettes).');
}
