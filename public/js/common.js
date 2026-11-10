// Composants partagés entre les écrans : en-tête, fiche de repas, feuille de repas, confirmation « C'est fait », refus.
import * as St from './store.js';
import * as A from './actions.js';
import { h, chip, sheet, toast, field, input, select, segmented, fmtNum, parseNum, confirmSheet, clear } from './ui.js';
import { CATEGORIES, MEALS, totalTime } from '/shared/recipes.js';
import { INGREDIENTS, RAYON_ICON } from '/shared/ingredients.js';
import { fmtQty, eur, fmtDayLong, fmtDayShort, todayStr, addDays, weekStartFor, norm } from '/shared/util.js';
import { substituteOptions } from '/shared/planner.js';
import { discountOf } from '/shared/pricing.js';
import { slotPortions } from '/shared/rules.js';

export const go = (path) => { location.hash = `#/${path}`; };

export function header(title, sub, right) {
  return h('div.top', h('div.grow', h('h1', title), sub && h('div.sub', sub)), right);
}

const NOTHING = () => document.createDocumentFragment();
export function syncBanner() {
  const pend = St.pendingCount();
  if (St.S.meta.error) return h('div.banner.offline', '⚠️ ', St.S.meta.error);
  if (!St.S.meta.online) return h('div.banner.offline', '📶 Hors connexion — tout reste utilisable, la synchronisation reprendra au retour du réseau', pend ? ` (${pend} modification${pend > 1 ? 's' : ''} en attente)` : '');
  return NOTHING();
}

export const catChip = (cat) => h('span.chip.cat', { style: { background: CATEGORIES[cat]?.color } }, CATEGORIES[cat]?.label ?? cat);

/** Libellé de la personne / des couverts d'un repas. */
export function whoLabel(slot) {
  const info = slotPortions(slot, St.list('profiles'), St.settings());
  return `${info.couverts} couvert${info.couverts > 1 ? 's' : ''}`;
}

/** Nom, emoji et sous-titre d'un repas du planning. */
export function slotView(slot) {
  if (slot.kind === 'none') return { emoji: '➖', name: slot.note || 'Pas de repas', sub: '', recipe: null };
  const recipe = A.recipeById(slot.recipeId);
  if (!recipe) return { emoji: '❔', name: 'Recette introuvable', sub: '', recipe: null };
  if (slot.kind === 'leftover') return { emoji: '♻️', name: `Restes : ${recipe.name}`, sub: 'à réchauffer', recipe };
  return { emoji: recipe.emoji, name: recipe.name, sub: `${totalTime(recipe)} min · ${whoLabel(slot)}`, recipe };
}

export function mealRow(slot, onClick) {
  const v = slotView(slot);
  return h('button.slot-row', { onclick: onClick, 'aria-label': `${MEALS[slot.meal].label} : ${v.name}` },
    h('span.em', slot.status === 'done' ? '✅' : v.emoji),
    h('span', h('span.slot-lbl', MEALS[slot.meal].label, slot.locked ? ' 🔒' : ''), h('div.t', { style: slot.status === 'done' ? { textDecoration: 'line-through', opacity: .6 } : null }, v.name), v.sub && h('small', v.sub)),
    v.recipe && slot.kind === 'recipe' ? catChip(v.recipe.cat) : '');
}

// ---------- Feuille d'un repas ----------
export function openSlotSheet(slotIn) {
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
export function refuseSheet(slot, after, onlyIng = null) {
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
export function openCookSheet(slotIn) {
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

export function reportRecipe(recipe) {
  sheet({
    title: 'Signaler',
    body: (close) => {
      let why = 'temps';
      const ta = h('textarea', { placeholder: 'Précisions (facultatif)' });
      return [segmented([['temps', 'Temps faux'], ['quantites', 'Quantités'], ['gout', 'Pas bon']], why, (v) => { why = v; }), field('Détails', ta), h('button.btn.primary.block', { onclick: () => { St.put('flags', { id: `flag-${recipe.id}`, recipeId: recipe.id, why, note: ta.value, date: todayStr() }); toast('Merci — cette recette ne sera plus proposée'); close(); } }, 'Envoyer et ne plus proposer')];
    },
  });
}

export const priceText = (p) => (p == null ? '—' : eur(p));
export { fmtDayLong, fmtDayShort };
