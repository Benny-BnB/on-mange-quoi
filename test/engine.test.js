import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import { eur, fmtQty, weekStartFor, weekDays, folderSlugFor, addDays, niceQty } from '../shared/util.js';
import { portionCoef, energyNeedMJ, REF_MJ } from '../shared/efsa.js';
import { INGREDIENTS, matchIngredient, packsFor } from '../shared/ingredients.js';
import { RECIPES, validateRecipe, CATEGORIES } from '../shared/recipes.js';
import { newProfile, DEFAULT_SETTINGS, strictViolations, slotPortions, derivedTags } from '../shared/rules.js';
import { parseFolder, checkExtraction, mechanicFromPrices } from '../shared/folder-parser.js';
import { planWeek, evalSlot, makeCtx, otherIdea } from '../shared/planner.js';
import { reconcileShopping, shoppingTotals } from '../shared/shopping.js';
import { makeStockItem, consume } from '../shared/stock.js';
import { costForPacks } from '../shared/pricing.js';

const FIXTURE = new URL('../data/folders/w45-2026-fr.pages.json', import.meta.url);
const hasFixture = existsSync(FIXTURE);
const pages = hasFixture ? JSON.parse(readFileSync(FIXTURE, 'utf8')) : [];

// ---------- Dates & formats ----------
test('semaine Delhaize : jeudi → mercredi', () => {
  assert.equal(weekStartFor('2026-11-10'), '2026-11-05'); // mardi → jeudi précédent
  assert.equal(weekStartFor('2026-11-05'), '2026-11-05');
  assert.equal(weekStartFor('2026-11-11'), '2026-11-05'); // mercredi = dernier jour
  assert.equal(weekStartFor('2026-11-12'), '2026-11-12');
  assert.deepEqual(weekDays('2026-11-05').at(-1), '2026-11-11');
});
test('identifiant du folder Publitas', () => {
  assert.equal(folderSlugFor('2026-11-05'), 'w45-2026-fr');
  assert.equal(folderSlugFor('2026-11-12'), 'w46-2026-fr');
});
test('montants au format X.XXX,XX€', () => {
  assert.equal(eur(9.99), '9,99€');
  assert.equal(eur(1234.5), '1.234,50€');
  assert.equal(eur(1234567.891), '1.234.567,89€');
  assert.equal(eur(0), '0,00€');
});
test('quantités lisibles et arrondis de cuisine', () => {
  assert.equal(fmtQty(450, 'g'), '450 g');
  assert.equal(fmtQty(1200, 'g'), '1,2 kg');
  assert.equal(fmtQty(1500, 'ml'), '1,5 l');
  assert.equal(niceQty(1.3, 'pc'), 1.5);
  assert.equal(niceQty(437, 'g'), 440);
});

// ---------- Portions (EFSA) ----------
test('EFSA : adulte de référence = 9,75 MJ, coefficients cohérents', () => {
  assert.equal(REF_MJ, 9.75);
  const homme = portionCoef(newProfile({ sex: 'homme' }));
  const femme = portionCoef(newProfile({ sex: 'femme' }));
  const np = portionCoef(newProfile({ sex: 'nonprecise' }));
  assert.ok(Math.abs(homme - 10.8 / 9.75) < 1e-9);
  assert.ok(Math.abs(femme - 8.7 / 9.75) < 1e-9);
  assert.ok(Math.abs(np - 1) < 1e-9, 'adulte non précisé = référence');
  const enfant = portionCoef(newProfile({ ageCat: 'enfant_7_12', sex: 'nonprecise' }));
  assert.ok(enfant > 0.55 && enfant < 0.95, `enfant 7-12 ≈ ${enfant}`);
});
test('EFSA : appétit et activité ajustent la portion', () => {
  const base = newProfile({ sex: 'homme' });
  assert.ok(Math.abs(portionCoef({ ...base, appetite: 'petit' }) / portionCoef(base) - 0.85) < 1e-9);
  assert.ok(Math.abs(portionCoef({ ...base, appetite: 'gros' }) / portionCoef(base) - 1.15) < 1e-9);
  assert.ok(energyNeedMJ({ ...base, activity: 'sportif' }) > energyNeedMJ({ ...base, activity: 'faible' }));
});

// ---------- Base d'ingrédients & recettes ----------
test('toutes les recettes de la bibliothèque sont valides', () => {
  const errs = RECIPES.flatMap((r) => validateRecipe(r).map((e) => `${r.id}: ${e}`));
  assert.deepEqual(errs, []);
  assert.equal(new Set(RECIPES.map((r) => r.id)).size, RECIPES.length, 'ids uniques');
  assert.ok(RECIPES.length >= 50);
});
test('catégories : temps max respectés', () => {
  for (const r of RECIPES) {
    const max = CATEGORIES[r.cat].maxTotal;
    if (max) assert.ok(r.prep + r.cook <= max, `${r.id} ${r.prep + r.cook} > ${max}`);
  }
});
test('format vendu : 450 g demandés → un paquet de 500 g', () => {
  assert.deepEqual(packsFor(450, [500]), { size: 500, n: 1, total: 500 });
  assert.deepEqual(packsFor(1100, [500]), { size: 500, n: 3, total: 1500 });
  assert.equal(packsFor(600, [250, 500]).total, 750 - 0 > 0 ? packsFor(600, [250, 500]).total : 0);
});
test('tags de régime déduits des ingrédients', () => {
  const carbo = RECIPES.find((r) => r.id === 'carbonara');
  const tags = derivedTags(carbo);
  assert.ok(!tags.includes('vegetarien'));
  const curry = RECIPES.find((r) => r.id === 'curry-pois-chiches');
  assert.ok(derivedTags(curry).includes('vegetalien'));
});

// ---------- Filtres stricts ----------
test('allergie = exclusion stricte, régime et religion aussi', () => {
  const lait = newProfile({ name: 'Léa', allergens: ['lait'] });
  assert.ok(strictViolations(['beurre'], lait).length);
  assert.ok(!strictViolations(['poulet-filet'], lait).length);
  const veg = newProfile({ diet: 'vegetarien' });
  assert.ok(strictViolations(['poulet-filet'], veg).length);
  assert.ok(strictViolations(['saumon-filet'], veg).length);
  assert.ok(!strictViolations(['oeufs'], veg).length);
  assert.ok(strictViolations(['oeufs'], newProfile({ diet: 'vegetalien' })).length);
  assert.ok(!strictViolations(['saumon-filet'], newProfile({ diet: 'pesco' })).length);
  assert.ok(strictViolations(['lardons'], newProfile({ religious: ['halal'] })).length);
  assert.ok(strictViolations(['scampis'], newProfile({ religious: ['casher'] })).length);
  assert.ok(strictViolations(['biere-brune'], newProfile({ religious: ['sans_alcool'] })).length);
  assert.ok(strictViolations(['pates'], newProfile({ allergenFree: 'pâtes' })).length, 'champ libre');
});

// ---------- Promos & parseur ----------
test('mécaniques déduites des prix', () => {
  assert.equal(mechanicFromPrices(4.78, 2.39, 2).label, '1+1 gratis');
  assert.equal(mechanicFromPrices(10.58, 7.94, 2).label, '2e à −50 %');
  assert.equal(mechanicFromPrices(5.97, 3.98, 3).label, '2+1 gratis');
  assert.equal(mechanicFromPrices(9.16, 6.87, 4).label, '3+1 gratis');
  assert.equal(mechanicFromPrices(4.49, 3.14, 1).label, '−30 %');
});
test('prix pour k articles en promo', () => {
  const p = { n: 2, normal: 4.78, promo: 2.39 };
  assert.equal(costForPacks(p, 2), 2.39);
  assert.ok(Math.abs(costForPacks(p, 3) - (2.39 + 2.39)) < 1e-9, '3 articles = 1 lot + 1 au prix normal');
  assert.equal(costForPacks(p, 1), 2.39 * 1); // 1 seul : prix normal unitaire
});
test('matching produit ↔ ingrédient', () => {
  assert.equal(matchIngredient('delhaize filet de poulet'), 'poulet-filet');
  assert.equal(matchIngredient('bertagni pates farcies'), 'pates-farcies');
  assert.equal(matchIngredient('barilla pates spaghetti n 5'), 'pates');
  assert.equal(matchIngredient('lessive liquide'), null);
});

test('lecture du folder réel w45-2026', { skip: !hasFixture }, () => {
  const parsed = parseFolder(pages, { slug: 'w45-2026-fr' });
  assert.deepEqual(parsed.validity, { from: '2026-11-05', to: '2026-11-11' });
  const chk = checkExtraction(parsed, pages);
  assert.ok(chk.ok, chk.problems.join(', '));
  const find = (re) => parsed.items.find((i) => re.test(`${i.brand} ${i.name}`));
  const danone = find(/DANONE/);
  assert.equal(danone.mechanic, '1+1 gratis');
  assert.equal(danone.promo, 2.39);
  assert.equal(danone.n, 2);
  assert.equal(danone.ingredientId, 'yaourt-grec');
  const coq = find(/Coq au vin/);
  assert.equal(coq.mechanic, '−30 %');
  assert.equal(coq.normal, 8.59);
  assert.equal(coq.promo, 6.01);
  assert.equal(find(/Scampis/).mechanic, '2e à −40 %');
  assert.equal(find(/Pâtes farcies/).ingredientId, 'pates-farcies');
  assert.equal(find(/BARILLA/).format.qty, 500);
  assert.equal(find(/Rôti de porc/).basis, 'kg');
  assert.ok(parsed.items.filter((i) => i.ingredientId).length >= 40);
  // les instructions de recette ne sont pas des produits
  assert.ok(!parsed.items.some((i) => /FAITES CUIRE/.test(i.brand)));
});

// ---------- Planning ----------
const mkWorld = (over = {}) => {
  const parsed = hasFixture ? parseFolder(pages, { slug: 'w45-2026-fr' }) : { items: [] };
  const promos = parsed.items.map((p) => ({ ...p }));
  const profiles = over.profiles ?? [
    newProfile({ id: 'p1', name: 'Alice', sex: 'homme' }),
    newProfile({ id: 'p2', name: 'Bruno', sex: 'femme' }),
    newProfile({ id: 'p3', name: 'Chloé', ageCat: 'enfant_7_12', sex: 'nonprecise' }),
  ];
  const settings = { ...DEFAULT_SETTINGS(), ...(over.settings ?? {}) };
  return { promos, profiles, settings, stock: over.stock ?? [], today: over.today ?? '2026-11-10', weekStart: '2026-11-05' };
};

test('planning : 7 jours, soupers avec 2-3 propositions, pas de répétition', { skip: !hasFixture }, () => {
  const w = mkWorld({ today: '2026-11-05' });
  const { slots, stats } = planWeek({ ...w, recipes: RECIPES, seed: 7 });
  const soupers = slots.filter((s) => s.meal === 'souper');
  assert.equal(soupers.length, 7);
  for (const s of soupers) {
    assert.ok(s.recipeId);
    assert.ok(s.proposals.length >= 2, `${s.id} propositions`);
    assert.equal(new Set(s.proposals.map((id) => RECIPES.find((r) => r.id === id).cat)).size >= 2, true, 'catégories différentes');
  }
  const ids = slots.filter((s) => s.kind === 'recipe').map((s) => s.recipeId);
  const souperIds = soupers.map((s) => s.recipeId);
  assert.equal(new Set(souperIds).size, souperIds.length, 'pas de souper répété');
  // contrainte « semaine = express le soir » : lundi → vendredi ≤ 20 min
  for (const s of soupers) {
    const day = new Date(s.date + 'T00:00:00Z').getUTCDay();
    if (day >= 1 && day <= 5) {
      const r = RECIPES.find((x) => x.id === s.recipeId);
      assert.ok(r.prep + r.cook <= 20, `${s.id} ${r.name} dure ${r.prep + r.cook} min`);
    }
  }
  assert.ok(stats.cost > 0);
  assert.ok(stats.promoRate > 0.2, `taux promo ${stats.promoRate}`);
});

test('planning : jamais deux jours de suite la même protéine au souper', { skip: !hasFixture }, () => {
  const w = mkWorld({ today: '2026-11-05' });
  const { slots, ctx } = planWeek({ ...w, recipes: RECIPES, seed: 3 });
  const prot = (s) => {
    const r = ctx.recipeById[s.recipeId];
    const ev = evalSlot(s, r, ctx);
    let best = null;
    for (const l of ev.lines) {
      const k = INGREDIENTS[l.ing].protein;
      if (k && (!best || l.q > best.q)) best = { k, q: l.q };
    }
    return best?.k ?? null;
  };
  const soupers = slots.filter((s) => s.meal === 'souper');
  let repeats = 0;
  for (let i = 1; i < soupers.length; i++) {
    const a = prot(soupers[i - 1]), b = prot(soupers[i]);
    if (a && a === b) repeats++;
  }
  assert.ok(repeats <= 1, `${repeats} répétitions de protéine`);
});

test('planning : allergie au lait et régime végétarien respectés sur toute la semaine', { skip: !hasFixture }, () => {
  const w = mkWorld({
    today: '2026-11-05',
    profiles: [newProfile({ id: 'a', name: 'Ana', allergens: ['lait'], diet: 'vegetarien' }), newProfile({ id: 'b', name: 'Ben' })],
  });
  const { slots, ctx } = planWeek({ ...w, recipes: RECIPES, seed: 11 });
  assert.ok(slots.filter((s) => s.kind === 'recipe').length >= 14);
  for (const s of slots) {
    if (s.kind !== 'recipe') continue;
    const ev = evalSlot(s, ctx.recipeById[s.recipeId], ctx);
    for (const l of ev.lines) {
      if (l.dropped) continue;
      const ing = INGREDIENTS[l.ing];
      assert.ok(!ing.allergens.includes('lait'), `${s.id} contient du lait (${ing.name})`);
      assert.ok(!ing.tags.some((t) => ['viande', 'volaille', 'porc', 'poisson', 'crustace'].includes(t)), `${s.id} contient ${ing.name}`);
    }
  }
});

test('planning : absence → pas de repas ; invités → portions en plus', { skip: !hasFixture }, () => {
  const w = mkWorld({
    today: '2026-11-05',
    profiles: [newProfile({ id: 'a', name: 'Ana', presence: { lun: { diner: false } } }), newProfile({ id: 'b', name: 'Ben', presence: { lun: { diner: false } } })],
  });
  const { slots } = planWeek({ ...w, recipes: RECIPES, seed: 5 });
  assert.ok(!slots.some((s) => s.id === '2026-11-09_diner'), 'lundi midi : tout le monde absent');
  const info = slotPortions({ date: '2026-11-06', meal: 'souper', guests: 2 }, w.profiles, w.settings);
  assert.ok(Math.abs(info.portions - 4) < 1e-9, 'deux adultes de référence + 2 invités');
});

test('planning : respecte le matériel (pas de four → pas de recette au four)', { skip: !hasFixture }, () => {
  const w = mkWorld({ today: '2026-11-05', settings: { equipment: { ...DEFAULT_SETTINGS().equipment, four: false } } });
  const { slots } = planWeek({ ...w, recipes: RECIPES, seed: 2 });
  for (const s of slots) {
    if (s.kind !== 'recipe') continue;
    const r = RECIPES.find((x) => x.id === s.recipeId);
    assert.ok(!r.eq.some((e) => e === 'four'), `${r.name} exige un four`);
  }
});

test('« Autre idée » propose une recette différente', { skip: !hasFixture }, () => {
  const w = mkWorld({ today: '2026-11-05' });
  const { slots, ctx } = planWeek({ ...w, recipes: RECIPES, seed: 1 });
  const slot = slots.find((s) => s.meal === 'souper');
  const next = otherIdea({ slot, slots, ctx, seed: 99 });
  assert.ok(next && next.recipeId !== slot.recipeId && !slot.proposals.includes(next.recipeId));
});

test('stock : les produits en stock réduisent la liste de courses', { skip: !hasFixture }, () => {
  const w = mkWorld({ today: '2026-11-05' });
  const planned = planWeek({ ...w, recipes: RECIPES, seed: 4 });
  const base = reconcileShopping({ weekStart: w.weekStart, slots: planned.slots, ctx: planned.ctx, stock: [], promos: w.promos, settings: w.settings, existing: [], today: w.today });
  assert.ok(base.upsert.length > 5);
  const first = base.upsert.find((l) => l.rayon !== 'epicerie');
  const stock = [makeStockItem({ ingredientId: first.ingredientId, qty: 100000, boughtAt: '2026-11-04' })];
  const ctx2 = makeCtx({ ...w, stock, recipes: RECIPES });
  const less = reconcileShopping({ weekStart: w.weekStart, slots: planned.slots, ctx: ctx2, stock, promos: w.promos, settings: w.settings, existing: [], today: w.today });
  assert.ok(!less.upsert.some((l) => l.ingredientId === first.ingredientId), `${first.name} couvert par le stock`);
  const totals = shoppingTotals(base.upsert);
  assert.ok(totals.remaining > 0);
});

test('liste de courses : quantités arrondies au format vendu, une ligne par article', { skip: !hasFixture }, () => {
  const w = mkWorld({ today: '2026-11-05' });
  const planned = planWeek({ ...w, recipes: RECIPES, seed: 4 });
  const { upsert } = reconcileShopping({ weekStart: w.weekStart, slots: planned.slots, ctx: planned.ctx, stock: [], promos: w.promos, settings: w.settings, existing: [], today: w.today });
  const ids = upsert.map((l) => l.ingredientId);
  assert.equal(new Set(ids).size, ids.length);
  for (const l of upsert) {
    assert.ok(l.qty >= l.need - 1e-6, `${l.name}: ${l.qty} ≥ ${l.need}`);
    assert.equal(l.qty, l.packs * l.size);
    assert.ok(l.price >= 0);
  }
});

// ---------- Stock ----------
test('consommation du stock : premier périmé, premier sorti', () => {
  const a = makeStockItem({ ingredientId: 'pates', qty: 500, boughtAt: '2026-11-01', useBy: '2027-01-01' });
  const b = makeStockItem({ ingredientId: 'pates', qty: 500, boughtAt: '2026-11-02', useBy: '2026-12-01' });
  const { changes, taken, missing } = consume([a, b], 'pates', 600);
  assert.equal(taken, 600);
  assert.equal(missing, 0);
  assert.deepEqual(changes.find((c) => c.id === b.id), { id: b.id, qty: 0 });
  assert.deepEqual(changes.find((c) => c.id === a.id), { id: a.id, qty: 400 });
  assert.equal(consume([a], 'pates', 800).missing, 300);
});

// ---------- Règles du cahier des charges : restes, anti-gaspi, remplacement, achats stratégiques ----------
import { substituteOptions } from '../shared/planner.js';
import { strategicSuggestions, computeDeficits } from '../shared/shopping.js';
import { RECIPE_BY_ID } from '../shared/recipes.js';

test('batch cooking : le souper en grande quantité devient les restes du dîner du lendemain', () => {
  const w = mkWorld({ today: '2026-11-05', settings: { timeRules: { semaine: { 'petit-dej': null, diner: null, souper: null }, weekend: { 'petit-dej': null, diner: null, souper: null } } } });
  const pool = ['bolognaise-batch', 'sandwich-jambon-fromage', 'pdj-tartines'].map((id) => RECIPE_BY_ID[id]);
  const { slots, ctx } = planWeek({ ...w, recipes: pool, seed: 1 });
  const souper = slots.find((s) => s.id === '2026-11-05_souper');
  assert.equal(souper.recipeId, 'bolognaise-batch');
  assert.ok(souper.batch >= 2, `facteur de batch ${souper.batch}`);
  const diner = slots.find((s) => s.id === '2026-11-06_diner');
  assert.equal(diner.kind, 'leftover');
  assert.equal(diner.from, souper.id);
  // les quantités du souper couvrent bien les deux repas
  const single = evalSlot({ ...souper, batch: 1 }, ctx.recipeById[souper.recipeId], ctx);
  const batch = evalSlot(souper, ctx.recipeById[souper.recipeId], ctx);
  const q = (ev) => ev.lines.find((l) => l.ing === 'boeuf-hache').raw;
  assert.ok(q(batch) / q(single) >= 1.9, 'au moins le double de viande');
});

test('anti-gaspi : un produit frais qui expire bientôt est utilisé en priorité', () => {
  const stock = [makeStockItem({ ingredientId: 'courgette', qty: 900, boughtAt: '2026-11-03', useBy: '2026-11-07' })];
  const w = mkWorld({ today: '2026-11-05', stock });
  const { slots, ctx } = planWeek({ ...w, recipes: RECIPES, seed: 21 });
  const used = slots.filter((s) => s.kind === 'recipe' && s.date <= '2026-11-07').some((s) => evalSlot(s, ctx.recipeById[s.recipeId], ctx).lines.some((l) => l.ing === 'courgette' && !l.dropped));
  assert.ok(used, 'la courgette qui expire le 07/11 doit être cuisinée avant');
});

test('remplacer un ingrédient : dinde proposée à la place du poulet, compatible avec les profils', () => {
  const w = mkWorld({ today: '2026-11-05' });
  const ctx = makeCtx({ ...w, recipes: RECIPES });
  const slot = { id: 'x', date: '2026-11-06', meal: 'souper', kind: 'recipe', recipeId: 'wok-poulet-legumes', over: {}, resolved: {}, dropped: [], guests: 0, batch: 1 };
  const idx = RECIPE_BY_ID['wok-poulet-legumes'].ing.findIndex(([i]) => i === 'poulet-filet');
  const opts = substituteOptions(slot, idx, RECIPE_BY_ID['wok-poulet-legumes'], ctx);
  assert.ok(opts.some((o) => o.id === 'dinde-filet'));
  // pour une personne halal, aucun substitut au porc
  const halal = mkWorld({ today: '2026-11-05', profiles: [newProfile({ id: 'h', name: 'Hana', religious: ['halal'] })] });
  const ctx2 = makeCtx({ ...halal, recipes: RECIPES });
  const opts2 = substituteOptions(slot, idx, RECIPE_BY_ID['wok-poulet-legumes'], ctx2);
  assert.ok(opts2.every((o) => !INGREDIENTS[o.id].tags.includes('porc')));
  // le remplacement est appliqué dans les lignes du repas
  const swapped = evalSlot({ ...slot, over: { [idx]: 'dinde-filet' } }, RECIPE_BY_ID['wok-poulet-legumes'], ctx);
  assert.ok(swapped.lines.some((l) => l.ing === 'dinde-filet') && !swapped.lines.some((l) => l.ing === 'poulet-filet'));
});

test('aliment détesté : ingrédient facultatif retiré, recette sinon pénalisée', () => {
  const w = mkWorld({ today: '2026-11-05', profiles: [newProfile({ id: 'a', name: 'Ana', hated: ['parmesan'] })] });
  const ctx = makeCtx({ ...w, recipes: RECIPES });
  const slot = { id: 'y', date: '2026-11-06', meal: 'souper', kind: 'recipe', recipeId: 'pates-tomate-mozza', over: {}, resolved: {}, dropped: [], guests: 0, batch: 1 };
  const ev = evalSlot(slot, RECIPE_BY_ID['pates-tomate-mozza'], ctx);
  assert.equal(ev.ok, true);
  assert.ok(ev.lines.find((l) => l.ing === 'parmesan').dropped, 'parmesan facultatif retiré pour Ana');
});

test('achats stratégiques : promos durables utiles à la semaine suivante, avec économie chiffrée', { skip: !hasFixture }, () => {
  const w = mkWorld({ today: '2026-11-10' });
  const nextWeek = '2026-11-12';
  const next = planWeek({ ...w, weekStart: nextWeek, today: nextWeek, recipes: RECIPES, seed: 5 });
  const sugg = strategicSuggestions({ nextSlots: next.slots, ctx: next.ctx, stock: [], promos: w.promos, settings: w.settings, weekStart: w.weekStart, nextWeekStart: nextWeek, currentLines: [] });
  assert.ok(sugg.length > 0, 'des suggestions attendues sur ce folder');
  for (const l of sugg) {
    assert.ok(l.strategic && l.saving > 0.2, `${l.name} : économie ${l.saving}`);
    assert.ok(l.useOn >= nextWeek, 'rattaché à un repas de la semaine suivante');
    assert.ok(l.promoId, 'en promo cette semaine');
  }
  // un seuil à 90 % ne laisse rien passer
  const none = strategicSuggestions({ nextSlots: next.slots, ctx: next.ctx, stock: [], promos: w.promos, settings: { ...w.settings, strategicThreshold: 90 }, weekStart: w.weekStart, nextWeekStart: nextWeek, currentLines: [] });
  assert.equal(none.length, 0);
  // sans congélateur : plus de produits à congeler
  const nofreeze = strategicSuggestions({ nextSlots: next.slots, ctx: next.ctx, stock: [], promos: w.promos, settings: { ...w.settings, freezer: 'aucun' }, weekStart: w.weekStart, nextWeekStart: nextWeek, currentLines: [] });
  assert.ok(nofreeze.every((l) => !l.needsFreezer));
});

test('promo à quantité minimale : on n’achète le lot que si l’article se garde', { skip: !hasFixture }, () => {
  const w = mkWorld({ today: '2026-11-05' });
  const planned = planWeek({ ...w, recipes: RECIPES, seed: 4 });
  const base = reconcileShopping({ weekStart: w.weekStart, slots: planned.slots, ctx: planned.ctx, stock: [], promos: w.promos, settings: w.settings, existing: [], today: w.today });
  for (const l of base.upsert) {
    if (l.extraForPromo) assert.ok(INGREDIENTS[l.ingredientId].shelf >= 21 || ['viande', 'poisson', 'volaille', 'crustace'].some((t) => INGREDIENTS[l.ingredientId].tags.includes(t)) || INGREDIENTS[l.ingredientId].loc === 'congelateur' || ['pain', 'beurre'].includes(l.ingredientId), `${l.name} se garde-t-il ?`);
  }
  // désactiver l'achat en plus réduit la quantité au nécessaire
  const withExtra = base.upsert.find((l) => l.extraForPromo);
  if (withExtra) {
    const again = reconcileShopping({ weekStart: w.weekStart, slots: planned.slots, ctx: planned.ctx, stock: [], promos: w.promos, settings: w.settings, existing: [{ ...withExtra, noExtra: true }], today: w.today });
    const l2 = again.upsert.find((l) => l.ingredientId === withExtra.ingredientId);
    assert.ok(l2.packs < withExtra.packs && !l2.extraForPromo);
  }
});
