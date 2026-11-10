// Magasin de données de la page Claude. Tout est gardé en mémoire (et en copie locale dans le navigateur pour un affichage
// immédiat), puis enregistré dans la base `db` de la page : elle est partagée entre tes appareils (iPhone, Mac…) en direct
// et Claude peut y écrire (promos du folder). Les enregistrements sont regroupés en « paquets » (un document par semaine,
// par collection…) pour limiter le nombre d'écritures ; la fusion se fait enregistrement par enregistrement (dernier modifié gagne).
import { uid, weekStartFor } from '/shared/util.js';
import { DEFAULT_SETTINGS } from '/shared/rules.js';

export const COLLS = ['settings', 'profiles', 'plan', 'stock', 'shopping', 'promos', 'folders', 'weeks', 'waste', 'recipes', 'flags'];
const KEY = 'omq-page:v1';

/** Clé du paquet (document) qui contient un enregistrement. */
const bundleOf = {
  plan: (r) => weekStartFor(r.date),
  shopping: (r) => r.week,
  promos: (r) => r.folder || 'manuel',
};
const bkey = (coll, rec) => (bundleOf[coll] ? bundleOf[coll](rec) : 'main');

export const S = {
  data: Object.fromEntries(COLLS.map((c) => [c, {}])),
  meta: { online: true, syncing: false, lastSync: null, error: null, localOnly: false, loaded: false, stale: false, readOnly: false },
  caps: { db: null, sample: null, downloads: null, user: null },
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

// ---------- Copie locale (confort : affichage immédiat) ----------
let saveTimer = null;
const saveLocal = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(S.data)); } catch { /* quota / navigation privée */ }
  }, 300);
};
const loadLocal = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw) for (const c of COLLS) S.data[c] = raw[c] ?? {};
    return !!raw;
  } catch { return false; }
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

// ---------- Écriture vers la base ----------
const dirty = new Set(); // `${coll}|${paquet}` à enregistrer
const inflight = new Set(); // en cours d'enregistrement
let flushTimer = null;
let flushing = false;
const TOMBSTONE_MS = 30 * 86400000;

const markDirty = (coll, b) => {
  dirty.add(`${coll}|${b}`);
  clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, 500);
};

const recordsOf = (coll, b) => {
  const out = {};
  const now = Date.now();
  for (const [id, r] of Object.entries(S.data[coll])) {
    if (r._b !== b) continue;
    if (r.deleted && now - (r._ts ?? 0) > TOMBSTONE_MS) continue; // les vieilles suppressions sont oubliées
    out[id] = r;
  }
  return out;
};

export async function flush() {
  if (flushing || !S.caps.db) return;
  flushing = true;
  S.meta.syncing = true;
  try {
    while (dirty.size) {
      const keys = [...dirty];
      for (const k of keys) {
        dirty.delete(k);
        inflight.add(k);
        const [coll, b] = k.split('|');
        const recs = recordsOf(coll, b);
        const doc = S.caps.db.doc(`${coll}/${b}`);
        try {
          if (!Object.values(recs).some((r) => !r.deleted) && !Object.keys(recs).length) await doc.delete();
          else {
            const body = { _ts: Date.now(), recs };
            if (JSON.stringify(body).length > 250000) throw Object.assign(new Error('Ce paquet de données est trop volumineux.'), { code: 'invalid_argument' });
            await doc.set(body);
          }
          S.meta.online = true; S.meta.error = null; S.meta.lastSync = Date.now();
        } catch (e) {
          dirty.add(k);
          if (e?.code === 'quota_exceeded') S.meta.error = 'Espace de stockage de la page plein : supprime d’anciennes données.';
          else if (e?.code === 'invalid_argument' || e?.code === 'revoked') S.meta.error = 'Cette page ne peut pas enregistrer tes données (accès en lecture seule ?).';
          else S.meta.online = false;
          inflight.delete(k);
          throw e;
        }
        inflight.delete(k);
      }
    }
  } catch (e) {
    // nouvel essai après une pause si c'est transitoire
    if (!['quota_exceeded', 'invalid_argument', 'revoked'].includes(e?.code)) setTimeout(flush, 4000);
  } finally {
    flushing = false;
    S.meta.syncing = false;
    emit();
  }
}
export const syncNow = flush;
export const pendingCount = () => dirty.size + inflight.size;

const queue = (coll, rec) => {
  if (!S.caps.db) { S.meta.localOnly = true; return; }
  markDirty(coll, rec._b);
};

const blocked = () => {
  if (!S.meta.readOnly) return false;
  window.dispatchEvent(new Event('omq:readonly'));
  return true;
};

export function put(coll, obj) {
  if (blocked()) return obj;
  const base = { ...obj, id: obj.id ?? uid(), _ts: Date.now(), deleted: false };
  const rec = { ...base, _b: bkey(coll, base) };
  S.data[coll][rec.id] = rec;
  queue(coll, rec);
  saveLocal(); emit();
  return rec;
}
export function patch(coll, id, changes) {
  const cur = S.data[coll][id];
  return put(coll, { ...(cur ?? { id }), ...changes });
}
export function putMany(coll, objs) {
  if (blocked()) return;
  const ts = Date.now();
  for (const o of objs) {
    const base = { ...o, id: o.id ?? uid(), _ts: ts, deleted: false };
    const rec = { ...base, _b: bkey(coll, base) };
    S.data[coll][rec.id] = rec;
    queue(coll, rec);
  }
  saveLocal(); emit();
}
export function del(coll, id) {
  if (blocked()) return;
  const cur = S.data[coll][id];
  if (!cur) return;
  const rec = { id, deleted: true, _ts: Date.now(), _b: cur._b ?? bkey(coll, cur) };
  S.data[coll][id] = rec;
  queue(coll, rec);
  saveLocal(); emit();
}
export function saveSettings(changes) {
  return put('settings', { ...(S.data.settings.main ?? {}), ...changes, id: 'main' });
}

// ---------- Lecture depuis la base (temps réel) ----------
const firstSnap = new Set();
let loadTimer = null;
const markLoaded = (coll) => {
  firstSnap.add(coll);
  if (firstSnap.size >= COLLS.length) {
    clearTimeout(loadTimer);
    S.meta.loaded = true; S.meta.stale = false;
    emit();
  }
};

function applySnapshot(coll, snap) {
  const local = S.data[coll];
  let changed = false;
  const present = new Set();
  for (const d of snap.docs) {
    const b = d.id;
    present.add(b);
    const remote = d.data()?.recs ?? {};
    for (const [id, r] of Object.entries(remote)) {
      const cur = local[id];
      if (!cur || (r._ts ?? 0) > (cur._ts ?? 0)) { local[id] = { ...r, id, _b: b }; changed = true; }
    }
    // paquet sans modification locale en attente : la base fait foi (une suppression ou une mise à jour de Claude se propage)
    if (!dirty.has(`${coll}|${b}`) && !inflight.has(`${coll}|${b}`)) {
      for (const [id, cur] of Object.entries(local)) if (cur._b === b && !(id in remote)) { delete local[id]; changed = true; }
    }
  }
  // paquets qui n'existent plus dans la base
  for (const [id, cur] of Object.entries(local)) {
    const k = `${coll}|${cur._b}`;
    if (cur._b && !present.has(cur._b) && !dirty.has(k) && !inflight.has(k) && !snap.metadata?.fromCache) { delete local[id]; changed = true; }
  }
  return changed;
}

export async function init(claudeApi) {
  const hadLocal = loadLocal();
  const use = async (n) => { try { return (await claudeApi?.use?.(n)) ?? null; } catch { return null; } };
  const [db, sample, downloads, user] = await Promise.all([use('db'), use('sample'), use('downloads'), use('user')]);
  S.caps = { db, sample, downloads, user };
  // accès en lecture seule (ex. page partagée sans droit d'écriture) : on le sait avant que quoi que ce soit n'échoue
  try { S.meta.readOnly = !!db && (await user?.can?.('data.write')) === false; } catch { /* inconnu : les écritures décideront */ }
  if (!db) {
    S.meta.localOnly = true;
    S.meta.loaded = true;
    emit();
    return;
  }
  if (hadLocal) { S.meta.loaded = true; S.meta.stale = true; } // on affiche la copie locale en attendant la base
  loadTimer = setTimeout(() => { if (!S.meta.loaded || S.meta.stale) { S.meta.loaded = true; S.meta.stale = true; S.meta.online = false; emit(); } }, 10000);
  for (const coll of COLLS) {
    try {
      db.collection(coll).onSnapshot(
        (snap) => {
          const changed = applySnapshot(coll, snap);
          if (!snap.metadata?.fromCache) { S.meta.online = true; S.meta.lastSync = Date.now(); markLoaded(coll); if (firstSnap.size >= COLLS.length) S.meta.stale = false; }
          if (changed) saveLocal();
          if (changed || !snap.metadata?.fromCache) emit();
        },
        (e) => { S.meta.online = false; S.meta.error = e?.code === 'revoked' ? 'L’accès à cette page a changé : recharge-la.' : null; markLoaded(coll); emit(); },
      );
    } catch (e) { console.error(e); markLoaded(coll); }
  }
  addEventListener('online', flush);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
  addEventListener('pagehide', flush);
}

export const pending = pendingCount;

/** Efface toutes les données du foyer (base + copie locale). */
export async function wipeAll() {
  try { localStorage.removeItem(KEY); } catch { /* ignoré */ }
  if (S.caps.db) {
    for (const coll of COLLS) {
      try {
        const snap = await S.caps.db.collection(coll).get();
        for (const d of snap.docs) await S.caps.db.doc(`${coll}/${d.id}`).delete();
      } catch { /* on continue */ }
    }
  }
  for (const c of COLLS) S.data[c] = {};
  dirty.clear();
  emit();
}

/** Export JSON de toutes les données. */
export const exportJson = () => JSON.stringify({ exportedAt: new Date().toISOString(), data: Object.fromEntries(COLLS.map((c) => [c, list(c)])) }, null, 1);
