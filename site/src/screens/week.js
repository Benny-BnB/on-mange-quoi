import * as St from '../store.js';
import * as A from '../actions.js';
import { h, chip, toast, sheet, field, input, select, confirmSheet, clear, parseNum } from '../ui.js';
import { header, syncBanner, mealRow, openSlotSheet, go, catChip } from '../common.js';
import { showKeySheet } from './key.js';
import { MEALS, CATEGORIES } from '/shared/recipes.js';
import { INGREDIENTS } from '/shared/ingredients.js';
import { eur, fmtDayShort, fmtDM, addDays, weekDays, folderSlugFor, todayStr, DAY_LABELS, dayKey, fmtQty } from '/shared/util.js';
import { shoppingTotals, promoCoverage } from '/shared/shopping.js';
import { discountOf, promoIngredient } from '/shared/pricing.js';

let offset = 0;
const ORDER = ['petit-dej', 'diner', 'souper', 'collation'];

export function renderWeek(root) {
  const base = A.currentWeek();
  const ws = addDays(base, offset * 7);
  const today = todayStr();
  const slots = A.slotsOfWeek(ws);
  const settings = St.settings();
  const slug = folderSlugFor(ws);
  const folder = St.get('folders', slug);
  const promos = St.list('promos').filter((p) => p.folder === slug || (p.validFrom && p.validFrom <= addDays(ws, 6) && p.validTo >= ws));

  root.append(header('Semaine', `du ${fmtDayShort(ws)} au ${fmtDayShort(addDays(ws, 6))}`,
    h('div.row', h('button.icon-btn', { onclick: () => { offset = Math.max(-1, offset - 1); rerender(); }, 'aria-label': 'Semaine précédente', disabled: offset <= -1 }, '‹'), h('button.icon-btn', { onclick: () => { offset = Math.min(1, offset + 1); rerender(); }, 'aria-label': 'Semaine suivante', disabled: offset >= 1 }, '›'))), syncBanner());

  // ----- dossier promos -----
  const fcard = h('div.card.stack');
  const statusChip = !folder ? chip('pas lu', 'amber') : folder.status === 'ok' ? chip(`${folder.count} articles`, 'green') : folder.status === 'pending' ? chip('pas encore en ligne', 'amber') : chip(folder.status === 'incomplete' ? 'à vérifier' : 'erreur', 'red');
  fcard.append(h('div.row', h('b.grow', '🏷️ Folder Delhaize'), statusChip));
  fcard.append(h('small.muted', folder?.validFrom ? `Valable du ${fmtDM(folder.validFrom)} au ${fmtDM(folder.validTo)}` : `Semaine ${slug.slice(0, 3).toUpperCase()}`));
  if (folder?.message) fcard.append(h('div.banner.offline', folder.message));
  fcard.append(h('div.row.wrap',
    h('button.btn.small', { onclick: () => openPromos(ws, promos) }, `Voir les promos (${promos.length})`),
    h('button.btn.small', { onclick: () => refreshFolder(slug, folder) }, '↻ Mettre à jour'),
    h('button.btn.small', { onclick: () => importSheet(slug, ws) }, '✍️ Saisir / importer')));
  root.append(fcard);

  // ----- actions -----
  const hasPlan = slots.length > 0;
  const gen = async () => {
    if (hasPlan && !(await confirmSheet({ title: 'Régénérer la semaine ?', text: 'Les repas déjà faits ou verrouillés sont conservés ; les autres sont remplacés.', ok: 'Régénérer' }))) return;
    toast('Planning en cours…');
    setTimeout(() => { const n = A.generatePlan(ws); toast(`${n} repas planifiés ✨`); }, 30);
  };
  root.append(h('div.row', { style: { marginTop: '12px' } },
    h('button.btn.primary.grow', { onclick: gen }, hasPlan ? '🔄 Régénérer' : '✨ Générer la semaine'),
    hasPlan && h('button.btn.good.grow', { onclick: () => { A.refreshShopping(ws, true); go('courses'); } }, '🛒 Valider → courses')));
  if (!St.list('profiles').length) root.append(h('div.banner.demo', { style: { marginTop: '10px' } }, '👋 Ajoute d’abord les profils du foyer (écran Foyer) pour calculer les portions.'));

  if (!hasPlan) {
    root.append(h('div.empty', h('span.big', '📅'), h('p', 'Aucun planning pour cette semaine.'), !promos.length && h('small', 'Sans promos lues, l’app planifie avec les prix habituels estimés.')));
    return;
  }

  // ----- statistiques -----
  const st = A.stats(ws);
  const lines = St.list('shopping').filter((l) => l.week === ws);
  const tot = shoppingTotals(lines);
  const planned = tot.spent + tot.remaining;
  const budget = settings.budget || 0;
  const cov = promoCoverage(lines);
  const pct = budget ? Math.min(100, (planned / budget) * 100) : 0;
  const over = budget && planned > budget;
  root.append(h('div.card.stack', { style: { marginTop: '12px' } },
    h('div.stats',
      h('div.stat', h('b', eur(planned)), h('small', 'courses estimées')),
      h('div.stat', h('b', `${Math.round((cov.total ? cov.rate : st.promoRate) * 100)} %`), h('small', 'en promo (obj. 80 %)')),
      h('div.stat', h('b', eur(tot.saved || st.saving)), h('small', 'économie promos'))),
    budget > 0 && h('div', h('div.row', h('small', `Budget : ${eur(budget)}`), h('small.right', over ? `dépasse de ${eur(planned - budget)}` : `reste ${eur(budget - planned)}`)), h('div.bar' + (over ? '.over' : pct > 85 ? '.mid' : ''), h('i', { style: { width: `${pct}%` } }))),
    over && h('div.row', h('small.grow', '💡 Le planning dépasse le budget.'), h('button.btn.small', { onclick: () => { const n = A.cheaper(ws); toast(n ? `${n} repas remplacé(s) par des options moins chères` : 'Pas d’alternative moins chère'); } }, 'Proposer moins cher'))));

  // ----- jours -----
  for (const d of weekDays(ws)) {
    const ds = slots.filter((s) => s.date === d).sort((a, b) => ORDER.indexOf(a.meal) - ORDER.indexOf(b.meal));
    if (!ds.length) continue;
    root.append(h('div.day-head' + (d === todayStr() ? '.today' : ''), h('h3', `${DAY_LABELS[dayKey(d)]} ${Number(d.slice(8))}`), d === todayStr() ? chip('aujourd’hui', 'promo') : d < todayStr() ? h('small', 'passé') : ''));
    root.append(h('div.card.tight', { style: d < todayStr() ? { opacity: .6 } : null }, ds.map((s) => mealRow(s, () => openSlotSheet(s)))));
  }
}

const rerender = () => window.dispatchEvent(new Event('omq:render'));

function refreshFolder(slug, folder) {
  sheet({
    title: 'Mettre à jour les promos',
    body: (close) => {
      const P = St.S.meta.promos;
      const upd = P.updatedAt ? new Date(P.updatedAt).toLocaleString('fr-BE', { dateStyle: 'short', timeStyle: 'short' }) : null;
      return [
        h('p', 'Le folder est lu automatiquement deux fois par jour par une tâche GitHub, puis publié (chiffré) sur le site. Cette page recharge les promos publiées.'),
        upd && h('small.muted', `Dernière publication : ${upd}${folder?.count ? ` · ${folder.count} articles pour cette semaine` : ''}.`),
        P.state === 'locked' && h('div.banner.offline', { style: { margin: '10px 0' } }, '🔒 Promos verrouillées : saisis le code du foyer.'),
        h('div.stack', { style: { marginTop: '12px' } },
          h('button.btn.primary.block', { onclick: async () => { toast('Rechargement…', { ms: 2000 }); await St.loadPromos(); toast(St.S.meta.promos.state === 'ok' ? 'Promos à jour ✅' : (St.S.meta.promos.message || 'Promos indisponibles')); close(); } }, '↻ Recharger les promos publiées'),
          h('button.btn.block', { onclick: () => { close(); showKeySheet(); } }, '🔒 Code du foyer')),
        h('p.muted', { style: { marginTop: '12px' } }, 'Pour relire le folder tout de suite : sur GitHub, onglet Actions → « Lecture du folder Delhaize » → Run workflow. Plan B : colle le texte avec « Saisir / importer ».'),
      ];
    },
  });
}

// ---------- Liste des promos ----------
function openPromos(ws, promos) {
  const settings = St.settings();
  sheet({
    wide: true, title: `Promos de la semaine (${promos.length})`,
    body: (close) => {
      const root = h('div.stack');
      const draw = () => {
        clear(root);
        const all = St.list('promos').filter((p) => promos.some((x) => x.id === p.id) || p.manual);
        const withIng = all.filter((p) => promoIngredient(p, St.settings()));
        const toCheck = withIng.filter((p) => p.confidence !== 'high');
        const good = withIng.filter((p) => p.confidence === 'high');
        const other = all.filter((p) => !promoIngredient(p, St.settings()));
        root.append(h('div.row.wrap', h('button.btn.small', { onclick: () => editPromoSheet(null, ws, draw) }, '+ Ajouter une promo'), h('small.muted', 'Les produits sont rattachés à un ingrédient générique ; corrige ici si besoin.')));
        const section = (title, list, cls = '') => {
          if (!list.length) return;
          root.append(h('div.section-title', title, h('span.count', list.length)));
          root.append(h('div.card.tight' + cls, list.sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((p) => promoRow(p, draw))));
        };
        section('À vérifier (prix ou mécanique incertains)', toCheck, '.warn');
        section('Utilisables pour tes repas', good);
        section('Non rattachées à un ingrédient', other);
      };
      draw();
      return root;
    },
  });
}

function promoRow(p, redraw) {
  const ing = promoIngredient(p, St.settings());
  const price = p.promo != null ? `${eur(p.promo / (p.n || 1))}${p.n > 1 ? ' pièce' : ''}` : 'prix ?';
  return h('div.stock-row', { style: { cursor: 'pointer' }, onclick: () => editPromoSheet(p, null, redraw) },
    h('div', h('div.nm', `${p.brand ? p.brand.split(',')[0] + ' · ' : ''}${p.name}`.slice(0, 90)), h('small', [p.format ? fmtQty(p.format.qty, p.format.unit) : p.basis ? `au ${p.basis}` : 'format ?', ing ? ` → ${INGREDIENTS[ing]?.name}` : ' → ?', p.validFrom && p.validFrom === p.validTo ? ` · le ${fmtDM(p.validFrom)} seulement` : ''].join(''))),
    h('div', { style: { textAlign: 'right' } }, h('b', price), h('div', p.mechanic ? chip(p.mechanic, 'promo') : '', p.confidence !== 'high' ? chip('?', 'amber') : '')));
}

const ING_OPTIONS = () => [['', '— aucun —'], ...Object.values(INGREDIENTS).filter((i) => !i.basic).sort((a, b) => a.name.localeCompare(b.name)).map((i) => [i.id, i.name])];

function editPromoSheet(p, ws, after) {
  const cur = p ?? { name: '', brand: '', n: 1, normal: null, promo: null, format: null, mechanic: '' };
  const f = { ing: p ? promoIngredient(p, St.settings()) || '' : '', name: cur.name, n: cur.n || 1, normal: cur.normal, promo: cur.promo, qty: cur.format?.qty ?? '', unit: cur.format?.unit ?? 'g', mechanic: cur.mechanic ?? '' };
  sheet({
    title: p ? 'Corriger la promo' : 'Ajouter une promo',
    body: () => [
      field('Produit', input({ type: 'text', value: f.name, oninput: (e) => { f.name = e.target.value; } })),
      field('Ingrédient correspondant', select(ING_OPTIONS(), f.ing, (v) => { f.ing = v; }), 'Mémorisé pour les prochains folders'),
      h('div.row', field('Prix normal (total)', input({ type: 'number', inputmode: 'decimal', step: '0.01', value: f.normal ?? '', onchange: (e) => { f.normal = parseNum(e.target.value) || null; } })), field('Prix promo (total)', input({ type: 'number', inputmode: 'decimal', step: '0.01', value: f.promo ?? '', onchange: (e) => { f.promo = parseNum(e.target.value) || null; } }))),
      h('div.row', field('Pour combien d’articles', input({ type: 'number', min: '1', value: f.n, onchange: (e) => { f.n = Math.max(1, parseInt(e.target.value) || 1); } })), field('Format d’un article', input({ type: 'number', inputmode: 'decimal', value: f.qty, onchange: (e) => { f.qty = parseNum(e.target.value) || ''; } })), field('Unité', select([['g', 'g'], ['ml', 'ml'], ['pc', 'pièces']], f.unit, (v) => { f.unit = v; }))),
      field('Mécanique', input({ type: 'text', value: f.mechanic, placeholder: '1+1 gratis, −30 %…', oninput: (e) => { f.mechanic = e.target.value; } })),
    ],
    footer: (close) => [
      p && h('button.btn', { onclick: () => { St.del('promos', p.id); A.refreshShopping(A.currentWeek(), true); close(); after?.(); } }, 'Supprimer'),
      h('button.btn.primary', { onclick: () => {
        const fields = { name: f.name || 'Produit', n: f.n, normal: f.normal, promo: f.promo, format: f.qty ? { qty: Number(f.qty), unit: f.unit } : null, mechanic: f.mechanic || null };
        if (p) { A.editPromo(p, fields); A.setPromoIngredient(St.get('promos', p.id), f.ing || null); } else { A.addPromo({ ...fields, ingredientId: f.ing || null, rayon: INGREDIENTS[f.ing]?.rayon ?? 'autre' }, ws); }
        close(); after?.();
      } }, 'Enregistrer'),
    ].filter(Boolean),
  });
}

// ---------- Import manuel (plan B) ----------
function importSheet(slug, ws) {
  const v = { text: '', from: ws, to: addDays(ws, 6) };
  sheet({
    title: 'Saisir / importer le folder',
    body: () => [
      h('p.muted', 'Si la lecture automatique échoue : colle ici le texte du folder (copié depuis delhaize.be ou le PDF). Tu peux aussi ajouter les promos une par une depuis « Voir les promos ».'),
      h('div.row', field('Du', input({ type: 'date', value: v.from, onchange: (e) => { v.from = e.target.value; } })), field('Au', input({ type: 'date', value: v.to, onchange: (e) => { v.to = e.target.value; } }))),
      field('Texte du folder', h('textarea', { placeholder: 'DELHAIZE\nFilet de poulet\n600 g\n9,99 6,99', oninput: (e) => { v.text = e.target.value; } })),
    ],
    footer: (close) => [h('button.btn', { onclick: close }, 'Annuler'), h('button.btn.primary', { onclick: async () => {
      if (!v.text.trim()) return toast('Colle d’abord du texte');
      const n = A.importFolderText({ slug, from: v.from, to: v.to, text: v.text });
      if (!n) return toast('Aucun article reconnu dans ce texte');
      toast(`${n} articles importés`); close();
    } }, 'Importer')],
  });
}
