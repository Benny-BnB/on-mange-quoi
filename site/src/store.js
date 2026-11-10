// Magasin de données de la version « site statique » (GitHub Pages) : tout est enregistré dans CE navigateur.
// Les promos viennent d'un fichier chiffré publié par une tâche GitHub Actions (data/promos.enc.json) ; elles se déchiffrent
// ici avec le « code du foyer ». Pas de serveur, donc pas de synchronisation automatique entre appareils : on transfère
// les données avec Exporter / Importer (écran Foyer).
import { uid } from '/shared/util.js';
import { DEFAULT_SETTINGS } from '/shared/rules.js';
import { open } from '/shared/seal.js';

export const COLLS = ['settings', 'profiles', 'plan', 'stock', 'shopping', 'promos', 'folders', 'weeks', 'waste', 'recipes', 'flags'];
const KEY = 'omq-site:v1';
const CODE_KEY = 'omq-site:code';
/** Données qui viennent du site (pas de l'utilisateur) : exclues de l'export. */
const SITE_COLLS = ['promos', 'folders'];

export const S = {
  data: Object.fromEntries(COLLS.map((c) => [c, {}])),
  meta: { online: true, loaded: true, error: null, localOnly: false, readOnly: false, stale: false, promos: { state: 'idle', message: '', updatedAt: null, checkedAt: null } },
  caps: {},
  version: 0,
};

const listeners = new Set();
export const subscribe = (fn) => (listeners.add(fn), () => listeners.delete(fn));
let emitTimer = null;
const emit = () => {
  S.version++;
  clearTimeout(emitTimer);
  emitTimer = setTimeout(() => listeners.forEach((f) => { try { f(); } catch (e) { console.error(e); } }), 16);
};

// ---------- Persistance locale ----------
let saveTimer = null;
const saveLocal = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(S.data)); } catch { S.meta.error = 'Impossible d’enregistrer dans ce navigateur (espace plein ou navigation privée).'; emit(); }
  }, 200);
};
const loadLocal = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw) for (const c of COLLS) S.data[c] = raw[c] ?? {};
  } catch { /* données illisibles : on repart de zéro */ }
};

// ---------- Accès ----------
export const get = (coll, id) => {
  const r = S.data[coll]?.[id];
  return r && !r.deleted ? r : null;
};
export const list = (coll) => Object.values(S.data[coll] ?? {}).filter((r) => !r.deleted);
export const settings = () => {
  const d = DEFAULT_SETTINGS();
  const s = get('settings', 'main') ?? {};
  return { ...d, ...s, meals: { ...d.meals, ...s.meals }, equipment: { ...d.equipment, ...s.equipment }, timeRules: { semaine: { ...d.timeRules.semaine, ...s.timeRules?.semaine }, weekend: { ...d.timeRules.weekend, ...s.timeRules?.weekend } }, appetite: { ...d.appetite, ...s.appetite } };
};

export function put(coll, obj) {
  const rec = { ...obj, id: obj.id ?? uid(), _ts: Date.now(), deleted: false };
  S.data[coll][rec.id] = rec;
  saveLocal(); emit();
  return rec;
}
export function patch(coll, id, changes) {
  return put(coll, { ...(S.data[coll][id] ?? { id }), ...changes });
}
export function putMany(coll, objs) {
  const ts = Date.now();
  for (const o of objs) {
    const rec = { ...o, id: o.id ?? uid(), _ts: ts, deleted: false };
    S.data[coll][rec.id] = rec;
  }
  saveLocal(); emit();
}
export function del(coll, id) {
  if (!S.data[coll][id]) return;
  delete S.data[coll][id];
  saveLocal(); emit();
}
export function saveSettings(changes) {
  return put('settings', { ...(S.data.settings.main ?? {}), ...changes, id: 'main' });
}
export const pendingCount = () => 0;
export const syncNow = async () => {};

// ---------- Promos publiées (fichier chiffré) ----------
export const getCode = () => { try { return localStorage.getItem(CODE_KEY) || ''; } catch { return ''; } };
let loading = false;

const applyStatus = (status) => {
  const present = new Set();
  for (const [slug, f] of Object.entries(status.folders ?? {})) {
    present.add(slug);
    S.data.folders[slug] = { id: slug, slug, validFrom: f.validFrom, validTo: f.validTo, fetchedAt: f.fetchedAt, status: f.status, message: f.message, count: f.count, source: 'lecture automatique', _ts: Date.parse(f.fetchedAt) || 0, deleted: false };
  }
  for (const [id, r] of Object.entries(S.data.folders)) if (r.source === 'lecture automatique' && !present.has(id)) delete S.data.folders[id];
};

const applyPromos = (store, status) => {
  const present = new Set();
  for (const [slug, f] of Object.entries(store.folders ?? {})) {
    const ts = Date.parse(status.folders?.[slug]?.fetchedAt) || 0;
    for (const it of f.items ?? []) {
      present.add(it.id);
      const cur = S.data.promos[it.id];
      if (cur && cur.manual && (cur._ts ?? 0) >= ts) continue; // correction manuelle plus récente que la lecture : on la garde
      S.data.promos[it.id] = { ...it, folder: slug, _ts: ts, deleted: false };
    }
  }
  // promos des semaines retirées du fichier
  for (const [id, r] of Object.entries(S.data.promos)) if (/^w\d{2}-\d{4}-fr$/.test(r.folder ?? '') && !r.manual && !present.has(id)) delete S.data.promos[id];
};

/** Télécharge status.json (public) et promos.enc.json (chiffré), déchiffre avec le code du foyer. */
export async function loadPromos() {
  if (loading) return;
  loading = true;
  const P = S.meta.promos;
  try {
    const st = await fetch('data/status.json', { cache: 'no-store' });
    if (!st.ok) { P.state = 'none'; P.message = 'Aucune promo publiée pour l’instant : la première lecture automatique n’a pas encore eu lieu.'; return; }
    const status = await st.json();
    applyStatus(status);
    P.checkedAt = Date.now();
    if (!Object.keys(status.folders ?? {}).length) { P.state = 'none'; P.message = 'Aucun folder lu pour l’instant.'; return; }
    const code = getCode();
    if (!code) { P.state = 'locked'; P.message = ''; return; }
    const pr = await fetch('data/promos.enc.json', { cache: 'no-store' });
    if (!pr.ok) throw new Error('Fichier des promos introuvable');
    const store = await open(await pr.json(), code);
    applyPromos(store, status);
    P.state = 'ok'; P.message = ''; P.updatedAt = status.updatedAt;
    saveLocal();
  } catch (e) {
    if (/Code incorrect/.test(e.message)) { P.state = 'locked'; P.message = 'Code incorrect.'; }
    else { P.state = S.data.promos && Object.keys(S.data.promos).length ? 'offline' : 'error'; P.message = P.state === 'offline' ? 'Hors connexion : dernières promos enregistrées.' : `Promos indisponibles : ${e.message}`; }
  } finally {
    loading = false;
    emit();
  }
}

/** Enregistre le code du foyer et tente de déverrouiller ; retourne true si les promos sont lisibles. */
export async function setCode(code) {
  try { localStorage.setItem(CODE_KEY, String(code).trim()); } catch { /* ignoré */ }
  await loadPromos();
  return S.meta.promos.state === 'ok';
}
export const forgetCode = () => { try { localStorage.removeItem(CODE_KEY); } catch { /* ignoré */ } };

// ---------- Démarrage ----------
export async function init() {
  loadLocal();
  S.meta.loaded = true;
  emit();
  loadPromos();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && Date.now() - (S.meta.promos.checkedAt ?? 0) > 10 * 60 * 1000) loadPromos();
  });
  setInterval(() => { if (!document.hidden) loadPromos(); }, 30 * 60 * 1000);
}

// ---------- Export / import / effacement ----------
export const exportJson = () => JSON.stringify({ app: 'on-mange-quoi', v: 1, exportedAt: new Date().toISOString(), data: Object.fromEntries(COLLS.filter((c) => !SITE_COLLS.includes(c)).map((c) => [c, list(c)])) }, null, 1);

/** Remplace les données de l'utilisateur par celles d'un export. Lève une erreur lisible si le texte n'en est pas un. */
export function importJson(text) {
  let o;
  try { o = JSON.parse(text); } catch { throw new Error('Ce texte n’est pas un export valide.'); }
  if (o?.app !== 'on-mange-quoi' || o.v !== 1 || typeof o.data !== 'object') throw new Error('Ce fichier ne vient pas de cette application.');
  let n = 0;
  for (const c of COLLS.filter((x) => !SITE_COLLS.includes(x))) {
    S.data[c] = {};
    for (const r of o.data[c] ?? []) if (r && typeof r.id === 'string') { S.data[c][r.id] = { ...r, deleted: false }; n++; }
  }
  saveLocal(); emit();
  return n;
}

export function wipeAll() {
  try { localStorage.removeItem(KEY); } catch { /* ignoré */ }
  for (const c of COLLS.filter((x) => !SITE_COLLS.includes(x))) S.data[c] = {};
  emit();
}
