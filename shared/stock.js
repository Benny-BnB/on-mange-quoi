// Stock : le pivot de l'app. Les achats l'augmentent, les recettes le diminuent, tout reste modifiable à la main.
import { INGREDIENTS } from './ingredients.js';
import { addDays, diffDays, uid } from './util.js';

export const LOC_LABEL = { placard: 'Placard', frigo: 'Frigo', congelateur: 'Congélateur' };

/** Date limite estimée à l'achat, d'après la conservation de l'ingrédient. */
export const estimateUseBy = (ingId, boughtAt, loc) => {
  const ing = INGREDIENTS[ingId];
  if (!ing) return null;
  const days = loc === 'congelateur' && ing.loc !== 'congelateur' ? Math.max(ing.shelf, 90) : ing.shelf;
  return addDays(boughtAt, days);
};

export const makeStockItem = ({ ingredientId = null, name, qty, unit, boughtAt, useBy, loc, kind = 'item', note = '' }) => {
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
export const daysLeft = (item, today) => (item.useBy ? diffDays(today, item.useBy) : null);

/** Lots d'un ingrédient triés par date limite (les plus proches d'abord, sans date en dernier). */
export const lotsFor = (stock, ingId) =>
  stock
    .filter((s) => s.ingredientId === ingId && s.qty > 0 && s.kind !== 'dish' && !s.deleted)
    .sort((a, b) => (a.useBy ?? '9999') .localeCompare(b.useBy ?? '9999'));

export const stockQty = (stock, ingId, onDate = null) =>
  lotsFor(stock, ingId).filter((l) => !onDate || !l.useBy || l.useBy >= onDate).reduce((a, l) => a + l.qty, 0);

/**
 * Retire `qty` d'un ingrédient (premier périmé, premier sorti). Retourne les modifications à appliquer.
 * @returns {{ changes: {id:string, qty:number}[], taken:number, missing:number }}
 */
export const consume = (stock, ingId, qty, onDate = null) => {
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
export const expiringSoon = (stock, today, days = 2) =>
  stock
    .filter((s) => !s.deleted && s.qty > 0 && s.useBy && diffDays(today, s.useBy) <= days && s.loc !== 'congelateur')
    .sort((a, b) => a.useBy.localeCompare(b.useBy));

export const urgency = (item, today) => {
  const d = daysLeft(item, today);
  if (d == null) return 'none';
  if (d < 0) return 'expired';
  if (d <= 2) return 'soon';
  if (d <= 5) return 'warn';
  return 'ok';
};

/** Index { ingredientId → [{id, qty, useBy}] } copiable, pour simuler la consommation pendant la planification. */
export const virtualStock = (stock) => {
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
export const vAvailable = (vs, ingId, date) =>
  (vs.get(ingId) ?? []).filter((l) => !l.useBy || l.useBy >= date).reduce((a, l) => a + l.qty, 0);

/** Consomme dans le stock virtuel et retourne ce qui reste à acheter. */
export const vConsume = (vs, ingId, qty, date) => {
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
export const makeLeftover = ({ name, portions, cookedAt, frozen = false, recipeId = null }) => ({
  ...makeStockItem({ name: `Restes : ${name}`, qty: portions, unit: 'portion', boughtAt: cookedAt, useBy: addDays(cookedAt, frozen ? 90 : 3), loc: frozen ? 'congelateur' : 'frigo', kind: 'dish' }),
  recipeId,
});
