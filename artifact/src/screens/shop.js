import * as St from '../store.js';
import * as A from '../actions.js';
import { h, chip, toast, sheet, field, input, select, confirmSheet, clear, parseNum } from '../ui.js';
import { header, syncBanner, go, refuseSheet } from '../common.js';
import { RAYONS, RAYON_ICON, INGREDIENTS } from '/shared/ingredients.js';
import { eur, fmtQty, fmtDayShort, todayStr, addDays, diffDays, fmtDM } from '/shared/util.js';
import { shoppingTotals, promoCoverage, lineCost } from '/shared/shopping.js';

const view = { mode: 'all', days: 3, picked: new Set(), cartOpen: false };
const rerender = () => window.dispatchEvent(new Event('omq:render'));

const qtyText = (l) => (l.kind === 'manual' ? l.qtyText || '' : `${l.packs > 1 ? `${l.packs} × ` : ''}${fmtQty(l.size, l.unit)}`);

export function renderShop(root) {
  const ws = A.currentWeek();
  const today = todayStr();
  const all = St.list('shopping').filter((l) => l.week === ws);
  const slots = A.slotsOfWeek(ws);
  const settings = St.settings();
  const wk = A.weekRecord(ws);
  root.append(header('Courses', `semaine du ${fmtDayShort(ws)} · passage n° ${wk.passage ?? 1}`,
    h('button.btn.small', { onclick: () => recapSheet(ws) }, '📊 Récap')), syncBanner());

  if (!slots.length && !all.length) {
    root.append(h('div.empty', h('span.big', '🛒'), h('p', 'La liste de courses se génère à partir du planning.'), h('button.btn.primary', { onclick: () => go('semaine') }, 'Planifier la semaine')),
      h('button.btn.block', { onclick: () => manualSheet(ws) }, '+ Ajouter un article'));
    return;
  }

  // ----- filtres -----
  const chips = h('div.chip-row', { style: { margin: '4px 0 10px' } });
  const setMode = (m, d) => { view.mode = m; if (d) view.days = d; rerender(); };
  chips.append(
    h('button.chip-btn' + (view.mode === 'all' ? '.on' : ''), { onclick: () => setMode('all') }, 'Tout'),
    ...[2, 3, 5].map((d) => h('button.chip-btn' + (view.mode === 'days' && view.days === d ? '.on' : ''), { onclick: () => setMode('days', d) }, `${d} jours`)),
    h('button.chip-btn' + (view.mode === 'pick' ? '.on' : ''), { onclick: () => pickSheet(all) }, view.mode === 'pick' ? `✓ Sélection (${view.picked.size})` : '☑︎ Choisir…'));
  root.append(chips);

  const open = all.filter((l) => !l.checked && !l.refused);
  const visible = open.filter((l) => {
    if (view.mode === 'days') return !l.firstDate || diffDays(today, l.firstDate) < view.days || l.kind !== 'auto';
    if (view.mode === 'pick') return view.picked.has(l.id);
    return true;
  });

  // ----- lignes par rayon -----
  if (!visible.length) root.append(h('div.empty', h('span.big', '🎉'), h('p', open.length ? 'Rien à acheter pour cette sélection.' : 'Tout est acheté !')));
  for (const [rk, rl, ri] of RAYONS) {
    const ls = visible.filter((l) => (l.rayon ?? 'autre') === rk).sort((a, b) => a.name.localeCompare(b.name));
    if (!ls.length) continue;
    root.append(h('div.section-title', `${ri} ${rl}`, h('span.count', ls.length)), h('div.card.tight', ls.map((l) => lineRow(l))));
  }

  // ----- achetés -----
  const bought = all.filter((l) => l.checked);
  if (bought.length) {
    root.append(h('details.card', { style: { marginTop: '18px' }, open: view.cartOpen, ontoggle: (e) => { view.cartOpen = e.target.open; } },
      h('summary', `✅ Déjà acheté (${bought.length})`), h('div', { style: { marginTop: '8px' } }, bought.sort((a, b) => (b.boughtAt || '').localeCompare(a.boughtAt || '')).map((l) => lineRow(l)))));
  }

  // ----- achats stratégiques (bonus) -----
  const strat = A.strategic(ws);
  if (strat.length) {
    root.append(h('div.section-title', '🎯 Achats stratégiques', h('span.count', strat.length)),
      h('div.card.tight', h('small.muted', { style: { display: 'block', padding: '4px 0 6px' } }, `Promos de cette semaine utiles à la semaine prochaine (économie ≥ ${settings.strategicThreshold} %, produits qui se gardent ou se congèlent). Décochés par défaut.`), strat.map((l) => lineRow(l, true))));
  }

  root.append(h('button.btn.block', { style: { marginTop: '16px' }, onclick: () => manualSheet(ws) }, '+ Ajouter un article'));

  // ----- totaux -----
  const t = shoppingTotals(all, { passage: wk.passage ?? 1 });
  const cov = promoCoverage(all);
  const planned = t.spent + t.remaining;
  const spent = wk.spentOverride ?? t.spent;
  root.append(h('div.card.totals.stack', { style: { boxShadow: '0 -4px 18px rgba(0,0,0,.12)' } },
    h('div.stats',
      h('div.stat', h('b', eur(t.inBasket)), h('small', 'dans le panier')),
      h('div.stat', h('b', eur(t.remaining)), h('small', 'reste à acheter')),
      h('div.stat', h('b', eur(t.saved)), h('small', 'économies'))),
    h('div.row.wrap', h('small.grow', `${Math.round(cov.rate * 100)} % des articles en promo`, settings.budget ? ` · budget ${eur(settings.budget)} (prévu ${eur(planned)})` : ''),
      t.countBought > 0 && h('button.btn.small', { onclick: () => { A.endPassage(ws); toast('Passage terminé — le prochain démarre à zéro'); } }, 'Terminer ce passage'))));
}

function lineRow(l, strategic = false) {
  const done = !!l.checked;
  const price = lineCost(l);
  const sub = [];
  if (l.kind === 'auto' && l.recipes?.length) sub.push(l.recipes.slice(0, 2).join(', ') + (l.recipes.length > 2 ? ` +${l.recipes.length - 2}` : ''));
  if (strategic && l.useOn) sub.push(`prévu le ${fmtDM(l.useOn)}${l.needsFreezer ? ' · à congeler' : ''}`);
  if (l.extraForPromo) sub.push(`dont ${l.extraForPromo} en plus pour la promo (stock)`);
  if (l.kind === 'basic') sub.push('basique bientôt vide');
  const cb = h('input.cb', { type: 'checkbox', checked: done, 'aria-label': `${l.name} acheté`, onchange: (e) => {
    if (e.target.checked) { A.markBought(St.get('shopping', l.id) ?? l); if (strategic) St.patch('shopping', l.id, { strategic: true }); } else A.unbuy(St.get('shopping', l.id));
  } });
  return h('div.shop-line' + (done ? '.done' : ''), cb,
    h('div', { style: { cursor: 'pointer' }, onclick: () => lineSheet(St.get('shopping', l.id) ?? l, strategic) },
      h('div.nm', l.name), h('div.sub', qtyText(l), done && l.actualQty && l.actualQty !== l.qty ? ` → acheté ${fmtQty(l.actualQty, l.unit)}` : ''), sub.length > 0 && h('div.sub', sub.join(' · ')), l.mechanic && h('div', chip(l.mechanic, 'promo'))),
    h('div.price', eur(price), l.saving > 0 && !done ? h('small', { style: { color: 'var(--green)' } }, `−${eur(l.saving)}`) : ''));
}

function lineSheet(l, strategic) {
  sheet({
    title: l.name,
    body: (close) => {
      const root = h('div.stack');
      root.append(h('div.card.stack',
        h('div.row', h('b.grow', qtyText(l)), h('b', eur(lineCost(l)))),
        l.mechanic && h('div', chip(l.mechanic, 'promo'), l.minQty > 1 && h('small', ` dès ${l.minQty} articles`)),
        l.kind === 'auto' && l.need ? h('small.muted', `Besoin du planning : ${fmtQty(l.need, l.unit)}${l.packs ? ` · arrondi au format vendu` : ''}`) : '',
        l.recipes?.length ? h('small', `Pour : ${l.recipes.join(', ')}`) : ''));
      if (l.checked) {
        root.append(h('button.btn.block', { onclick: () => { A.unbuy(l); close(); } }, '↩︎ Pas encore acheté'));
        return root;
      }
      root.append(h('button.btn.block.good', { onclick: () => { close(); A.markBought(l); } }, '✅ Acheté'));
      if (l.extraForPromo) root.append(h('button.btn.block', { onclick: () => { A.setNoExtra(l, true); close(); toast('Quantité réduite au nécessaire'); } }, `Acheter seulement le nécessaire (sans ${l.extraForPromo} en plus pour la promo)`));
      if (l.noExtra && l.minQty > 1) root.append(h('button.btn.block', { onclick: () => { A.setNoExtra(l, false); close(); } }, `Profiter de la promo (dès ${l.minQty} articles)`));
      if (l.kind !== 'manual') root.append(h('button.btn.block', { onclick: () => { close(); boughtDiffSheet(l); } }, '✏️ Acheté différemment (autre quantité / prix)'));
      if (l.kind === 'auto' && l.ingredientId && !strategic) {
        root.append(h('button.btn.block', { onclick: () => {
          const slot = A.slotsUsing(l.week, l.ingredientId)[0];
          close();
          if (slot) refuseSheet(slot, null, l.ingredientId);
          else { St.put('shopping', { ...l, refused: true }); toast('Article retiré de la liste'); }
        } }, '🙅 Je n’en veux pas…'));
      }
      if (l.kind === 'manual' || l.kind === 'basic') root.append(h('button.btn.block', { onclick: () => { St.del('shopping', l.id); if (l.kind === 'basic') A.flagBasicLow(l.ingredientId, false); close(); } }, '🗑 Retirer de la liste'));
      return root;
    },
  });
}

function boughtDiffSheet(l) {
  const v = { qty: l.qty, price: l.price };
  sheet({
    title: 'Acheté différemment',
    body: () => [
      h('p.muted', `Prévu : ${qtyText(l)} pour ${eur(l.price)}. Indique ce que tu as vraiment pris : le stock sera mis à jour avec la quantité réelle.`),
      h('div.row', field(`Quantité réelle (${l.unit === 'pc' ? 'pièces' : l.unit})`, input({ type: 'number', inputmode: 'decimal', value: String(l.qty), onchange: (e) => { v.qty = parseNum(e.target.value) || 0; } })), field('Prix payé (€)', input({ type: 'number', inputmode: 'decimal', step: '0.01', value: String(l.price), onchange: (e) => { v.price = parseNum(e.target.value) || 0; } }))),
    ],
    footer: (close) => [h('button.btn', { onclick: close }, 'Annuler'), h('button.btn.good', { onclick: () => { A.markBought(l, { qty: v.qty, price: v.price }); close(); } }, 'Valider')],
  });
}

function pickSheet(all) {
  const open = all.filter((l) => !l.checked && !l.refused);
  const sel = new Set(view.picked.size ? view.picked : open.map((l) => l.id));
  sheet({
    title: 'Mon passage', wide: true,
    body: () => [
      h('p.muted', 'Coche ce que tu achètes à ce passage : le reste reste sur la liste.'),
      h('div.card.tight', open.sort((a, b) => a.name.localeCompare(b.name)).map((l) => h('label.tog', h('input', { type: 'checkbox', checked: sel.has(l.id), onchange: (e) => (e.target.checked ? sel.add(l.id) : sel.delete(l.id)) }), h('span.grow', l.name), h('small', qtyText(l))))),
    ],
    footer: (close) => [h('button.btn', { onclick: () => { view.mode = 'all'; view.picked = new Set(); close(); rerender(); } }, 'Tout afficher'), h('button.btn.primary', { onclick: () => { view.mode = 'pick'; view.picked = sel; close(); rerender(); } }, 'Afficher la sélection')],
  });
}

function manualSheet(ws) {
  const v = { name: '', qty: '', price: '', rayon: 'maison' };
  sheet({
    title: 'Ajouter un article',
    body: () => [
      h('p.muted', 'Article hors planning (papier toilette…) : sans effet sur les recettes ni le stock.'),
      field('Article', input({ type: 'text', placeholder: 'Papier toilette', oninput: (e) => { v.name = e.target.value; } })),
      h('div.row', field('Quantité', input({ type: 'text', placeholder: '1 pack', oninput: (e) => { v.qty = e.target.value; } })), field('Prix estimé (€)', input({ type: 'number', inputmode: 'decimal', step: '0.01', oninput: (e) => { v.price = e.target.value; } }))),
      field('Rayon', select(RAYONS.map(([k, l]) => [k, l]), v.rayon, (x) => { v.rayon = x; })),
    ],
    footer: (close) => [h('button.btn', { onclick: close }, 'Annuler'), h('button.btn.primary', { onclick: () => { if (!v.name.trim()) return toast('Donne un nom à l’article'); A.addManualLine(ws, { name: v.name.trim(), qty: v.qty, price: parseNum(v.price) || 0, rayon: v.rayon }); close(); } }, 'Ajouter')],
  });
}

function recapSheet(ws) {
  const lines = St.list('shopping').filter((l) => l.week === ws);
  const t = shoppingTotals(lines);
  const wk = A.weekRecord(ws);
  const settings = St.settings();
  const spent = wk.spentOverride ?? t.spent;
  const waste = St.list('waste').filter((w) => w.date >= ws && w.date <= addDays(ws, 6));
  const cov = promoCoverage(lines);
  sheet({
    title: 'Récap de la semaine',
    body: (close) => [
      h('div.stats',
        h('div.stat', h('b', eur(spent)), h('small', 'dépensé')),
        h('div.stat', h('b', eur(t.saved)), h('small', 'économisé (promos)')),
        h('div.stat', h('b', `${Math.round(cov.rate * 100)} %`), h('small', 'articles en promo'))),
      h('div.card', { style: { marginTop: '12px' } },
        h('div.row', h('span.grow', 'Budget hebdomadaire'), h('b', eur(settings.budget))),
        h('div.row', h('span.grow', 'Articles achetés'), h('b', t.countBought)),
        h('div.row', h('span.grow', 'Produits jetés'), h('b', waste.length))),
      field('Total réel du ticket (€)', input({ type: 'number', inputmode: 'decimal', step: '0.01', placeholder: String(t.spent), value: wk.spentOverride ?? '', onchange: (e) => { const x = parseNum(e.target.value); A.setSpentOverride(ws, Number.isFinite(x) ? x : null); toast('Dépense mise à jour'); } }), 'Remplace la somme des articles cochés si tu préfères saisir le total du ticket'),
    ],
  });
}
