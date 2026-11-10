import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { openDb } from '../server/db.js';
import { readFolder, runCycle, importManual } from '../server/folder/job.js';
import { createApp } from '../server/index.js';
import { toRecipe, buildPrompt, generateRecipe } from '../server/ai.js';

const FIXTURE = new URL('../data/folders/w45-2026-fr.pages.json', import.meta.url);
const hasFixture = existsSync(FIXTURE);
const spreadsFromFixture = () => JSON.parse(readFileSync(FIXTURE, 'utf8')).map((p) => ({ pages: [{ text: p.text }] }));
const fakeFetch = (spreads, status = 200) => async () => ({ ok: status === 200, status, json: async () => spreads });

// ---------- Base de données & synchronisation ----------
test('synchronisation : dernière écriture gagnante, révisions, tombstones', () => {
  const db = openDb(':memory:');
  const { id, token } = db.createHousehold();
  assert.ok(db.authenticate(id, token));
  assert.equal(db.authenticate(id, 'mauvais'), null);
  assert.equal(db.authenticate('inconnu', token), null);

  let out = db.sync(id, 0, [{ coll: 'stock', id: 'a', data: { id: 'a', qty: 5 }, ts: 1000 }]);
  assert.equal(out.records.length, 1);
  const rev1 = out.rev;
  // une écriture plus ancienne est ignorée
  out = db.sync(id, rev1, [{ coll: 'stock', id: 'a', data: { id: 'a', qty: 1 }, ts: 500 }]);
  assert.equal(out.records.length, 0);
  assert.equal(db.exportAll(id)[0].data.qty, 5);
  // une plus récente gagne
  out = db.sync(id, rev1, [{ coll: 'stock', id: 'a', data: { id: 'a', qty: 9 }, ts: 2000 }]);
  assert.equal(out.records[0].data.qty, 9);
  // suppression = tombstone synchronisé
  out = db.sync(id, out.rev, [{ coll: 'stock', id: 'a', deleted: true, ts: 3000 }]);
  assert.equal(out.records[0].deleted, true);
  assert.equal(db.exportAll(id).length, 0);
  // collections inconnues refusées
  out = db.sync(id, out.rev, [{ coll: 'evil', id: 'x', data: {}, ts: 4000 }]);
  assert.equal(out.records.length, 0);
});

test('les foyers sont isolés', () => {
  const db = openDb(':memory:');
  const a = db.createHousehold();
  const b = db.createHousehold();
  db.sync(a.id, 0, [{ coll: 'profiles', id: 'p', data: { name: 'Alice' }, ts: 1 }]);
  assert.equal(db.sync(b.id, 0, []).records.length, 0);
  db.deleteHousehold(a.id);
  assert.equal(db.authenticate(a.id, a.token), null);
  assert.equal(db.exportAll(a.id).length, 0);
});

// ---------- Lecture du folder ----------
test('lecture du folder : succès, une seule lecture par folder, promos copiées chez chaque foyer', { skip: !hasFixture }, async () => {
  const db = openDb(':memory:');
  const h1 = db.createHousehold();
  const h2 = db.createHousehold();
  let calls = 0;
  const f = async (...a) => { calls++; return fakeFetch(spreadsFromFixture())(...a); };
  const r = await readFolder(db, 'w45-2026-fr', { fetchImpl: f });
  assert.equal(r.status, 'ok');
  assert.ok(r.count >= 90);
  for (const h of [h1, h2]) {
    const recs = db.sync(h.id, 0, []).records;
    assert.ok(recs.filter((x) => x.coll === 'promos').length >= 90);
    assert.equal(recs.find((x) => x.coll === 'folders').data.status, 'ok');
  }
  // 2e appel non forcé : pas de nouvelle lecture
  const again = await readFolder(db, 'w45-2026-fr', { fetchImpl: f });
  assert.equal(again.message, 'déjà lu');
  assert.equal(calls, 1);
  // relance manuelle trop rapide refusée
  const fast = await readFolder(db, 'w45-2026-fr', { fetchImpl: f, force: true });
  assert.match(fast.message, /minute/);
  assert.equal(calls, 1);
});

test('lecture du folder : folder pas encore en ligne, format cassé, erreur réseau', async () => {
  const db = openDb(':memory:');
  const hh = db.createHousehold();
  const pending = await readFolder(db, 'w46-2026-fr', { fetchImpl: fakeFetch({}, 404) });
  assert.equal(pending.status, 'pending');
  // format changé : plus de texte exploitable → signalé « à vérifier » plutôt que silencieux
  const broken = await readFolder(db, 'w47-2026-fr', { fetchImpl: fakeFetch([{ pages: [{ text: '' }, { text: 'rien' }] }]), force: true });
  assert.equal(broken.status, 'incomplete');
  assert.match(broken.message, /vérifier|importez/i);
  const net = await readFolder(db, 'w48-2026-fr', { fetchImpl: async () => { throw new Error('ECONNRESET'); } });
  assert.equal(net.status, 'error');
  assert.match(net.message, /import manuel/i);
  const folders = db.sync(hh.id, 0, []).records.filter((r) => r.coll === 'folders');
  assert.ok(folders.some((f) => f.data.status === 'error'));
});

test('cycle automatique : la semaine suivante n’est sondée que près de sa sortie', async () => {
  const db = openDb(':memory:');
  const urls = [];
  const f = async (u) => { urls.push(u); return { ok: false, status: 404, json: async () => ({}) }; };
  await runCycle(db, { today: '2026-11-06', fetchImpl: f }); // vendredi : le folder suivant sort jeudi → pas de sondage
  assert.equal(urls.filter((u) => u.includes('w46')).length, 0);
  await runCycle(db, { today: '2026-11-10', fetchImpl: f }); // mardi : sortie imminente
  assert.equal(urls.filter((u) => u.includes('w46')).length, 1);
});

test('import manuel (plan B) depuis du texte collé', () => {
  const db = openDb(':memory:');
  const hh = db.createHousehold();
  const r = importManual(db, { slug: 'w45-2026-fr', validFrom: '2026-11-05', validTo: '2026-11-11', text: 'DELHAIZE\nFilet de poulet\n600 g\n9,99 6,99\n\n-30\n\n%\n' });
  assert.equal(r.count, 1);
  const promo = db.sync(hh.id, 0, []).records.find((x) => x.coll === 'promos').data;
  assert.equal(promo.ingredientId, 'poulet-filet');
  assert.equal(promo.promo, 6.99);
  assert.equal(promo.validTo, '2026-11-11');
});

// ---------- API HTTP ----------
test('API HTTP : création du foyer, synchro authentifiée, export, suppression', async () => {
  const app = createApp({ dbPath: ':memory:', log: () => {} });
  const addr = await app.start(0, '127.0.0.1');
  const base = `http://127.0.0.1:${addr.port}`;
  const j = async (path, opts = {}) => { const r = await fetch(base + path, opts); return { status: r.status, body: await r.json().catch(() => null) }; };
  try {
    assert.equal((await j('/api/config')).body.ai, false);
    const created = await j('/api/households', { method: 'POST', body: '{}' });
    assert.equal(created.status, 201);
    const bearer = { authorization: `Bearer ${created.body.credentials}`, 'content-type': 'application/json' };
    assert.equal((await j('/api/sync', { method: 'POST', body: '{}' })).status, 401);
    const s = await j('/api/sync', { method: 'POST', headers: bearer, body: JSON.stringify({ since: 0, changes: [{ coll: 'profiles', id: 'p1', data: { id: 'p1', name: 'Alice', allergens: ['lait'] }, ts: 10 }] }) });
    assert.equal(s.status, 200);
    assert.equal(s.body.records[0].data.name, 'Alice');
    const exp = await j('/api/export', { headers: bearer });
    assert.equal(exp.body.records.length, 1);
    // fichiers statiques : pas d'évasion de répertoire
    assert.equal((await fetch(`${base}/shared/..%2f..%2fpackage.json`)).status === 200, false);
    assert.equal((await fetch(`${base}/`)).status, 200);
    assert.equal((await j('/api/household', { method: 'DELETE', headers: bearer })).status, 200);
    assert.equal((await j('/api/sync', { method: 'POST', headers: bearer, body: '{}' })).status, 401);
  } finally {
    await new Promise((ok) => app.server.close(ok));
  }
});

// ---------- IA : sorties structurées revalidées ----------
const good = { name: 'Poêlée express', emoji: '🥘', prep: 5, cook: 10, diff: 'facile', eq: ['plaques'], ing: [{ id: 'pates', q: 90 }, { id: 'champignons', q: 100 }, { id: 'huile-olive', q: 5 }], steps: [{ t: 'Cuire les pâtes.', timer: 9 }, { t: 'Poêler les champignons.' }], keep: '2 jours au frigo' };

test('IA : une recette valide est convertie au format de l’app', () => {
  const r = toRecipe(good, { meal: 'souper', cat: 'express', allowed: ['pates', 'champignons'] });
  assert.equal(r.source, 'ia');
  assert.deepEqual(r.ing[0], ['pates', 90]);
  assert.deepEqual(r.steps[0], ['Cuire les pâtes.', 9]);
});
test('IA : ingrédient non autorisé, inconnu ou temps trop long → refus', () => {
  assert.throws(() => toRecipe({ ...good, ing: [{ id: 'pates', q: 90 }, { id: 'poulet-filet', q: 100 }] }, { cat: 'express', allowed: ['pates'] }), /non autorisé/);
  assert.throws(() => toRecipe({ ...good, ing: [{ id: 'licorne', q: 1 }] }, { cat: 'express' }), /inconnu/);
  assert.throws(() => toRecipe({ ...good, prep: 30, cook: 30 }, { cat: 'express' }), /temps total/);
  assert.throws(() => toRecipe({ ...good, ing: [{ id: 'pates', q: 0 }] }, { cat: 'express' }), /quantité/);
});
test('IA : le prompt n’envoie aucune donnée personnelle, seulement des ingrédients autorisés', () => {
  const p = buildPrompt({ meal: 'souper', cat: 'express', allowed: ['pates', 'riz'], prefer: ['pâtes farcies'] });
  assert.match(p.user, /pates \(Pâtes, g\)/);
  assert.doesNotMatch(p.user, /poulet-filet/);
});
test('IA : appel API simulé (clé absente → désactivée)', async () => {
  delete process.env.ANTHROPIC_API_KEY;
  await assert.rejects(() => generateRecipe({ cat: 'express' }), /désactivée/);
  process.env.ANTHROPIC_API_KEY = 'test-key';
  try {
    let seen;
    const f = async (url, opts) => { seen = { url, headers: opts.headers, body: JSON.parse(opts.body) }; return { ok: true, json: async () => ({ content: [{ type: 'text', text: 'Voici :\n' + JSON.stringify(good) }] }) }; };
    const r = await generateRecipe({ cat: 'express', allowed: ['pates', 'champignons'] }, f);
    assert.equal(r.name, 'Poêlée express');
    assert.equal(seen.url, 'https://api.anthropic.com/v1/messages');
    assert.equal(seen.headers['x-api-key'], 'test-key');
  } finally { delete process.env.ANTHROPIC_API_KEY; }
});

// ---------- Exposition publique : verrouillage et appairage ----------
const withApp = async (env, fn) => {
  const app = createApp({ dbPath: ':memory:', log: () => {}, env });
  const addr = await app.start(0, '127.0.0.1');
  const base = `http://127.0.0.1:${addr.port}`;
  const j = async (path, opts = {}) => { const r = await fetch(base + path, opts); return { status: r.status, body: await r.json().catch(() => null), headers: r.headers }; };
  try { await fn({ j, base, app }); } finally { await new Promise((ok) => app.server.close(ok)); }
};
const post = (body, headers = {}) => ({ method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

test('mode public sans code : aucune création de foyer', async () => {
  await withApp({ PUBLIC_MODE: '1' }, async ({ j }) => {
    assert.equal((await j('/api/config')).body.signup, 'closed');
    const r = await j('/api/households', post({}));
    assert.equal(r.status, 403);
    assert.equal(r.body.signup, 'closed');
  });
});

test('code d’accès : refusé si faux, accepté si juste, essais limités', async () => {
  await withApp({ PUBLIC_MODE: '1', SIGNUP_CODE: 'Poulet-Roti 42' }, async ({ j }) => {
    assert.equal((await j('/api/config')).body.signup, 'code');
    assert.equal((await j('/api/households', post({}))).status, 403);
    assert.equal((await j('/api/households', post({ code: 'mauvais' }))).status, 403);
    // la comparaison ignore casse, espaces et tirets
    const ok = await j('/api/households', post({ code: 'poulet roti42' }));
    assert.equal(ok.status, 201);
    assert.ok(ok.body.credentials.includes('.'));
  });
  await withApp({ PUBLIC_MODE: '1', SIGNUP_CODE: 'secret' }, async ({ j }) => {
    for (let i = 0; i < 5; i++) assert.equal((await j('/api/households', post({ code: 'non' + i }))).status, 403);
    assert.equal((await j('/api/households', post({ code: 'secret' }))).status, 429, 'après 5 échecs, même le bon code est bloqué un temps');
  });
});

test('nombre de foyers plafonné en mode public', async () => {
  await withApp({ PUBLIC_MODE: '1', SIGNUP_CODE: 'x1', MAX_HOUSEHOLDS: '2' }, async ({ j }) => {
    assert.equal((await j('/api/households', post({ code: 'x1' }))).status, 201);
    assert.equal((await j('/api/households', post({ code: 'x1' }))).status, 201);
    assert.equal((await j('/api/households', post({ code: 'x1' }))).status, 403);
  });
});

test('appairage d’un appareil : code à usage unique, jeton propre à l’appareil, même foyer', async () => {
  await withApp({}, async ({ j }) => {
    const created = await j('/api/households', post({}));
    const bearer = { authorization: `Bearer ${created.body.credentials}` };
    await j('/api/sync', post({ since: 0, changes: [{ coll: 'profiles', id: 'p1', data: { id: 'p1', name: 'Alice' }, ts: 5 }] }, bearer));
    assert.equal((await j('/api/pair', post({}))).status, 401, 'il faut être connecté pour générer un code');
    const pair = await j('/api/pair', post({}, bearer));
    assert.match(pair.body.code, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    const redeemed = await j('/api/pair/redeem', post({ code: pair.body.code.toLowerCase() }));
    assert.equal(redeemed.status, 200);
    assert.notEqual(redeemed.body.credentials, created.body.credentials, 'jeton distinct');
    // le nouvel appareil voit les données du foyer
    const s = await j('/api/sync', post({ since: 0 }, { authorization: `Bearer ${redeemed.body.credentials}` }));
    assert.equal(s.body.records.find((r) => r.coll === 'profiles').data.name, 'Alice');
    // le code ne sert qu'une fois
    assert.equal((await j('/api/pair/redeem', post({ code: pair.body.code }))).status, 404);
    // un jeton inventé ne passe pas
    assert.equal((await j('/api/sync', post({ since: 0 }, { authorization: `Bearer ${created.body.credentials.split('.')[0]}.${'0'.repeat(48)}` }))).status, 401);
    // supprimer le foyer coupe aussi l'accès du second appareil
    await j('/api/household', { method: 'DELETE', headers: bearer });
    assert.equal((await j('/api/sync', post({ since: 0 }, { authorization: `Bearer ${redeemed.body.credentials}` }))).status, 401);
  });
});

test('appairage : code erroné → échecs comptés et limités', async () => {
  await withApp({}, async ({ j }) => {
    for (let i = 0; i < 8; i++) assert.equal((await j('/api/pair/redeem', post({ code: 'AAAABBBB' }))).status, 404);
    assert.equal((await j('/api/pair/redeem', post({ code: 'AAAABBBB' }))).status, 429);
  });
});

test('en-têtes de sécurité : CSP stricte sur la page, pas d’évasion de répertoire', async () => {
  await withApp({}, async ({ base }) => {
    const r = await fetch(`${base}/`);
    assert.match(r.headers.get('content-security-policy'), /script-src 'self'/);
    assert.equal(r.headers.get('x-frame-options'), 'DENY');
    assert.equal(r.headers.get('referrer-policy'), 'no-referrer');
    assert.equal((await fetch(`${base}/..%2fserver%2fdb.js`)).status === 200, false);
    assert.equal((await fetch(`${base}/data/app.db`)).status === 200, false);
  });
});

test('derrière un proxy, les limites s’appliquent à l’IP du client, pas à celle du proxy', async () => {
  await withApp({ PUBLIC_MODE: '1', SIGNUP_CODE: 'secret', TRUST_PROXY: '1' }, async ({ j }) => {
    for (let i = 0; i < 5; i++) await j('/api/households', post({ code: 'non' }, { 'fly-client-ip': '203.0.113.9' }));
    assert.equal((await j('/api/households', post({ code: 'secret' }, { 'fly-client-ip': '203.0.113.9' }))).status, 429);
    assert.equal((await j('/api/households', post({ code: 'secret' }, { 'fly-client-ip': '198.51.100.7' }))).status, 201, 'un autre client n’est pas bloqué');
  });
});
