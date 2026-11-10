import * as St from '../store.js';
import * as A from '../actions.js';
import { h, chip, toast, sheet, field, input, select, segmented, clear, parseNum, confirmSheet } from '../ui.js';
import { header, syncBanner } from '../common.js';
import { INGREDIENTS, DEFAULT_BASICS } from '/shared/ingredients.js';
import { LOC_LABEL, daysLeft, urgency, estimateUseBy } from '/shared/stock.js';
import { fmtQty, todayStr, fmtDM, addDays } from '/shared/util.js';

let tab = 'frigo';
const rerender = () => window.dispatchEvent(new Event('omq:render'));
const TABS = [['placard', '🥫 Placard'], ['frigo', '🧀 Frigo'], ['congelateur', '🧊 Congélateur'], ['restes', '♻️ Restes'], ['basiques', '🧂 Basiques']];

export function renderStock(root) {
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

export function stockSheet(it) {
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

export function inventorySheet() {
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
