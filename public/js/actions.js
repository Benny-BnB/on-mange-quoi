// Actions métier : relient le moteur (shared/) au magasin de données. Aucune logique d'affichage ici.
import * as St from './store.js';
import { RECIPES } from '/shared/recipes.js';
import { INGREDIENTS } from '/shared/ingredients.js';
import { planWeek, makeCtx, evalSlot, otherIdea, assignRecipe, relinkLeftovers, planStats, linesCost } from '/shared/planner.js';
import { reconcileShopping, shoppingTotals, strategicSuggestions, makeLine } from '/shared/shopping.js';
import { consume, makeStockItem, makeLeftover, estimateUseBy } from '/shared/stock.js';
import { isBasic } from '/shared/rules.js';
import { todayStr, weekStartFor, addDays, weekDays, uid, norm, round2 } from '/shared/util.js';
import { buildPromoIndex, promoIngredient } from '/shared/pricing.js';
import { packsFor } from '/shared/ingredients.js';

export const today = () => todayStr();
export const currentWeek = () => weekStartFor(today());
export const allRecipes = () => [...RECIPES, ...St.list('recipes')];
export const recipeById = (id) => allRecipes().find((r) => r.id === id) ?? null;
export const slotsOfWeek = (ws) => St.list('plan').filter((s) => s.date >= ws && s.date <= addDays(ws, 6)).sort((a, b) => a.id.localeCompare(b.id));

/** Contexte du moteur construit à partir des données actuelles. */
export function ctxFor(ws) {
  const flagged = St.list('flags').map((f) => f.recipeId);
  const prevSlots = slotsOfWeek(addDays(ws, -7));
  return makeCtx({
    profiles: St.list('profiles'), settings: St.settings(), promos: St.list('promos'), stock: St.list('stock'),
    recipes: allRecipes(), today: today(), weekStart: ws, recent: prevSlots.map((s) => s.recipeId).filter(Boolean), flagged,
  });
}

// ---------- Planning ----------
export function generatePlan(ws, { seed = Date.now() % 100000 } = {}) {
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

export function pickProposal(slot, recipeId) {
  const ctx = ctxFor(weekStartFor(slot.date));
  const next = assignRecipe(slot, recipeId, ctx);
  next.proposals = slot.proposals?.includes(recipeId) ? slot.proposals : [recipeId, ...(slot.proposals ?? [])].slice(0, 3);
  writeSlot(next);
}
export function writeSlot(slot) {
  St.put('plan', slot);
  const ws = weekStartFor(slot.date);
  const ctx = ctxFor(ws);
  const all = relinkLeftovers(slotsOfWeek(ws).map((s) => (s.id === slot.id ? slot : s)), ctx);
  const changed = all.filter((s) => JSON.stringify(strip(s)) !== JSON.stringify(strip(St.get('plan', s.id) ?? {})));
  if (changed.length) St.putMany('plan', changed);
  refreshShopping(ws);
}
export function anotherIdea(slot) {
  const ws = weekStartFor(slot.date);
  const next = otherIdea({ slot, slots: slotsOfWeek(ws), ctx: ctxFor(ws), seed: Date.now() % 100000 });
  if (!next) return false;
  writeSlot(next);
  return true;
}
export function setGuests(slot, n) { writeSlot({ ...slot, guests: Math.max(0, n), auto: false }); }
export function toggleLock(slot) { writeSlot({ ...slot, locked: !slot.locked }); }
export function skipSlot(slot) { writeSlot({ ...slot, kind: 'none', recipeId: null, note: 'Repas sauté / à l’extérieur', locked: true }); }
export function swapSlots(a, b) {
  const aa = { ...a, ...pick(b), id: a.id, date: a.date, meal: a.meal };
  const bb = { ...b, ...pick(a), id: b.id, date: b.date, meal: b.meal };
  St.putMany('plan', [aa, bb]);
  refreshShopping(weekStartFor(a.date));
}
const pick = (s) => ({ kind: s.kind, recipeId: s.recipeId, proposals: s.proposals, over: s.over, resolved: s.resolved, dropped: s.dropped, batch: s.batch, from: s.from, note: s.note });

export function evalFor(slot) {
  const r = recipeById(slot.recipeId);
  if (!r) return null;
  const ctx = ctxFor(weekStartFor(slot.date));
  return { recipe: r, ev: evalSlot(slot, r, ctx), ctx };
}

export function stats(ws) {
  const ctx = ctxFor(ws);
  return planStats(slotsOfWeek(ws), ctx);
}

/** Budget dépassé : remplace les repas les plus chers par une proposition nettement moins chère. */
export function cheaper(ws) {
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
export function refreshShopping(ws = currentWeek(), force = false) {
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

export function setNoExtra(line, on) {
  St.put('shopping', { ...line, noExtra: on });
  refreshShopping(line.week, true);
}

export function weekRecord(ws) { return St.get('weeks', ws) ?? { id: ws, start: ws, passage: 1 }; }

export function markBought(line, { qty = null, price = null } = {}) {
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
export function unbuy(line) {
  if (line.stockId) St.del('stock', line.stockId);
  St.put('shopping', { ...line, checked: false, boughtAt: null, actualQty: null, actualPrice: null, stockId: null });
  refreshShopping(line.week, true);
}
export function endPassage(ws) {
  const wk = weekRecord(ws);
  St.put('weeks', { ...wk, passage: (wk.passage ?? 1) + 1 });
}
export function addManualLine(ws, { name, qty = '', price = null, rayon = 'autre' }) {
  St.put('shopping', { id: `manual-${uid()}`, week: ws, kind: 'manual', name, qtyText: qty, rayon, price: price ?? 0, qty: 1, size: 1, packs: 1, unit: 'pc', checked: false, firstDate: today(), recipes: [], saving: 0 });
}
export function setSpentOverride(ws, amount) { St.put('weeks', { ...weekRecord(ws), spentOverride: amount }); }

/** Achats stratégiques (V1.5) pour la semaine suivante, si son planning existe. */
export function strategic(ws) {
  const next = addDays(ws, 7);
  const nextSlots = slotsOfWeek(next);
  if (!nextSlots.length) return [];
  const ctx = ctxFor(next);
  const current = St.list('shopping').filter((l) => l.week === ws);
  return strategicSuggestions({ nextSlots, ctx, stock: St.list('stock'), promos: St.list('promos'), settings: St.settings(), weekStart: ws, nextWeekStart: next, currentLines: current });
}

// ---------- Refus d'article ----------
/** Repas non terminés de la semaine qui utilisent l'ingrédient. */
export function slotsUsing(ws, ingId) {
  return slotsOfWeek(ws).filter((s) => {
    if (s.kind !== 'recipe' || s.status === 'done') return false;
    const r = evalFor(s);
    return r?.ev.lines.some((l) => l.ing === ingId && !l.dropped);
  });
}
export function refuseReplace(ws, ingId, newId) {
  const out = [];
  for (const s of slotsUsing(ws, ingId)) {
    const e = evalFor(s);
    const line = e.ev.lines.find((l) => l.ing === ingId);
    out.push({ ...s, over: { ...s.over, [line.i]: newId }, auto: false });
  }
  if (out.length) St.putMany('plan', out);
  refreshShopping(ws, true);
}
export function refuseRecipe(ws, ingId) {
  for (const s of slotsUsing(ws, ingId)) anotherIdea(s);
  refreshShopping(ws, true);
}
export function refuseNever(ws, ingId) {
  const s = St.settings();
  const word = INGREDIENTS[ingId]?.name ?? ingId;
  St.saveSettings({ hated: [...new Set([...(s.hated ?? []), word])] });
  for (const slot of slotsUsing(ws, ingId)) anotherIdea(slot);
  refreshShopping(ws, true);
}

// ---------- Cuisine & stock ----------
export function cookDone(slot, { lines, leftoverPortions = 0, freeze = false }) {
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
export function eatLeftover(slot, portions) {
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
export function throwAway(item, qty = null) {
  const q = qty ?? item.qty;
  St.put('waste', { id: uid(), date: today(), ingredientId: item.ingredientId, name: item.name, qty: q, unit: item.unit });
  if (q >= item.qty - 1e-6) St.del('stock', item.id); else St.patch('stock', item.id, { qty: item.qty - q });
  refreshShopping(currentWeek(), true);
}
export function addStock(fields) {
  const it = makeStockItem({ boughtAt: today(), ...fields });
  St.put('stock', it);
  refreshShopping(currentWeek(), true);
  return it;
}
export function updateStock(item, changes) {
  if ((changes.qty ?? item.qty) <= 0 && item.kind !== 'dish') St.del('stock', item.id); else St.patch('stock', item.id, changes);
  refreshShopping(currentWeek(), true);
}
export function flagBasicLow(ingId, on) {
  const s = St.settings();
  const set = new Set(s.lowBasics ?? []);
  on ? set.add(ingId) : set.delete(ingId);
  St.saveSettings({ lowBasics: [...set] });
  if (on) refreshShopping(currentWeek(), true);
  else St.list('shopping').filter((l) => l.kind === 'basic' && l.ingredientId === ingId && !l.checked).forEach((l) => St.del('shopping', l.id));
}

// ---------- Promos ----------
export function setPromoIngredient(promo, ingId) {
  St.put('promos', { ...promo, userIngredient: ingId || null });
  const s = St.settings();
  const key = norm(promo.name);
  const map = { ...(s.productMap ?? {}) };
  if (ingId) map[key] = ingId; else delete map[key];
  St.saveSettings({ productMap: map });
  refreshShopping(currentWeek(), true);
}
export function editPromo(promo, changes) {
  St.put('promos', { ...promo, ...changes, manual: true, confidence: 'high' });
  refreshShopping(currentWeek(), true);
}
export function addPromo(fields, ws = currentWeek()) {
  const id = `manuel-${uid()}`;
  St.put('promos', { id, folder: 'manuel', page: 0, brand: '', ex: '', n: 1, basis: null, perUnit: null, validFrom: ws, validTo: addDays(ws, 6), confidence: 'high', manual: true, ...fields });
  refreshShopping(currentWeek(), true);
}
