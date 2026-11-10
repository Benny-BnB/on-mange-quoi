import { readFileSync } from 'node:fs';
import { parseFolder } from '../shared/folder-parser.js';
import { planWeek, evalSlot } from '../shared/planner.js';
import { reconcileShopping, shoppingTotals, promoCoverage } from '../shared/shopping.js';
import { RECIPES, CATEGORIES } from '../shared/recipes.js';
import { newProfile, DEFAULT_SETTINGS } from '../shared/rules.js';
import { eur, fmtQty, fmtDayShort } from '../shared/util.js';
const pages = JSON.parse(readFileSync(new URL('../data/folders/w45-2026-fr.pages.json', import.meta.url), 'utf8'));
const promos = parseFolder(pages, { slug: 'w45-2026-fr' }).items;
const profiles = [newProfile({ id: '1', name: 'Alice', sex: 'homme' }), newProfile({ id: '2', name: 'Bruno', sex: 'femme' }), newProfile({ id: '3', name: 'Chloé', ageCat: 'enfant_7_12' })];
const settings = DEFAULT_SETTINGS();
const w = { weekStart: '2026-11-05', today: '2026-11-05', profiles, settings, promos, stock: [], recipes: RECIPES };
const { slots, ctx, stats } = planWeek({ ...w, seed: Number(process.argv[2] || 1) });
for (const s of slots) {
  const r = ctx.recipeById[s.recipeId];
  const ev = r ? evalSlot(s, r, ctx) : null;
  console.log(fmtDayShort(s.date).padEnd(12), s.meal.padEnd(9), s.kind === 'leftover' ? '↻ restes' : (r ? `${r.emoji} ${r.name} [${CATEGORIES[r.cat].label}, ${r.prep + r.cook} min]` : s.kind), ev ? `· ${ev.info.portions.toFixed(2)} parts` : '', s.batch > 1 ? `· batch ×${s.batch}` : '');
}
console.log('\nStats: coût', eur(stats.cost), '| taux promo', (stats.promoRate * 100).toFixed(0) + '%', '| économie', eur(stats.saving));
const { upsert } = reconcileShopping({ weekStart: w.weekStart, slots, ctx, stock: [], promos, settings, existing: [], today: w.today });
const t = shoppingTotals(upsert);
console.log('\nCourses:', upsert.length, 'lignes | à acheter', eur(t.remaining), '| économies', eur(t.saved), '| couverture promo', (promoCoverage(upsert).rate * 100).toFixed(0) + '%');
for (const l of upsert.sort((a, b) => a.rayon.localeCompare(b.rayon))) console.log(' ', l.rayon.padEnd(15), l.name.padEnd(34), `${l.packs}×${fmtQty(l.size, l.unit)}`.padEnd(12), eur(l.price).padStart(8), l.mechanic ? `(${l.mechanic})` : '', l.extraForPromo ? `+${l.extraForPromo} pour la promo` : '');
