'use strict';
const __M = {};
// ---- shared/util.js
__M["shared/util.js"] = (() => {
// Utilitaires partagés (client + serveur) : dates, formats, texte.

const uid = () =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`).replace(/-/g, '').slice(0, 16);

/** minuscule, sans accents, espaces normalisés — pour comparer / matcher du texte. */
const norm = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const sum = (arr, f = (x) => x) => arr.reduce((a, x) => a + f(x), 0);
const uniq = (arr) => [...new Set(arr)];
const round2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;

// ---------- Dates : chaînes 'YYYY-MM-DD', calculs en UTC pour éviter tout décalage de fuseau ----------
const toUTC = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const fromUTC = (t) => new Date(t).toISOString().slice(0, 10);

const todayStr = (now = new Date()) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
};
const addDays = (s, n) => fromUTC(toUTC(s) + n * 86400000);
const diffDays = (a, b) => Math.round((toUTC(b) - toUTC(a)) / 86400000); // b - a
/** 0 = dimanche … 6 = samedi */
const dow = (s) => new Date(toUTC(s)).getUTCDay();

const DAY_KEYS = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
const DAY_LABELS = { dim: 'Dimanche', lun: 'Lundi', mar: 'Mardi', mer: 'Mercredi', jeu: 'Jeudi', ven: 'Vendredi', sam: 'Samedi' };
const dayKey = (s) => DAY_KEYS[dow(s)];
const isWeekend = (s) => [0, 6].includes(dow(s));

/** Début (jeudi) de la semaine Delhaize qui contient la date. Cycle jeudi → mercredi. */
const weekStartFor = (s) => addDays(s, -((dow(s) - 4 + 7) % 7));
const weekDays = (start) => Array.from({ length: 7 }, (_, i) => addDays(start, i));

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const MONTHS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const fmtDayShort = (s) => {
  const [, m, d] = s.split('-').map(Number);
  return `${DAY_LABELS[dayKey(s)].slice(0, 3).toLowerCase()}. ${d} ${MONTHS[m - 1]}`;
};
const fmtDayLong = (s) => {
  const [, m, d] = s.split('-').map(Number);
  return `${DAY_LABELS[dayKey(s)]} ${d} ${MONTHS_LONG[m - 1]}`;
};
const fmtDM = (s) => s.slice(8, 10) + '/' + s.slice(5, 7);

/** Semaine ISO du jeudi de départ → identifiant Publitas `wNN-YYYY-fr`. */
const folderSlugFor = (weekStart, lang = 'fr') => {
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
const eur = (n) => {
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
const fmtQty = (q, unit) => {
  if (q == null || Number.isNaN(q)) return '';
  if (unit === 'g') return q >= 1000 ? `${trimNum(q / 1000, 2)} kg` : `${trimNum(q, 0)} g`;
  if (unit === 'ml') return q >= 1000 ? `${trimNum(q / 1000, 2)} l` : `${trimNum(q, 0)} ml`;
  if (unit === 'portion') return `${trimNum(q, 1)} portion${q > 1 ? 's' : ''}`;
  const n = Math.round(q * 10) / 10;
  return `${trimNum(n, 1)} pièce${n > 1 ? 's' : ''}`;
};

/** Arrondi « de cuisine » : 437 g → 440 g ; 1,3 œuf → 2. */
const niceQty = (q, unit) => {
  if (unit === 'pc') return Math.max(0.5, Math.ceil(q * 2 - 1e-9) / 2);
  if (unit === 'portion') return Math.round(q * 2) / 2;
  if (q < 20) return Math.max(1, Math.round(q));
  if (q < 100) return Math.round(q / 5) * 5;
  if (q < 1000) return Math.round(q / 10) * 10;
  return Math.round(q / 50) * 50;
};

/** Petit générateur pseudo-aléatoire déterministe (mulberry32). */
const rng = (seed = 1) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

return { uid, norm, clamp, sum, uniq, round2, todayStr, addDays, diffDays, dow, DAY_KEYS, DAY_LABELS, dayKey, isWeekend, weekStartFor, weekDays, fmtDayShort, fmtDayLong, fmtDM, folderSlugFor, eur, fmtQty, niceQty, rng };
})();

// ---- shared/ingredients.js
__M["shared/ingredients.js"] = (() => {
// Base d'ingrédients génériques : unités, formats vendus, conservation, allergènes, régimes,
// et motifs de correspondance avec les noms de produits des folders (matching Delhaize ↔ ingrédient).
// Les prix sont des ESTIMATIONS de prix habituels (hors promo), utilisées seulement pour chiffrer un budget
// quand aucune promo n'existe : à ajuster dans l'app (Foyer) au fil des tickets.
const { norm } = __M["shared/util.js"];

const ALLERGENS = {
  gluten: 'Céréales contenant du gluten',
  crustaces: 'Crustacés',
  oeufs: 'Œufs',
  poissons: 'Poissons',
  arachides: 'Arachides',
  soja: 'Soja',
  lait: 'Lait (lactose inclus)',
  fruits_a_coque: 'Fruits à coque',
  celeri: 'Céleri',
  moutarde: 'Moutarde',
  sesame: 'Graines de sésame',
  sulfites: 'Anhydride sulfureux et sulfites',
  lupin: 'Lupin',
  mollusques: 'Mollusques',
};

/** Rayons, dans l'ordre d'un parcours de magasin. */
const RAYONS = [
  ['fruits-legumes', 'Fruits & légumes', '🥦'],
  ['boulangerie', 'Pain & boulangerie', '🥖'],
  ['boucherie', 'Viandes & volailles', '🥩'],
  ['poissonnerie', 'Poissons & fruits de mer', '🐟'],
  ['charcuterie', 'Charcuterie & traiteur', '🥓'],
  ['laitier', 'Produits laitiers & œufs', '🧀'],
  ['epicerie', 'Épicerie', '🍝'],
  ['conserves', 'Conserves & sauces', '🥫'],
  ['surgeles', 'Surgelés', '🧊'],
  ['boissons', 'Boissons', '🥤'],
  ['maison', 'Hygiène & maison', '🧴'],
  ['autre', 'Autre', '🛒'],
];
const RAYON_LABEL = Object.fromEntries(RAYONS.map(([k, l]) => [k, l]));
const RAYON_ICON = Object.fromEntries(RAYONS.map(([k, , i]) => [k, i]));
const RAYON_ORDER = Object.fromEntries(RAYONS.map(([k], i) => [k, i]));

// [id, nom, rayon, unité, options]
// options : b=basique supposé présent · t=étiquettes · al=allergènes · pk=formats vendus (unité de base)
//           pr=prix habituel estimé (€/kg, €/l ou €/pièce) · sh=conservation (jours) · loc=frigo|placard|congelateur
//           m=motif de correspondance produit (texte normalisé) · x=motif d'exclusion · sub=substituts · pro=famille de protéine
const RAW = [
  // ----- Fruits & légumes -----
  ['carotte', 'Carottes', 'fruits-legumes', 'g', { pr: 1.6, sh: 14, loc: 'frigo', pk: [1000, 500], m: 'carotte', x: 'puree' }],
  ['pomme-de-terre', 'Pommes de terre', 'fruits-legumes', 'g', { pr: 1.4, sh: 21, loc: 'placard', pk: [2000, 1000], m: 'pommes? de terre|grenaille', sub: [] }],
  ['courgette', 'Courgettes', 'fruits-legumes', 'g', { pr: 2.5, sh: 7, loc: 'frigo', pk: [400], m: 'courgette' }],
  ['poivron', 'Poivrons', 'fruits-legumes', 'g', { pr: 3.5, sh: 7, loc: 'frigo', pk: [400], m: 'poivron' }],
  ['tomate', 'Tomates', 'fruits-legumes', 'g', { pr: 3.2, sh: 6, loc: 'frigo', pk: [500], m: '^(delhaize )?tomates?\\b|tomates? (grappe|cerise|ronde)' }],
  ['champignons', 'Champignons', 'fruits-legumes', 'g', { pr: 7.5, sh: 5, loc: 'frigo', pk: [250, 400], m: 'champignon' }],
  ['epinards', 'Épinards', 'fruits-legumes', 'g', { pr: 6, sh: 4, loc: 'frigo', pk: [250], m: 'epinards?\\b(?! et)' }],
  ['brocoli', 'Brocoli', 'fruits-legumes', 'g', { pr: 3, sh: 6, loc: 'frigo', pk: [500], m: 'brocoli' }],
  ['chou-fleur', 'Chou-fleur', 'fruits-legumes', 'g', { pr: 2.8, sh: 6, loc: 'frigo', pk: [800], m: 'chou-?fleur' }],
  ['poireau', 'Poireaux', 'fruits-legumes', 'g', { pr: 2.6, sh: 10, loc: 'frigo', pk: [500], m: 'poireau' }],
  ['aubergine', 'Aubergines', 'fruits-legumes', 'g', { pr: 3.5, sh: 7, loc: 'frigo', pk: [400], m: 'aubergine' }],
  ['legumes-wok', 'Légumes pour wok', 'fruits-legumes', 'g', { pr: 6, sh: 5, loc: 'frigo', pk: [400], m: 'legumes? pour wok|poelee de legumes' }],
  ['concombre', 'Concombre', 'fruits-legumes', 'pc', { pr: 1.0, sh: 7, loc: 'frigo', pk: [1], m: 'concombre' }],
  ['salade', 'Salade (laitue)', 'fruits-legumes', 'pc', { pr: 1.3, sh: 5, loc: 'frigo', pk: [1], m: 'laitue|salade (verte|iceberg|mixte)|mesclun|roquette' }],
  ['avocat', 'Avocat', 'fruits-legumes', 'pc', { pr: 1.2, sh: 5, loc: 'frigo', pk: [1], m: 'avocat' }],
  ['citron', 'Citron', 'fruits-legumes', 'pc', { pr: 0.4, sh: 14, loc: 'frigo', pk: [1], m: 'citron' }],
  ['herbes-fraiches', 'Herbes fraîches (basilic, persil…)', 'fruits-legumes', 'pc', { pr: 1.6, sh: 5, loc: 'frigo', pk: [1], m: '^(delhaize )?(basilic|persil|ciboulette|coriandre)\\b' }],
  ['pomme', 'Pommes', 'fruits-legumes', 'pc', { pr: 0.4, sh: 21, loc: 'frigo', pk: [6], m: 'pommes?\\b(?! de terre)' }],
  ['poire', 'Poires', 'fruits-legumes', 'pc', { pr: 0.5, sh: 10, loc: 'frigo', pk: [4], m: 'poires?\\b' }],
  ['banane', 'Bananes', 'fruits-legumes', 'pc', { pr: 0.25, sh: 6, loc: 'placard', pk: [5], m: 'banane' }],
  ['mandarine', 'Mandarines', 'fruits-legumes', 'g', { pr: 2.6, sh: 10, loc: 'frigo', pk: [1000], m: 'mandarine|clementine' }],
  ['orange', 'Oranges', 'fruits-legumes', 'pc', { pr: 0.6, sh: 14, loc: 'frigo', pk: [4], m: 'orange' }],
  ['kiwi', 'Kiwis', 'fruits-legumes', 'pc', { pr: 0.5, sh: 14, loc: 'frigo', pk: [6], m: 'kiwi' }],
  // ----- Boulangerie -----
  ['pain', 'Pain', 'boulangerie', 'g', { pr: 3.5, sh: 4, loc: 'placard', al: ['gluten'], pk: [800, 400], m: '^(delhaize )?pain|pain (suedois|complet|gris)' }],
  ['pain-pistolet', 'Pistolets', 'boulangerie', 'pc', { pr: 0.3, sh: 2, loc: 'placard', al: ['gluten'], pk: [6], m: 'pistolet|petits? pains' }],
  ['wraps', 'Wraps (tortillas)', 'boulangerie', 'pc', { pr: 0.4, sh: 21, loc: 'placard', al: ['gluten'], pk: [8, 6], m: 'wraps?\\b|tortillas?' }],
  ['pate-brisee', 'Pâte brisée', 'boulangerie', 'pc', { pr: 1.8, sh: 20, loc: 'frigo', al: ['gluten'], pk: [1], m: 'pate brisee|pate feuilletee' }],
  // ----- Viandes & volailles -----
  ['poulet-filet', 'Filet de poulet', 'boucherie', 'g', { pr: 10.5, sh: 3, loc: 'frigo', t: ['volaille', 'viande'], pro: 'poulet', pk: [600, 300], m: 'filets? de poulet|blancs? de poulet|aiguillettes? de poulet', sub: ['dinde-filet'] }],
  ['dinde-filet', 'Filet de dinde', 'boucherie', 'g', { pr: 11, sh: 3, loc: 'frigo', t: ['volaille', 'viande'], pro: 'dinde', pk: [500], m: 'dinde', sub: ['poulet-filet'] }],
  ['poulet-entier', 'Poulet entier', 'boucherie', 'g', { pr: 5.5, sh: 3, loc: 'frigo', t: ['volaille', 'viande'], pro: 'poulet', pk: [1500], m: 'poulet (entier|roti|fermier)' }],
  ['chipolata-poulet', 'Chipolatas de poulet', 'boucherie', 'g', { pr: 9.5, sh: 4, loc: 'frigo', t: ['volaille', 'viande'], al: ['gluten'], pro: 'poulet', pk: [325, 650], m: 'chipolata', sub: ['saucisse'] }],
  ['saucisse', 'Saucisses', 'boucherie', 'g', { pr: 8, sh: 3, loc: 'frigo', t: ['porc', 'viande'], al: ['gluten'], pro: 'porc', pk: [400], m: 'saucisses?\\b|merguez', sub: ['chipolata-poulet'] }],
  ['boeuf-hache', 'Bœuf haché', 'boucherie', 'g', { pr: 10, sh: 2, loc: 'frigo', t: ['viande'], pro: 'boeuf', pk: [500, 400], m: '\\bhache\\b|boeuf hache' }],
  ['boeuf-braiser', 'Bœuf à braiser', 'boucherie', 'g', { pr: 14, sh: 3, loc: 'frigo', t: ['viande'], pro: 'boeuf', pk: [600], m: 'stoofvlees|boeuf a braiser|carbonnade' }],
  ['roti-porc', 'Rôti de porc', 'boucherie', 'g', { pr: 9, sh: 3, loc: 'frigo', t: ['porc', 'viande'], pro: 'porc', pk: [800], m: 'roti de porc|filet de porc|filet mignon' }],
  ['lardons', 'Lardons', 'charcuterie', 'g', { pr: 9, sh: 7, loc: 'frigo', t: ['porc', 'viande'], pro: 'porc', pk: [200], m: 'lardons?' }],
  ['boulettes-viande', 'Boulettes de viande cuites', 'boucherie', 'g', { pr: 12, sh: 5, loc: 'frigo', t: ['viande'], al: ['gluten', 'oeufs'], pro: 'boeuf', pk: [500], m: 'boulettes? de viande|ribs' }],
  ['plat-four-volaille', 'Plat préparé au four (volaille)', 'boucherie', 'g', { pr: 12, sh: 4, loc: 'frigo', t: ['volaille', 'viande', 'alcool'], al: ['celeri', 'gluten', 'sulfites', 'lait'], pro: 'poulet', pk: [480], m: 'plat au four|coq au vin|plat prepare' }],
  // ----- Poissons -----
  ['saumon-filet', 'Filet de saumon', 'poissonnerie', 'g', { pr: 24, sh: 2, loc: 'frigo', t: ['poisson'], al: ['poissons'], pro: 'poisson', pk: [250, 500], m: 'saumon (atlantique|bio|classique)|pave de saumon|filet de saumon', sub: ['poisson-blanc'] }],
  ['poisson-blanc', 'Poisson blanc (églefin, cabillaud)', 'poissonnerie', 'g', { pr: 28, sh: 2, loc: 'frigo', t: ['poisson'], al: ['poissons'], pro: 'poisson', pk: [300], m: 'eglefin|cabillaud|colin|merlu|lieu noir', sub: ['saumon-filet'] }],
  ['scampis', 'Scampis', 'surgeles', 'g', { pr: 21, sh: 90, loc: 'congelateur', t: ['crustace'], al: ['crustaces'], pro: 'crustace', pk: [185, 400], m: 'scampis?|crevettes?|gambas' }],
  ['tataki-saumon', 'Tataki de saumon (prêt à manger)', 'poissonnerie', 'g', { pr: 63, sh: 3, loc: 'frigo', t: ['poisson'], al: ['poissons', 'soja', 'sesame'], pro: 'poisson', pk: [110], m: 'tataki' }],
  ['saumon-fume', 'Saumon fumé', 'poissonnerie', 'g', { pr: 40, sh: 10, loc: 'frigo', t: ['poisson'], al: ['poissons'], pro: 'poisson', pk: [100, 200], m: 'saumon fume' }],
  ['thon-boite', 'Thon en boîte', 'conserves', 'g', { pr: 10, sh: 730, loc: 'placard', t: ['poisson'], al: ['poissons'], pro: 'poisson', pk: [140], m: 'thon' }],
  ['batonnets-poisson', 'Bâtonnets de poisson', 'surgeles', 'g', { pr: 9, sh: 180, loc: 'congelateur', t: ['poisson'], al: ['poissons', 'gluten'], pro: 'poisson', pk: [300], m: 'batonnets? de (poisson|colin)|poisson pane' }],
  // ----- Charcuterie -----
  ['jambon', 'Jambon blanc', 'charcuterie', 'g', { pr: 14, sh: 5, loc: 'frigo', t: ['porc', 'viande'], pro: 'porc', pk: [100, 200], m: 'jambon' }],
  ['charcuterie-mixte', 'Charcuterie (salami, filet de saxe…)', 'charcuterie', 'g', { pr: 20, sh: 7, loc: 'frigo', t: ['porc', 'viande'], pro: 'porc', pk: [100], m: 'salami|filet de saxe|charcuterie|saucisson|coppa|speck|rosette' }],
  // ----- Laitiers & œufs -----
  ['oeufs', 'Œufs', 'laitier', 'pc', { pr: 0.35, sh: 21, loc: 'frigo', t: ['oeuf'], al: ['oeufs'], pk: [6, 12], m: 'oeufs?\\b' }],
  ['lait', 'Lait', 'laitier', 'ml', { pr: 1.0, sh: 7, loc: 'frigo', t: ['laitier'], al: ['lait'], pk: [1000], m: 'lait (demi|entier|ecreme|uht)|^lait\\b(?! de croissance| de coco)' }],
  ['beurre', 'Beurre', 'laitier', 'g', { pr: 11, sh: 45, loc: 'frigo', t: ['laitier'], al: ['lait'], pk: [250], m: 'beurre\\b(?! de cacahuete)' }],
  ['creme', 'Crème liquide', 'laitier', 'ml', { pr: 4.5, sh: 14, loc: 'frigo', t: ['laitier'], al: ['lait'], pk: [200, 250], m: 'creme (liquide|fraiche|entiere|cuisine)' }],
  ['yaourt-nature', 'Yaourt nature', 'laitier', 'g', { pr: 3, sh: 14, loc: 'frigo', t: ['laitier'], al: ['lait'], pk: [500], m: 'yaourt|activia|yoplait' , x: 'skyr|grec'}],
  ['yaourt-grec', 'Yaourt grec', 'laitier', 'g', { pr: 4, sh: 14, loc: 'frigo', t: ['laitier'], al: ['lait'], pk: [440], m: 'yaourt a la grecque|yaourt grec|grec' }],
  ['skyr', 'Skyr / fromage frais protéiné', 'laitier', 'g', { pr: 6, sh: 14, loc: 'frigo', t: ['laitier'], al: ['lait'], pk: [450], m: 'skyr|fromage frais proteine|produit laitier proteine' }],
  ['fromage-rape', 'Fromage râpé', 'laitier', 'g', { pr: 10, sh: 21, loc: 'frigo', t: ['laitier'], al: ['lait'], pk: [200, 150], m: 'fromage rape|emmental rape|gouda rape' }],
  ['fromage-tranches', 'Fromage en tranches / bloc', 'laitier', 'g', { pr: 12, sh: 21, loc: 'frigo', t: ['laitier'], al: ['lait'], pk: [200], m: 'passendale|pere joseph|fromage en bloc|fromage en tranches|gouda|edam|maasdam' }],
  ['mozzarella', 'Mozzarella', 'laitier', 'g', { pr: 9, sh: 10, loc: 'frigo', t: ['laitier'], al: ['lait'], pk: [125, 250], m: 'mozzarella|burrata' }],
  ['parmesan', 'Parmesan', 'laitier', 'g', { pr: 20, sh: 60, loc: 'frigo', t: ['laitier'], al: ['lait'], pk: [100], m: 'parmesan|grana padano|parmigiano' }],
  ['fromage-raclette', 'Fromage à raclette', 'laitier', 'g', { pr: 11, sh: 21, loc: 'frigo', t: ['laitier'], al: ['lait'], pk: [400], m: 'raclette' }],
  ['gorgonzola', 'Gorgonzola', 'laitier', 'g', { pr: 12, sh: 14, loc: 'frigo', t: ['laitier'], al: ['lait'], pk: [200], m: 'gorgonzola|roquefort|fromage en portion' }],
  ['feta', 'Feta', 'laitier', 'g', { pr: 11, sh: 21, loc: 'frigo', t: ['laitier'], al: ['lait'], pk: [200], m: 'feta' }],
  // ----- Épicerie -----
  ['pates', 'Pâtes', 'epicerie', 'g', { pr: 1.8, sh: 730, loc: 'placard', al: ['gluten'], pk: [500], m: '\\bpates\\b|spaghetti|penne|tagliatelle|fusilli|macaroni|linguine', x: 'farcies|ravioli|tortellini|sauce|base pour' }],
  ['pates-lasagne', 'Feuilles de lasagne', 'epicerie', 'g', { pr: 3.5, sh: 730, loc: 'placard', al: ['gluten'], pk: [500], m: 'lasagne' }],
  ['pates-farcies', 'Pâtes farcies (ravioli…)', 'epicerie', 'g', { pr: 8, sh: 14, loc: 'frigo', al: ['gluten', 'lait', 'oeufs'], pk: [250], m: 'pates farcies|ravioli|tortellini|tortelloni' }],
  ['riz', 'Riz', 'epicerie', 'g', { pr: 2.2, sh: 730, loc: 'placard', pk: [1000, 500], m: '\\briz\\b', x: 'barres?|galettes?|toast|biscuit|souffle' }],
  ['flocons-avoine', "Flocons d'avoine", 'epicerie', 'g', { pr: 2.5, sh: 365, loc: 'placard', al: ['gluten'], pk: [500], m: 'flocons? d.avoine|porridge' }],
  ['muesli', 'Muesli / céréales', 'epicerie', 'g', { pr: 5, sh: 180, loc: 'placard', al: ['gluten', 'fruits_a_coque'], pk: [500], m: 'muesli|cereales|granola|cornflakes' }],
  ['confiture', 'Confiture', 'epicerie', 'g', { pr: 6, sh: 365, loc: 'placard', pk: [335], m: 'confiture|pate a tartiner' }],
  ['biscuits', 'Biscuits', 'epicerie', 'g', { pr: 6, sh: 120, loc: 'placard', al: ['gluten', 'lait', 'oeufs'], pk: [200], m: 'biscuits?\\b|speculoos|galettes au beurre' }],
  ['chocolat', 'Chocolat', 'epicerie', 'g', { pr: 12, sh: 365, loc: 'placard', al: ['lait', 'soja'], pk: [200], m: 'chocolat|cote d.or' }],
  ['sauce-soja', 'Sauce soja', 'epicerie', 'ml', { pr: 8, sh: 365, loc: 'placard', al: ['soja', 'gluten'], pk: [150], m: 'sauce soja' }],
  ['sauce-poke', 'Sauce poké', 'epicerie', 'ml', { pr: 18, sh: 365, loc: 'placard', al: ['soja', 'sesame', 'gluten'], pk: [250], m: 'poke sauce|sauce poke' }],
  ['wakame', "Salade d'algues wakamé", 'epicerie', 'g', { pr: 22, sh: 14, loc: 'frigo', al: ['soja', 'sesame'], pk: [125], m: 'wakame|algues' }],
  ['lait-coco', 'Lait de coco', 'conserves', 'ml', { pr: 3, sh: 730, loc: 'placard', pk: [400], m: 'lait de coco|creme de coco' }],
  ['beurre-cacahuete', 'Beurre de cacahuète', 'epicerie', 'g', { pr: 9, sh: 365, loc: 'placard', al: ['arachides'], pk: [350], m: 'beurre de cacahuete|peanut' }],
  // ----- Conserves & sauces -----
  ['sauce-tomate', 'Sauce tomate (bocal)', 'conserves', 'g', { pr: 3.5, sh: 540, loc: 'placard', al: ['celeri'], pk: [400], m: 'sauce (pour pates|tomate)|base pour sauce|mutti|bertolli' }],
  ['tomates-concassees', 'Tomates concassées', 'conserves', 'g', { pr: 2.2, sh: 730, loc: 'placard', pk: [400], m: 'tomates? (concassees|pelees)|conserve de tomates|passata' }],
  ['haricots-rouges', 'Haricots rouges (boîte)', 'conserves', 'g', { pr: 3, sh: 730, loc: 'placard', pk: [400], m: 'haricots? rouges?' }],
  ['pois-chiches', 'Pois chiches (boîte)', 'conserves', 'g', { pr: 3, sh: 730, loc: 'placard', pk: [400], m: 'pois chiches?' }],
  ['mais', 'Maïs (boîte)', 'conserves', 'g', { pr: 3.5, sh: 730, loc: 'placard', pk: [285], m: '\\bmais\\b' }],
  // ----- Surgelés -----
  ['frites', 'Frites surgelées', 'surgeles', 'g', { pr: 3, sh: 180, loc: 'congelateur', pk: [750, 1000], m: 'frites|croquettes' }],
  ['pizza-surgelee', 'Pizza surgelée', 'surgeles', 'pc', { pr: 3.5, sh: 180, loc: 'congelateur', al: ['gluten', 'lait'], pk: [1], m: 'pizza|stromboli' }],
  ['petits-pois', 'Petits pois', 'surgeles', 'g', { pr: 4, sh: 180, loc: 'congelateur', pk: [450], m: 'petits pois' }],
  ['legumes-surgeles', 'Légumes surgelés', 'surgeles', 'g', { pr: 4, sh: 180, loc: 'congelateur', pk: [750, 450], m: 'legumes? (bio|surgeles)|poelee surgelee' }],
  ['mangue', 'Mangue (morceaux)', 'surgeles', 'g', { pr: 5.3, sh: 180, loc: 'congelateur', pk: [250], m: 'mangue' }],
  ['fruits-rouges', 'Fruits rouges surgelés', 'surgeles', 'g', { pr: 8, sh: 180, loc: 'congelateur', pk: [300], m: 'fruits rouges|framboises?|myrtilles?' }],
  ['puree-legumes', 'Purée de légumes', 'fruits-legumes', 'g', { pr: 6.3, sh: 6, loc: 'frigo', al: ['lait'], t: ['laitier'], pk: [500], m: 'puree' }],
  // ----- Alcool (cuisine) -----
  ['biere-brune', 'Bière brune', 'boissons', 'ml', { pr: 3, sh: 365, loc: 'placard', t: ['alcool'], al: ['gluten'], pk: [330], m: 'biere (brune|d.abbaye)|leffe' }],
  ['vin-rouge', 'Vin rouge (cuisine)', 'boissons', 'ml', { pr: 6, sh: 30, loc: 'placard', t: ['alcool'], al: ['sulfites'], pk: [750], m: 'vin rouge' }],
  // ----- Basiques (supposés toujours présents) -----
  ['sel', 'Sel', 'epicerie', 'g', { b: 1, pk: [1000] }],
  ['poivre', 'Poivre', 'epicerie', 'g', { b: 1, pk: [50] }],
  ['huile-olive', "Huile d'olive", 'epicerie', 'ml', { b: 1, pk: [750] }],
  ['huile-neutre', 'Huile de tournesol', 'epicerie', 'ml', { b: 1, pk: [1000] }],
  ['vinaigre', 'Vinaigre', 'epicerie', 'ml', { b: 1, pk: [500] }],
  ['sucre', 'Sucre', 'epicerie', 'g', { b: 1, pk: [1000] }],
  ['farine', 'Farine', 'epicerie', 'g', { b: 1, al: ['gluten'], pk: [1000] }],
  ['epices', 'Épices & herbes séchées (paprika, curry, origan…)', 'epicerie', 'g', { b: 1, pk: [50] }],
  ['bouillon-cube', 'Bouillon (cubes)', 'epicerie', 'pc', { b: 1, al: ['celeri'], pk: [12] }],
  ['moutarde', 'Moutarde', 'epicerie', 'g', { b: 1, al: ['moutarde'], pk: [200] }],
  ['ketchup', 'Ketchup', 'epicerie', 'g', { b: 1, pk: [500] }],
  ['mayonnaise', 'Mayonnaise', 'epicerie', 'g', { b: 1, al: ['oeufs', 'moutarde'], t: ['oeuf'], pk: [300] }],
  ['ail', 'Ail', 'fruits-legumes', 'pc', { b: 1, pk: [1] }],
  ['oignon', 'Oignons', 'fruits-legumes', 'pc', { b: 1, pk: [1] }],
];

const ANIMAL_TAGS = ['viande', 'volaille', 'porc', 'poisson', 'crustace', 'mollusque', 'laitier', 'oeuf', 'miel', 'gelatine'];

const INGREDIENTS = Object.fromEntries(
  RAW.map(([id, name, rayon, unit, o = {}]) => [
    id,
    {
      id,
      name,
      rayon,
      unit,
      basic: !!o.b,
      tags: o.t ?? [],
      allergens: o.al ?? [],
      packs: o.pk ?? [1],
      price: o.pr ?? 0,
      shelf: o.sh ?? 365,
      loc: o.loc ?? 'placard',
      protein: o.pro ?? null,
      match: o.m ? new RegExp(o.m) : null,
      exclude: o.x ? new RegExp(o.x) : null,
      sub: o.sub ?? [],
      animal: (o.t ?? []).some((t) => ANIMAL_TAGS.includes(t)),
    },
  ])
);

const DEFAULT_BASICS = Object.values(INGREDIENTS).filter((i) => i.basic).map((i) => i.id);

/** Groupes pour les recettes flexibles (anti-gaspi) : l'ingrédient est choisi selon le stock et les promos. */
const GROUPS = {
  legumes: ['carotte', 'courgette', 'poivron', 'tomate', 'champignons', 'brocoli', 'chou-fleur', 'poireau', 'epinards', 'aubergine', 'legumes-surgeles', 'petits-pois', 'legumes-wok'],
  fruits: ['pomme', 'banane', 'mandarine', 'kiwi', 'poire', 'orange'],
  poisson_pret: ['tataki-saumon', 'saumon-fume', 'saumon-filet'],
  charcuterie: ['jambon', 'charcuterie-mixte'],
  fromages: ['fromage-rape', 'fromage-tranches', 'mozzarella'],
  feculents: ['riz', 'pates'],
};

const ingName = (id) => INGREDIENTS[id]?.name ?? id;

/** Produit d'un folder → ingrédient générique (premier motif qui correspond ; l'ordre de RAW compte). */
const matchIngredient = (text, productMap = {}) => {
  const t = norm(text);
  if (productMap[t]) return productMap[t];
  for (const ing of Object.values(INGREDIENTS)) {
    if (ing.match && ing.match.test(t) && !(ing.exclude && ing.exclude.test(t))) return ing.id;
  }
  return null;
};

/** Rayon pour un produit non rattaché à un ingrédient (affichage « autres promos »). */
const guessRayon = (text) => {
  const t = norm(text);
  if (/biere|vin |gin|whisky|coca|soda|boisson|jus |eau |ice tea|red bull|spa |limonade|cafe|the /.test(t)) return 'boissons';
  if (/lessive|papier|mouchoir|gel douche|deodorant|lames|vaisselle|adoucissant|shampo|soin|chats|allume-feu|bloc w|dentifrice/.test(t)) return 'maison';
  if (/fromage|yaourt|lait|beurre|creme|dessert/.test(t)) return 'laitier';
  if (/poulet|boeuf|porc|viande|saucisse|cerf|steak|roti/.test(t)) return 'boucherie';
  if (/poisson|saumon|crevette|scampi|eglefin|thon/.test(t)) return 'poissonnerie';
  if (/surgel|pizza|glace/.test(t)) return 'surgeles';
  if (/chips|biscuit|chocolat|praline|bonbon|snack|cafe|confiture|brioche|cereale/.test(t)) return 'epicerie';
  if (/salade|legume|fruit|pomme|poire|kiwi/.test(t)) return 'fruits-legumes';
  return 'autre';
};

/** Combine un format vendu en pack(s) : choisit la combinaison qui couvre `need` en gaspillant le moins. */
const packsFor = (need, sizes) => {
  if (need <= 0) return { size: sizes[0] ?? 1, n: 0, total: 0 };
  let best = null;
  for (const s of sizes) {
    const n = Math.ceil(need / s - 1e-9);
    const total = n * s;
    if (!best || total < best.total - 1e-9 || (Math.abs(total - best.total) < 1e-9 && n < best.n)) best = { size: s, n, total };
  }
  return best;
};

return { ALLERGENS, RAYONS, RAYON_LABEL, RAYON_ICON, RAYON_ORDER, INGREDIENTS, DEFAULT_BASICS, GROUPS, ingName, matchIngredient, guessRayon, packsFor };
})();

// ---- shared/efsa.js
__M["shared/efsa.js"] = (() => {
// Besoins moyens en énergie (Average Requirements, MJ/jour) — EFSA, Dietary Reference Values for energy,
// EFSA Journal 2013;11(1):3005. Valeurs reprises telles quelles depuis l'outil officiel « EFSA DRV Finder »
// (multimedia.efsa.europa.eu/drvs), qui sert les mêmes tableaux que la publication.
// PAL = niveau d'activité physique : 1,4 faible (sédentaire) · 1,6 moyen · 1,8 actif · 2,0 très actif.
// Les PAL non publiés pour un âge (ex. 1,6 avant 4 ans) sont absents : on prend le PAL publié le plus proche.

/** Enfants : âge → { PAL: MJ/jour } */
const CHILD_M = {
  1: { 1.4: 3.3 }, 2: { 1.4: 4.3 }, 3: { 1.4: 4.9 },
  4: { 1.4: 5.3, 1.6: 6.0, 1.8: 6.8 }, 5: { 1.4: 5.6, 1.6: 6.4, 1.8: 7.2 }, 6: { 1.4: 5.9, 1.6: 6.7, 1.8: 7.6 },
  7: { 1.4: 6.3, 1.6: 7.2, 1.8: 8.1 }, 8: { 1.4: 6.7, 1.6: 7.6, 1.8: 8.6 }, 9: { 1.4: 7.0, 1.6: 8.1, 1.8: 9.1 },
  10: { 1.6: 8.1, 1.8: 9.1, 2.0: 10.1 }, 11: { 1.6: 8.5, 1.8: 9.6, 2.0: 10.7 }, 12: { 1.6: 9.1, 1.8: 10.2, 2.0: 11.4 },
  13: { 1.6: 9.8, 1.8: 11.0, 2.0: 12.2 }, 14: { 1.6: 10.5, 1.8: 11.8, 2.0: 13.1 }, 15: { 1.6: 11.3, 1.8: 12.7, 2.0: 14.1 },
  16: { 1.6: 11.9, 1.8: 13.4, 2.0: 14.9 }, 17: { 1.6: 12.3, 1.8: 13.8, 2.0: 15.4 },
};
const CHILD_F = {
  1: { 1.4: 3.0 }, 2: { 1.4: 4.0 }, 3: { 1.4: 4.6 },
  4: { 1.4: 4.9, 1.6: 5.6, 1.8: 6.3 }, 5: { 1.4: 5.2, 1.6: 5.9, 1.8: 6.7 }, 6: { 1.4: 5.5, 1.6: 6.3, 1.8: 7.1 },
  7: { 1.4: 5.8, 1.6: 6.7, 1.8: 7.5 }, 8: { 1.4: 6.2, 1.6: 7.1, 1.8: 7.9 }, 9: { 1.4: 6.6, 1.6: 7.5, 1.8: 8.4 },
  10: { 1.6: 7.6, 1.8: 8.6, 2.0: 9.5 }, 11: { 1.6: 8.0, 1.8: 9.0, 2.0: 10.0 }, 12: { 1.6: 8.4, 1.8: 9.4, 2.0: 10.5 },
  13: { 1.6: 8.8, 1.8: 9.9, 2.0: 11.0 }, 14: { 1.6: 9.1, 1.8: 10.2, 2.0: 11.4 }, 15: { 1.6: 9.3, 1.8: 10.5, 2.0: 11.7 },
  16: { 1.6: 9.5, 1.8: 10.6, 2.0: 11.8 }, 17: { 1.6: 9.5, 1.8: 10.7, 2.0: 11.9 },
};
const adult = (a, b, c, d) => ({ 1.4: a, 1.6: b, 1.8: c, 2.0: d });
/** Adultes : tranche d'âge → { PAL: MJ/jour }. Pas de valeur publiée pour ≥ 80 ans. */
const ADULT_M = {
  '18-29': adult(9.8, 11.2, 12.6, 14.0), '30-39': adult(9.5, 10.8, 12.2, 13.5), '40-49': adult(9.3, 10.7, 12.0, 13.4),
  '50-59': adult(9.2, 10.5, 11.9, 13.2), '60-69': adult(8.4, 9.6, 10.9, 12.1), '70-79': adult(8.3, 9.5, 10.7, 11.9),
};
const ADULT_F = {
  '18-29': adult(7.9, 9.0, 10.1, 11.2), '30-39': adult(7.6, 8.7, 9.8, 10.8), '40-49': adult(7.5, 8.6, 9.7, 10.7),
  '50-59': adult(7.5, 8.5, 9.6, 10.7), '60-69': adult(6.8, 7.8, 8.8, 9.7), '70-79': adult(6.8, 7.7, 8.7, 9.6),
};

const EFSA_TABLES = { CHILD_M, CHILD_F, ADULT_M, ADULT_F };

/** Adulte de référence : moyenne homme/femme 30-39 ans, activité moyenne (PAL 1,6). */
const REF_MJ = (ADULT_M['30-39'][1.6] + ADULT_F['30-39'][1.6]) / 2; // 9,75 MJ/jour

const AGE_CATS = {
  enfant_3_6: { label: 'Enfant 3-6 ans', ages: [3, 4, 5, 6] },
  enfant_7_12: { label: 'Enfant 7-12 ans', ages: [7, 8, 9, 10, 11, 12] },
  ado_13_17: { label: 'Ado 13-17 ans', ages: [13, 14, 15, 16, 17] },
  adulte: { label: 'Adulte', brackets: ['30-39'] }, // tranche de référence de l'adulte
  senior_65: { label: 'Senior 65+', brackets: ['60-69', '70-79'] }, // pas de valeur ≥ 80 ans chez l'EFSA
};
const ACTIVITY_PAL = { faible: 1.4, moyenne: 1.6, sportif: 1.8 };

const nearest = (row, pal) => {
  const pals = Object.keys(row).map(Number);
  pals.sort((a, b) => Math.abs(a - pal) - Math.abs(b - pal) || a - b); // égalité → PAL le plus bas
  return row[pals[0]];
};
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

const needFor = (cat, sex, pal) => {
  const c = AGE_CATS[cat] || AGE_CATS.adulte;
  const one = (s) => {
    if (c.ages) return mean(c.ages.map((a) => nearest((s === 'F' ? CHILD_F : CHILD_M)[a], pal)));
    return mean(c.brackets.map((b) => nearest((s === 'F' ? ADULT_F : ADULT_M)[b], pal)));
  };
  if (sex === 'homme') return one('M');
  if (sex === 'femme') return one('F');
  return (one('M') + one('F')) / 2; // non précisé
};

/** Besoin énergétique du profil, MJ/jour (EFSA). */
const energyNeedMJ = (p) => needFor(p.ageCat, p.sex, ACTIVITY_PAL[p.activity] ?? ACTIVITY_PAL.moyenne);

const DEFAULT_APPETITE = { petit: 0.85, normal: 1, gros: 1.15 };

/** Coefficient de portion = besoin du profil ÷ besoin de l'adulte de référence, ajusté par l'appétit. */
const portionCoef = (profile, appetite = DEFAULT_APPETITE) =>
  (energyNeedMJ(profile) / REF_MJ) * (appetite[profile.appetite] ?? 1);

return { EFSA_TABLES, REF_MJ, AGE_CATS, ACTIVITY_PAL, energyNeedMJ, DEFAULT_APPETITE, portionCoef };
})();

// ---- shared/rules.js
__M["shared/rules.js"] = (() => {
// Règles métier : profils, présence, portions, filtres (allergies / régimes / religion / goûts / matériel).
const { INGREDIENTS, GROUPS, ALLERGENS } = __M["shared/ingredients.js"];
const { portionCoef, DEFAULT_APPETITE } = __M["shared/efsa.js"];
const { dayKey, norm, uniq, niceQty } = __M["shared/util.js"];

const DIETS = { aucun: 'Aucun', vegetarien: 'Végétarien', vegetalien: 'Végétalien', pesco: 'Pesco-végétarien' };
const RELIGIOUS = { halal: 'Halal', casher: 'Casher', sans_porc: 'Sans porc', sans_alcool: 'Sans alcool en cuisine' };
const SEXES = { homme: 'Homme', femme: 'Femme', nonprecise: 'Non précisé' };
const ACTIVITIES = { faible: 'Faible', moyenne: 'Moyenne', sportif: 'Sportif' };
const APPETITES = { petit: 'Petit', normal: 'Normal', gros: 'Gros' };

const DEFAULT_SETTINGS = () => ({
  meals: { 'petit-dej': true, diner: true, souper: true, collation: false },
  equipment: { four: true, microondes: true, airfryer: false, plaques: true, mixeur: true, vapeur: false, barbecue: false, raclette: false },
  equipmentOther: '',
  feux: 4,
  freezer: 'moyen',
  budget: 120,
  basics: null, // null = liste par défaut (DEFAULT_BASICS)
  lowBasics: [],
  hated: [],
  timeRules: { semaine: { 'petit-dej': null, diner: null, souper: 20 }, weekend: { 'petit-dej': null, diner: null, souper: null } },
  appetite: { ...DEFAULT_APPETITE },
  strategicThreshold: 25,
  productMap: {},
  priceOverrides: {},
  onboarded: false,
  inventoryAt: null,
  lang: 'fr',
});

const FREEZER_SLOTS = { aucun: 0, petit: 2, moyen: 5, grand: 10 };

const newProfile = (over = {}) => ({
  name: '', ageCat: 'adulte', sex: 'nonprecise', appetite: 'normal', activity: 'moyenne', diet: 'aucun',
  religious: [], allergens: [], allergenFree: '', hated: [], presence: null, snacks: false, ...over,
});

const isBasic = (ingId, settings) => {
  const set = settings?.basics ?? Object.values(INGREDIENTS).filter((i) => i.basic).map((i) => i.id);
  return set.includes(ingId);
};

// ---------- Présence & portions ----------
/** Grille de présence : presence[jour][repas] === false → absent. Défaut : toujours présent. */
const isPresent = (profile, date, meal) => {
  const d = profile.presence?.[dayKey(date)];
  return d?.[meal] !== false;
};
const presentProfiles = (profiles, date, meal) =>
  profiles.filter((p) => isPresent(p, date, meal) && (meal !== 'collation' || p.snacks));

const coefOf = (profile, settings) => portionCoef(profile, settings?.appetite ?? DEFAULT_APPETITE);

/** Somme des coefficients des personnes présentes (+ invités, comptés comme des adultes de référence). */
const slotPortions = (slot, profiles, settings) => {
  const people = presentProfiles(profiles, slot.date, slot.meal);
  const sum = people.reduce((a, p) => a + coefOf(p, settings), 0) + (slot.guests || 0);
  return { people, guests: slot.guests || 0, portions: sum, couverts: people.length + (slot.guests || 0) };
};

// ---------- Filtres ----------
const tags = (ingId) => INGREDIENTS[ingId]?.tags ?? [];
const hasAny = (ings, list) => ings.some((i) => tags(i).some((t) => list.includes(t)));

/** Ingrédients incompatibles avec un profil (exclusion STRICTE : allergie, régime, religion). */
const strictViolations = (ingIds, profile) => {
  const bad = [];
  const free = (profile.allergenFree || '')
    .split(/[,;\n]/).map(norm).filter(Boolean);
  for (const id of ingIds) {
    const ing = INGREDIENTS[id];
    if (!ing) continue;
    for (const a of profile.allergens || []) if (ing.allergens.includes(a)) bad.push({ id, why: `allergie : ${ALLERGENS[a] ?? a}` });
    const label = norm(`${ing.name} ${id.replace(/-/g, ' ')}`);
    for (const f of free) if (label.includes(f)) bad.push({ id, why: `allergie : ${f}` });
  }
  const t = (i) => tags(i);
  const meatish = ['viande', 'volaille', 'porc'];
  const fishish = ['poisson', 'crustace', 'mollusque'];
  if (profile.diet === 'vegetarien') for (const id of ingIds) if (t(id).some((x) => [...meatish, ...fishish, 'gelatine'].includes(x))) bad.push({ id, why: 'régime végétarien' });
  if (profile.diet === 'vegetalien') for (const id of ingIds) if (INGREDIENTS[id]?.animal) bad.push({ id, why: 'régime végétalien' });
  if (profile.diet === 'pesco') for (const id of ingIds) if (t(id).some((x) => meatish.includes(x))) bad.push({ id, why: 'régime pesco-végétarien' });
  const rel = profile.religious || [];
  if (rel.includes('halal')) for (const id of ingIds) if (t(id).some((x) => ['porc', 'alcool', 'gelatine'].includes(x))) bad.push({ id, why: 'halal' });
  if (rel.includes('casher')) {
    for (const id of ingIds) if (t(id).some((x) => ['porc', 'crustace', 'mollusque', 'alcool'].includes(x))) bad.push({ id, why: 'casher' });
    if (hasAny(ingIds, ['viande', 'volaille']) && hasAny(ingIds, ['laitier'])) for (const id of ingIds) if (t(id).includes('laitier')) bad.push({ id, why: 'casher (viande + lait)' });
  }
  if (rel.includes('sans_porc')) for (const id of ingIds) if (t(id).includes('porc')) bad.push({ id, why: 'sans porc' });
  if (rel.includes('sans_alcool')) for (const id of ingIds) if (t(id).includes('alcool')) bad.push({ id, why: 'sans alcool' });
  return bad;
};

/** Aliments détestés (exclusion SOUPLE) : du profil + du foyer. */
const hatedHits = (ingIds, profile, settings) => {
  const list = [...(profile.hated || []), ...(settings?.hated || [])].map(norm).filter(Boolean);
  if (!list.length) return [];
  const hits = [];
  for (const id of ingIds) {
    const ing = INGREDIENTS[id];
    if (!ing) continue;
    const label = norm(`${ing.name} ${id.replace(/-/g, ' ')}`);
    for (const h of list) if (label.includes(h)) hits.push({ id, word: h });
  }
  return hits;
};

/** Matériel : chaîne = requis ; tableau = au moins un parmi. */
const equipmentOk = (recipe, settings) => {
  const eq = settings?.equipment ?? {};
  return (recipe.eq ?? []).every((e) => (Array.isArray(e) ? e.some((k) => eq[k]) : !!eq[e]));
};

const groupMembers = (g) => GROUPS[g] ?? [];

/**
 * Vérifie la recette pour des personnes données (lignes déjà résolues).
 * - allergie / régime / religion : exclusion stricte (une ligne optionnelle en conflit est simplement retirée)
 * - détesté : souple (ligne optionnelle retirée, sinon pénalité)
 */
const checkLines = (lines, people, settings) => {
  const dropped = new Set();
  const reasons = [];
  const hated = [];
  for (const p of people) {
    const ids = uniq(lines.filter((l) => !dropped.has(l.i)).map((l) => l.ing));
    const bad = strictViolations(ids, p);
    for (const b of bad) {
      const ls = lines.filter((l) => l.ing === b.id);
      if (ls.every((l) => l.opt)) ls.forEach((l) => dropped.add(l.i));
      else reasons.push(`${p.name || 'Profil'} : ${b.why} (${INGREDIENTS[b.id]?.name ?? b.id})`);
    }
    for (const h of hatedHits(uniq(lines.filter((l) => !dropped.has(l.i)).map((l) => l.ing)), p, settings)) {
      const ls = lines.filter((l) => l.ing === h.id && !dropped.has(l.i));
      if (ls.length && ls.every((l) => l.opt)) ls.forEach((l) => dropped.add(l.i));
      else hated.push({ who: p.name, ing: h.id });
    }
  }
  // aliments détestés du foyer, même sans personne présente
  return { ok: reasons.length === 0, reasons, dropped: [...dropped], hated };
};

/** Étiquettes déduites des ingrédients (jamais saisies à la main). */
const derivedTags = (recipe, ingIds) => {
  const all = ingIds ?? recipe.ing.flatMap(([i]) => (typeof i === 'string' ? [i] : []));
  const out = new Set(recipe.tags || []);
  const t = (id) => tags(id);
  const meat = all.some((i) => t(i).some((x) => ['viande', 'volaille', 'porc'].includes(x)));
  const fish = all.some((i) => t(i).some((x) => ['poisson', 'crustace', 'mollusque'].includes(x)));
  const animal = all.some((i) => INGREDIENTS[i]?.animal);
  if (!meat && !fish) out.add('vegetarien');
  if (!animal) out.add('vegetalien');
  if (!meat && fish) out.add('pesco');
  const needsOven = (recipe.eq ?? []).some((e) => e === 'four' || (Array.isArray(e) && e.every((x) => x === 'four')));
  if (!needsOven) out.add('sans-four');
  return [...out];
};

const allergensOf = (ingIds) => uniq(ingIds.flatMap((i) => INGREDIENTS[i]?.allergens ?? []));



return { DIETS, RELIGIOUS, SEXES, ACTIVITIES, APPETITES, DEFAULT_SETTINGS, FREEZER_SLOTS, newProfile, isBasic, isPresent, presentProfiles, coefOf, slotPortions, strictViolations, hatedHits, equipmentOk, groupMembers, checkLines, derivedTags, allergensOf, niceQty };
})();

// ---- shared/seal.js
__M["shared/seal.js"] = (() => {
// Chiffrement des promos publiées sur le site (AES-GCM 256, clé dérivée d'un « code du foyer » par PBKDF2-SHA256).
// Le site est public (GitHub Pages) mais le contenu du folder Delhaize ne doit pas l'être : usage strictement personnel.
// Fonctionne à l'identique dans le navigateur et dans Node (WebCrypto).
const enc = new TextEncoder();
const dec = new TextDecoder();

const b64 = (u8) => {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(s);
};
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

const deriveKey = async (pass, salt, iterations) => {
  const base = await crypto.subtle.importKey('raw', enc.encode(String(pass).normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
};

/** Chiffre un objet JSON. Sel et vecteur d'initialisation aléatoires à chaque appel. */
async function seal(obj, pass, { iterations = 250000 } = {}) {
  if (!pass) throw new Error('Code du foyer manquant');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pass, salt, iterations);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj))));
  return { v: 1, kdf: 'PBKDF2-SHA256', iter: iterations, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
}

/** Déchiffre ; lève « Code incorrect » si la clé ne convient pas ou si le fichier est altéré. */
async function open(sealed, pass) {
  if (!sealed || sealed.v !== 1) throw new Error('Format de fichier inconnu');
  if (!pass) throw new Error('Code du foyer manquant');
  try {
    const key = await deriveKey(pass, unb64(sealed.salt), sealed.iter);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(sealed.iv) }, key, unb64(sealed.ct));
    return JSON.parse(dec.decode(pt));
  } catch {
    throw new Error('Code incorrect');
  }
}

return { seal, open };
})();

// ---- site/src/store.js
__M["site/src/store.js"] = (() => {
// Magasin de données de la version « site statique » (GitHub Pages) : tout est enregistré dans CE navigateur.
// Les promos viennent d'un fichier chiffré publié par une tâche GitHub Actions (data/promos.enc.json) ; elles se déchiffrent
// ici avec le « code du foyer ». Pas de serveur, donc pas de synchronisation automatique entre appareils : on transfère
// les données avec Exporter / Importer (écran Foyer).
const { uid } = __M["shared/util.js"];
const { DEFAULT_SETTINGS } = __M["shared/rules.js"];
const { open } = __M["shared/seal.js"];

const COLLS = ['settings', 'profiles', 'plan', 'stock', 'shopping', 'promos', 'folders', 'weeks', 'waste', 'recipes', 'flags'];
const KEY = 'omq-site:v1';
const CODE_KEY = 'omq-site:code';
/** Données qui viennent du site (pas de l'utilisateur) : exclues de l'export. */
const SITE_COLLS = ['promos', 'folders'];

const S = {
  data: Object.fromEntries(COLLS.map((c) => [c, {}])),
  meta: { online: true, loaded: true, error: null, localOnly: false, readOnly: false, stale: false, promos: { state: 'idle', message: '', updatedAt: null, checkedAt: null } },
  caps: {},
  version: 0,
};

const listeners = new Set();
const subscribe = (fn) => (listeners.add(fn), () => listeners.delete(fn));
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
const get = (coll, id) => {
  const r = S.data[coll]?.[id];
  return r && !r.deleted ? r : null;
};
const list = (coll) => Object.values(S.data[coll] ?? {}).filter((r) => !r.deleted);
const settings = () => {
  const d = DEFAULT_SETTINGS();
  const s = get('settings', 'main') ?? {};
  return { ...d, ...s, meals: { ...d.meals, ...s.meals }, equipment: { ...d.equipment, ...s.equipment }, timeRules: { semaine: { ...d.timeRules.semaine, ...s.timeRules?.semaine }, weekend: { ...d.timeRules.weekend, ...s.timeRules?.weekend } }, appetite: { ...d.appetite, ...s.appetite } };
};

function put(coll, obj) {
  const rec = { ...obj, id: obj.id ?? uid(), _ts: Date.now(), deleted: false };
  S.data[coll][rec.id] = rec;
  saveLocal(); emit();
  return rec;
}
function patch(coll, id, changes) {
  return put(coll, { ...(S.data[coll][id] ?? { id }), ...changes });
}
function putMany(coll, objs) {
  const ts = Date.now();
  for (const o of objs) {
    const rec = { ...o, id: o.id ?? uid(), _ts: ts, deleted: false };
    S.data[coll][rec.id] = rec;
  }
  saveLocal(); emit();
}
function del(coll, id) {
  if (!S.data[coll][id]) return;
  delete S.data[coll][id];
  saveLocal(); emit();
}
function saveSettings(changes) {
  return put('settings', { ...(S.data.settings.main ?? {}), ...changes, id: 'main' });
}
const pendingCount = () => 0;
const syncNow = async () => {};

// ---------- Promos publiées (fichier chiffré) ----------
const getCode = () => { try { return localStorage.getItem(CODE_KEY) || ''; } catch { return ''; } };
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
async function loadPromos() {
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
async function setCode(code) {
  try { localStorage.setItem(CODE_KEY, String(code).trim()); } catch { /* ignoré */ }
  await loadPromos();
  return S.meta.promos.state === 'ok';
}
const forgetCode = () => { try { localStorage.removeItem(CODE_KEY); } catch { /* ignoré */ } };

// ---------- Démarrage ----------
async function init() {
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
const exportJson = () => JSON.stringify({ app: 'on-mange-quoi', v: 1, exportedAt: new Date().toISOString(), data: Object.fromEntries(COLLS.filter((c) => !SITE_COLLS.includes(c)).map((c) => [c, list(c)])) }, null, 1);

/** Remplace les données de l'utilisateur par celles d'un export. Lève une erreur lisible si le texte n'en est pas un. */
function importJson(text) {
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

function wipeAll() {
  try { localStorage.removeItem(KEY); } catch { /* ignoré */ }
  for (const c of COLLS.filter((x) => !SITE_COLLS.includes(x))) S.data[c] = {};
  emit();
}

return { COLLS, S, subscribe, get, list, settings, put, patch, putMany, del, saveSettings, pendingCount, syncNow, getCode, loadPromos, setCode, forgetCode, init, exportJson, importJson, wipeAll };
})();

// ---- shared/recipes.js
__M["shared/recipes.js"] = (() => {
// Bibliothèque de recettes (sortie structurée). Quantités par PORTION DE RÉFÉRENCE
// (1 adulte d'appétit normal = coefficient 1). Les ingrédients sont des ids de `ingredients.js` ;
// `{ any: 'groupe' }` laisse le moteur choisir selon le stock et les promos (recettes anti-gaspi).
// Les régimes / allergènes ne sont JAMAIS saisis ici : ils sont déduits des ingrédients.
const { GROUPS, INGREDIENTS } = __M["shared/ingredients.js"];

const CATEGORIES = {
  express: { label: 'Express', maxTotal: 20, color: '#e8590c', hint: 'Très peu d’étapes, peu de vaisselle' },
  equilibre: { label: 'Équilibré', maxTotal: 40, color: '#2f9e44', hint: 'Légumes majoritaires, cuisson douce' },
  plaisir: { label: 'Petit plaisir', maxTotal: null, color: '#d6336c', hint: 'Comfort food, gourmand' },
  batch: { label: 'Batch cooking', maxTotal: 90, color: '#1971c2', hint: 'Cuisiné une fois, servi 2 à 3 fois' },
  antigaspi: { label: 'Anti-gaspi', maxTotal: null, color: '#5c940d', hint: 'Vide le stock qui arrive à échéance' },
  weekend: { label: 'Week-end', maxTotal: null, color: '#7048e8', hint: 'Plat travaillé ou à partager' },
};
const MEALS = {
  'petit-dej': { label: 'Petit-déjeuner', emoji: '☕', order: 0 },
  diner: { label: 'Dîner', emoji: '🥪', order: 1 },
  souper: { label: 'Souper', emoji: '🍽️', order: 2 },
  collation: { label: 'Collation', emoji: '🍎', order: 3 },
};
const EQUIPMENT = {
  four: 'Four',
  microondes: 'Micro-ondes',
  airfryer: 'Airfryer',
  plaques: 'Plaques de cuisson',
  mixeur: 'Robot / mixeur',
  vapeur: 'Cuiseur vapeur',
  barbecue: 'Barbecue',
  raclette: 'Appareil à raclette',
};

const R = (id, name, emoji, meals, cat, o) => ({
  id, name, emoji, meals, cat,
  tags: o.tags ?? [], prep: o.prep, cook: o.cook, diff: o.diff ?? 'facile',
  eq: o.eq ?? ['plaques'], ing: o.ing, steps: o.steps, keep: o.keep ?? '2 jours au frigo',
  batch: o.batch ?? 1, source: 'bibliotheque',
});
const G = (g) => ({ any: g });
const OPT = { opt: true };

const RECIPES = [
  // ====================== SOUPER — EXPRESS (≤ 20 min) ======================
  R('pates-tomate-mozza', 'Pâtes tomate-mozzarella', '🍝', ['souper', 'diner'], 'express', {
    tags: ['enfants', 'emporter'], prep: 5, cook: 12,
    ing: [['pates', 100], ['sauce-tomate', 90], ['mozzarella', 40], ['parmesan', 8, OPT], ['herbes-fraiches', 0.25, OPT], ['huile-olive', 5], ['ail', 0.5], ['sel', 2], ['poivre', 1]],
    steps: ['Portez une grande casserole d’eau salée à ébullition.', ['Cuisez les pâtes selon les indications du paquet.', 10], 'Pendant ce temps, faites chauffer la sauce tomate avec l’ail émincé dans un filet d’huile d’olive.', 'Égouttez les pâtes, mélangez-les à la sauce et ajoutez la mozzarella en morceaux.', 'Servez avec le parmesan et les herbes.'],
  }),
  R('omelette-champignons', 'Omelette aux champignons et salade', '🍳', ['souper', 'diner'], 'express', {
    tags: ['emporter'], prep: 5, cook: 10,
    ing: [['oeufs', 2.5], ['champignons', 100], ['fromage-rape', 20], ['salade', 0.25], ['beurre', 8], ['pain', 50, OPT], ['sel', 1], ['poivre', 1]],
    steps: ['Émincez les champignons et lavez la salade.', ['Faites revenir les champignons dans le beurre à feu vif.', 4], 'Battez les œufs avec sel et poivre, versez-les sur les champignons.', ['Laissez prendre à feu doux, ajoutez le fromage et repliez l’omelette.', 4], 'Servez avec la salade (et du pain si vous voulez).'],
  }),
  R('wraps-poulet', 'Wraps poulet-crudités', '🌯', ['souper', 'diner'], 'express', {
    tags: ['enfants', 'emporter'], prep: 10, cook: 8,
    ing: [['wraps', 2], ['poulet-filet', 110], ['salade', 0.2], ['tomate', 60], ['concombre', 0.15], ['yaourt-grec', 30], ['epices', 2], ['huile-olive', 5], ['sel', 1]],
    steps: ['Coupez le poulet en lanières et assaisonnez-le avec les épices et le sel.', ['Faites-le dorer à la poêle dans l’huile.', 8], 'Coupez les crudités et mélangez le yaourt avec une pincée de sel.', 'Garnissez les wraps de poulet, crudités et sauce au yaourt, puis roulez-les.'],
  }),
  R('croque-monsieur', 'Croque-monsieur et salade', '🥪', ['souper', 'diner'], 'express', {
    tags: ['enfants', 'emporter'], prep: 5, cook: 10,
    ing: [['pain', 100], ['jambon', 50], ['fromage-rape', 40], ['beurre', 10], ['salade', 0.25]],
    steps: ['Beurrez les tranches de pain d’un côté.', 'Garnissez de jambon et de fromage, refermez.', ['Faites dorer à la poêle ou au grille-pain, 4 minutes de chaque côté.', 8], 'Servez avec la salade.'],
  }),
  R('pates-saumon-epinards', 'Pâtes au saumon et aux épinards', '🍝', ['souper'], 'express', {
    prep: 5, cook: 15,
    ing: [['pates', 100], ['saumon-filet', 100], ['creme', 50], ['epinards', 60], ['citron', 0.1, OPT], ['ail', 0.5], ['huile-olive', 5], ['sel', 1], ['poivre', 1]],
    steps: ['Cuisez les pâtes dans l’eau salée.', 'Coupez le saumon en dés et faites-le dorer 3 minutes avec l’ail.', ['Ajoutez la crème et les épinards, laissez tomber 3 minutes.', 3], 'Mélangez avec les pâtes égouttées, un peu de zeste de citron, poivre.'],
  }),
  R('scampis-ail-spaghetti', 'Scampis à l’ail et spaghetti', '🦐', ['souper'], 'express', {
    prep: 8, cook: 12,
    ing: [['pates', 100], ['scampis', 100], ['tomate', 80], ['ail', 1], ['huile-olive', 8], ['herbes-fraiches', 0.25, OPT], ['sel', 1], ['poivre', 1]],
    steps: ['Décongelez les scampis sous l’eau froide.', ['Cuisez les spaghetti dans l’eau salée.', 10], 'Faites revenir l’ail dans l’huile, ajoutez les scampis 3 minutes, puis les tomates en dés 2 minutes.', 'Mélangez aux pâtes, parsemez d’herbes.'],
  }),
  R('pizza-salade', 'Pizza et salade verte', '🍕', ['souper', 'diner'], 'express', {
    tags: ['enfants'], prep: 3, cook: 15, eq: ['four'],
    ing: [['pizza-surgelee', 0.5], ['salade', 0.25], ['tomate', 50, OPT], ['fromage-rape', 15, OPT], ['huile-olive', 5], ['vinaigre', 3]],
    steps: ['Préchauffez le four selon l’emballage.', ['Enfournez la pizza, garnie de tomate et fromage si vous voulez.', 14], 'Préparez la salade avec huile, vinaigre et sel.', 'Découpez la pizza et servez avec la salade.'],
  }),
  R('quesadillas-haricots', 'Quesadillas haricots rouges-fromage', '🌮', ['souper', 'diner'], 'express', {
    tags: ['enfants'], prep: 8, cook: 8,
    ing: [['wraps', 2], ['haricots-rouges', 80], ['mais', 40], ['fromage-rape', 40], ['poivron', 60], ['epices', 2], ['huile-neutre', 3]],
    steps: ['Égouttez haricots et maïs, coupez le poivron en petits dés.', 'Étalez haricots, maïs, poivron, épices et fromage sur la moitié de chaque wrap, repliez.', ['Faites dorer à la poêle 3-4 minutes de chaque côté.', 7], 'Coupez en triangles et servez.'],
  }),
  R('riz-saute-oeuf', 'Riz sauté aux légumes et à l’œuf', '🍚', ['souper'], 'express', {
    tags: ['enfants'], prep: 8, cook: 12,
    ing: [['riz', 70], ['oeufs', 1.5], [G('legumes'), 120], ['sauce-soja', 10], ['huile-neutre', 8], ['ail', 0.5]],
    steps: [['Cuisez le riz et laissez-le refroidir un instant.', 10], 'Coupez les légumes en petits morceaux.', 'Faites sauter l’ail et les légumes 4 minutes à feu vif dans l’huile.', 'Poussez sur le côté, brouillez les œufs, puis ajoutez le riz et la sauce soja. Mélangez.'],
  }),
  R('ravioli-ricotta-epinards', 'Raviolis ricotta-épinards sauce tomate', '🥟', ['souper', 'diner'], 'express', {
    tags: ['enfants'], prep: 3, cook: 8,
    ing: [['pates-farcies', 125], ['sauce-tomate', 80], ['parmesan', 10, OPT], ['herbes-fraiches', 0.25, OPT]],
    steps: ['Portez de l’eau salée à ébullition.', ['Plongez les raviolis, cuisez-les selon le paquet (3 à 4 minutes).', 4], 'Chauffez la sauce tomate.', 'Égouttez, nappez de sauce et parsemez de parmesan.'],
  }),
  R('salade-pates-thon', 'Salade de pâtes thon-maïs', '🥗', ['souper', 'diner'], 'express', {
    tags: ['emporter'], prep: 10, cook: 10,
    ing: [['pates', 80], ['thon-boite', 60], ['mais', 40], ['tomate', 80], ['concombre', 0.2], ['yaourt-grec', 30], ['huile-olive', 5], ['sel', 1], ['poivre', 1]],
    steps: [['Cuisez les pâtes puis rincez-les à l’eau froide.', 10], 'Coupez tomate et concombre en dés, égouttez thon et maïs.', 'Mélangez le tout avec le yaourt, l’huile, sel et poivre.'],
  }),
  R('plat-prepare-legumes', 'Plat préparé et légumes poêlés', '🍲', ['souper', 'diner'], 'express', {
    tags: ['emporter'], prep: 3, cook: 15, eq: [['four', 'microondes'], 'plaques'],
    ing: [['plat-four-volaille', 240], [G('legumes'), 120], ['huile-olive', 4], ['sel', 1]],
    steps: [['Réchauffez le plat préparé au four ou au micro-ondes selon l’emballage.', 12], 'Pendant ce temps, poêlez les légumes avec un filet d’huile.', 'Servez le plat avec les légumes.'],
  }),

  // ====================== SOUPER — ÉQUILIBRÉ (≤ 40 min) ======================
  R('poke-bowl', 'Poké bowl au saumon', '🥗', ['souper', 'diner'], 'equilibre', {
    tags: ['emporter'], prep: 15, cook: 12,
    ing: [['riz', 70], [G('poisson_pret'), 100], ['avocat', 0.5], ['concombre', 0.3], ['mangue', 60], ['wakame', 30, OPT], ['carotte', 40], ['sauce-poke', 20]],
    steps: [['Cuisez le riz et laissez-le tiédir.', 12], 'Coupez le poisson, l’avocat, le concombre et la carotte en petits morceaux ; décongelez la mangue.', 'Versez le riz dans un bol et disposez joliment les ingrédients par-dessus.', 'Ajoutez le wakamé, arrosez de sauce poké et servez.'],
  }),
  R('poulet-legumes-rotis', 'Poulet et légumes rôtis au four', '🍗', ['souper'], 'equilibre', {
    prep: 10, cook: 30, eq: ['four'],
    ing: [['poulet-filet', 130], ['pomme-de-terre', 200], ['courgette', 100], ['poivron', 80], ['carotte', 80], ['huile-olive', 10], ['epices', 3], ['sel', 2]],
    steps: ['Préchauffez le four à 200 °C.', 'Coupez pommes de terre, carottes, courgette et poivron en morceaux ; coupez le poulet en gros dés.', 'Mélangez le tout avec huile, épices et sel sur une plaque.', ['Enfournez en retournant à mi-cuisson.', 30]],
  }),
  R('saumon-riz-brocoli', 'Saumon, riz et brocoli', '🐟', ['souper'], 'equilibre', {
    prep: 5, cook: 20, eq: ['plaques'],
    ing: [['saumon-filet', 130], ['riz', 70], ['brocoli', 150], ['citron', 0.1, OPT], ['huile-olive', 5], ['sel', 1], ['poivre', 1]],
    steps: [['Cuisez le riz.', 12], 'Détaillez le brocoli en fleurettes et cuisez-le à la vapeur ou à l’eau 6 minutes.', ['Poêlez le saumon 4 minutes de chaque côté dans un filet d’huile.', 8], 'Servez avec un trait de citron.'],
  }),
  R('wok-poulet-legumes', 'Wok de poulet aux légumes', '🥘', ['souper'], 'equilibre', {
    prep: 10, cook: 12,
    ing: [[G('legumes'), 200], ['poulet-filet', 110], ['riz', 60], ['sauce-soja', 15], ['huile-neutre', 8], ['ail', 0.5]],
    steps: [['Cuisez le riz.', 12], 'Coupez le poulet en lanières et les légumes en morceaux réguliers.', ['Saisissez le poulet à feu vif 4 minutes dans l’huile, réservez.', 4], ['Faites sauter les légumes 5 minutes, remettez le poulet, ajoutez la sauce soja.', 5], 'Servez sur le riz.'],
  }),
  R('veloute-legumes', 'Velouté de légumes et tartine', '🥣', ['souper', 'diner'], 'equilibre', {
    tags: ['emporter'], prep: 10, cook: 25, eq: ['plaques', 'mixeur'],
    ing: [['carotte', 120], ['pomme-de-terre', 100], ['poireau', 80], ['creme', 20, OPT], ['pain', 60], ['fromage-rape', 20], ['bouillon-cube', 0.25], ['sel', 1], ['poivre', 1]],
    steps: ['Épluchez et coupez les légumes en morceaux.', ['Couvrez d’eau avec le bouillon et laissez cuire à couvert.', 20], 'Mixez finement, ajoutez la crème, rectifiez l’assaisonnement.', 'Servez avec une tartine de pain gratinée au fromage.'],
  }),
  R('gratin-courgettes', 'Gratin de courgettes et pommes de terre', '🧀', ['souper'], 'equilibre', {
    prep: 15, cook: 25, eq: ['four'],
    ing: [['courgette', 200], ['pomme-de-terre', 100], ['creme', 40], ['fromage-rape', 30], ['sel', 1], ['poivre', 1]],
    steps: ['Préchauffez le four à 200 °C.', 'Émincez courgettes et pommes de terre finement.', 'Disposez dans un plat, versez la crème salée et poivrée, parsemez de fromage.', ['Enfournez jusqu’à ce que le dessus soit doré.', 25]],
  }),
  R('eglefin-papillote', 'Églefin en papillote et pommes de terre', '🐠', ['souper'], 'equilibre', {
    prep: 10, cook: 25, eq: ['four'],
    ing: [['poisson-blanc', 140], ['pomme-de-terre', 200], ['poireau', 80], ['carotte', 60], ['citron', 0.15, OPT], ['beurre', 8], ['sel', 1], ['poivre', 1]],
    steps: ['Préchauffez le four à 190 °C.', 'Coupez pommes de terre, carotte et poireau en fines rondelles ; précuisez les pommes de terre 5 minutes.', 'Déposez légumes et poisson sur une feuille de papier cuisson, ajoutez beurre, citron, sel et poivre, fermez en papillote.', ['Enfournez.', 20]],
  }),
  R('curry-pois-chiches', 'Curry de pois chiches et épinards', '🍛', ['souper'], 'equilibre', {
    prep: 10, cook: 20,
    ing: [['pois-chiches', 100], ['lait-coco', 80], ['tomates-concassees', 80], ['epinards', 60], ['riz', 70], ['oignon', 0.5], ['epices', 4], ['huile-neutre', 5], ['sel', 1]],
    steps: [['Cuisez le riz.', 12], 'Faites revenir l’oignon émincé avec les épices dans l’huile.', ['Ajoutez tomates, pois chiches égouttés et lait de coco, laissez mijoter.', 12], 'Incorporez les épinards 2 minutes avant de servir sur le riz.'],
  }),
  R('ratatouille-oeufs', 'Ratatouille et œufs pochés', '🍆', ['souper'], 'equilibre', {
    prep: 15, cook: 25,
    ing: [['courgette', 120], ['aubergine', 100], ['poivron', 80], ['tomate', 120], ['oeufs', 1.5], ['pain', 40], ['oignon', 0.5], ['huile-olive', 8], ['epices', 2], ['sel', 1]],
    steps: ['Coupez tous les légumes en dés.', ['Faites-les revenir à l’huile avec l’oignon puis laissez mijoter à couvert.', 20], 'Creusez des puits dans la ratatouille, cassez-y les œufs.', ['Laissez prendre à couvert.', 4], 'Servez avec le pain.'],
  }),
  R('batonnets-poisson-puree', 'Bâtonnets de poisson, purée et petits pois', '🐟', ['souper'], 'equilibre', {
    tags: ['enfants'], prep: 10, cook: 22, eq: [['four', 'airfryer'], 'plaques'],
    ing: [['batonnets-poisson', 120], ['pomme-de-terre', 200], ['petits-pois', 80], ['lait', 50], ['beurre', 10], ['sel', 1]],
    steps: ['Préchauffez le four à 200 °C et enfournez les bâtonnets.', ['Cuisez les pommes de terre épluchées dans l’eau salée.', 18], 'Cuisez les petits pois 5 minutes.', 'Écrasez les pommes de terre avec lait chaud et beurre.', 'Servez le tout ensemble.'],
  }),

  // ====================== SOUPER — PETIT PLAISIR ======================
  R('burger-maison', 'Burgers maison et frites au four', '🍔', ['souper'], 'plaisir', {
    tags: ['enfants'], prep: 10, cook: 25, eq: ['four', 'plaques'],
    ing: [['boeuf-hache', 130], ['pain-pistolet', 1], ['fromage-tranches', 25], ['tomate', 40], ['salade', 0.1], ['frites', 200], ['ketchup', 15], ['sel', 1]],
    steps: [['Enfournez les frites selon l’emballage.', 22], 'Façonnez des steaks avec le haché, salez et poivrez.', ['Saisissez-les à la poêle 3-4 minutes de chaque côté, ajoutez le fromage en fin de cuisson.', 8], 'Garnissez les pains de salade, tomate, steak et sauce. Servez avec les frites.'],
  }),
  R('raclette-maison', 'Raclette, pommes de terre et charcuterie', '🧀', ['souper'], 'plaisir', {
    tags: ['apero'], prep: 10, cook: 25, eq: [['raclette', 'four']],
    ing: [['fromage-raclette', 150], ['pomme-de-terre', 300], ['charcuterie-mixte', 70], ['salade', 0.2], ['vinaigre', 3], ['huile-olive', 5]],
    steps: [['Cuisez les pommes de terre dans leur peau.', 22], 'Préparez la charcuterie et une salade verte.', 'Disposez le fromage en tranches : à l’appareil ou gratiné au four sur les pommes de terre.', 'Servez chaud avec la charcuterie et la salade.'],
  }),
  R('carbonara', 'Spaghetti carbonara', '🍝', ['souper'], 'plaisir', {
    tags: ['enfants'], prep: 5, cook: 15,
    ing: [['pates', 100], ['lardons', 60], ['oeufs', 1], ['parmesan', 20], ['poivre', 1], ['sel', 1]],
    steps: [['Cuisez les spaghetti dans l’eau salée.', 10], 'Faites dorer les lardons sans matière grasse.', 'Battez l’œuf avec le parmesan et beaucoup de poivre.', 'Hors du feu, mélangez les pâtes chaudes, les lardons et la préparation en ajoutant un peu d’eau de cuisson.'],
  }),
  R('mac-cheese', 'Macaroni au fromage', '🧀', ['souper'], 'plaisir', {
    tags: ['enfants'], prep: 5, cook: 20,
    ing: [['pates', 100], ['lait', 120], ['beurre', 12], ['farine', 12], ['fromage-rape', 50], ['jambon', 30, OPT], ['sel', 1], ['poivre', 1]],
    steps: [['Cuisez les macaronis.', 10], 'Faites fondre le beurre, ajoutez la farine puis le lait petit à petit en remuant.', ['Laissez épaissir 5 minutes, ajoutez le fromage.', 5], 'Mélangez aux pâtes (et au jambon coupé).'],
  }),
  R('chipolata-puree', 'Chipolatas et purée', '🌭', ['souper'], 'plaisir', {
    tags: ['enfants'], prep: 10, cook: 25,
    ing: [['chipolata-poulet', 150], ['pomme-de-terre', 250], ['lait', 50], ['beurre', 10], [G('legumes'), 120], ['sel', 1]],
    steps: [['Cuisez les pommes de terre épluchées dans l’eau salée.', 20], ['Faites dorer les chipolatas à la poêle, en les retournant.', 12], 'Cuisez les légumes à la vapeur ou à l’eau.', 'Écrasez les pommes de terre avec lait chaud et beurre.', 'Servez ensemble.'],
  }),
  R('boulettes-sauce-tomate', 'Boulettes sauce tomate et pommes de terre', '🍅', ['souper'], 'plaisir', {
    tags: ['enfants'], prep: 5, cook: 25,
    ing: [['boulettes-viande', 150], ['sauce-tomate', 120], ['pomme-de-terre', 250], ['oignon', 0.25], ['sel', 1]],
    steps: [['Cuisez les pommes de terre dans l’eau salée.', 20], 'Faites revenir l’oignon, ajoutez la sauce tomate.', ['Ajoutez les boulettes et laissez mijoter doucement.', 10], 'Servez les boulettes nappées de sauce avec les pommes de terre.'],
  }),
  R('gratin-pdt-jambon', 'Gratin de pommes de terre au jambon', '🥔', ['souper'], 'plaisir', {
    prep: 15, cook: 40, eq: ['four'],
    ing: [['pomme-de-terre', 250], ['jambon', 60], ['creme', 60], ['fromage-rape', 30], ['sel', 1], ['poivre', 1]],
    steps: ['Préchauffez le four à 190 °C.', 'Épluchez et émincez les pommes de terre ; coupez le jambon.', 'Alternez pommes de terre et jambon dans un plat, versez la crème, couvrez de fromage.', ['Enfournez jusqu’à ce que le gratin soit doré et tendre.', 40]],
    keep: '3 jours au frigo',
  }),
  R('pancakes', 'Pancakes aux fruits', '🥞', ['souper', 'petit-dej'], 'plaisir', {
    tags: ['enfants'], prep: 10, cook: 15,
    ing: [['farine', 60], ['oeufs', 1], ['lait', 150], ['sucre', 10], ['beurre', 8], [G('fruits'), 0.5], ['confiture', 15, OPT]],
    steps: ['Mélangez farine, sucre, œuf et lait pour obtenir une pâte lisse.', ['Faites cuire des petites louches de pâte dans un peu de beurre, 2 minutes par face.', 12], 'Servez avec fruits coupés et confiture.'],
  }),

  // ====================== SOUPER — BATCH COOKING (≤ 90 min, servi 2 à 3 fois) ======================
  R('bolognaise-batch', 'Spaghetti bolognaise (batch)', '🍝', ['souper'], 'batch', {
    tags: ['enfants'], prep: 15, cook: 45, batch: 2, keep: '3 jours au frigo ou 3 mois au congélateur',
    ing: [['boeuf-hache', 110], ['tomates-concassees', 120], ['carotte', 50], ['pates', 100], ['parmesan', 10, OPT], ['oignon', 0.5], ['ail', 0.5], ['huile-olive', 6], ['epices', 2], ['sel', 1]],
    steps: ['Faites revenir l’oignon, l’ail et la carotte râpée dans l’huile.', 'Ajoutez le haché et faites-le colorer en l’émiettant.', ['Versez les tomates, assaisonnez et laissez mijoter doucement.', 35], ['Cuisez les spaghetti.', 10], 'Servez la moitié ; mettez le reste de sauce au frais ou au congélateur.'],
  }),
  R('chili-con-carne', 'Chili con carne (batch)', '🌶️', ['souper'], 'batch', {
    prep: 15, cook: 50, batch: 2, keep: '3 jours au frigo ou 3 mois au congélateur',
    ing: [['boeuf-hache', 100], ['haricots-rouges', 80], ['mais', 40], ['tomates-concassees', 100], ['poivron', 50], ['riz', 60], ['oignon', 0.5], ['epices', 4], ['huile-neutre', 6], ['sel', 1]],
    steps: ['Faites revenir l’oignon et le poivron en dés, ajoutez le haché.', 'Ajoutez épices, tomates, haricots et maïs égouttés.', ['Laissez mijoter à feu doux.', 35], ['Cuisez le riz en fin de mijotage.', 12], 'Servez et gardez la moitié pour un autre repas.'],
  }),
  R('lasagnes-batch', 'Lasagnes au bœuf (batch)', '🍽️', ['souper'], 'batch', {
    tags: ['enfants'], prep: 25, cook: 55, batch: 2, eq: ['four'], diff: 'moyen', keep: '3 jours au frigo ou 3 mois au congélateur',
    ing: [['boeuf-hache', 90], ['tomates-concassees', 100], ['pates-lasagne', 60], ['lait', 150], ['beurre', 12], ['farine', 12], ['fromage-rape', 40], ['carotte', 40], ['oignon', 0.5], ['sel', 1], ['poivre', 1]],
    steps: ['Préchauffez le four à 190 °C.', ['Préparez la sauce : oignon, carotte, haché, tomates, mijotez.', 20], 'Préparez la béchamel : beurre, farine, lait.', 'Montez les couches : sauce, pâtes, béchamel, et terminez par le fromage.', ['Enfournez.', 40], 'Laissez reposer 10 minutes avant de découper.'],
  }),
  R('curry-poulet-coco', 'Curry de poulet au lait de coco (batch)', '🍛', ['souper'], 'batch', {
    prep: 15, cook: 35, batch: 2, keep: '3 jours au frigo ou 3 mois au congélateur',
    ing: [['poulet-filet', 120], ['lait-coco', 80], ['legumes-surgeles', 100], ['poivron', 60], ['riz', 70], ['oignon', 0.5], ['epices', 5], ['huile-neutre', 6], ['sel', 1]],
    steps: ['Coupez le poulet en dés et faites-le dorer avec l’oignon.', 'Ajoutez les épices, le poivron et les légumes.', ['Versez le lait de coco et laissez mijoter.', 20], ['Cuisez le riz.', 12], 'Servez ; gardez le reste pour un autre repas.'],
  }),
  R('soupe-legumes-batch', 'Grande soupe de légumes (batch)', '🥣', ['souper', 'diner'], 'batch', {
    tags: ['emporter'], prep: 15, cook: 35, batch: 3, eq: ['plaques', 'mixeur'], keep: '4 jours au frigo ou 3 mois au congélateur',
    ing: [['carotte', 120], ['pomme-de-terre', 100], ['poireau', 100], ['courgette', 80], ['pain', 60], ['creme', 20, OPT], ['bouillon-cube', 0.25], ['sel', 1], ['poivre', 1]],
    steps: ['Épluchez et coupez tous les légumes.', ['Couvrez d’eau avec le bouillon et laissez cuire.', 25], 'Mixez finement.', 'Servez avec du pain ; répartissez le reste en portions.'],
  }),
  R('hachis-parmentier', 'Hachis parmentier (batch)', '🥔', ['souper'], 'batch', {
    tags: ['enfants'], prep: 25, cook: 55, batch: 2, eq: ['four'], keep: '3 jours au frigo ou 3 mois au congélateur',
    ing: [['boeuf-hache', 130], ['pomme-de-terre', 250], ['carotte', 50], ['lait', 60], ['beurre', 10], ['fromage-rape', 20], ['oignon', 0.5], ['sel', 1], ['poivre', 1]],
    steps: ['Préchauffez le four à 200 °C.', ['Cuisez les pommes de terre et écrasez-les avec lait et beurre.', 20], 'Faites revenir oignon, carotte et haché.', 'Étalez la viande dans un plat, couvrez de purée et de fromage.', ['Enfournez pour gratiner.', 30]],
  }),

  // ====================== SOUPER — ANTI-GASPI ======================
  R('frittata-frigo', 'Frittata du frigo', '🍳', ['souper', 'diner'], 'antigaspi', {
    tags: ['emporter'], prep: 10, cook: 15,
    ing: [['oeufs', 2], [G('legumes'), 150], [G('fromages'), 25], [G('charcuterie'), 40, OPT], ['huile-olive', 6], ['sel', 1], ['poivre', 1]],
    steps: ['Coupez les légumes en petits morceaux et faites-les revenir.', 'Battez les œufs avec sel, poivre et fromage.', ['Versez sur les légumes, laissez prendre à feu doux à couvert.', 10], 'Retournez ou gratinez 2 minutes et servez en parts.'],
  }),
  R('soupe-vide-frigo', 'Soupe « vide-frigo »', '🥣', ['souper', 'diner'], 'antigaspi', {
    tags: ['emporter'], prep: 10, cook: 25, eq: ['plaques', 'mixeur'],
    ing: [[G('legumes'), 150], [G('legumes'), 100], ['pomme-de-terre', 100], ['bouillon-cube', 0.25], ['sel', 1], ['poivre', 1]],
    steps: ['Lavez et coupez tous les légumes disponibles.', ['Couvrez d’eau avec le bouillon et cuisez jusqu’à tendreté.', 20], 'Mixez, rectifiez l’assaisonnement.'],
  }),
  R('poelee-restes', 'Poêlée de légumes du frigo et riz', '🥘', ['souper'], 'antigaspi', {
    prep: 10, cook: 15,
    ing: [[G('legumes'), 200], ['riz', 70], ['oeufs', 1, OPT], [G('fromages'), 20, OPT], ['huile-olive', 8], ['epices', 2], ['sel', 1]],
    steps: [['Cuisez le riz.', 12], 'Coupez les légumes et poêlez-les à feu vif.', 'Ajoutez le riz, l’œuf brouillé et le fromage.', 'Assaisonnez avec les épices.'],
  }),
  R('gratin-pates-frigo', 'Gratin de pâtes et légumes du frigo', '🧀', ['souper'], 'antigaspi', {
    prep: 10, cook: 30, eq: ['four'],
    ing: [['pates', 90], [G('legumes'), 120], ['creme', 40], [G('fromages'), 40], ['sel', 1], ['poivre', 1]],
    steps: ['Préchauffez le four à 200 °C.', ['Cuisez les pâtes à moitié.', 6], 'Mélangez-les aux légumes coupés et à la crème dans un plat.', 'Couvrez de fromage.', ['Enfournez jusqu’à dorure.', 20]],
  }),

  // ====================== SOUPER — WEEK-END ======================
  R('poulet-roti', 'Poulet rôti et pommes de terre', '🍗', ['souper'], 'weekend', {
    tags: ['enfants'], prep: 15, cook: 80, eq: ['four'], keep: '3 jours au frigo',
    ing: [['poulet-entier', 400], ['pomme-de-terre', 250], ['carotte', 100], ['beurre', 10], ['epices', 3], ['sel', 2], ['poivre', 1]],
    steps: ['Préchauffez le four à 200 °C.', 'Badigeonnez le poulet de beurre et d’épices, salez, posez-le dans un plat.', 'Entourez de pommes de terre et de carottes en morceaux.', ['Enfournez en arrosant régulièrement du jus de cuisson.', 75], 'Laissez reposer 10 minutes avant de découper.'],
  }),
  R('roti-porc-legumes', 'Rôti de porc, pommes de terre et carottes', '🥩', ['souper'], 'weekend', {
    prep: 15, cook: 70, eq: ['four'], keep: '3 jours au frigo',
    ing: [['roti-porc', 150], ['pomme-de-terre', 250], ['carotte', 120], ['moutarde', 10], ['huile-olive', 10], ['epices', 2], ['sel', 2]],
    steps: ['Préchauffez le four à 180 °C.', 'Badigeonnez le rôti de moutarde et d’épices, posez-le dans un plat avec l’huile.', 'Ajoutez pommes de terre et carottes en morceaux.', ['Enfournez en arrosant de temps en temps.', 65], 'Laissez reposer avant de trancher.'],
  }),
  R('stoemp-saucisses', 'Stoemp aux carottes et saucisses', '🥕', ['souper'], 'weekend', {
    tags: ['enfants'], prep: 20, cook: 35,
    ing: [['saucisse', 150], ['pomme-de-terre', 250], ['carotte', 150], ['lait', 50], ['beurre', 15], ['sel', 1], ['poivre', 1]],
    steps: ['Épluchez et coupez pommes de terre et carottes.', ['Cuisez-les ensemble dans l’eau salée.', 25], ['Faites dorer les saucisses à la poêle.', 15], 'Écrasez grossièrement les légumes avec lait chaud et beurre.', 'Servez le stoemp avec les saucisses.'],
  }),
  R('carbonnade-flamande', 'Carbonnade flamande et pommes de terre', '🍺', ['souper'], 'weekend', {
    prep: 25, cook: 150, diff: 'moyen', eq: ['plaques'], keep: '3 jours au frigo ou 3 mois au congélateur',
    ing: [['boeuf-braiser', 150], ['biere-brune', 100], ['pomme-de-terre', 250], ['oignon', 1], ['pain', 20], ['moutarde', 10], ['beurre', 10], ['sucre', 5], ['sel', 1], ['poivre', 1]],
    steps: ['Coupez la viande en cubes et faites-la dorer dans le beurre, réservez.', 'Faites fondre les oignons émincés avec le sucre.', 'Remettez la viande, couvrez de bière, ajoutez le pain tartiné de moutarde.', ['Laissez mijoter à feu très doux à couvert.', 120], ['Cuisez les pommes de terre à l’eau.', 20], 'Servez la carbonnade avec les pommes de terre.'],
  }),
  R('quiche-lorraine', 'Quiche lorraine et salade', '🥧', ['souper', 'diner'], 'weekend', {
    tags: ['emporter'], prep: 15, cook: 40, eq: ['four'],
    ing: [['pate-brisee', 0.25], ['lardons', 50], ['oeufs', 1], ['creme', 60], ['fromage-rape', 30], ['salade', 0.25], ['sel', 1], ['poivre', 1]],
    steps: ['Préchauffez le four à 180 °C et garnissez un moule de pâte.', 'Faites dorer les lardons.', 'Battez œufs, crème, sel, poivre ; répartissez lardons et fromage sur la pâte.', ['Versez l’appareil et enfournez.', 35], 'Servez avec une salade verte.'],
  }),

  // ====================== DÎNER — à emporter ======================
  R('sandwich-jambon-fromage', 'Sandwich jambon-fromage', '🥖', ['diner'], 'express', {
    tags: ['emporter', 'enfants'], prep: 5, cook: 0, eq: [],
    ing: [['pain', 100], ['jambon', 40], ['fromage-tranches', 30], ['salade', 0.1], ['beurre', 8]],
    steps: ['Beurrez le pain.', 'Garnissez de jambon, fromage et salade.', 'Emballez ou servez directement.'],
    keep: 'à manger dans la journée',
  }),
  R('sandwich-thon-mais', 'Sandwich thon-maïs', '🥖', ['diner'], 'express', {
    tags: ['emporter'], prep: 6, cook: 0, eq: [],
    ing: [['pain', 100], ['thon-boite', 50], ['mais', 25], ['mayonnaise', 15], ['tomate', 40], ['salade', 0.1]],
    steps: ['Égouttez thon et maïs, mélangez avec la mayonnaise.', 'Garnissez le pain de salade, tomate et mélange de thon.'],
    keep: 'à manger dans la journée',
  }),
  R('salade-riz-oeuf', 'Salade de riz, maïs et œuf', '🥗', ['diner'], 'equilibre', {
    tags: ['emporter'], prep: 10, cook: 12,
    ing: [['riz', 60], ['oeufs', 1], ['mais', 40], ['tomate', 80], ['concombre', 0.2], ['huile-olive', 5], ['vinaigre', 3], ['sel', 1]],
    steps: [['Cuisez le riz et les œufs durs (10 minutes).', 12], 'Écalez l’œuf, coupez-le ainsi que les légumes.', 'Mélangez tous les ingrédients avec huile, vinaigre et sel.'],
  }),

  // ====================== PETIT-DÉJEUNER (formules) ======================
  R('pdj-tartines', 'Tartines beurre-confiture', '🍞', ['petit-dej'], 'express', {
    tags: ['enfants'], prep: 5, cook: 0, eq: [],
    ing: [['pain', 80], ['beurre', 10], ['confiture', 20]], steps: ['Tartinez le pain de beurre puis de confiture.'], keep: 'à manger tout de suite',
  }),
  R('pdj-porridge', 'Porridge à la banane', '🥣', ['petit-dej'], 'express', {
    tags: ['enfants'], prep: 3, cook: 5,
    ing: [['flocons-avoine', 45], ['lait', 200], ['banane', 0.5], ['sucre', 5, OPT]],
    steps: [['Chauffez flocons et lait en remuant.', 5], 'Ajoutez la banane en rondelles.'], keep: 'à manger tout de suite',
  }),
  R('pdj-yaourt-muesli', 'Yaourt, muesli et fruit', '🥛', ['petit-dej'], 'express', {
    tags: ['enfants'], prep: 3, cook: 0, eq: [],
    ing: [['yaourt-nature', 150], ['muesli', 40], [G('fruits'), 0.5]], steps: ['Versez le yaourt dans un bol, ajoutez le muesli et le fruit coupé.'], keep: 'à manger tout de suite',
  }),
  R('pdj-oeufs-toast', 'Œufs brouillés et toast', '🍳', ['petit-dej'], 'express', {
    prep: 3, cook: 5,
    ing: [['oeufs', 2], ['pain', 60], ['beurre', 8], ['sel', 1]], steps: ['Battez les œufs avec une pincée de sel.', ['Brouillez-les à feu doux dans le beurre.', 4], 'Servez sur du pain grillé.'], keep: 'à manger tout de suite',
  }),
  R('pdj-tartines-fromage', 'Tartines fromage et fruit', '🧀', ['petit-dej'], 'express', {
    tags: ['enfants'], prep: 4, cook: 0, eq: [],
    ing: [['pain', 80], ['fromage-tranches', 30], [G('fruits'), 0.5], ['beurre', 8, OPT]], steps: ['Garnissez le pain de fromage, servez avec un fruit.'], keep: 'à manger tout de suite',
  }),

  // ====================== COLLATIONS ======================
  R('col-fruit', 'Un fruit', '🍎', ['collation'], 'express', { tags: ['enfants', 'emporter'], prep: 1, cook: 0, eq: [], ing: [[G('fruits'), 1]], steps: ['Lavez le fruit et savourez.'], keep: '' }),
  R('col-yaourt', 'Yaourt nature', '🥛', ['collation'], 'express', { tags: ['enfants'], prep: 1, cook: 0, eq: [], ing: [['yaourt-nature', 125], ['confiture', 10, OPT]], steps: ['Servez le yaourt, avec une cuillère de confiture si vous voulez.'], keep: '' }),
  R('col-tartine-fromage', 'Tartine de fromage', '🧀', ['collation'], 'express', { tags: ['enfants', 'emporter'], prep: 2, cook: 0, eq: [], ing: [['pain', 40], ['fromage-tranches', 20]], steps: ['Garnissez le pain de fromage.'], keep: '' }),
  R('col-biscuits-lait', 'Biscuits et verre de lait', '🍪', ['collation'], 'express', { tags: ['enfants'], prep: 1, cook: 0, eq: [], ing: [['biscuits', 30], ['lait', 150]], steps: ['Servez les biscuits avec le lait.'], keep: '' }),
];

const RECIPE_BY_ID = Object.fromEntries(RECIPES.map((r) => [r.id, r]));
const totalTime = (r) => r.prep + r.cook;

/** Contrôle de cohérence d'une recette (bibliothèque ou générée par IA). Retourne la liste des erreurs. */
const validateRecipe = (r) => {
  const errs = [];
  if (!r.id || !r.name) errs.push('id/nom manquant');
  if (!CATEGORIES[r.cat]) errs.push(`catégorie inconnue: ${r.cat}`);
  if (!Array.isArray(r.meals) || !r.meals.length || r.meals.some((m) => !MEALS[m])) errs.push('repas invalides');
  if (!(r.prep >= 0) || !(r.cook >= 0)) errs.push('temps invalides');
  const max = CATEGORIES[r.cat]?.maxTotal;
  if (max && r.prep + r.cook > max) errs.push(`temps total ${r.prep + r.cook} min > ${max} min pour « ${CATEGORIES[r.cat].label} »`);
  if (!Array.isArray(r.ing) || !r.ing.length) errs.push('aucun ingrédient');
  for (const [ing, q] of r.ing ?? []) {
    if (typeof ing === 'string' && !INGREDIENTS[ing]) errs.push(`ingrédient inconnu: ${ing}`);
    if (ing && typeof ing === 'object' && !GROUPS[ing.any]) errs.push(`groupe inconnu: ${ing.any}`);
    if (!(q > 0)) errs.push(`quantité invalide pour ${typeof ing === 'string' ? ing : ing?.any}`);
  }
  if (!Array.isArray(r.steps) || !r.steps.length) errs.push('aucune étape');
  for (const e of r.eq ?? []) {
    for (const k of Array.isArray(e) ? e : [e]) if (!EQUIPMENT[k]) errs.push(`matériel inconnu: ${k}`);
  }
  return errs;
};

return { CATEGORIES, MEALS, EQUIPMENT, RECIPES, RECIPE_BY_ID, totalTime, validateRecipe };
})();

// ---- shared/pricing.js
__M["shared/pricing.js"] = (() => {
// Prix, promos et mécaniques (1+1, 2e à -50 %, 3 pour 2…).
const { INGREDIENTS } = __M["shared/ingredients.js"];
const { norm } = __M["shared/util.js"];

/** Un promo = { n, normal, promo, format:{qty,unit}|null, pct, … } où `normal`/`promo` sont les TOTAUX pour `n` articles. */
const unitPromo = (p) => (p.promo != null ? p.promo / (p.n || 1) : null);
const unitNormal = (p) => (p.normal != null ? p.normal / (p.n || 1) : null);

/** Part de remise (0–1) : calculée sur les prix si connus, sinon sur le pourcentage lu dans le folder. */
const discountOf = (p) => {
  if (p.normal != null && p.promo != null && p.normal > 0) return Math.max(0, 1 - p.promo / p.normal);
  if (p.pct != null) return Math.max(0, p.pct / 100);
  return null;
};

/** Ingrédient effectif d'un produit promo (correction manuelle > mémoire du foyer > détection automatique). */
const promoIngredient = (p, settings) => p.userIngredient ?? settings?.productMap?.[norm(p.name)] ?? p.ingredientId ?? null;

const promoValidOn = (p, date) => (!p.validFrom || p.validFrom <= date) && (!p.validTo || date <= p.validTo);

/** Coût de `k` articles en profitant de la promo (k ≥ n : lots de n au prix promo). */
const costForPacks = (p, k) => {
  const n = p.n || 1;
  const un = unitNormal(p) ?? unitPromo(p) ?? 0;
  if (p.promo == null) return k * (un || 0);
  const lots = Math.floor(k / n);
  return lots * p.promo + (k - lots * n) * un;
};

/** Économie pour k articles (par rapport au prix normal), 0 si inconnue. */
const savingForPacks = (p, k) => {
  const un = unitNormal(p);
  if (un == null) return 0;
  return Math.max(0, k * un - costForPacks(p, k));
};

const basisCompatible = (p, ing) => !!p.basis && !!ing && ((p.basis === 'kg' && ing.unit === 'g') || (p.basis === 'l' && ing.unit === 'ml'));
const formatCompatible = (p, ing) => !!p.format && !!ing && p.format.unit === ing.unit && p.format.qty > 0;

/** Prix promo / normal par unité de base (g, ml, pièce) si le produit permet de le calculer. */
const perBase = (p, ing) => {
  if (!p || !ing) return null;
  if (basisCompatible(p, ing)) return p.promo != null ? { promo: p.promo / 1000, normal: p.normal != null ? p.normal / 1000 : null } : null;
  if (formatCompatible(p, ing) && p.promo != null) {
    return { promo: unitPromo(p) / p.format.qty, normal: unitNormal(p) != null ? unitNormal(p) / p.format.qty : null };
  }
  return null;
};

/** Meilleure promo valide par ingrédient (remise la plus forte, puis prix unitaire le plus bas). */
const buildPromoIndex = (promos, date, settings) => {
  const idx = new Map();
  for (const p of promos) {
    if (p.deleted || !promoValidOn(p, date)) continue;
    const id = promoIngredient(p, settings);
    if (!id || !INGREDIENTS[id]) continue;
    const cur = idx.get(id);
    const d = discountOf(p) ?? 0.15;
    if (!cur || d > (discountOf(cur) ?? 0.15)) idx.set(id, p);
  }
  return idx;
};

/** Prix habituel estimé (€ par unité de base : g, ml ou pièce). */
const basePrice = (ingId, settings) => {
  const ing = INGREDIENTS[ingId];
  if (!ing) return 0;
  const per = settings?.priceOverrides?.[ingId] ?? ing.price; // €/kg, €/l ou €/pièce
  return ing.unit === 'pc' ? per : per / 1000;
};

/** Prix effectif par unité de base si on profite de la promo. */
const effectiveUnitPrice = (ingId, promo, settings) => {
  const ing = INGREDIENTS[ingId];
  const base = basePrice(ingId, settings);
  if (!promo) return base;
  const pb = perBase(promo, ing);
  if (pb) return pb.promo;
  const d = discountOf(promo);
  return d != null ? base * (1 - d) : base;
};

/** Prix normal par unité de base (promo) — sinon estimation. */
const normalUnitPrice = (ingId, promo, settings) => {
  const pb = perBase(promo, INGREDIENTS[ingId]);
  return pb?.normal ?? basePrice(ingId, settings);
};

/** Formats vendus pour un ingrédient : celui de la promo si compatible, sinon les formats habituels. */
const sizesFor = (ingId, promo) => {
  const ing = INGREDIENTS[ingId];
  if (promo && formatCompatible(promo, ing)) return [promo.format.qty];
  return ing?.packs?.length ? ing.packs : [1];
};

/** Prix d'un lot de `packs` unités d'une taille donnée (promo si compatible, sinon estimation). */
const priceOfPacks = (ingId, packs, size, promo, settings) => {
  const ing = INGREDIENTS[ingId];
  if (promo && formatCompatible(promo, ing) && promo.format.qty === size && promo.promo != null) {
    const cost = costForPacks(promo, packs);
    const normal = (unitNormal(promo) ?? unitPromo(promo)) * packs;
    return { cost, normal, saving: Math.max(0, normal - cost), promo: true };
  }
  const pb = perBase(promo, ing);
  const baseUnit = basePrice(ingId, settings);
  if (pb) {
    const cost = pb.promo * size * packs;
    const normal = (pb.normal ?? baseUnit) * size * packs;
    return { cost, normal, saving: Math.max(0, normal - cost), promo: true };
  }
  const un = baseUnit * size;
  const d = promo ? discountOf(promo) : null;
  const cost = d != null ? un * packs * (1 - d) : un * packs;
  return { cost, normal: un * packs, saving: d != null ? un * packs * d : 0, promo: d != null };
};

/** Quantité minimale d'articles pour profiter de la promo. */
const minQty = (p) => p?.n || 1;

return { unitPromo, unitNormal, discountOf, promoIngredient, promoValidOn, costForPacks, savingForPacks, perBase, buildPromoIndex, basePrice, effectiveUnitPrice, normalUnitPrice, sizesFor, priceOfPacks, minQty };
})();

// ---- shared/stock.js
__M["shared/stock.js"] = (() => {
// Stock : le pivot de l'app. Les achats l'augmentent, les recettes le diminuent, tout reste modifiable à la main.
const { INGREDIENTS } = __M["shared/ingredients.js"];
const { addDays, diffDays, uid } = __M["shared/util.js"];

const LOC_LABEL = { placard: 'Placard', frigo: 'Frigo', congelateur: 'Congélateur' };

/** Date limite estimée à l'achat, d'après la conservation de l'ingrédient. */
const estimateUseBy = (ingId, boughtAt, loc) => {
  const ing = INGREDIENTS[ingId];
  if (!ing) return null;
  const days = loc === 'congelateur' && ing.loc !== 'congelateur' ? Math.max(ing.shelf, 90) : ing.shelf;
  return addDays(boughtAt, days);
};

const makeStockItem = ({ ingredientId = null, name, qty, unit, boughtAt, useBy, loc, kind = 'item', note = '' }) => {
  const ing = ingredientId ? INGREDIENTS[ingredientId] : null;
  return {
    id: uid(),
    ingredientId,
    name: name ?? ing?.name ?? '',
    qty,
    unit: unit ?? ing?.unit ?? 'pc',
    boughtAt,
    useBy: useBy === undefined ? (ing ? estimateUseBy(ingredientId, boughtAt, loc ?? ing.loc) : null) : useBy,
    loc: loc ?? ing?.loc ?? 'placard',
    kind,
    note,
  };
};

/** Jours restants avant la date limite (négatif = périmé, null = pas de date). */
const daysLeft = (item, today) => (item.useBy ? diffDays(today, item.useBy) : null);

/** Lots d'un ingrédient triés par date limite (les plus proches d'abord, sans date en dernier). */
const lotsFor = (stock, ingId) =>
  stock
    .filter((s) => s.ingredientId === ingId && s.qty > 0 && s.kind !== 'dish' && !s.deleted)
    .sort((a, b) => (a.useBy ?? '9999') .localeCompare(b.useBy ?? '9999'));

const stockQty = (stock, ingId, onDate = null) =>
  lotsFor(stock, ingId).filter((l) => !onDate || !l.useBy || l.useBy >= onDate).reduce((a, l) => a + l.qty, 0);

/**
 * Retire `qty` d'un ingrédient (premier périmé, premier sorti). Retourne les modifications à appliquer.
 * @returns {{ changes: {id:string, qty:number}[], taken:number, missing:number }}
 */
const consume = (stock, ingId, qty, onDate = null) => {
  let left = qty;
  const changes = [];
  for (const lot of lotsFor(stock, ingId)) {
    if (left <= 1e-9) break;
    if (onDate && lot.useBy && lot.useBy < onDate) continue;
    const take = Math.min(lot.qty, left);
    changes.push({ id: lot.id, qty: Math.round((lot.qty - take) * 1000) / 1000 });
    left -= take;
  }
  return { changes, taken: qty - left, missing: Math.max(0, left) };
};

/** Produits à utiliser vite (frais, date limite dans les `days` jours). */
const expiringSoon = (stock, today, days = 2) =>
  stock
    .filter((s) => !s.deleted && s.qty > 0 && s.useBy && diffDays(today, s.useBy) <= days && s.loc !== 'congelateur')
    .sort((a, b) => a.useBy.localeCompare(b.useBy));

const urgency = (item, today) => {
  const d = daysLeft(item, today);
  if (d == null) return 'none';
  if (d < 0) return 'expired';
  if (d <= 2) return 'soon';
  if (d <= 5) return 'warn';
  return 'ok';
};

/** Index { ingredientId → [{id, qty, useBy}] } copiable, pour simuler la consommation pendant la planification. */
const virtualStock = (stock) => {
  const m = new Map();
  for (const s of stock) {
    if (s.deleted || s.qty <= 0 || s.kind === 'dish' || !s.ingredientId) continue;
    if (!m.has(s.ingredientId)) m.set(s.ingredientId, []);
    m.get(s.ingredientId).push({ id: s.id, qty: s.qty, useBy: s.useBy });
  }
  for (const arr of m.values()) arr.sort((a, b) => (a.useBy ?? '9999').localeCompare(b.useBy ?? '9999'));
  return m;
};

/** Disponible à une date dans un stock virtuel. */
const vAvailable = (vs, ingId, date) =>
  (vs.get(ingId) ?? []).filter((l) => !l.useBy || l.useBy >= date).reduce((a, l) => a + l.qty, 0);

/** Consomme dans le stock virtuel et retourne ce qui reste à acheter. */
const vConsume = (vs, ingId, qty, date) => {
  let left = qty;
  for (const l of vs.get(ingId) ?? []) {
    if (left <= 1e-9) break;
    if (l.useBy && l.useBy < date) continue;
    const t = Math.min(l.qty, left);
    l.qty -= t;
    left -= t;
  }
  return left;
};

/** Plat cuisiné (restes) à ajouter au stock. */
const makeLeftover = ({ name, portions, cookedAt, frozen = false, recipeId = null }) => ({
  ...makeStockItem({ name: `Restes : ${name}`, qty: portions, unit: 'portion', boughtAt: cookedAt, useBy: addDays(cookedAt, frozen ? 90 : 3), loc: frozen ? 'congelateur' : 'frigo', kind: 'dish' }),
  recipeId,
});

return { LOC_LABEL, estimateUseBy, makeStockItem, daysLeft, lotsFor, stockQty, consume, expiringSoon, urgency, virtualStock, vAvailable, vConsume, makeLeftover };
})();

// ---- shared/planner.js
__M["shared/planner.js"] = (() => {
// Moteur de planning : choisit les repas de la semaine Delhaize (jeudi → mercredi) en maximisant la part
// d'ingrédients en promo et en stock, sous contraintes strictes (profils, allergies, matériel, temps).
const { INGREDIENTS, GROUPS } = __M["shared/ingredients.js"];
const { CATEGORIES, MEALS, RECIPE_BY_ID } = __M["shared/recipes.js"];
const { presentProfiles, slotPortions, strictViolations, hatedHits, checkLines, equipmentOk, isBasic, coefOf } = __M["shared/rules.js"];
const { buildPromoIndex, discountOf, effectiveUnitPrice, normalUnitPrice, basePrice } = __M["shared/pricing.js"];
const { virtualStock, vAvailable, vConsume } = __M["shared/stock.js"];
const { weekDays, isWeekend, addDays, diffDays, rng, niceQty, uniq, dayKey } = __M["shared/util.js"];

const MEAL_ORDER = ['petit-dej', 'diner', 'souper', 'collation'];
const slotId = (date, meal) => `${date}_${meal}`;

// ---------- Résolution des lignes d'une recette ----------
const groupScore = (id, ctx, date) => {
  let s = 0;
  const lots = (ctx.vs.get(id) ?? []).filter((l) => l.qty > 0 && (!l.useBy || l.useBy >= date));
  if (lots.length) {
    s += 2;
    if (lots.some((l) => l.useBy && diffDays(date, l.useBy) <= 3)) s += 2.5;
  }
  const pr = ctx.promoIdx.get(id);
  if (pr) s += 1 + (discountOf(pr) ?? 0.15) * 2;
  s -= (INGREDIENTS[id].price || 0) / 20;
  s -= 2.5 * (ctx.groupUse?.get(id) ?? 0); // varier les légumes / fruits sur la semaine
  return s;
};

const okFor = (id, people, settings) =>
  hatedHits([id], { hated: [] }, settings).length === 0 &&
  people.every((p) => strictViolations([id], p).length === 0 && hatedHits([id], p, settings).length === 0);

/** Résout les groupes `{any}` en ingrédients concrets (stock d'abord, puis promos, puis prix). */
const resolveLines = (recipe, ctx, { people, date, over = {}, resolved = {} }) => {
  const taken = new Set();
  const out = [];
  for (let i = 0; i < recipe.ing.length; i++) {
    const [ing, q, o] = recipe.ing[i];
    let id = over[i] ?? (typeof ing === 'string' ? ing : resolved[i]);
    if (!id) {
      const cands = (GROUPS[ing.any] ?? []).filter((c) => !taken.has(c) && okFor(c, people, ctx.settings));
      cands.sort((a, b) => groupScore(b, ctx, date) - groupScore(a, ctx, date));
      id = cands[0];
    }
    if (!id) {
      if (o?.opt) continue;
      return null; // ligne obligatoire sans ingrédient possible
    }
    taken.add(id);
    out.push({ i, ing: id, q, opt: !!o?.opt, group: typeof ing === 'string' ? null : ing.any });
  }
  return out;
};

/** Lignes finales d'un repas : quantités calculées pour le foyer, arrondies, lignes retirées marquées. */
const scaleLines = (lines, recipe, portions, batch, dropped, settings) =>
  lines.map((l) => {
    const unit = INGREDIENTS[l.ing]?.unit ?? 'pc';
    return {
      ...l,
      unit,
      basic: isBasic(l.ing, settings),
      q: niceQty(l.q * portions * batch, unit),
      raw: Math.round(l.q * portions * batch * 100) / 100, // pour agréger les besoins sans cumuler les arrondis
      dropped: dropped.includes(l.i),
    };
  });

/** Calcule tout pour un repas : personnes, portions, lignes finales, contrôle de sécurité. */
const evalSlot = (slot, recipe, ctx) => {
  const info = slotPortions(slot, ctx.profiles, ctx.settings);
  const base = resolveLines(recipe, ctx, { people: info.people, date: slot.date, over: slot.over, resolved: slot.resolved });
  if (!base) return { ok: false, reasons: ['ingrédient obligatoire indisponible'], info, lines: [] };
  const chk = checkLines(base, info.people, ctx.settings);
  const dropped = [...new Set([...(slot.dropped ?? []), ...chk.dropped])];
  const lines = scaleLines(base, recipe, info.portions, slot.batch ?? 1, dropped, ctx.settings);
  return { ok: chk.ok, reasons: chk.reasons, hated: chk.hated, info, lines, resolved: Object.fromEntries(base.filter((l) => l.group).map((l) => [l.i, l.ing])), dropped };
};

// ---------- Coût & indicateurs ----------
const linesCost = (lines, ctx) => {
  let cost = 0, promoLines = 0, nonBasic = 0, saving = 0;
  for (const l of lines) {
    if (l.dropped || l.basic) continue;
    nonBasic++;
    const pr = ctx.promoIdx.get(l.ing);
    const u = effectiveUnitPrice(l.ing, pr, ctx.settings);
    cost += l.q * u;
    if (pr) {
      promoLines++;
      saving += l.q * Math.max(0, normalUnitPrice(l.ing, pr, ctx.settings) - u);
    }
  }
  return { cost, promoLines, nonBasic, saving };
};

const proteinOf = (lines) => {
  let best = null;
  for (const l of lines) {
    if (l.dropped) continue;
    const ing = INGREDIENTS[l.ing];
    const key = ing?.protein ?? (l.ing === 'oeufs' ? 'oeuf' : ['pois-chiches', 'haricots-rouges'].includes(l.ing) ? 'legumineuse' : null);
    if (key && (!best || l.q > best.q)) best = { key, q: l.q };
  }
  return best?.key ?? null;
};

// ---------- Score d'un candidat ----------
const scoreCandidate = (recipe, ev, slot, st, ctx) => {
  const date = slot.date;
  let wSum = 0, vSum = 0, expBonus = 0;
  for (const l of ev.lines) {
    if (l.dropped || l.basic) continue;
    const pr = ctx.promoIdx.get(l.ing);
    const have = vAvailable(ctx.vs, l.ing, date);
    const cov = Math.min(1, have / Math.max(l.q, 1e-6));
    const w = Math.max(0.2, l.q * (pr ? normalUnitPrice(l.ing, pr, ctx.settings) : basePrice(l.ing, ctx.settings)));
    let v = cov;
    if (cov < 1 && pr) v += (1 - cov) * (0.7 + 0.6 * (discountOf(pr) ?? 0.15));
    const expiring = (ctx.vs.get(l.ing) ?? []).some((x) => x.qty > 0 && x.useBy && x.useBy >= date && diffDays(date, x.useBy) <= 3);
    if (expiring && cov > 0) expBonus += cov * w;
    vSum += v * w;
    wSum += w;
  }
  const promoScore = wSum ? vSum / wSum : 0.3;
  const expShare = wSum ? expBonus / wSum : 0;
  const { cost } = linesCost(ev.lines, ctx);
  const perPerson = cost / Math.max(1, ev.info.couverts);
  let s = promoScore * 8 + expShare * 6 - perPerson * 0.5;

  // variété
  if (st.used.has(recipe.id)) s -= 100;
  if (ctx.recent?.has(recipe.id)) s -= 3;
  const prot = proteinOf(ev.lines);
  if (prot && slot.meal === 'souper' && st.lastProtein[addDays(date, -1)] === prot) s -= 6;
  if (prot && slot.meal === 'souper' && st.lastProtein[`${date}:diner`] === prot) s -= 3;
  if (prot && ['souper', 'diner'].includes(slot.meal)) s -= 1.5 * (st.protCount[prot] ?? 0);
  if (slot.meal === 'souper' && st.lastCat[addDays(date, -1)] === recipe.cat) s -= 1;
  // jours / catégories
  const we = isWeekend(date);
  if (slot.meal === 'souper') {
    if (recipe.cat === 'weekend') s += we ? 3 : -4;
    if (recipe.cat === 'plaisir') s += we ? 1.5 : 0;
    if (recipe.cat === 'batch') s += (dayKey(date) === 'dim' || dayKey(date) === 'mer') ? 2 : -0.5;
    if (recipe.cat === 'antigaspi') s += expShare > 0.15 ? 2 : -3;
  }
  if (ev.hated?.length) s -= 8 * ev.hated.length;
  if (ev.info.people.some((p) => ['enfant_3_6', 'enfant_7_12'].includes(p.ageCat)) && recipe.tags.includes('enfants')) s += 1.5;
  s += st.rand() * 1.2;
  return { s, cost, prot };
};

/** Candidats pour un repas, triés par score décroissant. */
const candidatesFor = (slot, ctx, st, { exclude = new Set(), relax = false } = {}) => {
  const people = presentProfiles(ctx.profiles, slot.date, slot.meal);
  const limit = ctx.settings.timeRules?.[isWeekend(slot.date) ? 'weekend' : 'semaine']?.[slot.meal] ?? null;
  const out = [];
  for (const r of ctx.recipes) {
    if (!r.meals.includes(slot.meal) || exclude.has(r.id) || ctx.flagged?.has(r.id)) continue;
    if (!equipmentOk(r, ctx.settings)) continue;
    if (limit && !relax && r.prep + r.cook > limit) continue;
    const ev = evalSlot({ ...slot, over: {}, resolved: {}, batch: 1 }, r, ctx);
    if (!ev.ok) continue;
    const sc = scoreCandidate(r, ev, slot, st, ctx);
    out.push({ recipe: r, ev, ...sc });
  }
  out.sort((a, b) => b.s - a.s);
  return out;
};

/** 2 à 3 propositions de catégories différentes. */
const pickProposals = (cands, n = 3) => {
  const picked = [];
  const cats = new Set();
  for (const c of cands) {
    if (picked.length >= n) break;
    if (!cats.has(c.recipe.cat)) { picked.push(c); cats.add(c.recipe.cat); }
  }
  for (const c of cands) {
    if (picked.length >= n) break;
    if (!picked.includes(c)) picked.push(c);
  }
  return picked;
};

// ---------- Contexte ----------
const makeCtx = ({ profiles, settings, promos, stock, recipes, today, weekStart, recent = [], flagged = [] }) => ({
  profiles: profiles.filter((p) => !p.deleted),
  settings,
  today,
  promoIdx: buildPromoIndex(promos.filter((p) => !p.deleted), today > weekStart ? today : weekStart, settings),
  vs: virtualStock(stock.filter((s) => !s.deleted)),
  recipes,
  recipeById: Object.fromEntries(recipes.map((r) => [r.id, r])),
  recent: new Set(recent),
  flagged: new Set(flagged),
  groupUse: new Map(),
});

const consumeLines = (lines, date, ctx) => {
  for (const l of lines) {
    if (l.dropped || l.basic) continue;
    vConsume(ctx.vs, l.ing, l.raw ?? l.q, date);
    if (l.group) ctx.groupUse.set(l.ing, (ctx.groupUse.get(l.ing) ?? 0) + 1);
  }
};

const newSlot = (date, meal, extra = {}) => ({
  id: slotId(date, meal), date, meal, kind: 'recipe', recipeId: null, proposals: [], over: {}, resolved: {}, dropped: [],
  guests: 0, batch: 1, auto: true, locked: false, status: 'planned', note: '', ...extra,
});

/**
 * Génère le planning d'une semaine. Les repas « faits » ou verrouillés sont conservés.
 * @returns {{ slots: object[], stats: object }}
 */
function planWeek({ weekStart, today, profiles, settings, promos, stock, recipes, existing = [], seed = 1, recent = [], flagged = [] }) {
  const ctx = makeCtx({ profiles, settings, promos, stock, recipes, today, weekStart, recent, flagged });
  const st = { used: new Set(), lastProtein: {}, lastCat: {}, protCount: {}, rand: rng(seed) };
  const keep = new Map(existing.filter((s) => s.status === 'done' || s.locked || s.date < today).map((s) => [s.id, s]));
  const slots = [];
  const days = weekDays(weekStart);

  for (const date of days) {
    for (const meal of MEAL_ORDER) {
      if (!settings.meals?.[meal]) continue;
      const id = slotId(date, meal);
      const kept = keep.get(id);
      if (kept) {
        slots.push(kept);
        if (kept.recipeId) {
          st.used.add(kept.recipeId);
          const r = ctx.recipeById[kept.recipeId];
          if (r && kept.status !== 'done') {
            const ev = evalSlot(kept, r, ctx);
            consumeLines(ev.lines, date, ctx);
            if (meal === 'souper') { st.lastProtein[date] = proteinOf(ev.lines); st.lastCat[date] = r.cat; }
          }
        }
        continue;
      }
      if (date < today) continue; // pas de planification dans le passé
      const people = presentProfiles(profiles, date, meal);
      const base = newSlot(date, meal);
      if (!people.length) continue; // personne présent : pas de repas

      // dîner : restes du souper de la veille en priorité
      if (meal === 'diner') {
        const prev = slots.find((s) => s.id === slotId(addDays(date, -1), 'souper'));
        if (prev && prev.kind === 'recipe' && prev.batch > 1 && prev.status !== 'done' && !base.locked) {
          slots.push({ ...base, kind: 'leftover', recipeId: prev.recipeId, from: prev.id, proposals: [] });
          continue;
        }
      }

      const cands = candidatesFor(base, ctx, st);
      const pool = cands.length ? cands : candidatesFor(base, ctx, st, { relax: true });
      if (!pool.length) { slots.push({ ...base, kind: 'none', note: 'Aucune recette compatible' }); continue; }

      let chosen;
      let proposals;
      if (meal === 'souper') {
        proposals = pickProposals(pool, 3);
        chosen = proposals[0];
      } else if (meal === 'petit-dej') {
        // rotation de 3 à 5 formules reconduites : on prend les mieux classées, en alternant selon le jour
        const top = pickProposals(pool, Math.min(5, pool.length)).sort((a, b) => a.recipe.id.localeCompare(b.recipe.id));
        const idx = days.indexOf(date) % Math.max(1, Math.min(top.length, 4));
        chosen = top[idx];
        proposals = [chosen, ...top.filter((c) => c !== chosen)].slice(0, 3);
      } else {
        proposals = pickProposals(pool, 2);
        chosen = proposals[0];
      }

      const slot = { ...base, recipeId: chosen.recipe.id, proposals: proposals.map((p) => p.recipe.id), resolved: chosen.ev.resolved, dropped: chosen.ev.dropped };
      // batch cooking : la quantité couvre aussi le dîner du lendemain (restes)
      if (meal === 'souper' && chosen.recipe.batch > 1) {
        const next = presentProfiles(profiles, addDays(date, 1), 'diner');
        const hasNext = days.includes(addDays(date, 1)) && settings.meals?.diner && next.length;
        if (hasNext) {
          const pS = slotPortions(slot, profiles, settings).portions;
          const pD = slotPortions({ date: addDays(date, 1), meal: 'diner', guests: 0 }, profiles, settings).portions;
          slot.batch = Math.min(chosen.recipe.batch + 0.5, Math.round((1 + pD / Math.max(pS, 0.1)) * 2) / 2);
        } else slot.batch = chosen.recipe.batch; // restes à congeler ou pour un autre repas
      }
      const ev = evalSlot(slot, chosen.recipe, ctx);
      consumeLines(ev.lines, date, ctx);
      st.used.add(chosen.recipe.id);
      if (meal === 'souper') { st.lastProtein[date] = chosen.prot; st.lastCat[date] = chosen.recipe.cat; }
      if (meal === 'diner') st.lastProtein[`${date}:diner`] = chosen.prot;
      if (chosen.prot && ['souper', 'diner'].includes(meal)) st.protCount[chosen.prot] = (st.protCount[chosen.prot] ?? 0) + 1;
      slots.push(slot);
    }
  }

  // restes éventuels : lien avec le souper de la veille
  return { slots, ctx, stats: planStats(slots, ctx) };
}

/** Coût estimé, taux d'ingrédients en promo, économie estimée d'un planning. */
const planStats = (slots, ctx) => {
  let cost = 0, promoLines = 0, nonBasic = 0, saving = 0;
  const perSlot = {};
  for (const s of slots) {
    if (s.kind !== 'recipe' || !s.recipeId || s.status === 'done') continue;
    const r = ctx.recipeById[s.recipeId];
    if (!r) continue;
    const ev = evalSlot(s, r, ctx);
    const l = linesCost(ev.lines, ctx);
    cost += l.cost; promoLines += l.promoLines; nonBasic += l.nonBasic; saving += l.saving;
    perSlot[s.id] = { cost: l.cost, perPerson: l.cost / Math.max(1, ev.info.couverts) };
  }
  return { cost, promoLines, nonBasic, promoRate: nonBasic ? promoLines / nonBasic : 0, saving, perSlot };
};

/** « Autre idée » : une nouvelle proposition pour un repas, différente de celles déjà vues. */
function otherIdea({ slot, slots, ctx, seed = Date.now() }) {
  const st = { used: new Set(slots.filter((s) => s.id !== slot.id && s.recipeId).map((s) => s.recipeId)), lastProtein: {}, lastCat: {}, protCount: {}, rand: rng(seed) };
  for (const s of slots) {
    if (s.id === slot.id || !s.recipeId || s.kind !== 'recipe') continue;
    const r = ctx.recipeById[s.recipeId];
    if (!r) continue;
    const ev = evalSlot(s, r, ctx);
    if (s.meal === 'souper') { st.lastProtein[s.date] = proteinOf(ev.lines); st.lastCat[s.date] = r.cat; }
  }
  const seen = new Set([slot.recipeId, ...(slot.proposals ?? []), ...(slot.seen ?? [])].filter(Boolean));
  const base = { ...slot, over: {}, resolved: {}, dropped: [], batch: 1 };
  let cands = candidatesFor(base, ctx, st, { exclude: seen });
  if (!cands.length) cands = candidatesFor(base, ctx, st, { exclude: new Set([slot.recipeId]), relax: true });
  if (!cands.length) return null;
  const proposals = slot.meal === 'souper' ? pickProposals(cands, 3) : cands.slice(0, 2);
  return {
    ...slot, kind: 'recipe', recipeId: proposals[0].recipe.id, proposals: proposals.map((p) => p.recipe.id),
    resolved: proposals[0].ev.resolved, dropped: proposals[0].ev.dropped, over: {}, batch: 1, auto: false,
    seen: [...seen, ...proposals.map((p) => p.recipe.id)].slice(-30),
  };
}

/** Choix manuel d'une recette pour un repas. */
function assignRecipe(slot, recipeId, ctx) {
  const r = ctx.recipeById[recipeId];
  if (!r) return slot;
  const next = { ...slot, kind: 'recipe', recipeId, over: {}, resolved: {}, dropped: [], batch: 1, auto: false, from: undefined };
  const ev = evalSlot(next, r, ctx);
  next.resolved = ev.resolved ?? {};
  next.dropped = ev.dropped ?? [];
  return next;
}

/** Remplace un ingrédient d'une ligne (« Remplacer l'ingrédient »). */
function substituteOptions(slot, lineIndex, recipe, ctx) {
  const ev = evalSlot(slot, recipe, ctx);
  const line = ev.lines.find((l) => l.i === lineIndex);
  if (!line) return [];
  const ing = INGREDIENTS[line.ing];
  const pool = uniq([...(ing.sub ?? []), ...(line.group ? GROUPS[line.group] : []), ...Object.values(INGREDIENTS).filter((i) => i.protein && ing.protein && i.id !== ing.id && i.rayon === ing.rayon).map((i) => i.id)])
    .filter((id) => id !== line.ing && INGREDIENTS[id] && INGREDIENTS[id].unit === ing.unit);
  const people = ev.info.people;
  return pool
    .filter((id) => okFor(id, people, ctx.settings))
    .map((id) => ({ id, name: INGREDIENTS[id].name, promo: ctx.promoIdx.get(id) ?? null }))
    .sort((a, b) => (b.promo ? discountOf(b.promo) ?? 0.15 : 0) - (a.promo ? discountOf(a.promo) ?? 0.15 : 0));
}

/** Après un changement manuel : recale les « restes » (batch cooking) sur les repas voisins. */
function relinkLeftovers(slots, ctx) {
  const byId = new Map(slots.map((s) => [s.id, s]));
  return slots.map((s) => {
    if (s.meal !== 'diner') return s;
    const prev = byId.get(slotId(addDays(s.date, -1), 'souper'));
    const prevIsBatch = prev && prev.kind === 'recipe' && prev.batch > 1 && prev.status !== 'done';
    if (s.kind === 'leftover' && !prevIsBatch) {
      // la source n'est plus un batch : on laisse une recette « à choisir »
      return { ...s, kind: 'none', recipeId: null, from: undefined, note: 'À choisir' };
    }
    return s;
  });
}



return { slotId, resolveLines, scaleLines, evalSlot, linesCost, candidatesFor, makeCtx, planWeek, planStats, otherIdea, assignRecipe, substituteOptions, relinkLeftovers, MEALS, CATEGORIES, RECIPE_BY_ID, coefOf, rng };
})();

// ---- shared/shopping.js
__M["shared/shopping.js"] = (() => {
// Liste de courses : besoins du planning − stock disponible, arrondis au format vendu, avec prix et économies.
const { INGREDIENTS, RAYON_ORDER, packsFor } = __M["shared/ingredients.js"];
const { evalSlot } = __M["shared/planner.js"];
const { stockQty, vConsume, virtualStock, vAvailable, daysLeft } = __M["shared/stock.js"];
const { FREEZER_SLOTS } = __M["shared/rules.js"];
const { buildPromoIndex, sizesFor, priceOfPacks, minQty, discountOf, savingForPacks } = __M["shared/pricing.js"];
const { addDays, diffDays, uid, round2 } = __M["shared/util.js"];

const MEAL_ORDER = { 'petit-dej': 0, diner: 1, souper: 2, collation: 3 };
const bySlotOrder = (a, b) => a.date.localeCompare(b.date) || MEAL_ORDER[a.meal] - MEAL_ORDER[b.meal];

/** Durable = se garde (≥ 3 semaines) ou se congèle (viande, poisson, pain, beurre…) si on a un congélateur. */
const isDurable = (ingId, settings) => {
  const ing = INGREDIENTS[ingId];
  if (!ing) return false;
  if (ing.shelf >= 21) return true;
  const freezable = ing.loc === 'congelateur' || ing.tags.some((t) => ['viande', 'volaille', 'porc', 'poisson', 'crustace'].includes(t)) || ['pain', 'beurre', 'fromage-rape', 'pain-pistolet'].includes(ingId);
  return freezable && (FREEZER_SLOTS[settings?.freezer ?? 'moyen'] ?? 0) > 0;
};

/**
 * Besoins nets de la semaine : parcourt les repas dans l'ordre, retire d'abord le stock utilisable à la date du repas.
 * @returns Map<ingId, { need, deficit, firstDate, recipes:Set<string>, covered }>
 */
const computeDeficits = ({ slots, ctx, stock }) => {
  const vs = virtualStock(stock.filter((s) => !s.deleted));
  const out = new Map();
  for (const slot of [...slots].sort(bySlotOrder)) {
    if (slot.kind !== 'recipe' || !slot.recipeId || slot.status === 'done') continue;
    const recipe = ctx.recipeById[slot.recipeId];
    if (!recipe) continue;
    const ev = evalSlot(slot, recipe, { ...ctx, vs });
    for (const l of ev.lines) {
      if (l.dropped || l.basic) continue;
      const rec = out.get(l.ing) ?? { need: 0, deficit: 0, firstDate: slot.date, recipes: new Set(), optionalOnly: true };
      const left = vConsume(vs, l.ing, l.raw ?? l.q, slot.date);
      rec.need += l.raw ?? l.q;
      rec.deficit += left;
      if (left > 0 && rec.deficitDate == null) rec.deficitDate = slot.date;
      if (left > 0) { rec.recipes.add(recipe.name); rec.optionalOnly = rec.optionalOnly && l.opt; }
      out.set(l.ing, rec);
    }
  }
  return out;
};

/**
 * Transforme un déficit en ligne d'achat : format vendu, promo (quantité minimale), prix, économie.
 */
const makeLine = ({ week, ingId, deficit, firstDate, recipes, promo, settings, today, allowExtra = true }) => {
  const ing = INGREDIENTS[ingId];
  const sizes = sizesFor(ingId, promo);
  const best = packsFor(deficit, sizes);
  let packs = best.n;
  const size = best.size;
  let extraForPromo = 0;
  const minN = promo ? minQty(promo) : 1;
  // la promo n'est valable qu'à partir de n articles : on arrondit si l'article se garde, sinon on paie le prix normal
  if (allowExtra && promo && packs < minN && packs > 0 && isDurable(ingId, settings)) {
    extraForPromo = minN - packs;
    packs = minN;
  }
  const price = priceOfPacks(ingId, packs, size, promo, settings);
  const promoApplies = !!promo && (packs >= minN || promo.basis);
  return {
    id: `auto-${week}-${ingId}`,
    week, kind: 'auto', ingredientId: ingId, name: ing.name, rayon: ing.rayon,
    need: Math.round(deficit), unit: ing.unit, size, packs, qty: packs * size,
    price: round2(promoApplies ? price.cost : price.normal), normal: round2(price.normal),
    saving: round2(promoApplies ? price.saving : 0),
    promoId: promoApplies ? promo.id : null, mechanic: promoApplies ? promo.mechanic : null,
    minQty: minN, extraForPromo,
    recipes: [...recipes], firstDate: firstDate ?? today,
    checked: false, boughtAt: null, actualQty: null, actualPrice: null, refused: false, strategic: false, passage: null,
  };
};

/**
 * Recalcule les lignes automatiques de la semaine. Les lignes déjà cochées (achetées), manuelles ou refusées sont conservées.
 * @returns {{ upsert: object[], remove: string[] }}
 */
const reconcileShopping = ({ weekStart, slots, ctx, stock, promos, settings, existing, today }) => {
  const deficits = computeDeficits({ slots, ctx, stock });
  const promoIdx = buildPromoIndex(promos.filter((p) => !p.deleted), today > weekStart ? today : weekStart, settings);
  const mine = existing.filter((l) => l.week === weekStart && !l.deleted);
  const open = new Map(mine.filter((l) => l.kind === 'auto' && !l.checked && !l.strategic).map((l) => [l.ingredientId, l]));
  const upsert = [];
  const remove = [];
  const seen = new Set();
  for (const [ingId, d] of deficits) {
    if (d.deficit <= 1e-6) continue;
    // garniture facultative : on ne l'ajoute à la liste que si elle est en promo (sinon « facultatif » dans la recette)
    if (d.optionalOnly && !promoIdx.has(ingId)) continue;
    const cur = open.get(ingId);
    const line = makeLine({ week: weekStart, ingId, deficit: d.deficit, firstDate: d.deficitDate ?? d.firstDate, recipes: d.recipes, promo: promoIdx.get(ingId), settings, today, allowExtra: !cur?.noExtra });
    seen.add(ingId);
    if (cur) {
      // on garde l'identité et l'état de la ligne ; refus conservé
      upsert.push({ ...line, id: cur.id, refused: cur.refused, noExtra: !!cur.noExtra, createdAt: cur.createdAt });
    } else {
      // un identifiant déjà pris par une ligne cochée → suffixe
      const clash = mine.some((l) => l.id === line.id);
      upsert.push({ ...line, id: clash ? `${line.id}-${uid().slice(0, 4)}` : line.id });
    }
  }
  for (const [ingId, cur] of open) if (!seen.has(ingId)) remove.push(cur.id);
  return { upsert, remove, deficits };
};

// ---------- Totaux ----------
const lineCost = (l) => (l.checked ? (l.actualPrice ?? l.price ?? 0) : l.price ?? 0);

const shoppingTotals = (lines, { passage = null } = {}) => {
  const live = lines.filter((l) => !l.deleted && !l.refused);
  const bought = live.filter((l) => l.checked);
  const todo = live.filter((l) => !l.checked && !l.strategic);
  return {
    inBasket: round2(bought.filter((l) => passage == null || l.passage === passage).reduce((a, l) => a + lineCost(l), 0)),
    spent: round2(bought.reduce((a, l) => a + lineCost(l), 0)),
    remaining: round2(todo.reduce((a, l) => a + (l.price ?? 0), 0)),
    saved: round2(live.reduce((a, l) => a + (l.saving ?? 0), 0)),
    savedRemaining: round2(todo.reduce((a, l) => a + (l.saving ?? 0), 0)),
    countTodo: todo.length,
    countBought: bought.length,
  };
};

/** Part des articles à acheter (hors basiques) qui sont en promo : l'objectif des 80 %. */
const promoCoverage = (lines) => {
  const live = lines.filter((l) => !l.deleted && !l.refused && l.kind === 'auto' && !l.strategic);
  if (!live.length) return { rate: 0, promo: 0, total: 0 };
  const promo = live.filter((l) => l.promoId).length;
  return { rate: promo / live.length, promo, total: live.length };
};

/**
 * Achats stratégiques (bonus) : promos de cette semaine utiles à la semaine suivante.
 * Conditions : se garde ou se congèle, économie ≥ seuil, rattaché à une recette de la semaine suivante, place disponible.
 */
const strategicSuggestions = ({ nextSlots, ctx, stock, promos, settings, weekStart, nextWeekStart, currentLines }) => {
  if (!nextSlots?.length) return [];
  const threshold = (settings.strategicThreshold ?? 25) / 100;
  const promoIdx = buildPromoIndex(promos.filter((p) => !p.deleted), weekStart, settings);
  const deficits = computeDeficits({ slots: nextSlots, ctx, stock });
  const already = new Set((currentLines ?? []).filter((l) => !l.deleted).map((l) => l.ingredientId));
  const cap = FREEZER_SLOTS[settings.freezer ?? 'moyen'] ?? 0;
  let freezerUsed = 0;
  const out = [];
  const entries = [...deficits].filter(([id, d]) => d.deficit > 0 && promoIdx.has(id)).sort((a, b) => (discountOf(promoIdx.get(b[0])) ?? 0) - (discountOf(promoIdx.get(a[0])) ?? 0));
  for (const [ingId, d] of entries) {
    const promo = promoIdx.get(ingId);
    if (already.has(ingId)) continue;
    if ((discountOf(promo) ?? 0) < threshold) continue;
    if (!isDurable(ingId, settings)) continue;
    const ing = INGREDIENTS[ingId];
    // le congélateur n'est nécessaire que pour ce qui ne se garde pas 3 semaines au frigo / au placard
    const needsFreezer = ing.loc === 'congelateur' || (ing.shelf < 21 && ing.loc !== 'placard');
    if (needsFreezer) { if (freezerUsed >= cap) continue; freezerUsed++; }
    const line = makeLine({ week: weekStart, ingId, deficit: d.deficit, firstDate: d.firstDate, recipes: d.recipes, promo, settings, today: weekStart });
    if (!line.promoId || !(line.saving > 0.2)) continue; // économie chiffrée et significative uniquement
    out.push({ ...line, id: `strat-${weekStart}-${ingId}`, kind: 'auto', strategic: true, useOn: d.firstDate, needsFreezer });
  }
  return out;
};

/** Alerte la veille de la fin d'une promo : articles non achetés dont la promo se termine demain. */
const promoEndingTomorrow = (lines, promos, today) => {
  const byId = new Map(promos.map((p) => [p.id, p]));
  return lines.filter((l) => !l.deleted && !l.checked && !l.refused && l.promoId && byId.get(l.promoId)?.validTo === addDays(today, 1));
};

return { isDurable, computeDeficits, makeLine, reconcileShopping, lineCost, shoppingTotals, promoCoverage, strategicSuggestions, promoEndingTomorrow };
})();

// ---- shared/folder-parser.js
__M["shared/folder-parser.js"] = (() => {
// Lecture du folder Delhaize (visionneuse Publitas) : texte par page → liste structurée d'articles en promo.
// Le texte brut est bruité (badges séparés, prix éclatés) : chaque article reçoit un niveau de confiance,
// les prix sont recoupés (mécanique déduite des prix plutôt que du badge) et tout reste corrigeable à la main.
const { norm, addDays, folderSlugFor } = __M["shared/util.js"];
const { matchIngredient, guessRayon, INGREDIENTS } = __M["shared/ingredients.js"];

const num = (s) => parseFloat(String(s).replace(',', '.'));
const BADGE_LINE = [
  /^[-+−]?\s?\d{1,3}$/, /^%$/, /^€$/, /^-€$/, /^\d?\s?E?\s?À$/i, /^E$/, /^[A-Z]$/, /^\d\s?\+\s?\d$/, /^GRATIS$/i,
  /^POUR \d( PACKS?)?$/i, /^SUNDAY DEAL$/i, /^DU \d{1,2} [A-ZÉÛ]+$/i, /^POINTS$/i, /^DE REMISE$/i, /^\*+$/, /^=$/, /^\d+\s?L\s?\+\s?\d+\s?L\s?GRATIS$/i, /^\/PIÈCE$/i, /^i$/,
];
const isBadgeLine = (l) => BADGE_LINE.some((r) => r.test(l.trim()));
const NOISE = [/^OX:/, /ABUS D.ALCOOL/i, /^Offres valables/i, /^Voir conditions/i, /^Infos? et conditions/i, /^La plupart/i, /QR/i, /^i$/];
const isNoiseLine = (l) => NOISE.some((r) => r.test(l));
const isUpper = (l) => {
  const letters = l.replace(/[^A-Za-zÀ-ÿ]/g, '');
  return letters.length >= 3 && letters === letters.toUpperCase() && !isBadgeLine(l);
};
const PRICE_PAIR = /^(\d+[.,]\d{1,2})\s+(\d+[.,]\d{2})(?:\/(\d+))?(?:\s+(.*))?$/;
const PERKG_PAIR = /^(\d+[.,]\d{2})\/(kg|l|L)\s+(\d+[.,]\d{2})\/(kg|l|L)(?:\/(\d+))?$/;
const PER100_PAIR = /^(\d+[.,]\d{2})\/100\s?g\s+€?\s?(\d+[.,]?\d*)\/100\s?g$/;
const LONE_PRICE = /^(\d+[.,]\d{2})(?:\/(\d+))?$/;
const PERUNIT = /[–-]\s*(\d+[.,]\d+)\s*\/\s*(kg|l|L|pièce|piece|dose|g)\b/;
const SIZE = /(\d+(?:[.,]\d+)?)\s*(kg|g|ml|cl|l|L)\b/;
const MULTI_SIZE = /(\d+)\s*x\s*(\d+(?:[.,]\d+)?)\s*(kg|g|ml|cl|l|L)\b/;
const PIECES = /(\d+)\s*(pièces?|pieces?|pcs?|pads?|tranches?)\b/i;

const PERUNIT_ALONE = /^(\d+[.,]\d{2})\/(kg|l|L)$/;
/** Ligne qui ne décrit qu'un format (« 250 g », « De 200 g à 600 g », « 4 x 110 g », « Poids variable »…). */
const isFormatOnly = (l) => {
  if (/^(Poids variable|Pièce)$/i.test(l)) return true;
  if (!SIZE.test(l) && !PIECES.test(l)) return false;
  const rest = l
    .replace(PERUNIT, '').replace(/\d+(?:[.,]\d+)?\s*\/\s*(kg|l|L|pièce)/gi, '')
    .replace(/\d+(?:[.,]\d+)?/g, '').replace(/\b(kg|g|ml|cl|l|L|x|à|de|De|ou|pack|casier|bouteilles?|canettes?|pet|pièces?|pcs?|tranches?|pads?)\b/gi, '')
    .replace(/[^A-Za-zÀ-ÿ]/g, '');
  return rest.length <= 2;
};
const NON_FOOD = /(aliment pour (chats?|chiens?)|snack pour chats|lessive|adoucissant|gel douche|deodorant|papier toilette|mouchoirs|lames de rasoir|vaisselle|allume-feu|bloc w|soin visage|produit de soin|boisson|energisante|ice tea|chips|lait de croissance|cafe|capsules?|toast ou rice bar|brioche|pralines?|doritos|cheetos)/;

const toBase = (v, u) => {
  const x = num(v);
  switch (u.toLowerCase()) {
    case 'kg': return { qty: Math.round(x * 1000), unit: 'g' };
    case 'g': return { qty: x, unit: 'g' };
    case 'l': return { qty: Math.round(x * 1000), unit: 'ml' };
    case 'cl': return { qty: x * 10, unit: 'ml' };
    case 'ml': return { qty: x, unit: 'ml' };
    default: return null;
  }
};

/** Mécanique lisible déduite des prix : A = total normal pour n, B = total promo pour n. */
const mechanicFromPrices = (A, B, n) => {
  if (!(A > 0) || !(B > 0) || B >= A) return null;
  const r = B / A;
  const N = n || 1;
  if (N === 1) return { label: `−${Math.round((1 - r) * 100)} %`, pct: Math.round((1 - r) * 100) };
  const free = N * (1 - r);
  const k = Math.round(free);
  const pct = Math.round((1 - r) * 100);
  if (N === 2) {
    if (Math.abs(r - 0.5) < 0.02) return { label: '1+1 gratis', pct };
    return { label: `2e à −${Math.round((1 - r) * 2 * 100)} %`, pct };
  }
  if (k >= 1 && Math.abs(free - k) < 0.08) return { label: `${N - k}+${k} gratis`, pct };
  return { label: `dès ${N} : −${pct} %`, pct };
};

const mechanicFromBadges = (lines) => {
  const t = lines.join(' ');
  const plus = t.match(/(\d)\s?\+\s?(\d)(?:\s?GRATIS)?/i);
  if (plus && /GRATIS/i.test(t)) return { label: `${plus[1]}+${plus[2]} gratis`, pct: Math.round((Number(plus[2]) / (Number(plus[1]) + Number(plus[2]))) * 100) };
  const pct = t.match(/[-−]\s?(\d{1,2})\b/);
  if (pct && /2\s?E\s?À|2E À/i.test(t)) return { label: `2e à −${pct[1]} %`, pct: Math.round(Number(pct[1]) / 2) };
  if (pct && /%/.test(t)) return { label: `−${pct[1]} %`, pct: Number(pct[1]) };
  return null;
};


/** Analyse les lignes d'un produit : prix, exemple « Par ex. », format, lignes de nom. */
const parseBody = (lines) => {
  let normal = null, promo = null, n = null, perUnit = null, lone = null, basis = null, hasPrice = false;
  const nameLines = [], exLines = [];
  let inEx = false, formatLine = null;
  for (const l of lines) {
    let m;
    if (/^Combinez/i.test(l)) continue;
    if ((m = l.match(PRICE_PAIR))) { normal = num(m[1]); promo = num(m[2]); n = m[3] ? Number(m[3]) : null; inEx = false; hasPrice = true; continue; }
    if ((m = l.match(PERKG_PAIR))) { normal = num(m[1]); promo = num(m[3]); perUnit = { value: promo, unit: m[2].toLowerCase() }; basis = m[2].toLowerCase(); n = m[5] ? Number(m[5]) : null; inEx = false; hasPrice = true; continue; }
    if ((m = l.match(PER100_PAIR))) { normal = num(m[1]) * 10; promo = num(m[2]) * 10; perUnit = { value: promo, unit: 'kg' }; basis = 'kg'; inEx = false; hasPrice = true; continue; }
    if ((m = l.match(PERUNIT_ALONE))) { perUnit = { value: num(m[1]), unit: m[2].toLowerCase() }; inEx = false; continue; }
    if ((m = l.match(LONE_PRICE))) { lone = { value: num(m[1]), n: m[2] ? Number(m[2]) : null }; inEx = false; hasPrice = true; continue; }
    if (/^Par ex/i.test(l)) { inEx = true; exLines.push(l.replace(/^Par ex\.?\s*:?\s*/i, '')); continue; }
    if (inEx) { exLines.push(l); continue; }
    if (/^Origine/i.test(l)) continue;
    if (isFormatOnly(l)) { if (!formatLine) formatLine = l; continue; }
    nameLines.push(l);
  }
  const ex = exLines.join(' ');
  const pu = (ex + ' ' + (formatLine || '')).match(PERUNIT);
  if (!perUnit && pu) perUnit = { value: num(pu[1]), unit: pu[2].toLowerCase() };
  return { normal, promo, n, perUnit, lone, nameLines, ex, formatLine, basis, hasPrice };
};

/** Validité du folder lue sur la page 1 : « Jeudi 05/11 -> mercredi 11/11/2026 ». */
const parseValidity = (pages) => {
  const t = pages.map((p) => p.text).join('\n');
  const m = t.match(/(\d{2})\/(\d{2})\s*(?:->|→|au)\s*\w*\s*(\d{2})\/(\d{2})\/(\d{4})/i);
  if (!m) return null;
  const endY = Number(m[5]);
  const startY = Number(m[2]) > Number(m[4]) ? endY - 1 : endY;
  return { from: `${startY}-${m[2]}-${m[1]}`, to: `${endY}-${m[4]}-${m[3]}` };
};

const slugify = (s) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const MONTHS = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];

/**
 * @param pages [{ n, text }]
 * @param opts  { slug, productMap }
 */
const parseFolder = (pages, opts = {}) => {
  const slug = opts.slug ?? 'folder';
  const validity = parseValidity(pages);
  const items = [];

  for (const page of pages) {
    const blocks = (page.text || '')
      .split(/\n\s*\n/)
      .map((b) => b.split('\n').map((l) => l.trim()).filter(Boolean))
      .filter((b) => b.length);
    // séquence : { kind: 'badge'|'brand'|'product'|'noise', lines }
    const seq = [];
    for (const b of blocks) {
      const clean = b.filter((l) => !isNoiseLine(l));
      if (!clean.length) continue;
      if (clean.every(isBadgeLine) || clean.every((l) => isBadgeLine(l) || /^(SUNDAY DEAL|DU \d+ \w+)$/i.test(l))) seq.push({ kind: 'badge', lines: clean });
      else if (clean.every(isUpper)) seq.push({ kind: 'brand', lines: clean });
      else if (clean.some((l) => l.length > 75) && !clean.some((l) => PRICE_PAIR.test(l) || LONE_PRICE.test(l))) continue; // texte marketing / recette
      else seq.push({ kind: 'product', lines: clean });
    }

    let pendingBrand = null;
    const prods = [];
    seq.forEach((s, i) => {
      if (s.kind === 'brand') { pendingBrand = s.lines; return; }
      if (s.kind !== 'product') return;
      // en-tête de marque dans le bloc
      const lines = [...s.lines];
      const brandLines = [];
      while (lines.length && isUpper(lines[0])) brandLines.push(lines.shift());
      const hasBody = lines.length > 0;
      if (!hasBody) { pendingBrand = brandLines; return; }
      const brand = (brandLines.length ? brandLines : pendingBrand || []).join(' ');
      if (!brandLines.length) pendingBrand = null; else pendingBrand = null;
      // bloc sans le moindre indice de produit (pas de prix, pas de taille, pas de marque) → ignoré
      const body = lines.join(' ');
      const hasPrice = lines.some((l) => PRICE_PAIR.test(l) || PERKG_PAIR.test(l) || PER100_PAIR.test(l) || LONE_PRICE.test(l));
      if (!brand && !hasPrice && !SIZE.test(body) && !/Origine|Pièce/i.test(body)) return;
      prods.push({ i, brand, lines, page: page.n });
    });

    // badges : précédant (lead) ou suivant (trail) chaque produit
    prods.forEach((p, k) => {
      let a = p.i - 1; const lead = [];
      while (a >= 0 && seq[a].kind === 'badge') { lead.unshift(...seq[a].lines); a--; }
      const nextI = prods[k + 1]?.i ?? seq.length;
      const trail = [];
      for (let b = p.i + 1; b < nextI; b++) if (seq[b].kind === 'badge') trail.push(...seq[b].lines);
      p.lead = lead; p.trail = trail;
    });

    // fusionne les blocs « orphelins » (prix / exemple sans nom) avec le produit précédent
    const parsedProds = [];
    for (const p of prods) {
      const body = parseBody(p.lines);
      const onlyParen = body.nameLines.length > 0 && body.nameLines.every((l) => /^\(/.test(l));
      if (!p.brand && (body.nameLines.length === 0 || onlyParen) && parsedProds.length) {
        const prev = parsedProds[parsedProds.length - 1];
        prev.lines = [...prev.lines, ...p.lines];
        prev.body = parseBody(prev.lines);
        prev.trail = [...prev.trail, ...p.trail];
        continue;
      }
      parsedProds.push({ ...p, body });
    }

    for (const p of parsedProds) {
      let { normal, promo, n, perUnit, lone, nameLines, ex, formatLine, basis } = p.body;
      const exN = ex.match(/^(\d+)\s*x\s/);
      if (!n && exN && Number(exN[1]) > 1 && promo != null) n = Number(exN[1]);
      const sizeSrc = (str) => {
        const ms = str.match(MULTI_SIZE);
        if (ms) return toBase(String(num(ms[2]) * Number(ms[1])), ms[3]);
        const one = str.match(SIZE);
        if (one) return toBase(one[1], one[2]);
        const pc = str.match(PIECES);
        if (pc) return { qty: Number(pc[1]), unit: 'pc' };
        return null;
      };
      const exNoPrice = ex.replace(PERUNIT, '');
      const exTail = exNoPrice.replace(/^\d+\s*x\s/, '');
      // la taille citée dans l'exemple prime ; sinon la ligne de format ; « De 150 g à 10 x 40 g » = plusieurs formats → on garde l'exemple
      let format = sizeSrc(exTail) || (formatLine && !/^(De|Pack|Casier|Canettes|Bouteilles)\b/i.test(formatLine) ? sizeSrc(formatLine.replace(PERUNIT, '')) : null);
      if (basis) format = null; // prix au kilo / au litre : on achète la quantité voulue
      if (lone && promo == null) {
        const consistent = perUnit && format && Math.abs(lone.value - (perUnit.value * format.qty) / 1000) / lone.value < 0.06;
        if (consistent) { promo = lone.value * (lone.n || 1); n = lone.n || n; }
        else if (lone.n) { promo = lone.value; n = lone.n; }
        else { promo = lone.value; normal = null; }
      }
      let mech = mechanicFromPrices(normal, promo, n);
      let confidence = normal != null && promo != null ? 'high' : promo != null ? 'medium' : 'low';
      if (!mech) mech = mechanicFromBadges(p.lead.length ? p.lead : p.trail);
      if (!mech) confidence = 'low';
      const badgeText = [...p.lead, ...p.trail].join(' ');
      let validFrom = validity?.from, validTo = validity?.to;
      const sd = badgeText.match(/DU (\d{1,2}) ([A-ZÉÛ]+)/i);
      if (/SUNDAY DEAL/i.test(badgeText) && sd && validity) {
        const mi = MONTHS.indexOf(norm(sd[2]));
        if (mi >= 0) {
          const y = validity.to.slice(0, 4);
          validFrom = validTo = `${y}-${String(mi + 1).padStart(2, '0')}-${String(sd[1]).padStart(2, '0')}`;
        }
      }
      const name = nameLines.join(' ').replace(/\s+/g, ' ').trim();
      if (!name && !p.brand) continue;
      if (/^\d+\.\s/.test(p.brand || '') || (/^\d+\.\s/.test(name) && !p.body.hasPrice)) continue; // instructions de recette
      const head = norm([p.brand, name].join(' '));
      let ingredientId = null;
      if (!NON_FOOD.test(head)) {
        ingredientId = matchIngredient(head, opts.productMap);
        if (!ingredientId && ex) {
          const exName = norm(ex).replace(/^\d+\s*x\s*/, '').split(/[,–-]|\d+\s*(?:g|kg|ml|cl|l)\b/)[0];
          ingredientId = matchIngredient(exName, opts.productMap);
        }
      }
      const rayon = ingredientId ? INGREDIENTS[ingredientId].rayon : guessRayon([p.brand, name, ex].join(' '));
      items.push({
        id: `${slug}-p${p.page}-${slugify(p.brand + ' ' + name) || 'article'}`,
        folder: slug, page: p.page,
        brand: p.brand ? p.brand.replace(/\s+/g, ' ') : '', name: name || p.brand,
        ex: ex.replace(/\s+/g, ' ').trim(),
        format, n: n || 1, normal, promo, basis: basis ?? null,
        perUnit: perUnit ? { value: perUnit.value, unit: perUnit.unit } : null,
        mechanic: mech?.label ?? null, pct: mech?.pct ?? null,
        validFrom: validFrom ?? null, validTo: validTo ?? null,
        ingredientId, rayon, confidence, manual: false,
      });
    }
  }

  // doublons éventuels (même id) : on garde le plus fiable
  const rank = { high: 3, medium: 2, low: 1 };
  const byId = new Map();
  for (const it of items) {
    const cur = byId.get(it.id);
    if (!cur || rank[it.confidence] > rank[cur.confidence]) byId.set(it.id, it);
  }
  return { items: [...byId.values()], validity };
};

/** Contrôle d'extraction : le folder est-il lisible et complet ? */
const checkExtraction = (parsed, pages) => {
  const textPages = pages.filter((p) => (p.text || '').trim().length > 60).length;
  const n = parsed.items.length;
  const food = parsed.items.filter((i) => i.ingredientId).length;
  const withPrice = parsed.items.filter((i) => i.promo != null).length;
  const problems = [];
  if (!parsed.validity) problems.push('dates de validité introuvables');
  if (textPages < 5) problems.push('très peu de pages lisibles');
  if (n < 30) problems.push(`seulement ${n} articles détectés`);
  if (food < 8) problems.push(`seulement ${food} produits alimentaires reconnus`);
  if (n && withPrice / n < 0.5) problems.push('moins de la moitié des articles ont un prix lisible');
  return { ok: problems.length === 0, problems, stats: { pages: pages.length, textPages, items: n, food, withPrice } };
};

const expectedSlug = (weekStart) => folderSlugFor(weekStart);
const nextWeekStart = (weekStart) => addDays(weekStart, 7);

return { mechanicFromPrices, parseValidity, parseFolder, checkExtraction, expectedSlug, nextWeekStart };
})();

// ---- site/src/actions.js
__M["site/src/actions.js"] = (() => {
// Actions métier : relient le moteur (shared/) au magasin de données. Aucune logique d'affichage ici.
const St = __M["site/src/store.js"];
const { RECIPES } = __M["shared/recipes.js"];
const { INGREDIENTS } = __M["shared/ingredients.js"];
const { planWeek, makeCtx, evalSlot, otherIdea, assignRecipe, relinkLeftovers, planStats, linesCost } = __M["shared/planner.js"];
const { reconcileShopping, shoppingTotals, strategicSuggestions, makeLine } = __M["shared/shopping.js"];
const { consume, makeStockItem, makeLeftover, estimateUseBy } = __M["shared/stock.js"];
const { isBasic } = __M["shared/rules.js"];
const { todayStr, weekStartFor, addDays, weekDays, uid, norm, round2 } = __M["shared/util.js"];
const { buildPromoIndex, promoIngredient } = __M["shared/pricing.js"];
const { packsFor } = __M["shared/ingredients.js"];
const { parseFolder } = __M["shared/folder-parser.js"];

const today = () => todayStr();
const currentWeek = () => weekStartFor(today());
const allRecipes = () => [...RECIPES, ...St.list('recipes')];
const recipeById = (id) => allRecipes().find((r) => r.id === id) ?? null;
const slotsOfWeek = (ws) => St.list('plan').filter((s) => s.date >= ws && s.date <= addDays(ws, 6)).sort((a, b) => a.id.localeCompare(b.id));

/** Contexte du moteur construit à partir des données actuelles. */
function ctxFor(ws) {
  const flagged = St.list('flags').map((f) => f.recipeId);
  const prevSlots = slotsOfWeek(addDays(ws, -7));
  return makeCtx({
    profiles: St.list('profiles'), settings: St.settings(), promos: St.list('promos'), stock: St.list('stock'),
    recipes: allRecipes(), today: today(), weekStart: ws, recent: prevSlots.map((s) => s.recipeId).filter(Boolean), flagged,
  });
}

// ---------- Planning ----------
function generatePlan(ws, { seed = Date.now() % 100000 } = {}) {
  const ctx = ctxFor(ws);
  const existing = slotsOfWeek(ws);
  const { slots } = planWeek({
    weekStart: ws, today: today(), profiles: ctx.profiles, settings: ctx.settings, promos: St.list('promos'),
    stock: St.list('stock'), recipes: ctx.recipes, existing, seed, recent: [...ctx.recent], flagged: [...ctx.flagged],
  });
  const keepIds = new Set(slots.map((s) => s.id));
  for (const old of existing) if (!keepIds.has(old.id) && old.status !== 'done') St.del('plan', old.id);
  St.putMany('plan', slots.filter((s) => !existing.find((e) => e.id === s.id && JSON.stringify(strip(e)) === JSON.stringify(strip(s)))));
  St.patch('weeks', ws, { id: ws, start: ws, generatedAt: Date.now() });
  refreshShopping(ws);
  return slots.length;
}
const strip = (o) => { const { _ts, ...rest } = o; return rest; };

function pickProposal(slot, recipeId) {
  const ctx = ctxFor(weekStartFor(slot.date));
  const next = assignRecipe(slot, recipeId, ctx);
  next.proposals = slot.proposals?.includes(recipeId) ? slot.proposals : [recipeId, ...(slot.proposals ?? [])].slice(0, 3);
  writeSlot(next);
}
function writeSlot(slot) {
  St.put('plan', slot);
  const ws = weekStartFor(slot.date);
  const ctx = ctxFor(ws);
  const all = relinkLeftovers(slotsOfWeek(ws).map((s) => (s.id === slot.id ? slot : s)), ctx);
  const changed = all.filter((s) => JSON.stringify(strip(s)) !== JSON.stringify(strip(St.get('plan', s.id) ?? {})));
  if (changed.length) St.putMany('plan', changed);
  refreshShopping(ws);
}
function anotherIdea(slot) {
  const ws = weekStartFor(slot.date);
  const next = otherIdea({ slot, slots: slotsOfWeek(ws), ctx: ctxFor(ws), seed: Date.now() % 100000 });
  if (!next) return false;
  writeSlot(next);
  return true;
}
function setGuests(slot, n) { writeSlot({ ...slot, guests: Math.max(0, n), auto: false }); }
function toggleLock(slot) { writeSlot({ ...slot, locked: !slot.locked }); }
function skipSlot(slot) { writeSlot({ ...slot, kind: 'none', recipeId: null, note: 'Repas sauté / à l’extérieur', locked: true }); }
function swapSlots(a, b) {
  const aa = { ...a, ...pick(b), id: a.id, date: a.date, meal: a.meal };
  const bb = { ...b, ...pick(a), id: b.id, date: b.date, meal: b.meal };
  St.putMany('plan', [aa, bb]);
  refreshShopping(weekStartFor(a.date));
}
const pick = (s) => ({ kind: s.kind, recipeId: s.recipeId, proposals: s.proposals, over: s.over, resolved: s.resolved, dropped: s.dropped, batch: s.batch, from: s.from, note: s.note });

function evalFor(slot) {
  const r = recipeById(slot.recipeId);
  if (!r) return null;
  const ctx = ctxFor(weekStartFor(slot.date));
  return { recipe: r, ev: evalSlot(slot, r, ctx), ctx };
}

function stats(ws) {
  const ctx = ctxFor(ws);
  return planStats(slotsOfWeek(ws), ctx);
}

/** Budget dépassé : remplace les repas les plus chers par une proposition nettement moins chère. */
function cheaper(ws) {
  const ctx = ctxFor(ws);
  const cost = (slot, rid) => {
    const r = recipeById(rid);
    const e = r && evalSlot({ ...slot, recipeId: rid, over: {}, resolved: {}, dropped: [], batch: 1 }, r, ctx);
    return e?.ok ? linesCost(e.lines, ctx).cost : Infinity;
  };
  let changed = 0;
  for (const s of slotsOfWeek(ws).filter((x) => x.kind === 'recipe' && x.status !== 'done' && !x.locked && x.proposals?.length > 1)) {
    let best = s.recipeId, bc = cost(s, s.recipeId);
    for (const id of s.proposals) { const c = cost(s, id); if (c < bc * 0.9) { best = id; bc = c; } }
    if (best !== s.recipeId) { pickProposal(s, best); changed++; }
  }
  return changed;
}

// ---------- Courses ----------
let lastFp = '';
const fingerprint = (ws) => {
  const f = (c) => { const l = St.list(c); return `${l.length}:${l.reduce((m, r) => Math.max(m, r._ts ?? 0), 0)}`; };
  return [ws, f('plan'), f('stock'), f('profiles'), f('promos'), f('settings'), f('recipes'), today()].join('|');
};
function refreshShopping(ws = currentWeek(), force = false) {
  const fp = fingerprint(ws);
  if (!force && fp === lastFp) return;
  lastFp = fp;
  const slots = slotsOfWeek(ws);
  const settings = St.settings();
  if (!slots.length) return;
  const ctx = ctxFor(ws);
  const existing = St.list('shopping');
  const { upsert, remove } = reconcileShopping({ weekStart: ws, slots, ctx, stock: St.list('stock'), promos: St.list('promos'), settings, existing, today: today() });
  const same = (a, b) => ['qty', 'packs', 'price', 'saving', 'promoId', 'mechanic', 'firstDate', 'need', 'extraForPromo', 'noExtra'].every((k) => a?.[k] === b?.[k]) && JSON.stringify(a?.recipes) === JSON.stringify(b?.recipes) && a?.refused === b?.refused;
  const changed = upsert.filter((l) => !same(existing.find((e) => e.id === l.id), l));
  if (changed.length) St.putMany('shopping', changed);
  remove.forEach((id) => St.del('shopping', id));
  // basiques « bientôt vides »
  for (const id of settings.lowBasics ?? []) {
    const lid = `basic-${ws}-${id}`;
    if (!existing.find((e) => e.id === lid && !e.deleted)) {
      const ing = INGREDIENTS[id];
      if (ing) St.put('shopping', { id: lid, week: ws, kind: 'basic', ingredientId: id, name: ing.name, rayon: ing.rayon, qty: ing.packs[0], size: ing.packs[0], packs: 1, unit: ing.unit, price: round2((ing.price || 0) * (ing.unit === 'pc' ? 1 : ing.packs[0] / 1000)), checked: false, firstDate: today(), recipes: [] });
    }
  }
}

function setNoExtra(line, on) {
  St.put('shopping', { ...line, noExtra: on });
  refreshShopping(line.week, true);
}

function weekRecord(ws) { return St.get('weeks', ws) ?? { id: ws, start: ws, passage: 1 }; }

function markBought(line, { qty = null, price = null } = {}) {
  const ws = line.week;
  const wk = weekRecord(ws);
  const q = qty ?? line.qty;
  const p = price ?? (qty ? round2(line.price * (q / line.qty)) : line.price);
  let stockId = null;
  if (line.ingredientId && !line.manualOnly) {
    const item = makeStockItem({ ingredientId: line.ingredientId, qty: q, boughtAt: today() });
    St.put('stock', item);
    stockId = item.id;
    const s = St.settings();
    if ((s.lowBasics ?? []).includes(line.ingredientId)) St.saveSettings({ lowBasics: s.lowBasics.filter((x) => x !== line.ingredientId) });
  }
  St.put('shopping', { ...line, checked: true, boughtAt: today(), actualQty: q, actualPrice: p, passage: wk.passage ?? 1, stockId });
  refreshShopping(ws, true);
}
function unbuy(line) {
  if (line.stockId) St.del('stock', line.stockId);
  St.put('shopping', { ...line, checked: false, boughtAt: null, actualQty: null, actualPrice: null, stockId: null });
  refreshShopping(line.week, true);
}
function endPassage(ws) {
  const wk = weekRecord(ws);
  St.put('weeks', { ...wk, passage: (wk.passage ?? 1) + 1 });
}
function addManualLine(ws, { name, qty = '', price = null, rayon = 'autre' }) {
  St.put('shopping', { id: `manual-${uid()}`, week: ws, kind: 'manual', name, qtyText: qty, rayon, price: price ?? 0, qty: 1, size: 1, packs: 1, unit: 'pc', checked: false, firstDate: today(), recipes: [], saving: 0 });
}
function setSpentOverride(ws, amount) { St.put('weeks', { ...weekRecord(ws), spentOverride: amount }); }

/** Achats stratégiques (V1.5) pour la semaine suivante, si son planning existe. */
function strategic(ws) {
  const next = addDays(ws, 7);
  const nextSlots = slotsOfWeek(next);
  if (!nextSlots.length) return [];
  const ctx = ctxFor(next);
  const current = St.list('shopping').filter((l) => l.week === ws);
  return strategicSuggestions({ nextSlots, ctx, stock: St.list('stock'), promos: St.list('promos'), settings: St.settings(), weekStart: ws, nextWeekStart: next, currentLines: current });
}

// ---------- Refus d'article ----------
/** Repas non terminés de la semaine qui utilisent l'ingrédient. */
function slotsUsing(ws, ingId) {
  return slotsOfWeek(ws).filter((s) => {
    if (s.kind !== 'recipe' || s.status === 'done') return false;
    const r = evalFor(s);
    return r?.ev.lines.some((l) => l.ing === ingId && !l.dropped);
  });
}
function refuseReplace(ws, ingId, newId) {
  const out = [];
  for (const s of slotsUsing(ws, ingId)) {
    const e = evalFor(s);
    const line = e.ev.lines.find((l) => l.ing === ingId);
    out.push({ ...s, over: { ...s.over, [line.i]: newId }, auto: false });
  }
  if (out.length) St.putMany('plan', out);
  refreshShopping(ws, true);
}
function refuseRecipe(ws, ingId) {
  for (const s of slotsUsing(ws, ingId)) anotherIdea(s);
  refreshShopping(ws, true);
}
function refuseNever(ws, ingId) {
  const s = St.settings();
  const word = INGREDIENTS[ingId]?.name ?? ingId;
  St.saveSettings({ hated: [...new Set([...(s.hated ?? []), word])] });
  for (const slot of slotsUsing(ws, ingId)) anotherIdea(slot);
  refreshShopping(ws, true);
}

// ---------- Cuisine & stock ----------
function cookDone(slot, { lines, leftoverPortions = 0, freeze = false }) {
  const r = recipeById(slot.recipeId);
  const stock = St.list('stock');
  let work = stock;
  for (const l of lines) {
    if (!(l.q > 0)) continue;
    const { changes } = consume(work, l.ing, l.q);
    for (const c of changes) {
      if (c.qty <= 0) St.del('stock', c.id); else St.patch('stock', c.id, { qty: c.qty });
      work = work.map((w) => (w.id === c.id ? { ...w, qty: c.qty } : w));
    }
  }
  if (leftoverPortions > 0 && r) St.put('stock', makeLeftover({ name: r.name, portions: leftoverPortions, cookedAt: today(), frozen: freeze, recipeId: r.id }));
  St.put('plan', { ...slot, status: 'done', doneAt: today() });
  refreshShopping(weekStartFor(slot.date), true);
}
function eatLeftover(slot, portions) {
  const dishes = St.list('stock').filter((s) => s.kind === 'dish' && s.recipeId === slot.recipeId && s.qty > 0).sort((a, b) => (a.useBy ?? '').localeCompare(b.useBy ?? ''));
  let left = portions;
  for (const d of dishes) {
    if (left <= 0) break;
    const t = Math.min(d.qty, left);
    if (d.qty - t <= 0.01) St.del('stock', d.id); else St.patch('stock', d.id, { qty: d.qty - t });
    left -= t;
  }
  St.put('plan', { ...slot, status: 'done', doneAt: today() });
}
function throwAway(item, qty = null) {
  const q = qty ?? item.qty;
  St.put('waste', { id: uid(), date: today(), ingredientId: item.ingredientId, name: item.name, qty: q, unit: item.unit });
  if (q >= item.qty - 1e-6) St.del('stock', item.id); else St.patch('stock', item.id, { qty: item.qty - q });
  refreshShopping(currentWeek(), true);
}
function addStock(fields) {
  const it = makeStockItem({ boughtAt: today(), ...fields });
  St.put('stock', it);
  refreshShopping(currentWeek(), true);
  return it;
}
function updateStock(item, changes) {
  if ((changes.qty ?? item.qty) <= 0 && item.kind !== 'dish') St.del('stock', item.id); else St.patch('stock', item.id, changes);
  refreshShopping(currentWeek(), true);
}
function flagBasicLow(ingId, on) {
  const s = St.settings();
  const set = new Set(s.lowBasics ?? []);
  on ? set.add(ingId) : set.delete(ingId);
  St.saveSettings({ lowBasics: [...set] });
  if (on) refreshShopping(currentWeek(), true);
  else St.list('shopping').filter((l) => l.kind === 'basic' && l.ingredientId === ingId && !l.checked).forEach((l) => St.del('shopping', l.id));
}

// ---------- Promos ----------
function setPromoIngredient(promo, ingId) {
  St.put('promos', { ...promo, userIngredient: ingId || null });
  const s = St.settings();
  const key = norm(promo.name);
  const map = { ...(s.productMap ?? {}) };
  if (ingId) map[key] = ingId; else delete map[key];
  St.saveSettings({ productMap: map });
  refreshShopping(currentWeek(), true);
}
function editPromo(promo, changes) {
  St.put('promos', { ...promo, ...changes, manual: true, confidence: 'high' });
  refreshShopping(currentWeek(), true);
}
function addPromo(fields, ws = currentWeek()) {
  const id = `manuel-${uid()}`;
  St.put('promos', { id, folder: 'manuel', page: 0, brand: '', ex: '', n: 1, basis: null, perUnit: null, validFrom: ws, validTo: addDays(ws, 6), confidence: 'high', manual: true, ...fields });
  refreshShopping(currentWeek(), true);
}

/** Plan B : texte du folder collé à la main → promos de la page (même lecteur que celui de Claude). */
function importFolderText({ slug, from, to, text }) {
  const header = from && to ? `${from.slice(8)}/${from.slice(5, 7)} -> ${to.slice(8)}/${to.slice(5, 7)}/${to.slice(0, 4)}\n\n` : '';
  const parsed = parseFolder([{ n: 1, text: header + text }], { slug, productMap: St.settings().productMap });
  if (!parsed.items.length) return 0;
  St.putMany('promos', parsed.items.map((it) => ({ ...it, manual: true })));
  St.put('folders', { id: slug, slug, validFrom: from, validTo: to, fetchedAt: new Date().toISOString(), status: 'ok', message: null, count: parsed.items.length, source: 'texte collé' });
  refreshShopping(currentWeek(), true);
  return parsed.items.length;
}

return { today, currentWeek, allRecipes, recipeById, slotsOfWeek, ctxFor, generatePlan, pickProposal, writeSlot, anotherIdea, setGuests, toggleLock, skipSlot, swapSlots, evalFor, stats, cheaper, refreshShopping, setNoExtra, weekRecord, markBought, unbuy, endPassage, addManualLine, setSpentOverride, strategic, slotsUsing, refuseReplace, refuseRecipe, refuseNever, cookDone, eatLeftover, throwAway, addStock, updateStock, flagBasicLow, setPromoIngredient, editPromo, addPromo, importFolderText };
})();

// ---- site/src/ui.js
__M["site/src/ui.js"] = (() => {
// Petits utilitaires d'interface : construction DOM sûre (jamais d'innerHTML sur du texte saisi), feuilles, toasts.

/** h('div.carte', { onclick }, 'texte', enfant) */
function h(tag, attrs, ...kids) {
  const m = tag.match(/^([a-z0-9]*)(?:#([\w-]+))?((?:\.[\w-]+)*)$/i) ?? [tag, 'div', undefined, ''];
  const el = document.createElement(m[1] || 'div');
  if (m[2]) el.id = m[2];
  const classes = m[3].split('.').filter(Boolean);
  if (classes.length) el.className = classes.join(' ');
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === false || v == null) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.className += (el.className ? ' ' : '') + v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'open') el[k] = !!v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, kids);
  return el;
}
function append(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}
const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };

const chip = (text, cls = '', attrs = {}) => h(`span.chip${cls ? '.' + cls.split(' ').join('.') : ''}`, attrs, text);
const icon = (e) => h('span.ico', { 'aria-hidden': 'true' }, e);

// ---------- Toasts ----------
let toastTimer;
function toast(msg, { undo = null, ms = 4000 } = {}) {
  let el = document.getElementById('toast');
  if (!el) { el = h('div#toast', { role: 'status', 'aria-live': 'polite' }); document.body.append(el); }
  clear(el);
  append(el, [h('span', msg), undo && h('button.link', { onclick: () => { undo(); el.classList.remove('show'); } }, 'Annuler')]);
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

// ---------- Feuille (bottom sheet) ----------
const stack = [];
/**
 * @param {{title:string, body:(close:Function)=>Node|Node[], footer?:(close:Function)=>Node|Node[], wide?:boolean, onClose?:Function}} o
 */
function sheet({ title, body, footer, wide = false, onClose }) {
  const back = h('div.backdrop');
  const panel = h('div.sheet' + (wide ? '.wide' : ''), { role: 'dialog', 'aria-modal': 'true', 'aria-label': title });
  const close = () => {
    panel.classList.add('out'); back.classList.add('out');
    setTimeout(() => { back.remove(); panel.remove(); }, 160);
    const i = stack.indexOf(close); if (i >= 0) stack.splice(i, 1);
    onClose?.();
  };
  const head = h('header.sheet-head', h('h2', title), h('button.icon-btn', { onclick: close, 'aria-label': 'Fermer' }, '✕'));
  const content = h('div.sheet-body', body(close));
  panel.append(head, content);
  if (footer) panel.append(h('footer.sheet-foot', footer(close)));
  back.addEventListener('click', close);
  document.body.append(back, panel);
  stack.push(close);
  setTimeout(() => { panel.classList.add('in'); back.classList.add('in'); }, 10);
  return { close, content, panel };
}
const closeTop = () => stack.at(-1)?.();

function confirmSheet({ title, text, ok = 'Confirmer', danger = false }) {
  return new Promise((resolve) => {
    let done = false;
    sheet({
      title, onClose: () => { if (!done) resolve(false); },
      body: () => h('p', text),
      footer: (close) => [
        h('button.btn', { onclick: () => close() }, 'Annuler'),
        h('button.btn.primary' + (danger ? '.danger' : ''), { onclick: () => { done = true; resolve(true); close(); } }, ok),
      ],
    });
  });
}

// ---------- Champs ----------
const field = (label, control, hint) => h('label.field', h('span.lbl', label), control, hint && h('small.hint', hint));
const input = (props) => h('input', props);
const select = (options, value, onchange, attrs = {}) =>
  h('select', { onchange: (e) => onchange(e.target.value), ...attrs }, options.map(([v, l]) => h('option', { value: v, selected: v === value }, l)));
const segmented = (options, value, onchange) =>
  h('div.seg', { role: 'radiogroup' }, options.map(([v, l]) => h('button.seg-btn' + (v === value ? '.on' : ''), { type: 'button', role: 'radio', 'aria-checked': v === value ? 'true' : 'false', onclick: (e) => { e.target.parentElement.querySelectorAll('.seg-btn').forEach((b) => { b.classList.toggle('on', b === e.target); b.setAttribute('aria-checked', b === e.target ? 'true' : 'false'); }); onchange(v); } }, l)));
const toggle = (checked, onchange, label) =>
  h('label.tog', h('input', { type: 'checkbox', checked, onchange: (e) => onchange(e.target.checked) }), h('span', label));

const fmtNum = (n, d = 1) => String(Math.round(n * 10 ** d) / 10 ** d).replace('.', ',');
const parseNum = (s) => parseFloat(String(s).replace(',', '.'));

return { h, append, clear, chip, icon, toast, sheet, closeTop, confirmSheet, field, input, select, segmented, toggle, fmtNum, parseNum };
})();

// ---- site/src/ai.js
__M["site/src/ai.js"] = (() => {
// Nouvelles idées de recettes par IA (capacité `sample` de la page : Claude répond sur le compte de la personne qui clique).
// L'IA ne choisit que parmi les ingrédients autorisés pour les personnes à table ; sa réponse est revalidée par les règles de l'app.
const St = __M["site/src/store.js"];
const { INGREDIENTS } = __M["shared/ingredients.js"];
const { CATEGORIES, EQUIPMENT, MEALS, validateRecipe } = __M["shared/recipes.js"];
const { strictViolations, hatedHits } = __M["shared/rules.js"];
const { uid } = __M["shared/util.js"];

const aiAvailable = () => !!St.S.caps.sample;

/** Ingrédients que toutes les personnes présentes peuvent manger (jamais de données personnelles envoyées). */
const allowedIngredients = (people, settings) =>
  Object.keys(INGREDIENTS).filter((id) => hatedHits([id], { hated: [] }, settings).length === 0 && people.every((p) => strictViolations([id], p).length === 0 && hatedHits([id], p, settings).length === 0));

const buildPrompt = ({ meal = 'souper', cat = 'express', prefer = [], allowed, timeMax = null }) => {
  const vocab = allowed.map((id) => `${id} (${INGREDIENTS[id].name}, ${INGREDIENTS[id].unit})`).join('; ');
  const info = CATEGORIES[cat];
  return (
    'Tu es un cuisinier belge pragmatique. Crée UNE recette en français pour UNE personne adulte d’appétit normal (portion de référence). ' +
    'Réponds uniquement par un objet JSON. Utilise exclusivement les identifiants d’ingrédients de la liste. Quantités dans l’unité de l’ingrédient (g, ml ou pièces). ' +
    'Les basiques (sel, poivre, huile, épices, ail, oignon) sont autorisés en petites quantités.\n' +
    `Repas : ${MEALS[meal]?.label ?? meal}. Catégorie : ${info?.label ?? cat} (${info?.hint ?? ''}). ` +
    (info?.maxTotal ? `Temps total (préparation + cuisson) ≤ ${info.maxTotal} min. ` : '') +
    (timeMax ? `Temps total ≤ ${timeMax} min. ` : '') +
    (prefer.length ? `Construis la recette autour de : ${prefer.join(', ')}. ` : '') +
    `\nIngrédients autorisés : ${vocab}.\nMatériel possible : ${Object.keys(EQUIPMENT).join(', ')}.` +
    '\nFormat : {"name":"","emoji":"","prep":0,"cook":0,"diff":"facile|moyen","eq":["plaques"],"ing":[{"id":"","q":0,"opt":false}],"steps":[{"t":"texte","timer":0}],"keep":"conservation des restes"}'
  );
};

/** Convertit la réponse de l'IA en recette de l'app et la valide ; lève une erreur détaillée si elle est incohérente. */
const toRecipe = (raw, { meal = 'souper', cat = 'express', allowed = null } = {}) => {
  const allowedSet = allowed?.length ? new Set(allowed) : null;
  const basics = new Set(Object.values(INGREDIENTS).filter((i) => i.basic).map((i) => i.id));
  const recipe = {
    id: `ia-${uid()}`,
    name: String(raw.name ?? '').slice(0, 80),
    emoji: String(raw.emoji ?? '🍽️').slice(0, 4),
    meals: [meal], cat, tags: [],
    prep: Number(raw.prep), cook: Number(raw.cook),
    diff: raw.diff === 'moyen' ? 'moyen' : 'facile',
    eq: (raw.eq ?? ['plaques']).filter((k) => EQUIPMENT[k]),
    ing: (raw.ing ?? []).map((l) => [String(l.id), Number(l.q), l.opt ? { opt: true } : undefined].filter((x) => x !== undefined)),
    steps: (raw.steps ?? []).map((s) => (s.timer > 0 ? [String(s.t), Number(s.timer)] : String(s.t))),
    keep: String(raw.keep ?? '2 jours au frigo'), batch: 1, source: 'ia',
  };
  const errs = validateRecipe(recipe);
  if (allowedSet) for (const [id] of recipe.ing) if (!allowedSet.has(id) && !basics.has(id)) errs.push(`ingrédient non autorisé: ${id}`);
  if (errs.length) throw new Error(errs.join(' ; '));
  return recipe;
};

/** Demande une recette à Claude. Rejette avec un message lisible. */
async function askRecipe({ meal, cat, prefer, people, settings, timeMax }) {
  const sample = St.S.caps.sample;
  if (!sample) throw new Error('Claude n’est pas disponible dans cette page.');
  const allowed = allowedIngredients(people, settings);
  let raw;
  try { raw = await sample.json(buildPrompt({ meal, cat, prefer, allowed, timeMax }), { modelTier: 'default', cache: false }); }
  catch (e) {
    const msg = { not_granted: 'Tu n’as pas autorisé Claude dans cette page.', rate_limited: 'Trop de demandes : réessaie dans un moment.', invalid_json: 'Claude a répondu dans un format inattendu : réessaie.' }[e?.code];
    throw new Error(msg || 'Claude n’a pas pu répondre : réessaie plus tard.');
  }
  return toRecipe(raw, { meal, cat, allowed });
}

return { aiAvailable, allowedIngredients, buildPrompt, toRecipe, askRecipe };
})();

// ---- site/src/screens/key.js
__M["site/src/screens/key.js"] = (() => {
// Saisie du « code du foyer » : il déchiffre les promos publiées (le site est public, le folder Delhaize ne l'est pas).
const St = __M["site/src/store.js"];
const { h, sheet, field, input, toast } = __M["site/src/ui.js"];

function showKeySheet(message = '') {
  const code = input({ type: 'text', placeholder: 'code du foyer', autocapitalize: 'off', autocomplete: 'off', autocorrect: 'off', spellcheck: 'false' });
  const note = h('div');
  return sheet({
    title: '🔒 Code du foyer',
    body: () => [
      h('p', 'Les promos Delhaize sont publiées chiffrées. Saisis le code du foyer (le même sur tous les appareils) pour les afficher.'),
      message && h('div.banner.offline', message),
      field('Code', code),
      note,
      h('small.muted', 'Il reste enregistré dans ce navigateur : tu ne le saisis qu’une fois par appareil.'),
    ],
    footer: (close) => [
      h('button.btn', { onclick: close }, 'Plus tard'),
      h('button.btn.primary', { onclick: async () => {
        if (!code.value.trim()) return toast('Saisis le code');
        toast('Déverrouillage…', { ms: 2500 });
        const ok = await St.setCode(code.value);
        if (ok) { toast('Promos déverrouillées ✅'); close(); }
        else { note.replaceChildren(h('div.banner.offline', St.S.meta.promos.message || 'Code incorrect.')); }
      } }, 'Déverrouiller'),
    ],
  });
}

return { showKeySheet };
})();

// ---- site/src/common.js
__M["site/src/common.js"] = (() => {
// Composants partagés entre les écrans : en-tête, fiche de repas, feuille de repas, confirmation « C'est fait », refus.
const St = __M["site/src/store.js"];
const A = __M["site/src/actions.js"];
const { h, chip, sheet, toast, field, input, select, segmented, fmtNum, parseNum, confirmSheet, clear } = __M["site/src/ui.js"];
const { CATEGORIES, MEALS, totalTime } = __M["shared/recipes.js"];
const { INGREDIENTS, RAYON_ICON } = __M["shared/ingredients.js"];
const { fmtQty, eur, fmtDayLong, fmtDayShort, todayStr, addDays, weekStartFor, norm, isWeekend } = __M["shared/util.js"];
const { substituteOptions } = __M["shared/planner.js"];
const { discountOf } = __M["shared/pricing.js"];
const { slotPortions, presentProfiles } = __M["shared/rules.js"];
const { askRecipe, aiAvailable } = __M["site/src/ai.js"];
const { showKeySheet } = __M["site/src/screens/key.js"];

/** Cible de l'écran Recette (un repas du planning ou `r~<id>` pour un aperçu) : gardée en mémoire, pas dans l'adresse. */
const nav = { recipe: null };
/** Navigation : `go('semaine')`, `go('recette/<repas>')`. Seules les adresses `#nom` passent par une page Claude. */
const go = (path) => {
  const [name, ...rest] = path.split('/');
  if (name === 'recette') nav.recipe = rest.join('/') || null;
  if (location.hash === `#${name}`) window.dispatchEvent(new Event('omq:render'));
  else location.hash = `#${name}`;
};

function header(title, sub, right) {
  return h('div.top', h('div.grow', h('h1', title), sub && h('div.sub', sub)), right);
}

const NOTHING = () => document.createDocumentFragment();
function syncBanner() {
  const P = St.S.meta.promos;
  if (St.S.meta.error) return h('div.banner.offline', '⚠️ ', St.S.meta.error);
  if (P.state === 'locked') return h('div.banner.offline', { style: { cursor: 'pointer' }, role: 'button', tabindex: '0', onclick: () => showKeySheet(P.message) }, '🔒 Promos verrouillées : touche ici pour saisir le code du foyer.');
  if (P.state === 'offline') return h('div.banner.offline', '📶 ', P.message);
  if (P.state === 'error') return h('div.banner.offline', '⚠️ ', P.message);
  return NOTHING();
}

const catChip = (cat) => h('span.chip.cat', { style: { background: CATEGORIES[cat]?.color } }, CATEGORIES[cat]?.label ?? cat);

/** Libellé de la personne / des couverts d'un repas. */
function whoLabel(slot) {
  const info = slotPortions(slot, St.list('profiles'), St.settings());
  return `${info.couverts} couvert${info.couverts > 1 ? 's' : ''}`;
}

/** Nom, emoji et sous-titre d'un repas du planning. */
function slotView(slot) {
  if (slot.kind === 'none') return { emoji: '➖', name: slot.note || 'Pas de repas', sub: '', recipe: null };
  const recipe = A.recipeById(slot.recipeId);
  if (!recipe) return { emoji: '❔', name: 'Recette introuvable', sub: '', recipe: null };
  if (slot.kind === 'leftover') return { emoji: '♻️', name: `Restes : ${recipe.name}`, sub: 'à réchauffer', recipe };
  return { emoji: recipe.emoji, name: recipe.name, sub: `${totalTime(recipe)} min · ${whoLabel(slot)}`, recipe };
}

function mealRow(slot, onClick) {
  const v = slotView(slot);
  return h('button.slot-row', { onclick: onClick, 'aria-label': `${MEALS[slot.meal].label} : ${v.name}` },
    h('span.em', slot.status === 'done' ? '✅' : v.emoji),
    h('span', h('span.slot-lbl', MEALS[slot.meal].label, slot.locked ? ' 🔒' : ''), h('div.t', { style: slot.status === 'done' ? { textDecoration: 'line-through', opacity: .6 } : null }, v.name), v.sub && h('small', v.sub)),
    v.recipe && slot.kind === 'recipe' ? catChip(v.recipe.cat) : '');
}

// ---------- Feuille d'un repas ----------
function openSlotSheet(slotIn) {
  const slot = St.get('plan', slotIn.id) ?? slotIn;
  const ws = weekStartFor(slot.date);
  return sheet({
    title: `${MEALS[slot.meal].label} · ${fmtDayShort(slot.date)}`,
    body: (close) => {
      const root = h('div.stack');
      const draw = () => {
        const cur = St.get('plan', slot.id) ?? slot;
        clear(root);
        const v = slotView(cur);
        const e = cur.kind === 'recipe' ? A.evalFor(cur) : null;
        root.append(
          h('div.card.row', h('span', { style: { fontSize: '2.2rem' } }, v.emoji), h('div.grow', h('h3', v.name), h('small', v.sub), e && h('div', chip(`${fmtQty(e.ev.info.portions * 100 / 100, 'portion').replace('portions', 'parts').replace('portion', 'part')}`, 'blue'))),
            v.recipe && h('button.btn.primary.small', { onclick: () => { close(); go(`recette/${cur.id}`); } }, 'Ouvrir')),
        );
        if (cur.status === 'done') { root.append(h('div.banner.demo', '✅ Repas fait')); return; }
        // propositions
        if (cur.proposals?.length > 1 && cur.kind === 'recipe') {
          root.append(h('div.section-title', 'Propositions'));
          const ctx = A.ctxFor(ws);
          for (const id of cur.proposals) {
            const r = A.recipeById(id);
            if (!r) continue;
            const on = id === cur.recipeId;
            root.append(h('button.card.tight.row', { style: { width: '100%', textAlign: 'left', borderColor: on ? 'var(--accent)' : null, borderWidth: on ? '2px' : null }, onclick: () => { A.pickProposal(cur, id); draw(); } },
              h('span', { style: { fontSize: '1.7rem' } }, r.emoji), h('div.grow', h('b', r.name), h('div', catChip(r.cat), ' ', h('small', `${totalTime(r)} min`))), on ? chip('choisi', 'green') : ''));
          }
        }
        const act = h('div.row.wrap');
        act.append(
          h('button.btn', { onclick: () => { if (!A.anotherIdea(cur)) toast('Pas d’autre idée compatible'); draw(); } }, '🎲 Autre idée'),
          h('button.btn', { onclick: () => pickRecipeSheet(cur, draw) }, '📖 Choisir…'),
          aiAvailable() && h('button.btn', { onclick: () => aiIdea(cur, draw) }, '✨ Idée de Claude'),
          h('button.btn', { onclick: () => { A.toggleLock(cur); draw(); } }, cur.locked ? '🔓 Déverrouiller' : '🔒 Verrouiller'),
        );
        root.append(h('div.section-title', 'Actions'), act);
        root.append(
          h('div.card.row', h('div.grow', h('b', 'Invités'), h('div', h('small', '+N adultes, sans créer de profil'))),
            h('button.icon-btn', { onclick: () => { A.setGuests(cur, (cur.guests || 0) - 1); draw(); }, 'aria-label': 'Un invité de moins' }, '−'), h('b', { style: { minWidth: '1.5em', textAlign: 'center' } }, cur.guests || 0),
            h('button.icon-btn', { onclick: () => { A.setGuests(cur, (cur.guests || 0) + 1); draw(); }, 'aria-label': 'Un invité de plus' }, '+')),
        );
        const sw = h('div.row.wrap');
        sw.append(h('button.btn', { onclick: () => swapSheet(cur, draw) }, '🔁 Échanger avec un autre repas'), h('button.btn', { onclick: () => { A.skipSlot(cur); close(); } }, '🚫 Pas de repas ici'));
        if (cur.kind === 'recipe' && e) sw.append(h('button.btn', { onclick: () => refuseSheet(cur, draw) }, '🙅 Je n’en veux pas…'));
        root.append(sw);
      };
      draw();
      return root;
    },
    footer: (close) => {
      const cur = St.get('plan', slot.id) ?? slot;
      if (cur.status === 'done' || cur.kind === 'none' || !cur.recipeId) return h('button.btn', { onclick: close }, 'Fermer');
      return [h('button.btn', { onclick: close }, 'Fermer'), h('button.btn.good', { onclick: () => { close(); openCookSheet(cur); } }, '✅ C’est fait')];
    },
  });
}

/** Une recette sur mesure par Claude (capacité `sample`), revalidée par les règles de l'app avant d'être proposée. */
async function aiIdea(slot, after) {
  const ws = weekStartFor(slot.date);
  const ctx = A.ctxFor(ws);
  const people = presentProfiles(ctx.profiles, slot.date, slot.meal);
  const prefer = [...ctx.promoIdx.keys()].filter((id) => !INGREDIENTS[id].basic).slice(0, 8).map((id) => INGREDIENTS[id].name);
  const limit = ctx.settings.timeRules?.[isWeekend(slot.date) ? 'weekend' : 'semaine']?.[slot.meal] ?? null;
  toast('Claude cherche une idée… (jusqu’à une minute)', { ms: 9000 });
  try {
    const recipe = await askRecipe({ meal: slot.meal, cat: limit && limit <= 20 ? 'express' : 'equilibre', prefer, people, settings: ctx.settings, timeMax: limit });
    St.put('recipes', recipe);
    A.pickProposal(slot, recipe.id);
    toast(`Nouvelle recette : ${recipe.name}`);
    after?.();
  } catch (e) { toast(e.message, { ms: 7000 }); }
}

function pickRecipeSheet(slot, after) {
  const s = sheet({
    title: 'Choisir une recette',
    body: (close) => {
      const q = input({ type: 'search', placeholder: 'Rechercher…' });
      const list = h('div.stack');
      const ctx = A.ctxFor(weekStartFor(slot.date));
      const render = () => {
        clear(list);
        const t = norm(q.value);
        const people = ctx.profiles;
        for (const r of A.allRecipes().filter((r) => r.meals.includes(slot.meal) && (!t || norm(r.name).includes(t)))) {
          const ok = (() => { try { return A.evalFor({ ...slot, recipeId: r.id, over: {}, resolved: {}, batch: 1 })?.ev.ok; } catch { return false; } })();
          list.append(h('button.card.tight.row', { style: { width: '100%', textAlign: 'left', opacity: ok ? 1 : .5 }, disabled: !ok, onclick: () => { A.pickProposal(slot, r.id); close(); after?.(); } },
            h('span', { style: { fontSize: '1.6rem' } }, r.emoji), h('div.grow', h('b', r.name), h('div', catChip(r.cat), ' ', h('small', `${totalTime(r)} min`))), ok ? '' : chip('incompatible', 'red')));
        }
      };
      q.addEventListener('input', render);
      render();
      return [q, list];
    },
  });
  return s;
}

function swapSheet(slot, after) {
  const ws = weekStartFor(slot.date);
  sheet({
    title: 'Échanger avec…',
    body: (close) => A.slotsOfWeek(ws).filter((s) => s.id !== slot.id && s.status !== 'done' && s.kind !== 'leftover').map((s) => {
      const v = slotView(s);
      return h('button.slot-row', { onclick: () => { A.swapSlots(slot, s); close(); after?.(); toast('Repas échangés'); } },
        h('span.em', v.emoji), h('span', h('span.slot-lbl', `${fmtDayShort(s.date)} · ${MEALS[s.meal].label}`), h('div.t', v.name)), '');
    }),
  });
}

// ---------- « Je n'en veux pas » ----------
function refuseSheet(slot, after, onlyIng = null) {
  const ws = weekStartFor(slot.date);
  const e = A.evalFor(slot);
  if (!e) return;
  const lines = e.ev.lines.filter((l) => !l.dropped && !l.basic && (!onlyIng || l.ing === onlyIng));
  sheet({
    title: 'Je n’en veux pas',
    body: (close) => {
      const root = h('div.stack');
      const pickLine = () => {
        clear(root);
        root.append(h('p', 'Quel ingrédient ne te tente pas ?'));
        for (const l of lines) root.append(h('button.card.tight.row', { style: { width: '100%', textAlign: 'left' }, onclick: () => options(l) }, h('b.grow', INGREDIENTS[l.ing].name), h('small', fmtQty(l.q, l.unit))));
      };
      const options = (l) => {
        clear(root);
        const name = INGREDIENTS[l.ing].name;
        root.append(h('h3', name), h('p.muted', 'Les quantités et la liste seront recalculées.'));
        const subs = substituteOptions(slot, l.i, e.recipe, e.ctx);
        root.append(h('div.section-title', 'Remplacer l’ingrédient (garder la recette)'));
        if (!subs.length) root.append(h('small', 'Aucun équivalent compatible trouvé.'));
        for (const sOpt of subs.slice(0, 5)) root.append(h('button.card.tight.row', { style: { width: '100%', textAlign: 'left' }, onclick: () => { A.refuseReplace(ws, l.ing, sOpt.id); toast(`${sOpt.name} à la place`); close(); after?.(); } }, h('b.grow', sOpt.name), sOpt.promo ? chip(`promo ${sOpt.promo.mechanic ?? ''}`, 'promo') : chip('hors promo')));
        root.append(h('div.section-title', 'Autres options'),
          h('button.btn.block', { onclick: () => { A.refuseRecipe(ws, l.ing); toast('Repas remplacé(s)'); close(); after?.(); } }, '🎲 Changer de recette'),
          h('button.btn.block', { style: { marginTop: '8px' }, onclick: async () => { if (await confirmSheet({ title: 'Ne plus jamais proposer ?', text: `« ${name} » rejoint les aliments refusés du foyer. Les repas concernés sont remplacés.`, ok: 'Ne plus proposer' })) { A.refuseNever(ws, l.ing); close(); after?.(); } } }, '🚫 Ne plus jamais proposer'));
      };
      if (lines.length === 1 || onlyIng) options(lines[0]); else pickLine();
      return root;
    },
  });
}

// ---------- « C'est fait » ----------
function openCookSheet(slotIn) {
  const slot = St.get('plan', slotIn.id) ?? slotIn;
  if (slot.kind === 'leftover') {
    const info = slotPortions(slot, St.list('profiles'), St.settings());
    A.eatLeftover(slot, info.portions);
    toast('Restes mangés — stock mis à jour');
    return;
  }
  const e = A.evalFor(slot);
  if (!e) return;
  const stock = St.list('stock');
  const rows = e.ev.lines.filter((l) => !l.dropped && !l.basic);
  const vals = new Map(rows.map((l) => [l.i, l.q]));
  const portions = e.ev.info.portions;
  const batch = slot.batch ?? 1;
  let leftover = batch > 1 ? Math.round((batch - 1) * portions * 2) / 2 : 0;
  let freeze = false;
  sheet({
    title: 'C’est fait ! Quantités utilisées',
    body: () => {
      const root = h('div.stack');
      root.append(h('p.muted', 'Le stock est mis à jour avec ces quantités. Corrige si tu as cuisiné autre chose (par exemple tout le paquet).'));
      const card = h('div.card');
      for (const l of rows) {
        const have = stock.filter((s) => s.ingredientId === l.ing && s.qty > 0).reduce((a, s) => a + s.qty, 0);
        const inp = input({ type: 'number', inputmode: 'decimal', min: '0', step: l.unit === 'pc' ? '0.5' : '10', value: String(l.q), style: { width: '110px' }, onchange: (ev) => vals.set(l.i, Math.max(0, parseNum(ev.target.value) || 0)) });
        card.append(h('div.ing', h('div', h('b', INGREDIENTS[l.ing].name), h('div', h('small', `en stock : ${fmtQty(have, l.unit)}`), have > 0 && have !== l.q ? [' ', h('button.link', { onclick: () => { inp.value = String(have); vals.set(l.i, have); } }, 'tout le stock')] : '')), h('div.row', inp, h('small', l.unit === 'pc' ? 'pièces' : l.unit))));
      }
      root.append(card);
      root.append(field('Portions de restes à garder', input({ type: 'number', inputmode: 'decimal', min: '0', step: '0.5', value: String(leftover), onchange: (ev) => { leftover = Math.max(0, parseNum(ev.target.value) || 0); } }), 'Ajoutées au stock comme « plat cuisiné »'));
      if (St.settings().freezer !== 'aucun') root.append(h('label.tog', h('input', { type: 'checkbox', onchange: (ev) => { freeze = ev.target.checked; } }), h('span', 'Congeler les restes')));
      root.append(h('button.btn.block', { onclick: () => { reportRecipe(e.recipe); } }, '🚩 Signaler un problème avec cette recette'));
      return root;
    },
    footer: (close) => [h('button.btn', { onclick: close }, 'Annuler'), h('button.btn.good', { onclick: () => { A.cookDone(slot, { lines: rows.map((l) => ({ ing: l.ing, q: vals.get(l.i) })), leftoverPortions: leftover, freeze }); toast('Bon appétit ! Stock mis à jour 🍽️'); close(); } }, 'Valider')],
  });
}

function reportRecipe(recipe) {
  sheet({
    title: 'Signaler',
    body: (close) => {
      let why = 'temps';
      const ta = h('textarea', { placeholder: 'Précisions (facultatif)' });
      return [segmented([['temps', 'Temps faux'], ['quantites', 'Quantités'], ['gout', 'Pas bon']], why, (v) => { why = v; }), field('Détails', ta), h('button.btn.primary.block', { onclick: () => { St.put('flags', { id: `flag-${recipe.id}`, recipeId: recipe.id, why, note: ta.value, date: todayStr() }); toast('Merci — cette recette ne sera plus proposée'); close(); } }, 'Envoyer et ne plus proposer')];
    },
  });
}

const priceText = (p) => (p == null ? '—' : eur(p));


return { nav, go, header, syncBanner, catChip, whoLabel, slotView, mealRow, openSlotSheet, refuseSheet, openCookSheet, reportRecipe, priceText, fmtDayLong, fmtDayShort };
})();

// ---- site/src/screens/foyer.js
__M["site/src/screens/foyer.js"] = (() => {
const St = __M["site/src/store.js"];
const A = __M["site/src/actions.js"];
const { h, chip, toast, sheet, field, input, select, segmented, toggle, clear, parseNum, confirmSheet, fmtNum } = __M["site/src/ui.js"];
const { header, syncBanner } = __M["site/src/common.js"];
const { showKeySheet } = __M["site/src/screens/key.js"];
const { EQUIPMENT, MEALS } = __M["shared/recipes.js"];
const { ALLERGENS } = __M["shared/ingredients.js"];
const { AGE_CATS, energyNeedMJ, portionCoef, REF_MJ } = __M["shared/efsa.js"];
const { newProfile, DIETS, RELIGIOUS, SEXES, ACTIVITIES, APPETITES, coefOf } = __M["shared/rules.js"];
const { DAY_KEYS, DAY_LABELS, uid } = __M["shared/util.js"];

const rerender = () => window.dispatchEvent(new Event('omq:render'));
const DAYS = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];

function renderFoyer(root) {
  const profiles = St.list('profiles');
  const s = St.settings();
  root.append(header('Foyer', 'profils, matériel, préférences'), syncBanner());

  // ----- profils -----
  root.append(h('div.section-title', 'Profils', h('span.count', profiles.length)));
  const pc = h('div.card.tight');
  if (!profiles.length) pc.append(h('div.empty', h('p', 'Aucun profil pour l’instant.')));
  for (const p of profiles) {
    const coef = coefOf(p, s);
    pc.append(h('div.stock-row', { style: { cursor: 'pointer' }, onclick: () => profileSheet(p) },
      h('div.person', h('div.avatar', (p.name || '?').slice(0, 1).toUpperCase()), h('div', h('div.nm', p.name || 'Sans prénom'), h('small', [AGE_CATS[p.ageCat]?.label, DIETS[p.diet] !== 'Aucun' ? DIETS[p.diet] : null, (p.allergens?.length ? `${p.allergens.length} allergie${p.allergens.length > 1 ? 's' : ''}` : null)].filter(Boolean).join(' · '))), chip(`× ${fmtNum(coef, 2)}`, 'blue')),
      h('span', '›')));
  }
  root.append(pc, h('button.btn.block', { style: { marginTop: '10px' }, onclick: () => profileSheet(null) }, '+ Ajouter une personne'));

  // ----- matériel -----
  root.append(h('div.section-title', 'Matériel de cuisine'));
  const eq = h('div.card');
  eq.append(h('div.checks', Object.entries(EQUIPMENT).map(([k, label]) => toggle(!!s.equipment[k], (v) => { St.saveSettings({ equipment: { ...s.equipment, [k]: v } }); A.refreshShopping(A.currentWeek(), true); }, label))));
  eq.append(h('small.muted', 'Un appareil cassé ? Décoche-le : les recettes qui en ont besoin ne sont plus proposées.'));
  eq.append(h('div.row', field('Nombre de feux', input({ type: 'number', min: '1', max: '8', value: s.feux, onchange: (e) => St.saveSettings({ feux: parseInt(e.target.value) || 4 }) })), field('Autre matériel', input({ type: 'text', value: s.equipmentOther, placeholder: 'wok, cocotte…', onchange: (e) => St.saveSettings({ equipmentOther: e.target.value }) }))));
  eq.append(field('Congélateur', segmented([['aucun', 'Aucun'], ['petit', 'Petit'], ['moyen', 'Moyen'], ['grand', 'Grand']], s.freezer, (v) => St.saveSettings({ freezer: v }))));
  root.append(eq);

  // ----- repas & temps -----
  root.append(h('div.section-title', 'Repas à planifier'));
  const meals = h('div.card');
  meals.append(h('div.checks', Object.entries(MEALS).map(([k, m]) => toggle(!!s.meals[k], (v) => St.saveSettings({ meals: { ...s.meals, [k]: v } }), `${m.emoji} ${m.label}`))));
  const LIM = [['', 'Libre'], ['20', 'Express (20 min)'], ['30', '30 min'], ['45', '45 min']];
  const lim = (when, meal) => String(s.timeRules?.[when]?.[meal] ?? '');
  const setLim = (when, meal, v) => St.saveSettings({ timeRules: { ...s.timeRules, [when]: { ...s.timeRules[when], [meal]: v ? Number(v) : null } } });
  meals.append(field('Souper en semaine (lundi → vendredi)', select(LIM, lim('semaine', 'souper'), (v) => setLim('semaine', 'souper', v)), 'Contrainte de temps appliquée à tous les soirs de semaine'),
    field('Souper le week-end', select(LIM, lim('weekend', 'souper'), (v) => setLim('weekend', 'souper', v))),
    field('Dîner (midi) en semaine', select(LIM, lim('semaine', 'diner'), (v) => setLim('semaine', 'diner', v))));
  root.append(meals);

  // ----- budget -----
  root.append(h('div.section-title', 'Budget'));
  root.append(h('div.card', field('Budget hebdomadaire (€)', input({ type: 'number', inputmode: 'decimal', step: '5', value: s.budget, onchange: (e) => St.saveSettings({ budget: parseNum(e.target.value) || 0 }) }), 'Modifiable à tout moment'), field('Seuil des achats stratégiques (% de remise)', input({ type: 'number', min: '5', max: '70', value: s.strategicThreshold, onchange: (e) => St.saveSettings({ strategicThreshold: parseInt(e.target.value) || 25 }) }))));

  // ----- aliments refusés -----
  root.append(h('div.section-title', 'Aliments refusés par le foyer'));
  const hated = h('div.card.stack');
  const chips = h('div.chip-row');
  for (const w of s.hated ?? []) chips.append(h('button.chip-btn', { onclick: () => { St.saveSettings({ hated: s.hated.filter((x) => x !== w) }); }, 'aria-label': `Retirer ${w}` }, `${w} ✕`));
  if (!(s.hated ?? []).length) chips.append(h('small.muted', 'Aucun. « Je n’en veux pas → ne plus jamais proposer » les ajoute ici.'));
  const addIn = input({ type: 'text', placeholder: 'ex. coriandre' });
  hated.append(chips, h('div.row', addIn, h('button.btn', { onclick: () => { const w = addIn.value.trim(); if (w) { St.saveSettings({ hated: [...new Set([...(s.hated ?? []), w])] }); addIn.value = ''; } } }, 'Ajouter')));
  root.append(hated);

  // ----- réglages avancés : portions -----
  root.append(h('details.card', { style: { marginTop: '16px' } }, h('summary', 'Portions & réglages avancés'),
    h('p.muted', { style: { marginTop: '8px' } }, `Coefficient = besoin énergétique du profil ÷ besoin de l’adulte de référence (${fmtNum(REF_MJ, 2)} MJ/j, moyenne H/F 30-39 ans, activité moyenne), table EFSA 2013. L’appétit ajuste ensuite la portion.`),
    h('div.row', ...['petit', 'normal', 'gros'].map((k) => field(`Appétit ${k}`, input({ type: 'number', step: '0.01', min: '0.5', max: '1.5', value: s.appetite[k], onchange: (e) => St.saveSettings({ appetite: { ...s.appetite, [k]: parseNum(e.target.value) || s.appetite[k] } }) }))))));

  // ----- promos -----
  root.append(h('div.section-title', 'Promos Delhaize'));
  const P = St.S.meta.promos;
  const pcard = h('div.card.stack');
  pcard.append(h('div.row', h('span.grow', P.state === 'ok' ? '🟢 Promos déverrouillées' : P.state === 'locked' ? '🔒 Verrouillées' : P.state === 'offline' ? '🟠 Hors connexion' : P.state === 'none' ? '⚪ Pas encore publiées' : P.state === 'error' ? '🔴 Indisponibles' : '…'), P.updatedAt && h('small', `publiées le ${new Date(P.updatedAt).toLocaleDateString('fr-BE')}`)));
  if (P.message) pcard.append(h('small.muted', P.message));
  pcard.append(h('small.muted', 'Lecture automatique du folder deux fois par jour (GitHub Actions). Le contenu est chiffré : le code du foyer le déverrouille.'));
  pcard.append(h('div.row.wrap', h('button.btn.small', { onclick: () => showKeySheet() }, '🔒 Code du foyer'), h('button.btn.small', { onclick: async () => { await St.loadPromos(); toast(St.S.meta.promos.state === 'ok' ? 'Promos à jour' : (St.S.meta.promos.message || 'Indisponible')); } }, '↻ Recharger')));
  root.append(pcard);

  // ----- sauvegarde & transfert -----
  root.append(h('div.section-title', 'Sauvegarde et transfert'));
  root.append(h('div.card.stack',
    h('p', 'Tes données (profils, planning, stock, courses) sont enregistrées dans ce navigateur, sur cet appareil. Il n’y a pas de synchronisation automatique entre appareils : pour changer de téléphone ou partager, exporte puis importe.'),
    h('div.row.wrap',
      h('button.btn.small', { onclick: () => downloadExport() }, '⬇︎ Exporter (fichier)'),
      h('button.btn.small', { onclick: () => copyExport() }, '📋 Copier le texte'),
      h('button.btn.small', { onclick: () => importSheet() }, '⬆︎ Importer…'))));

  // ----- données -----
  root.append(h('div.section-title', 'Données personnelles'));
  root.append(h('div.card.stack',
    h('p.muted', 'Les allergies et données de santé ne quittent jamais ce navigateur : le site est statique, il n’envoie rien nulle part.'),
    h('button.btn.small.danger', { onclick: async () => { if (await confirmSheet({ title: 'Tout effacer ?', text: 'Profils, stock, planning, courses : toutes tes données sont effacées de ce navigateur. Fais d’abord un export si tu veux les garder. Action irréversible.', ok: 'Tout effacer', danger: true })) { St.wipeAll(); toast('Données effacées'); rerender(); } } }, 'Tout effacer')));
  root.append(h('div.card.flat', { style: { marginTop: '14px' } }, h('small.muted', 'Usage strictement personnel (CGU Delhaize, art. 2.3.2) : les promos ne sont ni publiques ni à partager. Besoins énergétiques : EFSA, EFSA Journal 2013;11(1):3005. Vérifie toujours les étiquettes des produits en cas d’allergie.')));
}

function downloadExport() {
  const url = URL.createObjectURL(new Blob([St.exportJson()], { type: 'application/json' }));
  const a = h('a', { href: url, download: `on-mange-quoi-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  toast('Export prêt');
}
async function copyExport() {
  const text = St.exportJson();
  try { await navigator.clipboard.writeText(text); toast('Texte copié : colle-le dans « Importer » sur l’autre appareil'); }
  catch {
    sheet({ title: 'Copier le texte', body: () => [h('p.muted', 'Sélectionne tout le texte, copie-le, puis colle-le dans « Importer » sur l’autre appareil.'), h('textarea', { readonly: true, onfocus: (e) => e.target.select() }, text)] });
  }
}
function importSheet() {
  let text = '';
  sheet({
    title: 'Importer des données',
    body: () => [
      h('p.muted', 'Colle le texte exporté depuis l’autre appareil, ou choisis le fichier. Les données de cet appareil seront remplacées.'),
      field('Texte exporté', h('textarea', { placeholder: '{ "app": "on-mange-quoi", … }', oninput: (e) => { text = e.target.value; } })),
      field('…ou fichier', h('input', { type: 'file', accept: '.json,application/json', onchange: async (e) => { const f = e.target.files?.[0]; if (f) text = await f.text(); } })),
    ],
    footer: (close) => [h('button.btn', { onclick: close }, 'Annuler'), h('button.btn.primary', { onclick: async () => {
      if (!text.trim()) return toast('Colle d’abord le texte ou choisis un fichier');
      if (!(await confirmSheet({ title: 'Remplacer les données ?', text: 'Les données actuelles de cet appareil seront remplacées par celles de l’export.', ok: 'Remplacer' }))) return;
      try { const n = St.importJson(text); toast(`${n} éléments importés ✅`); close(); rerender(); } catch (e) { toast(e.message, { ms: 6000 }); }
    } }, 'Importer')],
  });
}

// ---------- Éditeur de profil ----------
function profileSheet(p, { onSaved } = {}) {
  const isNew = !p;
  const v = { ...newProfile(), ...(p ?? {}), id: p?.id ?? uid(), presence: JSON.parse(JSON.stringify(p?.presence ?? {})) };
  const preview = h('div');
  const updatePreview = () => { clear(preview); preview.append(h('small.muted', `Portion : × ${fmtNum(coefOf(v, St.settings()), 2)} · besoin ≈ ${fmtNum(energyNeedMJ(v), 1)} MJ/jour (EFSA)`)); };
  return sheet({
    title: isNew ? 'Nouveau profil' : v.name || 'Profil', wide: true,
    body: () => {
      updatePreview();
      const root = h('div');
      root.append(
        field('Prénom *', input({ type: 'text', value: v.name, placeholder: 'Prénom', autofocus: true, oninput: (e) => { v.name = e.target.value; } })),
        field('Catégorie d’âge *', select(Object.entries(AGE_CATS).map(([k, c]) => [k, c.label]), v.ageCat, (x) => { v.ageCat = x; updatePreview(); })),
        field('Sexe *', segmented(Object.entries(SEXES), v.sex, (x) => { v.sex = x; updatePreview(); })),
        field('Appétit', segmented(Object.entries(APPETITES), v.appetite, (x) => { v.appetite = x; updatePreview(); })),
        field('Activité physique', segmented(Object.entries(ACTIVITIES), v.activity, (x) => { v.activity = x; updatePreview(); })),
        preview,
        field('Régime', select(Object.entries(DIETS), v.diet, (x) => { v.diet = x; })),
      );
      const rel = h('div.checks');
      for (const [k, l] of Object.entries(RELIGIOUS)) rel.append(toggle(v.religious.includes(k), (on) => { v.religious = on ? [...new Set([...v.religious, k])] : v.religious.filter((x) => x !== k); }, l));
      root.append(h('div.field', h('span.lbl', 'Restrictions religieuses'), rel));
      root.append(h('details.card.flat', { style: { margin: '12px 0' } }, h('summary', `Allergies et intolérances ${v.allergens.length ? `(${v.allergens.length})` : ''}`),
        h('p.muted', 'Exclusion stricte, pour tout le repas si la personne est présente.'),
        h('div.checks', Object.entries(ALLERGENS).map(([k, l]) => toggle(v.allergens.includes(k), (on) => { v.allergens = on ? [...new Set([...v.allergens, k])] : v.allergens.filter((x) => x !== k); }, l))),
        field('Autre allergie ou intolérance', input({ type: 'text', value: v.allergenFree, placeholder: 'ex. kiwi, fraise', oninput: (e) => { v.allergenFree = e.target.value; } }), 'Séparées par des virgules, exclusion stricte')));
      root.append(field('Aliments détestés', input({ type: 'text', value: (v.hated || []).join(', '), placeholder: 'coriandre, chou-fleur', oninput: (e) => { v.hated = e.target.value.split(',').map((x) => x.trim()).filter(Boolean); } }), 'Évités, ou recette proposée sans l’ingrédient pour cette personne'));
      root.append(toggle(v.snacks, (on) => { v.snacks = on; }, 'Planifier des collations pour cette personne'));
      // grille de présence
      const grid = h('div.grid-presence', h('b'), ...['petit-dej', 'diner', 'souper'].map((m) => h('small.center', MEALS[m].label.replace('Petit-déjeuner', 'Petit-déj'))));
      for (const d of DAYS) {
        grid.append(h('span', DAY_LABELS[d].slice(0, 3)));
        for (const m of ['petit-dej', 'diner', 'souper']) grid.append(h('input', { type: 'checkbox', checked: v.presence?.[d]?.[m] !== false, 'aria-label': `${DAY_LABELS[d]} ${MEALS[m].label}`, onchange: (e) => { v.presence[d] = { ...(v.presence[d] ?? {}), [m]: e.target.checked }; if (e.target.checked && Object.values(v.presence[d]).every((x) => x)) delete v.presence[d]; } }));
      }
      root.append(h('div.field', h('span.lbl', 'Présence aux repas'), h('small.muted', 'Décoche les repas où la personne est absente (ex. midi en semaine).'), grid));
      return root;
    },
    footer: (close) => [
      !isNew && h('button.btn', { onclick: async () => { if (await confirmSheet({ title: `Supprimer ${v.name} ?`, text: 'Le profil est retiré du foyer ; les portions sont recalculées.', ok: 'Supprimer', danger: true })) { St.del('profiles', v.id); A.refreshShopping(A.currentWeek(), true); close(); } } }, 'Supprimer'),
      h('button.btn.primary', { onclick: () => {
        if (!v.name.trim()) return toast('Le prénom est obligatoire');
        St.put('profiles', { ...v, name: v.name.trim() });
        A.refreshShopping(A.currentWeek(), true);
        close(); onSaved?.();
      } }, 'Enregistrer'),
    ].filter(Boolean),
  });
}

return { renderFoyer, profileSheet };
})();

// ---- site/src/screens/stock.js
__M["site/src/screens/stock.js"] = (() => {
const St = __M["site/src/store.js"];
const A = __M["site/src/actions.js"];
const { h, chip, toast, sheet, field, input, select, segmented, clear, parseNum, confirmSheet } = __M["site/src/ui.js"];
const { header, syncBanner } = __M["site/src/common.js"];
const { INGREDIENTS, DEFAULT_BASICS } = __M["shared/ingredients.js"];
const { LOC_LABEL, daysLeft, urgency, estimateUseBy } = __M["shared/stock.js"];
const { fmtQty, todayStr, fmtDM, addDays } = __M["shared/util.js"];

let tab = 'frigo';
const rerender = () => window.dispatchEvent(new Event('omq:render'));
const TABS = [['placard', '🥫 Placard'], ['frigo', '🧀 Frigo'], ['congelateur', '🧊 Congélateur'], ['restes', '♻️ Restes'], ['basiques', '🧂 Basiques']];

function renderStock(root) {
  const today = todayStr();
  const stock = St.list('stock').filter((s) => s.qty > 0);
  const waste = St.list('waste').filter((w) => w.date >= today.slice(0, 7) + '-01');
  root.append(header('Stock', `${stock.length} article${stock.length > 1 ? 's' : ''} suivi${stock.length > 1 ? 's' : ''}${waste.length ? ` · ${waste.length} jeté${waste.length > 1 ? 's' : ''} ce mois-ci` : ''}`,
    h('div.row', h('button.btn.small', { onclick: () => inventorySheet() }, 'Inventaire'), h('button.btn.small.primary', { onclick: () => stockSheet(null) }, '+'))), syncBanner());

  const settings = St.settings();
  if (!settings.inventoryAt || addDays(settings.inventoryAt, 28) < today) {
    root.append(h('div.card.warn', h('b', settings.inventoryAt ? '🔄 Petit inventaire ?' : '📦 Inventaire de départ'), h('p', settings.inventoryAt ? 'Cela fait plus de 4 semaines : une vérification rapide garde les listes de courses justes.' : 'Facultatif : indique ce que tu as déjà pour des listes plus justes dès la première semaine (sinon le stock démarre vide).'), h('button.btn.small', { onclick: () => inventorySheet() }, 'Faire l’inventaire rapide')));
  }

  root.append(h('div.chip-row', { style: { margin: '12px 0' } }, TABS.map(([k, l]) => h('button.chip-btn' + (tab === k ? '.on' : ''), { onclick: () => { tab = k; rerender(); } }, l))));

  if (tab === 'basiques') return renderBasics(root, settings);

  const list = stock.filter((s) => (tab === 'restes' ? s.kind === 'dish' : s.kind !== 'dish' && s.loc === tab)).sort((a, b) => (a.useBy ?? '9999').localeCompare(b.useBy ?? '9999'));
  if (!list.length) {
    root.append(h('div.empty', h('span.big', tab === 'restes' ? '♻️' : '🧺'), h('p', tab === 'restes' ? 'Pas de restes. Après un « C’est fait », garde des portions ici.' : 'Rien ici pour l’instant : le stock se remplit tout seul quand tu coches « Acheté ».')));
    return;
  }
  root.append(h('div.card.tight', list.map((it) => stockRow(it, today))));
}

function stockRow(it, today) {
  const u = urgency(it, today);
  const d = daysLeft(it, today);
  const when = it.useBy ? (d < 0 ? `périmé depuis ${-d} j` : d === 0 ? 'aujourd’hui' : d === 1 ? 'demain' : `dans ${d} j`) : '';
  return h('div.stock-row',
    h('div', { style: { cursor: 'pointer' }, onclick: () => stockSheet(it) }, h('div.nm', it.name), h('small', `${fmtQty(it.qty, it.unit)}${it.useBy ? ` · avant le ${fmtDM(it.useBy)}` : ''}`), when && h('div', chip(when, u === 'expired' ? 'red' : u === 'soon' ? 'amber' : u === 'warn' ? 'blue' : ''))),
    h('div.row', h('button.btn.small', { onclick: () => stockSheet(it) }, '✏️'), h('button.btn.small', { onclick: () => { A.throwAway(it); toast(`${it.name} jeté`, { undo: () => { St.put('stock', it); const w = St.list('waste').at(-1); if (w) St.del('waste', w.id); } }); }, 'aria-label': 'Jeté' }, '🗑')));
}

function renderBasics(root, settings) {
  const basics = settings.basics ?? DEFAULT_BASICS;
  const low = new Set(settings.lowBasics ?? []);
  root.append(h('div.card.stack',
    h('p', 'Les basiques sont supposés toujours présents : ils ne sont jamais décomptés. Signale « bientôt vide » pour les ajouter à la prochaine liste.'),
    h('button.btn.small', { onclick: () => basicsSheet() }, 'Modifier la liste des basiques')));
  root.append(h('div.card.tight', { style: { marginTop: '12px' } }, basics.map((id) => INGREDIENTS[id]).filter(Boolean).map((ing) =>
    h('div.stock-row', h('div', h('div.nm', ing.name), low.has(ing.id) && chip('bientôt vide → sur la liste', 'amber')),
      h('button.btn.small' + (low.has(ing.id) ? '.primary' : ''), { onclick: () => { A.flagBasicLow(ing.id, !low.has(ing.id)); toast(low.has(ing.id) ? 'Retiré de la liste' : `${ing.name} ajouté à la liste`); } }, low.has(ing.id) ? '✓ Bientôt vide' : 'Bientôt vide')))));
}

function basicsSheet() {
  const set = new Set(St.settings().basics ?? DEFAULT_BASICS);
  sheet({
    title: 'Mes basiques', wide: true,
    body: () => [h('p.muted', 'Coche ce qui est toujours dans tes placards. Le reste sera suivi précisément (quantités et dates).'), h('div.card.tight.checks', Object.values(INGREDIENTS).sort((a, b) => a.name.localeCompare(b.name)).map((ing) => h('label.tog', h('input', { type: 'checkbox', checked: set.has(ing.id), onchange: (e) => (e.target.checked ? set.add(ing.id) : set.delete(ing.id)) }), h('span', ing.name))))],
    footer: (close) => [h('button.btn', { onclick: close }, 'Annuler'), h('button.btn.primary', { onclick: () => { St.saveSettings({ basics: [...set] }); A.refreshShopping(A.currentWeek(), true); close(); } }, 'Enregistrer')],
  });
}

function stockSheet(it) {
  const isNew = !it;
  const v = it ? { ...it } : { ingredientId: '', name: '', qty: '', unit: 'g', loc: tab === 'basiques' || tab === 'restes' ? 'frigo' : tab, useBy: '' };
  sheet({
    title: isNew ? 'Ajouter au stock' : it.name,
    body: () => {
      const root = h('div');
      const ingSel = select([['', '— autre produit —'], ...Object.values(INGREDIENTS).filter((i) => !i.basic).sort((a, b) => a.name.localeCompare(b.name)).map((i) => [i.id, i.name])], v.ingredientId || '', (val) => { v.ingredientId = val; if (val) { const ing = INGREDIENTS[val]; v.name = ing.name; v.unit = ing.unit; v.loc = ing.loc; v.useBy = estimateUseBy(val, todayStr(), ing.loc) ?? ''; unitSel.value = v.unit; locSel.value = v.loc; dateIn.value = v.useBy; nameIn.value = v.name; } });
      const nameIn = input({ type: 'text', value: v.name, placeholder: 'Nom du produit', oninput: (e) => { v.name = e.target.value; } });
      const unitSel = select([['g', 'grammes'], ['ml', 'millilitres'], ['pc', 'pièces'], ['portion', 'portions']], v.unit, (x) => { v.unit = x; });
      const locSel = select(Object.entries(LOC_LABEL), v.loc, (x) => { v.loc = x; });
      const dateIn = input({ type: 'date', value: v.useBy || '', onchange: (e) => { v.useBy = e.target.value || null; } });
      if (isNew) root.append(field('Produit', ingSel), field('Nom', nameIn));
      root.append(
        h('div.row', field('Quantité', input({ type: 'number', inputmode: 'decimal', value: v.qty, onchange: (e) => { v.qty = parseNum(e.target.value) || 0; } })), isNew ? field('Unité', unitSel) : h('small', it.unit === 'pc' ? 'pièces' : it.unit)),
        field('À consommer avant', dateIn, 'Estimé à l’achat, corrige si besoin'),
        field('Où ?', locSel));
      if (!isNew) root.append(h('div.row.wrap', { style: { marginTop: '8px' } },
        h('button.btn', { onclick: () => { A.throwAway(it); toast(`${it.name} jeté`); sheetClose(); } }, '🗑 Jeté'),
        h('button.btn', { onclick: () => { A.updateStock(it, { qty: 0 }); sheetClose(); } }, 'Plus rien (0)')));
      return root;
    },
    footer: (close) => { sheetClose = close; return [h('button.btn', { onclick: close }, 'Annuler'), h('button.btn.primary', { onclick: () => {
      if (isNew) { if (!v.name || !(Number(v.qty) > 0)) return toast('Nom et quantité requis'); A.addStock({ ingredientId: v.ingredientId || null, name: v.name, qty: Number(v.qty), unit: v.unit, loc: v.loc, useBy: v.useBy || null }); }
      else A.updateStock(it, { qty: Number(v.qty), useBy: v.useBy || null, loc: v.loc });
      close();
    } }, 'Enregistrer')]; },
  });
}
let sheetClose = () => {};

// ---------- Inventaire de départ ----------
const INVENTORY = {
  placard: ['pates', 'riz', 'farine', 'flocons-avoine', 'muesli', 'confiture', 'biscuits', 'tomates-concassees', 'sauce-tomate', 'haricots-rouges', 'pois-chiches', 'mais', 'thon-boite', 'lait-coco', 'pomme-de-terre', 'pain'],
  frigo: ['oeufs', 'lait', 'beurre', 'creme', 'yaourt-nature', 'fromage-rape', 'fromage-tranches', 'jambon', 'carotte', 'courgette', 'tomate', 'salade', 'pomme', 'poulet-filet', 'boeuf-hache'],
  congelateur: ['frites', 'legumes-surgeles', 'petits-pois', 'pizza-surgelee', 'poulet-filet', 'boeuf-hache', 'saumon-filet', 'scampis'],
};
const LEVELS = [['0', 'Vide'], ['0.3', 'Un peu'], ['1', 'Plein']];

function inventorySheet() {
  const picks = new Map(); // `${loc}:${id}` → facteur
  sheet({
    title: 'Inventaire rapide', wide: true,
    body: () => {
      const root = h('div.stack');
      root.append(h('p.muted', 'Pour chaque produit : vide, un peu ou plein (tu peux corriger les quantités exactes ensuite). Ne touche pas ce que tu n’as pas.'));
      for (const [loc, ids] of Object.entries(INVENTORY)) {
        root.append(h('div.section-title', LOC_LABEL[loc]), h('div.card.tight', ids.map((id) => {
          const ing = INGREDIENTS[id];
          return h('div.stock-row', h('div.nm', ing.name), segmented(LEVELS, '0', (val) => picks.set(`${loc}:${id}`, Number(val))));
        })));
      }
      return root;
    },
    footer: (close) => [h('button.btn', { onclick: () => { St.saveSettings({ inventoryAt: todayStr() }); close(); } }, 'Passer'), h('button.btn.primary', { onclick: () => {
      let n = 0;
      for (const [k, f] of picks) {
        if (!(f > 0)) continue;
        const [loc, id] = k.split(':');
        const ing = INGREDIENTS[id];
        const pack = ing.packs[0] ?? 1;
        A.addStock({ ingredientId: id, qty: Math.round(pack * f * (ing.unit === 'pc' && f < 1 ? 1 : 1)), loc, useBy: addDays(todayStr(), Math.max(2, Math.round(Math.min(ing.shelf, loc === 'congelateur' ? 90 : 14) * (f < 1 ? 0.5 : 0.8)))) });
        n++;
      }
      St.saveSettings({ inventoryAt: todayStr() });
      toast(n ? `${n} produit${n > 1 ? 's' : ''} ajouté${n > 1 ? 's' : ''} au stock` : 'Stock inchangé');
      close();
    } }, 'Enregistrer')],
  });
}

return { renderStock, stockSheet, inventorySheet };
})();

// ---- site/src/screens/onboarding.js
__M["site/src/screens/onboarding.js"] = (() => {
// Première utilisation : profils → matériel → repas → inventaire (facultatif) → première génération. Moins de 5 minutes.
const St = __M["site/src/store.js"];
const A = __M["site/src/actions.js"];
const { h, chip, toast, sheet, field, input, select, segmented, toggle, clear, parseNum } = __M["site/src/ui.js"];
const { profileSheet } = __M["site/src/screens/foyer.js"];
const { inventorySheet } = __M["site/src/screens/stock.js"];
const { EQUIPMENT, MEALS } = __M["shared/recipes.js"];
const { AGE_CATS } = __M["shared/efsa.js"];
const { coefOf } = __M["shared/rules.js"];
const { fmtNum } = __M["site/src/ui.js"];
const { go } = __M["site/src/common.js"];

function startOnboarding() {
  let step = 0;
  const STEPS = ['Le foyer', 'La cuisine', 'Les repas', 'Le stock', 'C’est parti'];
  let panel;
  const s = sheet({
    title: 'Bienvenue 👋', wide: true,
    onClose: () => {},
    body: () => { panel = h('div'); draw(); return panel; },
  });
  function draw() {
    const settings = St.settings();
    const profiles = St.list('profiles');
    clear(panel);
    panel.append(h('div.wizard-steps', STEPS.map((_, i) => h('i' + (i <= step ? '.on' : ''))), ), h('h2', `${step + 1}. ${STEPS[step]}`));
    const nav = (canNext = true, label = 'Suivant') => h('div.row', { style: { marginTop: '18px' } },
      step > 0 && h('button.btn', { onclick: () => { step--; draw(); } }, 'Retour'),
      h('button.btn.primary.grow', { disabled: !canNext, onclick: () => { step++; draw(); } }, label));

    if (step === 0) {
      panel.append(h('p.muted', 'Chaque personne en moins d’une minute : prénom, âge, sexe — c’est tout ce qu’il faut pour calculer les portions. Le reste est facultatif (allergies, régime, goûts).'));
      const card = h('div.card.tight');
      for (const p of profiles) card.append(h('div.stock-row', h('div', h('b', p.name), h('small', ` ${AGE_CATS[p.ageCat].label}`)), chip(`× ${fmtNum(coefOf(p, settings), 2)}`, 'blue')));
      if (profiles.length) panel.append(card);
      panel.append(h('button.btn.block', { style: { marginTop: '10px' }, onclick: () => profileSheet(null, { onSaved: draw }) }, profiles.length ? '+ Ajouter une autre personne' : '+ Ajouter la première personne'), nav(profiles.length > 0));
    }
    if (step === 1) {
      panel.append(h('p.muted', 'Les recettes qui demandent un appareil que tu n’as pas ne seront jamais proposées.'));
      panel.append(h('div.card', h('div.checks', Object.entries(EQUIPMENT).map(([k, l]) => toggle(!!settings.equipment[k], (v) => St.saveSettings({ equipment: { ...St.settings().equipment, [k]: v } }), l))),
        field('Congélateur', segmented([['aucun', 'Aucun'], ['petit', 'Petit'], ['moyen', 'Moyen'], ['grand', 'Grand']], settings.freezer, (v) => St.saveSettings({ freezer: v }))),
        field('Budget courses par semaine (€)', input({ type: 'number', inputmode: 'decimal', value: settings.budget, onchange: (e) => St.saveSettings({ budget: parseNum(e.target.value) || 0 }) }))));
      panel.append(nav());
    }
    if (step === 2) {
      panel.append(h('div.card', h('div.checks', Object.entries(MEALS).map(([k, m]) => toggle(!!settings.meals[k], (v) => St.saveSettings({ meals: { ...St.settings().meals, [k]: v } }), `${m.emoji} ${m.label}`))),
        toggle(settings.timeRules.semaine.souper === 20, (v) => St.saveSettings({ timeRules: { ...St.settings().timeRules, semaine: { ...St.settings().timeRules.semaine, souper: v ? 20 : null } } }), 'En semaine, souper express (20 min max)')));
      panel.append(h('small.muted', { style: { display: 'block', marginTop: '8px' } }, 'Les absences (ex. midi en semaine) se règlent dans chaque profil.'), nav());
    }
    if (step === 3) {
      panel.append(h('p.muted', 'Facultatif : indique ce que tu as déjà pour des listes justes dès la première semaine. Sans inventaire, le stock démarre vide et se remplit tout seul quand tu coches « Acheté ».'),
        h('button.btn.block', { onclick: () => inventorySheet() }, '📦 Faire l’inventaire rapide'), nav(true, 'Passer / Suivant'));
    }
    if (step === 4) {
      panel.append(h('p', St.list('promos').length ? 'Tout est prêt. L’app planifie les repas autour des promos Delhaize de la semaine et prépare la liste de courses.' : 'Tout est prêt. Les promos Delhaize ne sont pas encore dans la page : le planning utilisera les prix habituels estimés, tu pourras relancer la génération dès qu’elles arrivent.'));
      panel.append(h('button.btn.primary.block', { onclick: async () => {
        St.saveSettings({ onboarded: true });
        toast('Planning en cours…');
        const ws = A.currentWeek();
        setTimeout(() => { A.generatePlan(ws); s.close(); go('semaine'); }, 30);
      } }, '✨ Générer ma première semaine'), h('div.row', { style: { marginTop: '10px' } }, h('button.btn', { onclick: () => { step--; draw(); } }, 'Retour')));
    }
  }
  return s;
}

return { startOnboarding };
})();

// ---- site/src/screens/today.js
__M["site/src/screens/today.js"] = (() => {
const St = __M["site/src/store.js"];
const A = __M["site/src/actions.js"];
const { h, chip, toast } = __M["site/src/ui.js"];
const { header, syncBanner, slotView, mealRow, catChip, go, openSlotSheet, openCookSheet } = __M["site/src/common.js"];
const { MEALS, totalTime } = __M["shared/recipes.js"];
const { fmtDayLong, todayStr, addDays, weekStartFor, fmtDM } = __M["shared/util.js"];
const { expiringSoon, daysLeft } = __M["shared/stock.js"];
const { fmtQty } = __M["shared/util.js"];
const { promoEndingTomorrow } = __M["shared/shopping.js"];
const { startOnboarding } = __M["site/src/screens/onboarding.js"];

const ORDER = ['petit-dej', 'diner', 'souper', 'collation'];

function renderToday(root) {
  const today = todayStr();
  const ws = weekStartFor(today);
  const profiles = St.list('profiles');
  const settings = St.settings();
  root.append(header('Aujourd’hui', fmtDayLong(today)), syncBanner());

  if (!profiles.length && St.S.meta.readOnly) {
    root.append(h('div.empty', h('span.big', '👀'), h('h2', 'Rien à afficher pour l’instant'), h('p', 'Cette page est en lecture seule et ne contient pas encore de profils. La personne qui l’a créée doit d’abord configurer le foyer.')));
    return;
  }
  if (!profiles.length) {
    root.append(h('div.empty', h('span.big', '👋'), h('h2', 'Bienvenue !'), h('p', 'Crée les profils du foyer en moins de 5 minutes, puis l’app planifie tous les repas autour des promos Delhaize.'), h('button.btn.primary', { onclick: () => startOnboarding() }, 'Commencer')));
    return;
  }

  const slots = A.slotsOfWeek(ws);
  const todays = slots.filter((s) => s.date === today).sort((a, b) => ORDER.indexOf(a.meal) - ORDER.indexOf(b.meal));

  // ----- alertes -----
  const alerts = [];
  const soon = expiringSoon(St.list('stock'), today, 2);
  if (soon.length) alerts.push(h('div.card.warn', h('b', `⏳ À utiliser vite (${soon.length})`), h('div', { style: { marginTop: '4px' } }, soon.slice(0, 5).map((s) => h('div', `${s.name} — ${fmtQty(s.qty, s.unit)} · ${daysLeft(s, today) <= 0 ? 'aujourd’hui' : `dans ${daysLeft(s, today)} j`}`)), soon.length > 5 && h('small', `+ ${soon.length - 5} autres`)), h('button.link', { onclick: () => go('stock') }, 'Voir le stock')));
  const ending = promoEndingTomorrow(St.list('shopping').filter((l) => l.week === ws), St.list('promos'), today);
  if (ending.length) alerts.push(h('div.card.warn', h('b', `🏷️ ${ending.length} promo${ending.length > 1 ? 's' : ''} se termine${ending.length > 1 ? 'nt' : ''} demain`), h('div', ending.slice(0, 4).map((l) => h('div', l.name))), h('button.link', { onclick: () => go('courses') }, 'Aller aux courses')));
  const fold = St.list('folders').sort((a, b) => b.slug.localeCompare(a.slug))[0];
  if (!fold || fold.status !== 'ok') alerts.push(h('div.card', h('b', fold ? '⚠️ Folder à vérifier' : 'ℹ️ Pas encore de promos'), h('p.muted', fold?.message ?? 'Les promos Delhaize ne sont pas encore publiées : la lecture automatique a lieu deux fois par jour. Tu peux aussi coller le texte du folder depuis l’écran Semaine.'), h('button.link', { onclick: () => go('semaine') }, 'Ouvrir la Semaine')));
  if (alerts.length) root.append(h('div.stack', alerts));

  if (!slots.length) {
    root.append(h('div.empty', h('span.big', '📅'), h('h2', 'Pas encore de planning'), h('p', 'Génère la semaine en un clic, tu pourras ensuite ajuster chaque repas.'), h('button.btn.primary', { onclick: () => { toast('Planning en cours…'); setTimeout(() => { A.generatePlan(ws); go('semaine'); }, 30); } }, '✨ Générer la semaine')));
    return;
  }

  root.append(h('div.section-title', 'Au menu aujourd’hui'));
  if (!todays.length) root.append(h('div.card.center', h('p', 'Aucun repas planifié aujourd’hui.'), h('button.btn', { onclick: () => go('semaine') }, 'Voir la semaine')));
  for (const s of todays) root.append(mealCard(s));

  // demain
  const tomorrow = slots.filter((s) => s.date === addDays(today, 1) && s.meal === 'souper' && s.recipeId);
  if (tomorrow.length) {
    const v = slotView(tomorrow[0]);
    root.append(h('div.section-title', 'Demain soir'), h('div.card.tight', mealRow(tomorrow[0], () => openSlotSheet(tomorrow[0]))));
  }
}

function mealCard(s) {
  const v = slotView(s);
  const done = s.status === 'done';
  const card = h('div.card.stack' + (done ? '.flat' : ''));
  card.append(h('div.meal' + (done ? '.done' : ''),
    h('div.emoji', done ? '✅' : v.emoji),
    h('div', h('div.slot-lbl', MEALS[s.meal].label), h('div.name', v.name), h('small', v.sub), v.recipe && s.kind === 'recipe' && h('div', { style: { marginTop: '4px' } }, catChip(v.recipe.cat))),
    h('button.icon-btn', { onclick: () => openSlotSheet(s), 'aria-label': 'Options du repas' }, '⋯')));
  if (!done && s.recipeId) {
    card.append(h('div.row.wrap',
      s.kind === 'recipe' && h('button.btn.small', { onclick: () => go(`recette/${s.id}`) }, 'Ouvrir la recette'),
      s.kind === 'recipe' && h('button.btn.small', { onclick: () => { if (!A.anotherIdea(s)) toast('Pas d’autre idée compatible'); } }, '🎲 Autre idée'),
      h('button.btn.small.good.right', { onclick: () => openCookSheet(s) }, '✅ C’est fait')));
  }
  return card;
}

return { renderToday };
})();

// ---- site/src/screens/week.js
__M["site/src/screens/week.js"] = (() => {
const St = __M["site/src/store.js"];
const A = __M["site/src/actions.js"];
const { h, chip, toast, sheet, field, input, select, confirmSheet, clear, parseNum } = __M["site/src/ui.js"];
const { header, syncBanner, mealRow, openSlotSheet, go, catChip } = __M["site/src/common.js"];
const { showKeySheet } = __M["site/src/screens/key.js"];
const { MEALS, CATEGORIES } = __M["shared/recipes.js"];
const { INGREDIENTS } = __M["shared/ingredients.js"];
const { eur, fmtDayShort, fmtDM, addDays, weekDays, folderSlugFor, todayStr, DAY_LABELS, dayKey, fmtQty } = __M["shared/util.js"];
const { shoppingTotals, promoCoverage } = __M["shared/shopping.js"];
const { discountOf, promoIngredient } = __M["shared/pricing.js"];

let offset = 0;
const ORDER = ['petit-dej', 'diner', 'souper', 'collation'];

function renderWeek(root) {
  const base = A.currentWeek();
  const ws = addDays(base, offset * 7);
  const today = todayStr();
  const slots = A.slotsOfWeek(ws);
  const settings = St.settings();
  const slug = folderSlugFor(ws);
  const folder = St.get('folders', slug);
  const promos = St.list('promos').filter((p) => p.folder === slug || (p.validFrom && p.validFrom <= addDays(ws, 6) && p.validTo >= ws));

  root.append(header('Semaine', `du ${fmtDayShort(ws)} au ${fmtDayShort(addDays(ws, 6))}`,
    h('div.row', h('button.icon-btn', { onclick: () => { offset = Math.max(-1, offset - 1); rerender(); }, 'aria-label': 'Semaine précédente', disabled: offset <= -1 }, '‹'), h('button.icon-btn', { onclick: () => { offset = Math.min(1, offset + 1); rerender(); }, 'aria-label': 'Semaine suivante', disabled: offset >= 1 }, '›'))), syncBanner());

  // ----- dossier promos -----
  const fcard = h('div.card.stack');
  const statusChip = !folder ? chip('pas lu', 'amber') : folder.status === 'ok' ? chip(`${folder.count} articles`, 'green') : folder.status === 'pending' ? chip('pas encore en ligne', 'amber') : chip(folder.status === 'incomplete' ? 'à vérifier' : 'erreur', 'red');
  fcard.append(h('div.row', h('b.grow', '🏷️ Folder Delhaize'), statusChip));
  fcard.append(h('small.muted', folder?.validFrom ? `Valable du ${fmtDM(folder.validFrom)} au ${fmtDM(folder.validTo)}` : `Semaine ${slug.slice(0, 3).toUpperCase()}`));
  if (folder?.message) fcard.append(h('div.banner.offline', folder.message));
  fcard.append(h('div.row.wrap',
    h('button.btn.small', { onclick: () => openPromos(ws, promos) }, `Voir les promos (${promos.length})`),
    h('button.btn.small', { onclick: () => refreshFolder(slug, folder) }, '↻ Mettre à jour'),
    h('button.btn.small', { onclick: () => importSheet(slug, ws) }, '✍️ Saisir / importer')));
  root.append(fcard);

  // ----- actions -----
  const hasPlan = slots.length > 0;
  const gen = async () => {
    if (hasPlan && !(await confirmSheet({ title: 'Régénérer la semaine ?', text: 'Les repas déjà faits ou verrouillés sont conservés ; les autres sont remplacés.', ok: 'Régénérer' }))) return;
    toast('Planning en cours…');
    setTimeout(() => { const n = A.generatePlan(ws); toast(`${n} repas planifiés ✨`); }, 30);
  };
  root.append(h('div.row', { style: { marginTop: '12px' } },
    h('button.btn.primary.grow', { onclick: gen }, hasPlan ? '🔄 Régénérer' : '✨ Générer la semaine'),
    hasPlan && h('button.btn.good.grow', { onclick: () => { A.refreshShopping(ws, true); go('courses'); } }, '🛒 Valider → courses')));
  if (!St.list('profiles').length) root.append(h('div.banner.demo', { style: { marginTop: '10px' } }, '👋 Ajoute d’abord les profils du foyer (écran Foyer) pour calculer les portions.'));

  if (!hasPlan) {
    root.append(h('div.empty', h('span.big', '📅'), h('p', 'Aucun planning pour cette semaine.'), !promos.length && h('small', 'Sans promos lues, l’app planifie avec les prix habituels estimés.')));
    return;
  }

  // ----- statistiques -----
  const st = A.stats(ws);
  const lines = St.list('shopping').filter((l) => l.week === ws);
  const tot = shoppingTotals(lines);
  const planned = tot.spent + tot.remaining;
  const budget = settings.budget || 0;
  const cov = promoCoverage(lines);
  const pct = budget ? Math.min(100, (planned / budget) * 100) : 0;
  const over = budget && planned > budget;
  root.append(h('div.card.stack', { style: { marginTop: '12px' } },
    h('div.stats',
      h('div.stat', h('b', eur(planned)), h('small', 'courses estimées')),
      h('div.stat', h('b', `${Math.round((cov.total ? cov.rate : st.promoRate) * 100)} %`), h('small', 'en promo (obj. 80 %)')),
      h('div.stat', h('b', eur(tot.saved || st.saving)), h('small', 'économie promos'))),
    budget > 0 && h('div', h('div.row', h('small', `Budget : ${eur(budget)}`), h('small.right', over ? `dépasse de ${eur(planned - budget)}` : `reste ${eur(budget - planned)}`)), h('div.bar' + (over ? '.over' : pct > 85 ? '.mid' : ''), h('i', { style: { width: `${pct}%` } }))),
    over && h('div.row', h('small.grow', '💡 Le planning dépasse le budget.'), h('button.btn.small', { onclick: () => { const n = A.cheaper(ws); toast(n ? `${n} repas remplacé(s) par des options moins chères` : 'Pas d’alternative moins chère'); } }, 'Proposer moins cher'))));

  // ----- jours -----
  for (const d of weekDays(ws)) {
    const ds = slots.filter((s) => s.date === d).sort((a, b) => ORDER.indexOf(a.meal) - ORDER.indexOf(b.meal));
    if (!ds.length) continue;
    root.append(h('div.day-head' + (d === todayStr() ? '.today' : ''), h('h3', `${DAY_LABELS[dayKey(d)]} ${Number(d.slice(8))}`), d === todayStr() ? chip('aujourd’hui', 'promo') : d < todayStr() ? h('small', 'passé') : ''));
    root.append(h('div.card.tight', { style: d < todayStr() ? { opacity: .6 } : null }, ds.map((s) => mealRow(s, () => openSlotSheet(s)))));
  }
}

const rerender = () => window.dispatchEvent(new Event('omq:render'));

function refreshFolder(slug, folder) {
  sheet({
    title: 'Mettre à jour les promos',
    body: (close) => {
      const P = St.S.meta.promos;
      const upd = P.updatedAt ? new Date(P.updatedAt).toLocaleString('fr-BE', { dateStyle: 'short', timeStyle: 'short' }) : null;
      return [
        h('p', 'Le folder est lu automatiquement deux fois par jour par une tâche GitHub, puis publié (chiffré) sur le site. Cette page recharge les promos publiées.'),
        upd && h('small.muted', `Dernière publication : ${upd}${folder?.count ? ` · ${folder.count} articles pour cette semaine` : ''}.`),
        P.state === 'locked' && h('div.banner.offline', { style: { margin: '10px 0' } }, '🔒 Promos verrouillées : saisis le code du foyer.'),
        h('div.stack', { style: { marginTop: '12px' } },
          h('button.btn.primary.block', { onclick: async () => { toast('Rechargement…', { ms: 2000 }); await St.loadPromos(); toast(St.S.meta.promos.state === 'ok' ? 'Promos à jour ✅' : (St.S.meta.promos.message || 'Promos indisponibles')); close(); } }, '↻ Recharger les promos publiées'),
          h('button.btn.block', { onclick: () => { close(); showKeySheet(); } }, '🔒 Code du foyer')),
        h('p.muted', { style: { marginTop: '12px' } }, 'Pour relire le folder tout de suite : sur GitHub, onglet Actions → « Lecture du folder Delhaize » → Run workflow. Plan B : colle le texte avec « Saisir / importer ».'),
      ];
    },
  });
}

// ---------- Liste des promos ----------
function openPromos(ws, promos) {
  const settings = St.settings();
  sheet({
    wide: true, title: `Promos de la semaine (${promos.length})`,
    body: (close) => {
      const root = h('div.stack');
      const draw = () => {
        clear(root);
        const all = St.list('promos').filter((p) => promos.some((x) => x.id === p.id) || p.manual);
        const withIng = all.filter((p) => promoIngredient(p, St.settings()));
        const toCheck = withIng.filter((p) => p.confidence !== 'high');
        const good = withIng.filter((p) => p.confidence === 'high');
        const other = all.filter((p) => !promoIngredient(p, St.settings()));
        root.append(h('div.row.wrap', h('button.btn.small', { onclick: () => editPromoSheet(null, ws, draw) }, '+ Ajouter une promo'), h('small.muted', 'Les produits sont rattachés à un ingrédient générique ; corrige ici si besoin.')));
        const section = (title, list, cls = '') => {
          if (!list.length) return;
          root.append(h('div.section-title', title, h('span.count', list.length)));
          root.append(h('div.card.tight' + cls, list.sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((p) => promoRow(p, draw))));
        };
        section('À vérifier (prix ou mécanique incertains)', toCheck, '.warn');
        section('Utilisables pour tes repas', good);
        section('Non rattachées à un ingrédient', other);
      };
      draw();
      return root;
    },
  });
}

function promoRow(p, redraw) {
  const ing = promoIngredient(p, St.settings());
  const price = p.promo != null ? `${eur(p.promo / (p.n || 1))}${p.n > 1 ? ' pièce' : ''}` : 'prix ?';
  return h('div.stock-row', { style: { cursor: 'pointer' }, onclick: () => editPromoSheet(p, null, redraw) },
    h('div', h('div.nm', `${p.brand ? p.brand.split(',')[0] + ' · ' : ''}${p.name}`.slice(0, 90)), h('small', [p.format ? fmtQty(p.format.qty, p.format.unit) : p.basis ? `au ${p.basis}` : 'format ?', ing ? ` → ${INGREDIENTS[ing]?.name}` : ' → ?', p.validFrom && p.validFrom === p.validTo ? ` · le ${fmtDM(p.validFrom)} seulement` : ''].join(''))),
    h('div', { style: { textAlign: 'right' } }, h('b', price), h('div', p.mechanic ? chip(p.mechanic, 'promo') : '', p.confidence !== 'high' ? chip('?', 'amber') : '')));
}

const ING_OPTIONS = () => [['', '— aucun —'], ...Object.values(INGREDIENTS).filter((i) => !i.basic).sort((a, b) => a.name.localeCompare(b.name)).map((i) => [i.id, i.name])];

function editPromoSheet(p, ws, after) {
  const cur = p ?? { name: '', brand: '', n: 1, normal: null, promo: null, format: null, mechanic: '' };
  const f = { ing: p ? promoIngredient(p, St.settings()) || '' : '', name: cur.name, n: cur.n || 1, normal: cur.normal, promo: cur.promo, qty: cur.format?.qty ?? '', unit: cur.format?.unit ?? 'g', mechanic: cur.mechanic ?? '' };
  sheet({
    title: p ? 'Corriger la promo' : 'Ajouter une promo',
    body: () => [
      field('Produit', input({ type: 'text', value: f.name, oninput: (e) => { f.name = e.target.value; } })),
      field('Ingrédient correspondant', select(ING_OPTIONS(), f.ing, (v) => { f.ing = v; }), 'Mémorisé pour les prochains folders'),
      h('div.row', field('Prix normal (total)', input({ type: 'number', inputmode: 'decimal', step: '0.01', value: f.normal ?? '', onchange: (e) => { f.normal = parseNum(e.target.value) || null; } })), field('Prix promo (total)', input({ type: 'number', inputmode: 'decimal', step: '0.01', value: f.promo ?? '', onchange: (e) => { f.promo = parseNum(e.target.value) || null; } }))),
      h('div.row', field('Pour combien d’articles', input({ type: 'number', min: '1', value: f.n, onchange: (e) => { f.n = Math.max(1, parseInt(e.target.value) || 1); } })), field('Format d’un article', input({ type: 'number', inputmode: 'decimal', value: f.qty, onchange: (e) => { f.qty = parseNum(e.target.value) || ''; } })), field('Unité', select([['g', 'g'], ['ml', 'ml'], ['pc', 'pièces']], f.unit, (v) => { f.unit = v; }))),
      field('Mécanique', input({ type: 'text', value: f.mechanic, placeholder: '1+1 gratis, −30 %…', oninput: (e) => { f.mechanic = e.target.value; } })),
    ],
    footer: (close) => [
      p && h('button.btn', { onclick: () => { St.del('promos', p.id); A.refreshShopping(A.currentWeek(), true); close(); after?.(); } }, 'Supprimer'),
      h('button.btn.primary', { onclick: () => {
        const fields = { name: f.name || 'Produit', n: f.n, normal: f.normal, promo: f.promo, format: f.qty ? { qty: Number(f.qty), unit: f.unit } : null, mechanic: f.mechanic || null };
        if (p) { A.editPromo(p, fields); A.setPromoIngredient(St.get('promos', p.id), f.ing || null); } else { A.addPromo({ ...fields, ingredientId: f.ing || null, rayon: INGREDIENTS[f.ing]?.rayon ?? 'autre' }, ws); }
        close(); after?.();
      } }, 'Enregistrer'),
    ].filter(Boolean),
  });
}

// ---------- Import manuel (plan B) ----------
function importSheet(slug, ws) {
  const v = { text: '', from: ws, to: addDays(ws, 6) };
  sheet({
    title: 'Saisir / importer le folder',
    body: () => [
      h('p.muted', 'Si la lecture automatique échoue : colle ici le texte du folder (copié depuis delhaize.be ou le PDF). Tu peux aussi ajouter les promos une par une depuis « Voir les promos ».'),
      h('div.row', field('Du', input({ type: 'date', value: v.from, onchange: (e) => { v.from = e.target.value; } })), field('Au', input({ type: 'date', value: v.to, onchange: (e) => { v.to = e.target.value; } }))),
      field('Texte du folder', h('textarea', { placeholder: 'DELHAIZE\nFilet de poulet\n600 g\n9,99 6,99', oninput: (e) => { v.text = e.target.value; } })),
    ],
    footer: (close) => [h('button.btn', { onclick: close }, 'Annuler'), h('button.btn.primary', { onclick: async () => {
      if (!v.text.trim()) return toast('Colle d’abord du texte');
      const n = A.importFolderText({ slug, from: v.from, to: v.to, text: v.text });
      if (!n) return toast('Aucun article reconnu dans ce texte');
      toast(`${n} articles importés`); close();
    } }, 'Importer')],
  });
}

return { renderWeek };
})();

// ---- site/src/screens/shop.js
__M["site/src/screens/shop.js"] = (() => {
const St = __M["site/src/store.js"];
const A = __M["site/src/actions.js"];
const { h, chip, toast, sheet, field, input, select, confirmSheet, clear, parseNum } = __M["site/src/ui.js"];
const { header, syncBanner, go, refuseSheet } = __M["site/src/common.js"];
const { RAYONS, RAYON_ICON, INGREDIENTS } = __M["shared/ingredients.js"];
const { eur, fmtQty, fmtDayShort, todayStr, addDays, diffDays, fmtDM } = __M["shared/util.js"];
const { shoppingTotals, promoCoverage, lineCost } = __M["shared/shopping.js"];

const view = { mode: 'all', days: 3, picked: new Set(), cartOpen: false };
const rerender = () => window.dispatchEvent(new Event('omq:render'));

const qtyText = (l) => (l.kind === 'manual' ? l.qtyText || '' : `${l.packs > 1 ? `${l.packs} × ` : ''}${fmtQty(l.size, l.unit)}`);

function renderShop(root) {
  const ws = A.currentWeek();
  const today = todayStr();
  const all = St.list('shopping').filter((l) => l.week === ws);
  const slots = A.slotsOfWeek(ws);
  const settings = St.settings();
  const wk = A.weekRecord(ws);
  root.append(header('Courses', `semaine du ${fmtDayShort(ws)} · passage n° ${wk.passage ?? 1}`,
    h('button.btn.small', { onclick: () => recapSheet(ws) }, '📊 Récap')), syncBanner());

  if (!slots.length && !all.length) {
    root.append(h('div.empty', h('span.big', '🛒'), h('p', 'La liste de courses se génère à partir du planning.'), h('button.btn.primary', { onclick: () => go('semaine') }, 'Planifier la semaine')),
      h('button.btn.block', { onclick: () => manualSheet(ws) }, '+ Ajouter un article'));
    return;
  }

  // ----- filtres -----
  const chips = h('div.chip-row', { style: { margin: '4px 0 10px' } });
  const setMode = (m, d) => { view.mode = m; if (d) view.days = d; rerender(); };
  chips.append(
    h('button.chip-btn' + (view.mode === 'all' ? '.on' : ''), { onclick: () => setMode('all') }, 'Tout'),
    ...[2, 3, 5].map((d) => h('button.chip-btn' + (view.mode === 'days' && view.days === d ? '.on' : ''), { onclick: () => setMode('days', d) }, `${d} jours`)),
    h('button.chip-btn' + (view.mode === 'pick' ? '.on' : ''), { onclick: () => pickSheet(all) }, view.mode === 'pick' ? `✓ Sélection (${view.picked.size})` : '☑︎ Choisir…'));
  root.append(chips);

  const open = all.filter((l) => !l.checked && !l.refused);
  const visible = open.filter((l) => {
    if (view.mode === 'days') return !l.firstDate || diffDays(today, l.firstDate) < view.days || l.kind !== 'auto';
    if (view.mode === 'pick') return view.picked.has(l.id);
    return true;
  });

  // ----- lignes par rayon -----
  if (!visible.length) root.append(h('div.empty', h('span.big', '🎉'), h('p', open.length ? 'Rien à acheter pour cette sélection.' : 'Tout est acheté !')));
  for (const [rk, rl, ri] of RAYONS) {
    const ls = visible.filter((l) => (l.rayon ?? 'autre') === rk).sort((a, b) => a.name.localeCompare(b.name));
    if (!ls.length) continue;
    root.append(h('div.section-title', `${ri} ${rl}`, h('span.count', ls.length)), h('div.card.tight', ls.map((l) => lineRow(l))));
  }

  // ----- achetés -----
  const bought = all.filter((l) => l.checked);
  if (bought.length) {
    root.append(h('details.card', { style: { marginTop: '18px' }, open: view.cartOpen, ontoggle: (e) => { view.cartOpen = e.target.open; } },
      h('summary', `✅ Déjà acheté (${bought.length})`), h('div', { style: { marginTop: '8px' } }, bought.sort((a, b) => (b.boughtAt || '').localeCompare(a.boughtAt || '')).map((l) => lineRow(l)))));
  }

  // ----- achats stratégiques (bonus) -----
  const strat = A.strategic(ws);
  if (strat.length) {
    root.append(h('div.section-title', '🎯 Achats stratégiques', h('span.count', strat.length)),
      h('div.card.tight', h('small.muted', { style: { display: 'block', padding: '4px 0 6px' } }, `Promos de cette semaine utiles à la semaine prochaine (économie ≥ ${settings.strategicThreshold} %, produits qui se gardent ou se congèlent). Décochés par défaut.`), strat.map((l) => lineRow(l, true))));
  }

  root.append(h('button.btn.block', { style: { marginTop: '16px' }, onclick: () => manualSheet(ws) }, '+ Ajouter un article'));

  // ----- totaux -----
  const t = shoppingTotals(all, { passage: wk.passage ?? 1 });
  const cov = promoCoverage(all);
  const planned = t.spent + t.remaining;
  const spent = wk.spentOverride ?? t.spent;
  root.append(h('div.card.totals.stack', { style: { boxShadow: '0 -4px 18px rgba(0,0,0,.12)' } },
    h('div.stats',
      h('div.stat', h('b', eur(t.inBasket)), h('small', 'dans le panier')),
      h('div.stat', h('b', eur(t.remaining)), h('small', 'reste à acheter')),
      h('div.stat', h('b', eur(t.saved)), h('small', 'économies'))),
    h('div.row.wrap', h('small.grow', `${Math.round(cov.rate * 100)} % des articles en promo`, settings.budget ? ` · budget ${eur(settings.budget)} (prévu ${eur(planned)})` : ''),
      t.countBought > 0 && h('button.btn.small', { onclick: () => { A.endPassage(ws); toast('Passage terminé — le prochain démarre à zéro'); } }, 'Terminer ce passage'))));
}

function lineRow(l, strategic = false) {
  const done = !!l.checked;
  const price = lineCost(l);
  const sub = [];
  if (l.kind === 'auto' && l.recipes?.length) sub.push(l.recipes.slice(0, 2).join(', ') + (l.recipes.length > 2 ? ` +${l.recipes.length - 2}` : ''));
  if (strategic && l.useOn) sub.push(`prévu le ${fmtDM(l.useOn)}${l.needsFreezer ? ' · à congeler' : ''}`);
  if (l.extraForPromo) sub.push(`dont ${l.extraForPromo} en plus pour la promo (stock)`);
  if (l.kind === 'basic') sub.push('basique bientôt vide');
  const cb = h('input.cb', { type: 'checkbox', checked: done, 'aria-label': `${l.name} acheté`, onchange: (e) => {
    if (e.target.checked) { A.markBought(St.get('shopping', l.id) ?? l); if (strategic) St.patch('shopping', l.id, { strategic: true }); } else A.unbuy(St.get('shopping', l.id));
  } });
  return h('div.shop-line' + (done ? '.done' : ''), cb,
    h('div', { style: { cursor: 'pointer' }, onclick: () => lineSheet(St.get('shopping', l.id) ?? l, strategic) },
      h('div.nm', l.name), h('div.sub', qtyText(l), done && l.actualQty && l.actualQty !== l.qty ? ` → acheté ${fmtQty(l.actualQty, l.unit)}` : ''), sub.length > 0 && h('div.sub', sub.join(' · ')), l.mechanic && h('div', chip(l.mechanic, 'promo'))),
    h('div.price', eur(price), l.saving > 0 && !done ? h('small', { style: { color: 'var(--green)' } }, `−${eur(l.saving)}`) : ''));
}

function lineSheet(l, strategic) {
  sheet({
    title: l.name,
    body: (close) => {
      const root = h('div.stack');
      root.append(h('div.card.stack',
        h('div.row', h('b.grow', qtyText(l)), h('b', eur(lineCost(l)))),
        l.mechanic && h('div', chip(l.mechanic, 'promo'), l.minQty > 1 && h('small', ` dès ${l.minQty} articles`)),
        l.kind === 'auto' && l.need ? h('small.muted', `Besoin du planning : ${fmtQty(l.need, l.unit)}${l.packs ? ` · arrondi au format vendu` : ''}`) : '',
        l.recipes?.length ? h('small', `Pour : ${l.recipes.join(', ')}`) : ''));
      if (l.checked) {
        root.append(h('button.btn.block', { onclick: () => { A.unbuy(l); close(); } }, '↩︎ Pas encore acheté'));
        return root;
      }
      root.append(h('button.btn.block.good', { onclick: () => { close(); A.markBought(l); } }, '✅ Acheté'));
      if (l.extraForPromo) root.append(h('button.btn.block', { onclick: () => { A.setNoExtra(l, true); close(); toast('Quantité réduite au nécessaire'); } }, `Acheter seulement le nécessaire (sans ${l.extraForPromo} en plus pour la promo)`));
      if (l.noExtra && l.minQty > 1) root.append(h('button.btn.block', { onclick: () => { A.setNoExtra(l, false); close(); } }, `Profiter de la promo (dès ${l.minQty} articles)`));
      if (l.kind !== 'manual') root.append(h('button.btn.block', { onclick: () => { close(); boughtDiffSheet(l); } }, '✏️ Acheté différemment (autre quantité / prix)'));
      if (l.kind === 'auto' && l.ingredientId && !strategic) {
        root.append(h('button.btn.block', { onclick: () => {
          const slot = A.slotsUsing(l.week, l.ingredientId)[0];
          close();
          if (slot) refuseSheet(slot, null, l.ingredientId);
          else { St.put('shopping', { ...l, refused: true }); toast('Article retiré de la liste'); }
        } }, '🙅 Je n’en veux pas…'));
      }
      if (l.kind === 'manual' || l.kind === 'basic') root.append(h('button.btn.block', { onclick: () => { St.del('shopping', l.id); if (l.kind === 'basic') A.flagBasicLow(l.ingredientId, false); close(); } }, '🗑 Retirer de la liste'));
      return root;
    },
  });
}

function boughtDiffSheet(l) {
  const v = { qty: l.qty, price: l.price };
  sheet({
    title: 'Acheté différemment',
    body: () => [
      h('p.muted', `Prévu : ${qtyText(l)} pour ${eur(l.price)}. Indique ce que tu as vraiment pris : le stock sera mis à jour avec la quantité réelle.`),
      h('div.row', field(`Quantité réelle (${l.unit === 'pc' ? 'pièces' : l.unit})`, input({ type: 'number', inputmode: 'decimal', value: String(l.qty), onchange: (e) => { v.qty = parseNum(e.target.value) || 0; } })), field('Prix payé (€)', input({ type: 'number', inputmode: 'decimal', step: '0.01', value: String(l.price), onchange: (e) => { v.price = parseNum(e.target.value) || 0; } }))),
    ],
    footer: (close) => [h('button.btn', { onclick: close }, 'Annuler'), h('button.btn.good', { onclick: () => { A.markBought(l, { qty: v.qty, price: v.price }); close(); } }, 'Valider')],
  });
}

function pickSheet(all) {
  const open = all.filter((l) => !l.checked && !l.refused);
  const sel = new Set(view.picked.size ? view.picked : open.map((l) => l.id));
  sheet({
    title: 'Mon passage', wide: true,
    body: () => [
      h('p.muted', 'Coche ce que tu achètes à ce passage : le reste reste sur la liste.'),
      h('div.card.tight', open.sort((a, b) => a.name.localeCompare(b.name)).map((l) => h('label.tog', h('input', { type: 'checkbox', checked: sel.has(l.id), onchange: (e) => (e.target.checked ? sel.add(l.id) : sel.delete(l.id)) }), h('span.grow', l.name), h('small', qtyText(l))))),
    ],
    footer: (close) => [h('button.btn', { onclick: () => { view.mode = 'all'; view.picked = new Set(); close(); rerender(); } }, 'Tout afficher'), h('button.btn.primary', { onclick: () => { view.mode = 'pick'; view.picked = sel; close(); rerender(); } }, 'Afficher la sélection')],
  });
}

function manualSheet(ws) {
  const v = { name: '', qty: '', price: '', rayon: 'maison' };
  sheet({
    title: 'Ajouter un article',
    body: () => [
      h('p.muted', 'Article hors planning (papier toilette…) : sans effet sur les recettes ni le stock.'),
      field('Article', input({ type: 'text', placeholder: 'Papier toilette', oninput: (e) => { v.name = e.target.value; } })),
      h('div.row', field('Quantité', input({ type: 'text', placeholder: '1 pack', oninput: (e) => { v.qty = e.target.value; } })), field('Prix estimé (€)', input({ type: 'number', inputmode: 'decimal', step: '0.01', oninput: (e) => { v.price = e.target.value; } }))),
      field('Rayon', select(RAYONS.map(([k, l]) => [k, l]), v.rayon, (x) => { v.rayon = x; })),
    ],
    footer: (close) => [h('button.btn', { onclick: close }, 'Annuler'), h('button.btn.primary', { onclick: () => { if (!v.name.trim()) return toast('Donne un nom à l’article'); A.addManualLine(ws, { name: v.name.trim(), qty: v.qty, price: parseNum(v.price) || 0, rayon: v.rayon }); close(); } }, 'Ajouter')],
  });
}

function recapSheet(ws) {
  const lines = St.list('shopping').filter((l) => l.week === ws);
  const t = shoppingTotals(lines);
  const wk = A.weekRecord(ws);
  const settings = St.settings();
  const spent = wk.spentOverride ?? t.spent;
  const waste = St.list('waste').filter((w) => w.date >= ws && w.date <= addDays(ws, 6));
  const cov = promoCoverage(lines);
  sheet({
    title: 'Récap de la semaine',
    body: (close) => [
      h('div.stats',
        h('div.stat', h('b', eur(spent)), h('small', 'dépensé')),
        h('div.stat', h('b', eur(t.saved)), h('small', 'économisé (promos)')),
        h('div.stat', h('b', `${Math.round(cov.rate * 100)} %`), h('small', 'articles en promo'))),
      h('div.card', { style: { marginTop: '12px' } },
        h('div.row', h('span.grow', 'Budget hebdomadaire'), h('b', eur(settings.budget))),
        h('div.row', h('span.grow', 'Articles achetés'), h('b', t.countBought)),
        h('div.row', h('span.grow', 'Produits jetés'), h('b', waste.length))),
      field('Total réel du ticket (€)', input({ type: 'number', inputmode: 'decimal', step: '0.01', placeholder: String(t.spent), value: wk.spentOverride ?? '', onchange: (e) => { const x = parseNum(e.target.value); A.setSpentOverride(ws, Number.isFinite(x) ? x : null); toast('Dépense mise à jour'); } }), 'Remplace la somme des articles cochés si tu préfères saisir le total du ticket'),
    ],
  });
}

return { renderShop };
})();

// ---- site/src/screens/recipe.js
__M["site/src/screens/recipe.js"] = (() => {
const St = __M["site/src/store.js"];
const A = __M["site/src/actions.js"];
const { h, chip, toast, clear } = __M["site/src/ui.js"];
const { header, syncBanner, catChip, go, openCookSheet, openSlotSheet, reportRecipe, slotView } = __M["site/src/common.js"];
const { CATEGORIES, EQUIPMENT, MEALS, totalTime } = __M["shared/recipes.js"];
const { INGREDIENTS, ALLERGENS } = __M["shared/ingredients.js"];
const { derivedTags, allergensOf } = __M["shared/rules.js"];
const { linesCost } = __M["shared/planner.js"];
const { fmtQty, eur, todayStr, fmtDayShort, uniq } = __M["shared/util.js"];
const { stockQty } = __M["shared/stock.js"];

const cook = { key: null, on: false, step: 0, wake: null };
const timers = new Map(); // `${key}:${step}` → { total, endAt, left, running }
let ticker = null;
const rerender = () => window.dispatchEvent(new Event('omq:render'));
const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.max(0, Math.round(s % 60))).padStart(2, '0')}`;

function beep() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.35, 0.7].forEach((t) => { const o = ac.createOscillator(); const g = ac.createGain(); o.connect(g); g.connect(ac.destination); o.frequency.value = 880; g.gain.setValueAtTime(0.25, ac.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + t + 0.3); o.start(ac.currentTime + t); o.stop(ac.currentTime + t + 0.3); });
  } catch { /* audio indisponible */ }
  navigator.vibrate?.([300, 150, 300]);
}
function tick() {
  let any = false;
  for (const [k, t] of timers) {
    if (!t.running) continue;
    any = true;
    t.left = Math.max(0, (t.endAt - Date.now()) / 1000);
    const el = document.getElementById(`tm-${k.replace(/[^a-z0-9]/gi, '_')}`);
    if (el) el.textContent = mmss(t.left);
    if (t.left <= 0) {
      t.running = false; t.done = true;
      beep();
      toast('⏰ Minuteur terminé !', { ms: 8000 });
      rerender();
    }
  }
  if (!any) { clearInterval(ticker); ticker = null; }
}
const startTimer = (key, minutes) => {
  const t = timers.get(key) ?? { total: minutes * 60, left: minutes * 60, running: false };
  if (t.done) { t.left = t.total; t.done = false; }
  t.endAt = Date.now() + t.left * 1000; t.running = true;
  timers.set(key, t);
  if (!ticker) ticker = setInterval(tick, 250);
  rerender();
};
const pauseTimer = (key) => { const t = timers.get(key); if (t) { t.left = Math.max(0, (t.endAt - Date.now()) / 1000); t.running = false; rerender(); } };
const resetTimer = (key, minutes) => { timers.set(key, { total: minutes * 60, left: minutes * 60, running: false }); rerender(); };

async function setWake(on) {
  try {
    if (on && 'wakeLock' in navigator) cook.wake = await navigator.wakeLock.request('screen');
    else { await cook.wake?.release(); cook.wake = null; }
  } catch { /* refusé : pas grave */ }
}
document.addEventListener('visibilitychange', () => { if (cook.on && !document.hidden && !cook.wake) setWake(true); });

function resolveTarget(param) {
  const today = todayStr();
  if (param?.startsWith('r~')) {
    const recipe = A.recipeById(param.slice(2));
    if (!recipe) return null;
    return { slot: { id: 'preview', date: today, meal: recipe.meals[0], kind: 'recipe', recipeId: recipe.id, guests: 0, over: {}, resolved: {}, dropped: [], batch: 1 }, preview: true };
  }
  if (param) { const slot = St.get('plan', param); return slot ? { slot } : null; }
  const slots = A.slotsOfWeek(A.currentWeek()).filter((s) => s.kind === 'recipe' && s.recipeId && s.status !== 'done');
  const pick = slots.find((s) => s.date === today && s.meal === 'souper') ?? slots.find((s) => s.date === today) ?? slots.find((s) => s.date > today);
  return pick ? { slot: pick } : null;
}

function renderRecipe(root, param) {
  const target = resolveTarget(param);
  if (!target) {
    root.append(header('Recette'), syncBanner(), h('div.empty', h('span.big', '👩‍🍳'), h('h2', 'Aucune recette en cours'), h('p', 'Ouvre un repas depuis Aujourd’hui ou la Semaine.'), h('button.btn.primary', { onclick: () => go('aujourdhui') }, 'Voir aujourd’hui')));
    return;
  }
  const { slot, preview } = target;
  if (slot.kind === 'leftover' || !slot.recipeId) { root.append(header('Recette'), h('div.empty', 'Ce repas n’a pas de recette à cuisiner.')); return; }
  const e = A.evalFor(slot);
  if (!e) { root.append(header('Recette'), h('div.empty', 'Recette introuvable.')); return; }
  const { recipe, ev, ctx } = e;
  const key = slot.id + ':' + recipe.id;
  if (cook.key !== key) { cook.key = key; cook.on = false; cook.step = 0; }
  const portions = ev.info.portions;
  const cost = linesCost(ev.lines, ctx);
  const steps = recipe.steps.map((s) => (Array.isArray(s) ? { t: s[0], min: s[1] } : { t: s }));

  if (cook.on) return renderCooking(root, { slot, recipe, steps, preview });

  root.append(header('Recette', preview ? 'aperçu' : `${fmtDayShort(slot.date)} · ${MEALS[slot.meal].label}`,
    h('button.icon-btn', { onclick: () => go('aujourdhui'), 'aria-label': 'Retour' }, '←')), syncBanner());
  root.append(h('div.hero', h('div.big', recipe.emoji), h('h1', recipe.name),
    h('div.chip-row', { style: { justifyContent: 'center', marginTop: '8px' } }, catChip(recipe.cat), ...derivedTags(recipe, ev.lines.filter((l) => !l.dropped).map((l) => l.ing)).filter((t) => ['vegetarien', 'vegetalien', 'pesco', 'enfants', 'emporter', 'sans-four', 'apero'].includes(t)).map((t) => chip(TAG[t] ?? t, 'green')))));
  root.append(h('div.stats', { style: { margin: '10px 0' } },
    h('div.stat', h('b', `${recipe.prep} min`), h('small', 'préparation')),
    h('div.stat', h('b', `${recipe.cook} min`), h('small', 'cuisson')),
    h('div.stat', h('b', `${totalTime(recipe)} min`), h('small', `total · ${recipe.diff}`))));

  root.append(h('div.card.row', h('div.grow', h('b', `${ev.info.couverts} couvert${ev.info.couverts > 1 ? 's' : ''}`), h('div', h('small', `${ev.info.people.map((p) => p.name || '—').join(', ')}${ev.info.guests ? ` + ${ev.info.guests} invité${ev.info.guests > 1 ? 's' : ''}` : ''}`))),
    h('div', { style: { textAlign: 'right' } }, h('b', eur(cost.cost)), h('div', h('small', `${eur(cost.cost / Math.max(1, ev.info.couverts))} / personne`)))));
  if (!ev.ok) root.append(h('div.card.bad', h('b', '⛔ Incompatible avec une personne présente'), ev.reasons.map((r) => h('div', r))));
  if (ev.hated?.length) root.append(h('div.card.warn', ev.hated.map((x) => h('div', `😬 ${x.who || 'Quelqu’un'} n’aime pas : ${INGREDIENTS[x.ing]?.name}`))));
  if (slot.batch > 1) root.append(h('div.banner.demo', { style: { marginTop: '10px' } }, `🍲 Batch cooking : quantités ×${slot.batch} — il restera ${Math.round((slot.batch - 1) * portions * 2) / 2} portions pour le repas suivant ou le congélateur.`));

  // ----- ingrédients -----
  const stock = St.list('stock');
  root.append(h('div.section-title', 'Ingrédients'));
  const card = h('div.card');
  for (const l of ev.lines) {
    const ing = INGREDIENTS[l.ing];
    const have = stockQty(stock, l.ing, slot.date);
    const promo = ctx.promoIdx.get(l.ing);
    let status;
    if (l.basic) status = chip('basique');
    else if (have >= l.q) status = chip('en stock', 'green');
    else if (have > 0) status = chip(`stock partiel (${fmtQty(have, l.unit)})`, 'blue');
    else if (promo) status = chip(`en promo${promo.mechanic ? ' · ' + promo.mechanic : ''}`, 'promo');
    else status = chip('à acheter hors promo', 'amber');
    card.append(h('div.ing' + (l.dropped ? '.dropped' : ''), h('div', h('b', ing.name), l.opt && h('small', ' (facultatif)'), h('div', status)), h('div.q', l.basic ? 'au goût' : fmtQty(l.q, l.unit))));
  }
  root.append(card);

  const eq = recipe.eq.map((x) => (Array.isArray(x) ? x.map((k) => EQUIPMENT[k]).join(' ou ') : EQUIPMENT[x])).filter(Boolean);
  const alls = allergensOf(ev.lines.filter((l) => !l.dropped).map((l) => l.ing));
  root.append(h('div.card.stack', { style: { marginTop: '12px' } },
    eq.length > 0 && h('div', h('b', 'Matériel : '), eq.join(' · ')),
    recipe.keep && h('div', h('b', 'Restes : '), recipe.keep),
    alls.length > 0 && h('div', h('b', 'Contient : '), alls.map((a) => ALLERGENS[a]).join(', '), h('div', h('small.muted', 'Pense à vérifier les étiquettes des produits.')))));

  // ----- étapes -----
  root.append(h('div.section-title', 'Préparation'));
  root.append(h('div.card', steps.map((s, i) => h('div.step', h('div.n', i + 1), h('div', s.t, s.min ? h('div', chip(`⏱ ${s.min} min`, 'blue')) : '')))));

  root.append(h('div.stack', { style: { marginTop: '16px' } },
    h('button.btn.primary.block', { onclick: () => { cook.on = true; cook.step = 0; setWake(true); rerender(); } }, '👩‍🍳 Commencer à cuisiner'),
    !preview && slot.status !== 'done' && h('button.btn.good.block', { onclick: () => openCookSheet(slot) }, '✅ C’est fait'),
    !preview && h('button.btn.block', { onclick: () => openSlotSheet(slot) }, '⋯ Options du repas'),
    h('button.btn.ghost.block', { onclick: () => reportRecipe(recipe) }, '🚩 Signaler un problème')));
}

const TAG = { vegetarien: 'végétarien', vegetalien: 'végétalien', pesco: 'pesco', enfants: 'adapté enfants', emporter: 'à emporter', 'sans-four': 'sans four', apero: 'apéro' };

function renderCooking(root, { slot, recipe, steps, preview }) {
  const i = Math.min(cook.step, steps.length - 1);
  const s = steps[i];
  const tkey = `${cook.key}:${i}`;
  const t = s.min ? (timers.get(tkey) ?? { total: s.min * 60, left: s.min * 60, running: false }) : null;
  root.append(h('div.top', h('div.grow', h('div.sub', recipe.name), h('b', `Étape ${i + 1} / ${steps.length}`)), h('button.icon-btn', { onclick: () => { cook.on = false; setWake(false); rerender(); }, 'aria-label': 'Quitter le mode cuisine' }, '✕')));
  root.append(h('div.bar', { style: { marginBottom: '14px' } }, h('i', { style: { width: `${((i + 1) / steps.length) * 100}%` } })));
  root.append(h('div.card.stack', { style: { minHeight: '40vh', justifyContent: 'center' } },
    h('div.cook-step', s.t),
    t && h('div.stack', h('div.timer' + (t.done ? '.ring' : ''), { id: `tm-${tkey.replace(/[^a-z0-9]/gi, '_')}` }, mmss(t.running ? Math.max(0, (t.endAt - Date.now()) / 1000) : t.left)),
      h('div.row', { style: { justifyContent: 'center' } },
        t.running ? h('button.btn', { onclick: () => pauseTimer(tkey) }, '⏸ Pause') : h('button.btn.primary', { onclick: () => startTimer(tkey, s.min) }, t.done ? '↻ Relancer' : '▶︎ Lancer le minuteur'),
        h('button.btn', { onclick: () => resetTimer(tkey, s.min) }, 'Remise à zéro')))));
  // minuteurs en cours sur d'autres étapes
  const others = [...timers].filter(([k, v]) => k.startsWith(cook.key + ':') && k !== tkey && v.running);
  if (others.length) root.append(h('div.banner.demo', { style: { marginTop: '10px' } }, '⏱ Minuteur en cours à l’étape ', others.map(([k]) => Number(k.split(':').pop()) + 1).join(', ')));
  root.append(h('div.row', { style: { marginTop: '14px' } },
    h('button.btn.grow', { disabled: i === 0, onclick: () => { cook.step = i - 1; rerender(); } }, '← Précédente'),
    i < steps.length - 1 ? h('button.btn.primary.grow', { onclick: () => { cook.step = i + 1; rerender(); } }, 'Étape suivante →')
      : h('button.btn.good.grow', { onclick: () => { cook.on = false; setWake(false); if (preview) rerender(); else openCookSheet(slot); rerender(); } }, '✅ C’est fait')));
  root.append(h('small.kbd-hint', { style: { display: 'block', marginTop: '10px', textAlign: 'center' } }, cook.wake ? '🔆 L’écran reste allumé' : 'L’écran peut s’éteindre (non supporté par ce navigateur)'));
}

return { renderRecipe };
})();

// ---- site/src/main.js
__M["site/src/main.js"] = (() => {
const St = __M["site/src/store.js"];
const A = __M["site/src/actions.js"];
const { h, clear, closeTop, toast } = __M["site/src/ui.js"];
const { nav } = __M["site/src/common.js"];
const { renderToday } = __M["site/src/screens/today.js"];
const { renderWeek } = __M["site/src/screens/week.js"];
const { renderShop } = __M["site/src/screens/shop.js"];
const { renderRecipe } = __M["site/src/screens/recipe.js"];
const { renderStock } = __M["site/src/screens/stock.js"];
const { renderFoyer } = __M["site/src/screens/foyer.js"];
const { startOnboarding } = __M["site/src/screens/onboarding.js"];
const { showKeySheet } = __M["site/src/screens/key.js"];

const TABS = [
  ['aujourdhui', '🏠', 'Aujourd’hui', renderToday],
  ['semaine', '📅', 'Semaine', renderWeek],
  ['courses', '🛒', 'Courses', renderShop],
  ['recette', '👩‍🍳', 'Recette', (root) => renderRecipe(root, nav.recipe)],
  ['stock', '🧊', 'Stock', renderStock],
  ['foyer', '👨‍👩‍👧', 'Foyer', renderFoyer],
];

const app = document.getElementById('app');
const tabs = document.getElementById('tabs');
const current = () => {
  const name = location.hash.replace(/^#\/?/, '');
  return TABS.some((t) => t[0] === name) ? name : 'aujourdhui';
};

let timer = 0;
function render() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    const name = current();
    const y = window.scrollY;
    clear(app);
    try { TABS.find((t) => t[0] === name)[3](app); }
    catch (e) { console.error(e); app.append(h('div.card.bad', h('b', 'Oups, un écran a planté'), h('pre', { style: { whiteSpace: 'pre-wrap', fontSize: '.8rem' } }, String(e.stack || e)))); }
    drawNav(name);
    window.scrollTo(0, y);
  }, 0);
}

const openLines = () => St.list('shopping').filter((l) => l.week === A.currentWeek() && !l.checked && !l.refused && l.kind !== 'manual').length;
function drawNav(active) {
  clear(tabs);
  for (const [k, ico, label] of TABS) {
    const n = k === 'courses' ? openLines() : 0;
    tabs.append(h('a', { href: `#${k}`, 'aria-current': active === k ? 'page' : null }, h('span.ico', ico), label, n > 0 && h('span.dot', n > 99 ? '99+' : n)));
  }
}

window.addEventListener('hashchange', () => { closeTop(); window.scrollTo(0, 0); render(); });
window.addEventListener('omq:render', render);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeTop(); });

let keyAsked = false;
St.subscribe(() => {
  try { A.refreshShopping(); } catch (e) { console.error(e); }
  // première ouverture du site avec des promos publiées mais pas de code : on le demande une fois
  if (!keyAsked && St.S.meta.promos.state === 'locked' && St.settings().onboarded) { keyAsked = true; setTimeout(() => showKeySheet(St.S.meta.promos.message), 400); }
  render();
});

async function boot() {
  render();
  await St.init();
  render();
  if (!St.settings().onboarded && !St.list('profiles').length) setTimeout(startOnboarding, 250);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => { /* hors ligne / navigation privée : l'app marche sans */ });
}
boot();

return {  };
})();
