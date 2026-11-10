// Lecture du folder Delhaize (visionneuse Publitas) : texte par page → liste structurée d'articles en promo.
// Le texte brut est bruité (badges séparés, prix éclatés) : chaque article reçoit un niveau de confiance,
// les prix sont recoupés (mécanique déduite des prix plutôt que du badge) et tout reste corrigeable à la main.
import { norm, addDays, folderSlugFor } from './util.js';
import { matchIngredient, guessRayon, INGREDIENTS } from './ingredients.js';

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
export const mechanicFromPrices = (A, B, n) => {
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
export const parseValidity = (pages) => {
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
export const parseFolder = (pages, opts = {}) => {
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
export const checkExtraction = (parsed, pages) => {
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

export const expectedSlug = (weekStart) => folderSlugFor(weekStart);
export const nextWeekStart = (weekStart) => addDays(weekStart, 7);
