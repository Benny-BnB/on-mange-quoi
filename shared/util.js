// Utilitaires partagés (client + serveur) : dates, formats, texte.

export const uid = () =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`).replace(/-/g, '').slice(0, 16);

/** minuscule, sans accents, espaces normalisés — pour comparer / matcher du texte. */
export const norm = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const sum = (arr, f = (x) => x) => arr.reduce((a, x) => a + f(x), 0);
export const uniq = (arr) => [...new Set(arr)];
export const round2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;

// ---------- Dates : chaînes 'YYYY-MM-DD', calculs en UTC pour éviter tout décalage de fuseau ----------
const toUTC = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const fromUTC = (t) => new Date(t).toISOString().slice(0, 10);

export const todayStr = (now = new Date()) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
};
export const addDays = (s, n) => fromUTC(toUTC(s) + n * 86400000);
export const diffDays = (a, b) => Math.round((toUTC(b) - toUTC(a)) / 86400000); // b - a
/** 0 = dimanche … 6 = samedi */
export const dow = (s) => new Date(toUTC(s)).getUTCDay();

export const DAY_KEYS = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
export const DAY_LABELS = { dim: 'Dimanche', lun: 'Lundi', mar: 'Mardi', mer: 'Mercredi', jeu: 'Jeudi', ven: 'Vendredi', sam: 'Samedi' };
export const dayKey = (s) => DAY_KEYS[dow(s)];
export const isWeekend = (s) => [0, 6].includes(dow(s));

/** Début (jeudi) de la semaine Delhaize qui contient la date. Cycle jeudi → mercredi. */
export const weekStartFor = (s) => addDays(s, -((dow(s) - 4 + 7) % 7));
export const weekDays = (start) => Array.from({ length: 7 }, (_, i) => addDays(start, i));

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const MONTHS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const fmtDayShort = (s) => {
  const [, m, d] = s.split('-').map(Number);
  return `${DAY_LABELS[dayKey(s)].slice(0, 3).toLowerCase()}. ${d} ${MONTHS[m - 1]}`;
};
export const fmtDayLong = (s) => {
  const [, m, d] = s.split('-').map(Number);
  return `${DAY_LABELS[dayKey(s)]} ${d} ${MONTHS_LONG[m - 1]}`;
};
export const fmtDM = (s) => s.slice(8, 10) + '/' + s.slice(5, 7);

/** Semaine ISO du jeudi de départ → identifiant Publitas `wNN-YYYY-fr`. */
export const folderSlugFor = (weekStart, lang = 'fr') => {
  const t = toUTC(weekStart); // le jeudi appartient à la semaine ISO « du folder »
  const d = new Date(t);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `w${String(week).padStart(2, '0')}-${d.getUTCFullYear()}-${lang}`;
};

// ---------- Montants & quantités ----------
/** Format demandé : X.XXX,XX€ (point pour les milliers, virgule décimale). */
export const eur = (n) => {
  if (n == null || Number.isNaN(n)) return '—';
  const neg = n < 0;
  const [i, d] = Math.abs(n).toFixed(2).split('.');
  return `${neg ? '−' : ''}${i.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${d}€`;
};

const trimNum = (x, dec) => {
  const s = x.toFixed(dec).replace('.', ',');
  return s.includes(',') ? s.replace(/,?0+$/, '') : s;
};

/** Quantité lisible : 450 g, 1,2 kg, 250 ml, 1,5 l, 3 pièces. */
export const fmtQty = (q, unit) => {
  if (q == null || Number.isNaN(q)) return '';
  if (unit === 'g') return q >= 1000 ? `${trimNum(q / 1000, 2)} kg` : `${trimNum(q, 0)} g`;
  if (unit === 'ml') return q >= 1000 ? `${trimNum(q / 1000, 2)} l` : `${trimNum(q, 0)} ml`;
  if (unit === 'portion') return `${trimNum(q, 1)} portion${q > 1 ? 's' : ''}`;
  const n = Math.round(q * 10) / 10;
  return `${trimNum(n, 1)} pièce${n > 1 ? 's' : ''}`;
};

/** Arrondi « de cuisine » : 437 g → 440 g ; 1,3 œuf → 2. */
export const niceQty = (q, unit) => {
  if (unit === 'pc') return Math.max(0.5, Math.ceil(q * 2 - 1e-9) / 2);
  if (unit === 'portion') return Math.round(q * 2) / 2;
  if (q < 20) return Math.max(1, Math.round(q));
  if (q < 100) return Math.round(q / 5) * 5;
  if (q < 1000) return Math.round(q / 10) * 10;
  return Math.round(q / 50) * 50;
};

/** Petit générateur pseudo-aléatoire déterministe (mulberry32). */
export const rng = (seed = 1) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
