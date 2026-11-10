// Magasin de données local-first : tout vit dans le navigateur (utilisable sans réseau), puis se synchronise
// avec le serveur du foyer (dernière écriture gagnante par enregistrement). Les autres téléphones sont prévenus en direct.
import { uid } from '/shared/util.js';
import { DEFAULT_SETTINGS } from '/shared/rules.js';

export const COLLS = ['settings', 'profiles', 'plan', 'stock', 'shopping', 'promos', 'folders', 'weeks', 'waste', 'recipes', 'flags'];
const KEY = 'omqcs:v1';

export const S = {
  data: Object.fromEntries(COLLS.map((c) => [c, {}])),
  meta: { rev: 0, creds: null, outbox: {}, online: true, syncing: false, lastSync: null, error: null, localOnly: false },
  config: null,
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
const save = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify({ data: S.data, meta: { ...S.meta, syncing: false } })); } catch { /* quota / navigation privée */ }
  }, 250);
};
const load = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw?.data) {
      for (const c of COLLS) S.data[c] = raw.data[c] ?? {};
      Object.assign(S.meta, raw.meta ?? {}, { syncing: false });
    }
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

let syncTimer = null;
const queue = (coll, id, data, deleted) => {
  S.meta.outbox[`${coll}/${id}`] = { coll, id, data: deleted ? null : data, deleted: !!deleted, ts: data?._ts ?? Date.now() };
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => syncNow(), 600);
};

export function put(coll, obj) {
  const rec = { ...obj, id: obj.id ?? uid(), _ts: Date.now(), deleted: false };
  S.data[coll][rec.id] = rec;
  queue(coll, rec.id, rec, false);
  save(); emit();
  return rec;
}
export function patch(coll, id, changes) {
  const cur = S.data[coll][id];
  return put(coll, { ...(cur ?? { id }), ...changes });
}
export function putMany(coll, objs) {
  const ts = Date.now();
  for (const o of objs) {
    const rec = { ...o, id: o.id ?? uid(), _ts: ts, deleted: false };
    S.data[coll][rec.id] = rec;
    queue(coll, rec.id, rec, false);
  }
  save(); emit();
}
export function del(coll, id) {
  if (!S.data[coll][id]) return;
  const rec = { id, deleted: true, _ts: Date.now() };
  S.data[coll][id] = rec;
  queue(coll, id, rec, true);
  save(); emit();
}
export function saveSettings(changes) {
  return put('settings', { ...(S.data.settings.main ?? {}), ...changes, id: 'main' });
}

// ---------- Synchronisation ----------
const api = async (path, opts = {}) => {
  const res = await fetch(path, {
    ...opts,
    headers: { 'content-type': 'application/json', ...(S.meta.creds ? { authorization: `Bearer ${S.meta.creds}` } : {}), ...(opts.headers ?? {}) },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw Object.assign(new Error(data.error || `HTTP ${res.status}`), { status: res.status, data });
  }
  return res.json();
};
export { api };

let eventSource = null;
function connectEvents() {
  if (!S.meta.creds || typeof EventSource === 'undefined') return;
  eventSource?.close();
  eventSource = new EventSource(`/api/events?t=${encodeURIComponent(S.meta.creds)}`);
  eventSource.onmessage = (e) => {
    try { if (JSON.parse(e.data).rev > S.meta.rev) syncNow(); } catch { /* ignoré */ }
  };
}

export async function syncNow() {
  if (!S.meta.creds || S.meta.syncing) return;
  S.meta.syncing = true;
  const sending = Object.values(S.meta.outbox);
  try {
    const out = await api('/api/sync', { method: 'POST', body: JSON.stringify({ since: S.meta.rev, changes: sending }) });
    for (const r of out.records) {
      const key = `${r.coll}/${r.id}`;
      const pending = S.meta.outbox[key];
      if (pending && pending.ts > r.ts) continue; // notre version locale est plus récente
      if (!COLLS.includes(r.coll)) continue;
      S.data[r.coll][r.id] = r.deleted ? { id: r.id, deleted: true, _ts: r.ts } : { ...r.data, id: r.id, _ts: r.ts, deleted: false };
    }
    for (const c of sending) {
      const key = `${c.coll}/${c.id}`;
      if (S.meta.outbox[key]?.ts === c.ts) delete S.meta.outbox[key];
    }
    S.meta.rev = out.rev;
    S.meta.online = true; S.meta.error = null; S.meta.lastSync = Date.now();
  } catch (e) {
    if (e.status === 401) S.meta.error = 'Ce foyer n’existe plus sur le serveur.';
    else { S.meta.online = false; }
  } finally {
    S.meta.syncing = false;
    save(); emit();
  }
}

/** Crée le foyer (compte) sur le serveur ; `code` = code d'accès si le serveur en exige un. */
export async function createHousehold(code = '') {
  const out = await api('/api/households', { method: 'POST', body: JSON.stringify({ code }) });
  S.meta.creds = out.credentials;
  S.meta.online = true; S.meta.error = null; S.meta.localOnly = false;
  save();
  await syncNow();
  connectEvents();
  emit();
}

/** Ajoute cet appareil à un foyer existant avec le code affiché sur un appareil déjà connecté. */
export async function redeemCode(code) {
  const out = await api('/api/pair/redeem', { method: 'POST', body: JSON.stringify({ code, label: (navigator.userAgentData?.platform || navigator.platform || 'appareil').slice(0, 30) }) });
  await joinHousehold(out.credentials);
}

export const useLocalOnly = () => { S.meta.localOnly = true; save(); emit(); };
export const hasAccount = () => !!S.meta.creds || !!S.meta.localOnly;

/** Rejoint un foyer existant depuis un autre téléphone (lien d'invitation). */
export async function joinHousehold(creds) {
  for (const c of COLLS) S.data[c] = {};
  S.meta = { ...S.meta, creds, rev: 0, outbox: {}, error: null };
  save();
  await syncNow();
  connectEvents();
}

export async function init() {
  load();
  const m = location.hash.match(/join=([a-f0-9]+\.[a-f0-9]+)/);
  try { S.config = await fetch('/api/config').then((r) => r.json()); } catch { S.config = null; }
  if (m) { await joinHousehold(m[1]); history.replaceState(null, '', location.pathname + '#/aujourdhui'); }
  else if (S.meta.creds) { await syncNow(); connectEvents(); }
  addEventListener('online', () => syncNow());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) syncNow(); });
  setInterval(() => { if (Object.keys(S.meta.outbox).length || !S.meta.online) syncNow(); }, 20000);
  emit();
}

export const pendingCount = () => Object.keys(S.meta.outbox).length;

export async function wipeAll() {
  try { await api('/api/household', { method: 'DELETE' }); } catch { /* serveur injoignable : on efface au moins en local */ }
  eventSource?.close();
  localStorage.removeItem(KEY);
  location.hash = '';
  location.reload();
}
