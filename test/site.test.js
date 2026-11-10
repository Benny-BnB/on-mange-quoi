import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { seal, open } from '../shared/seal.js';
import { updateFolder } from '../scripts/update-folder.js';

const FIXTURE = new URL('../data/folders/w45-2026-fr.pages.json', import.meta.url);
const hasFixture = existsSync(FIXTURE);
const pages = hasFixture ? JSON.parse(readFileSync(FIXTURE, 'utf8')) : [];
const KEY = 'une phrase de test assez longue';
const tmp = () => mkdtempSync(join(tmpdir(), 'omq-'));

// ---------- Chiffrement ----------
test('seal/open : aller-retour, mauvais code et fichier altéré refusés', async () => {
  const data = { folders: { 'w45-2026-fr': { items: [{ name: 'Yaourt à la grecque', promo: 2.39 }] } } };
  const s = await seal(data, KEY, { iterations: 1000 });
  assert.equal(s.v, 1);
  assert.ok(!JSON.stringify(s).includes('Yaourt'), 'le contenu ne doit pas apparaître en clair');
  assert.deepEqual(await open(s, KEY), data);
  await assert.rejects(() => open(s, 'autre code'), /Code incorrect/);
  const tampered = { ...s, ct: s.ct.slice(0, -4) + (s.ct.endsWith('AAAA') ? 'BBBB' : 'AAAA') };
  await assert.rejects(() => open(tampered, KEY), /Code incorrect/);
  const s2 = await seal(data, KEY, { iterations: 1000 });
  assert.notEqual(s.ct, s2.ct, 'sel et vecteur aléatoires : deux chiffrements diffèrent');
  await assert.rejects(() => seal(data, ''), /manquant/);
});

test('seal : accents et gros contenus', async () => {
  const big = { texte: 'é'.repeat(200000) + 'œuf à la crème' };
  assert.deepEqual(await open(await seal(big, 'clé accentuée éèà', { iterations: 1000 }), 'clé accentuée éèà'), big);
});

// ---------- Mise à jour du folder (GitHub Actions) ----------
const ok = (slug) => async (s) => (s === slug ? { pages } : { notPublished: true });

test('lecture du folder : écrit des fichiers chiffrés + un statut lisible, puis ne relit plus', { skip: !hasFixture }, async () => {
  const out = tmp();
  try {
    let calls = 0;
    const pagesFor = async (s) => { calls++; return ok('w45-2026-fr')(s); };
    const r1 = await updateFolder({ out, key: KEY, today: '2026-11-10', pagesFor });
    assert.equal(r1.changed, true);
    assert.match(r1.results[0], /w45-2026-fr : 98 articles/);
    const raw = readFileSync(join(out, 'promos.enc.json'), 'utf8');
    assert.ok(!raw.includes('DANONE') && !raw.includes('Yaourt'), 'promos chiffrées');
    const status = JSON.parse(readFileSync(join(out, 'status.json'), 'utf8'));
    assert.equal(status.folders['w45-2026-fr'].status, 'ok');
    assert.equal(status.folders['w45-2026-fr'].validTo, '2026-11-11');
    const store = await open(JSON.parse(raw), KEY);
    assert.equal(store.folders['w45-2026-fr'].items.length, 98);
    // 2e passage : déjà lu → aucun appel pour le folder en cours, aucun changement
    const before = calls;
    const r2 = await updateFolder({ out, key: KEY, today: '2026-11-10', pagesFor });
    assert.equal(r2.changed, false);
    assert.match(r2.results[0], /déjà lu/);
    assert.equal(calls - before, 1, 'seul le folder suivant est sondé (mardi : sortie imminente)');
    assert.match(r2.results[1], /pas encore en ligne/);
  } finally { rmSync(out, { recursive: true }); }
});

test('lecture du folder : le folder suivant n’est sondé que dans les 3 jours avant sa sortie', { skip: !hasFixture }, async () => {
  const out = tmp();
  try {
    const seen = [];
    const pagesFor = async (s) => { seen.push(s); return { notPublished: true }; };
    await updateFolder({ out, key: KEY, today: '2026-11-06', pagesFor }); // vendredi : jeudi suivant dans 6 jours
    assert.deepEqual(seen, ['w45-2026-fr']);
    seen.length = 0;
    await updateFolder({ out, key: KEY, today: '2026-11-09', pagesFor }); // lundi : dans 3 jours
    assert.deepEqual(seen, ['w45-2026-fr', 'w46-2026-fr']);
  } finally { rmSync(out, { recursive: true }); }
});

test('lecture du folder : « pas en ligne » ne crée aucun fichier (donc aucun commit)', async () => {
  const out = tmp();
  try {
    const r = await updateFolder({ out, key: KEY, today: '2026-11-10', pagesFor: async () => ({ notPublished: true }) });
    assert.equal(r.changed, false);
    assert.equal(existsSync(join(out, 'promos.enc.json')), false);
    assert.equal(existsSync(join(out, 'status.json')), false);
  } finally { rmSync(out, { recursive: true }); }
});

test('lecture du folder : clé absente ou mauvaise clé → erreur claire, rien d’écrasé', { skip: !hasFixture }, async () => {
  const out = tmp();
  try {
    await assert.rejects(() => updateFolder({ out, key: '', today: '2026-11-10', pagesFor: ok('w45-2026-fr') }), /PROMO_KEY manquant/);
    await updateFolder({ out, key: KEY, today: '2026-11-10', pagesFor: ok('w45-2026-fr') });
    const before = readFileSync(join(out, 'promos.enc.json'), 'utf8');
    await assert.rejects(() => updateFolder({ out, key: 'un autre code', today: '2026-11-12', pagesFor: ok('w46-2026-fr') }), /ne déchiffre pas/);
    assert.equal(readFileSync(join(out, 'promos.enc.json'), 'utf8'), before);
  } finally { rmSync(out, { recursive: true }); }
});

test('lecture du folder : semaine suivante fusionnée, anciens folders retirés, relance forcée du folder en cours', { skip: !hasFixture }, async () => {
  const out = tmp();
  try {
    await updateFolder({ out, key: KEY, today: '2026-11-10', pagesFor: ok('w45-2026-fr') });
    // la semaine suivante sort : on garde les deux
    const next = pages.map((p) => ({ ...p, text: p.text.replace('05/11 -> mercredi 11/11/2026', '12/11 -> mercredi 18/11/2026') }));
    const r = await updateFolder({ out, key: KEY, today: '2026-11-11', pagesFor: async (s) => (s === 'w46-2026-fr' ? { pages: next } : { notPublished: true }) });
    assert.equal(r.changed, true);
    let store = await open(JSON.parse(readFileSync(join(out, 'promos.enc.json'), 'utf8')), KEY);
    assert.deepEqual(Object.keys(store.folders).sort(), ['w45-2026-fr', 'w46-2026-fr']);
    const st = JSON.parse(readFileSync(join(out, 'status.json'), 'utf8'));
    assert.equal(st.folders['w46-2026-fr'].validFrom, '2026-11-12');
    // 6 semaines plus tard : l'ancien folder est retiré
    await updateFolder({ out, key: KEY, today: '2026-12-31', pagesFor: async () => ({ notPublished: true }) });
    store = await open(JSON.parse(readFileSync(join(out, 'promos.enc.json'), 'utf8')), KEY);
    assert.equal(Object.keys(store.folders).length, 0);
    // relance forcée : relit le folder en cours même s'il est « ok »
    const out2 = tmp();
    try {
      let n = 0;
      await updateFolder({ out: out2, key: KEY, today: '2026-11-10', pagesFor: async (s) => { n++; return ok('w45-2026-fr')(s); } });
      const n1 = n;
      await updateFolder({ out: out2, key: KEY, today: '2026-11-10', force: true, pagesFor: async (s) => { n++; return ok('w45-2026-fr')(s); } });
      assert.ok(n - n1 >= 1);
    } finally { rmSync(out2, { recursive: true }); }
  } finally { rmSync(out, { recursive: true }); }
});
