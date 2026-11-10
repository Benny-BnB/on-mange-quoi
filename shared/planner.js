// Moteur de planning : choisit les repas de la semaine Delhaize (jeudi → mercredi) en maximisant la part
// d'ingrédients en promo et en stock, sous contraintes strictes (profils, allergies, matériel, temps).
import { INGREDIENTS, GROUPS } from './ingredients.js';
import { CATEGORIES, MEALS, RECIPE_BY_ID } from './recipes.js';
import {
  presentProfiles, slotPortions, strictViolations, hatedHits, checkLines, equipmentOk, isBasic, coefOf,
} from './rules.js';
import { buildPromoIndex, discountOf, effectiveUnitPrice, normalUnitPrice, basePrice } from './pricing.js';
import { virtualStock, vAvailable, vConsume } from './stock.js';
import { weekDays, isWeekend, addDays, diffDays, rng, niceQty, uniq, dayKey } from './util.js';

const MEAL_ORDER = ['petit-dej', 'diner', 'souper', 'collation'];
export const slotId = (date, meal) => `${date}_${meal}`;

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
export const resolveLines = (recipe, ctx, { people, date, over = {}, resolved = {} }) => {
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
export const scaleLines = (lines, recipe, portions, batch, dropped, settings) =>
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
export const evalSlot = (slot, recipe, ctx) => {
  const info = slotPortions(slot, ctx.profiles, ctx.settings);
  const base = resolveLines(recipe, ctx, { people: info.people, date: slot.date, over: slot.over, resolved: slot.resolved });
  if (!base) return { ok: false, reasons: ['ingrédient obligatoire indisponible'], info, lines: [] };
  const chk = checkLines(base, info.people, ctx.settings);
  const dropped = [...new Set([...(slot.dropped ?? []), ...chk.dropped])];
  const lines = scaleLines(base, recipe, info.portions, slot.batch ?? 1, dropped, ctx.settings);
  return { ok: chk.ok, reasons: chk.reasons, hated: chk.hated, info, lines, resolved: Object.fromEntries(base.filter((l) => l.group).map((l) => [l.i, l.ing])), dropped };
};

// ---------- Coût & indicateurs ----------
export const linesCost = (lines, ctx) => {
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
export const candidatesFor = (slot, ctx, st, { exclude = new Set(), relax = false } = {}) => {
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
export const makeCtx = ({ profiles, settings, promos, stock, recipes, today, weekStart, recent = [], flagged = [] }) => ({
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
export function planWeek({ weekStart, today, profiles, settings, promos, stock, recipes, existing = [], seed = 1, recent = [], flagged = [] }) {
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
export const planStats = (slots, ctx) => {
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
export function otherIdea({ slot, slots, ctx, seed = Date.now() }) {
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
export function assignRecipe(slot, recipeId, ctx) {
  const r = ctx.recipeById[recipeId];
  if (!r) return slot;
  const next = { ...slot, kind: 'recipe', recipeId, over: {}, resolved: {}, dropped: [], batch: 1, auto: false, from: undefined };
  const ev = evalSlot(next, r, ctx);
  next.resolved = ev.resolved ?? {};
  next.dropped = ev.dropped ?? [];
  return next;
}

/** Remplace un ingrédient d'une ligne (« Remplacer l'ingrédient »). */
export function substituteOptions(slot, lineIndex, recipe, ctx) {
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
export function relinkLeftovers(slots, ctx) {
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

export { MEALS, CATEGORIES, RECIPE_BY_ID, coefOf, rng };
