// Liste de courses : besoins du planning − stock disponible, arrondis au format vendu, avec prix et économies.
import { INGREDIENTS, RAYON_ORDER, packsFor } from './ingredients.js';
import { evalSlot } from './planner.js';
import { stockQty, vConsume, virtualStock, vAvailable, daysLeft } from './stock.js';
import { FREEZER_SLOTS } from './rules.js';
import {
  buildPromoIndex, sizesFor, priceOfPacks, minQty, discountOf, savingForPacks,
} from './pricing.js';
import { addDays, diffDays, uid, round2 } from './util.js';

const MEAL_ORDER = { 'petit-dej': 0, diner: 1, souper: 2, collation: 3 };
const bySlotOrder = (a, b) => a.date.localeCompare(b.date) || MEAL_ORDER[a.meal] - MEAL_ORDER[b.meal];

/** Durable = se garde (≥ 3 semaines) ou se congèle (viande, poisson, pain, beurre…) si on a un congélateur. */
export const isDurable = (ingId, settings) => {
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
export const computeDeficits = ({ slots, ctx, stock }) => {
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
export const makeLine = ({ week, ingId, deficit, firstDate, recipes, promo, settings, today, allowExtra = true }) => {
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
export const reconcileShopping = ({ weekStart, slots, ctx, stock, promos, settings, existing, today }) => {
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
export const lineCost = (l) => (l.checked ? (l.actualPrice ?? l.price ?? 0) : l.price ?? 0);

export const shoppingTotals = (lines, { passage = null } = {}) => {
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
export const promoCoverage = (lines) => {
  const live = lines.filter((l) => !l.deleted && !l.refused && l.kind === 'auto' && !l.strategic);
  if (!live.length) return { rate: 0, promo: 0, total: 0 };
  const promo = live.filter((l) => l.promoId).length;
  return { rate: promo / live.length, promo, total: live.length };
};

/**
 * Achats stratégiques (bonus) : promos de cette semaine utiles à la semaine suivante.
 * Conditions : se garde ou se congèle, économie ≥ seuil, rattaché à une recette de la semaine suivante, place disponible.
 */
export const strategicSuggestions = ({ nextSlots, ctx, stock, promos, settings, weekStart, nextWeekStart, currentLines }) => {
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
export const promoEndingTomorrow = (lines, promos, today) => {
  const byId = new Map(promos.map((p) => [p.id, p]));
  return lines.filter((l) => !l.deleted && !l.checked && !l.refused && l.promoId && byId.get(l.promoId)?.validTo === addDays(today, 1));
};
