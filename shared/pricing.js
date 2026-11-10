// Prix, promos et mécaniques (1+1, 2e à -50 %, 3 pour 2…).
import { INGREDIENTS } from './ingredients.js';
import { norm } from './util.js';

/** Un promo = { n, normal, promo, format:{qty,unit}|null, pct, … } où `normal`/`promo` sont les TOTAUX pour `n` articles. */
export const unitPromo = (p) => (p.promo != null ? p.promo / (p.n || 1) : null);
export const unitNormal = (p) => (p.normal != null ? p.normal / (p.n || 1) : null);

/** Part de remise (0–1) : calculée sur les prix si connus, sinon sur le pourcentage lu dans le folder. */
export const discountOf = (p) => {
  if (p.normal != null && p.promo != null && p.normal > 0) return Math.max(0, 1 - p.promo / p.normal);
  if (p.pct != null) return Math.max(0, p.pct / 100);
  return null;
};

/** Ingrédient effectif d'un produit promo (correction manuelle > mémoire du foyer > détection automatique). */
export const promoIngredient = (p, settings) => p.userIngredient ?? settings?.productMap?.[norm(p.name)] ?? p.ingredientId ?? null;

export const promoValidOn = (p, date) => (!p.validFrom || p.validFrom <= date) && (!p.validTo || date <= p.validTo);

/** Coût de `k` articles en profitant de la promo (k ≥ n : lots de n au prix promo). */
export const costForPacks = (p, k) => {
  const n = p.n || 1;
  const un = unitNormal(p) ?? unitPromo(p) ?? 0;
  if (p.promo == null) return k * (un || 0);
  const lots = Math.floor(k / n);
  return lots * p.promo + (k - lots * n) * un;
};

/** Économie pour k articles (par rapport au prix normal), 0 si inconnue. */
export const savingForPacks = (p, k) => {
  const un = unitNormal(p);
  if (un == null) return 0;
  return Math.max(0, k * un - costForPacks(p, k));
};

const basisCompatible = (p, ing) => !!p.basis && !!ing && ((p.basis === 'kg' && ing.unit === 'g') || (p.basis === 'l' && ing.unit === 'ml'));
const formatCompatible = (p, ing) => !!p.format && !!ing && p.format.unit === ing.unit && p.format.qty > 0;

/** Prix promo / normal par unité de base (g, ml, pièce) si le produit permet de le calculer. */
export const perBase = (p, ing) => {
  if (!p || !ing) return null;
  if (basisCompatible(p, ing)) return p.promo != null ? { promo: p.promo / 1000, normal: p.normal != null ? p.normal / 1000 : null } : null;
  if (formatCompatible(p, ing) && p.promo != null) {
    return { promo: unitPromo(p) / p.format.qty, normal: unitNormal(p) != null ? unitNormal(p) / p.format.qty : null };
  }
  return null;
};

/** Meilleure promo valide par ingrédient (remise la plus forte, puis prix unitaire le plus bas). */
export const buildPromoIndex = (promos, date, settings) => {
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
export const basePrice = (ingId, settings) => {
  const ing = INGREDIENTS[ingId];
  if (!ing) return 0;
  const per = settings?.priceOverrides?.[ingId] ?? ing.price; // €/kg, €/l ou €/pièce
  return ing.unit === 'pc' ? per : per / 1000;
};

/** Prix effectif par unité de base si on profite de la promo. */
export const effectiveUnitPrice = (ingId, promo, settings) => {
  const ing = INGREDIENTS[ingId];
  const base = basePrice(ingId, settings);
  if (!promo) return base;
  const pb = perBase(promo, ing);
  if (pb) return pb.promo;
  const d = discountOf(promo);
  return d != null ? base * (1 - d) : base;
};

/** Prix normal par unité de base (promo) — sinon estimation. */
export const normalUnitPrice = (ingId, promo, settings) => {
  const pb = perBase(promo, INGREDIENTS[ingId]);
  return pb?.normal ?? basePrice(ingId, settings);
};

/** Formats vendus pour un ingrédient : celui de la promo si compatible, sinon les formats habituels. */
export const sizesFor = (ingId, promo) => {
  const ing = INGREDIENTS[ingId];
  if (promo && formatCompatible(promo, ing)) return [promo.format.qty];
  return ing?.packs?.length ? ing.packs : [1];
};

/** Prix d'un lot de `packs` unités d'une taille donnée (promo si compatible, sinon estimation). */
export const priceOfPacks = (ingId, packs, size, promo, settings) => {
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
export const minQty = (p) => p?.n || 1;
