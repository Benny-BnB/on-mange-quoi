import * as St from '../store.js';
import * as A from '../actions.js';
import { h, chip, toast, sheet, field, input, select, segmented, toggle, clear, parseNum, confirmSheet, fmtNum } from '../ui.js';
import { header, syncBanner } from '../common.js';
import { showKeySheet } from './key.js';
import { EQUIPMENT, MEALS } from '/shared/recipes.js';
import { ALLERGENS } from '/shared/ingredients.js';
import { AGE_CATS, energyNeedMJ, portionCoef, REF_MJ } from '/shared/efsa.js';
import { newProfile, DIETS, RELIGIOUS, SEXES, ACTIVITIES, APPETITES, coefOf } from '/shared/rules.js';
import { DAY_KEYS, DAY_LABELS, uid } from '/shared/util.js';

const rerender = () => window.dispatchEvent(new Event('omq:render'));
const DAYS = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];

export function renderFoyer(root) {
  const profiles = St.list('profiles');
  const s = St.settings();
  root.append(header('Foyer', 'profils, matériel, préférences'), syncBanner());

  // ----- profils -----
  root.append(h('div.section-title', 'Profils', h('span.count', profiles.length)));
  const pc = h('div.card.tight');
  if (!profiles.length) pc.append(h('div.empty', h('p', 'Aucun profil pour l’instant.')));
  for (const p of profiles) {
    const coef = coefOf(p, s);
    pc.append(h('div.stock-row', { style: { cursor: 'pointer' }, onclick: () => profileSheet(p) },
      h('div.person', h('div.avatar', (p.name || '?').slice(0, 1).toUpperCase()), h('div', h('div.nm', p.name || 'Sans prénom'), h('small', [AGE_CATS[p.ageCat]?.label, DIETS[p.diet] !== 'Aucun' ? DIETS[p.diet] : null, (p.allergens?.length ? `${p.allergens.length} allergie${p.allergens.length > 1 ? 's' : ''}` : null)].filter(Boolean).join(' · '))), chip(`× ${fmtNum(coef, 2)}`, 'blue')),
      h('span', '›')));
  }
  root.append(pc, h('button.btn.block', { style: { marginTop: '10px' }, onclick: () => profileSheet(null) }, '+ Ajouter une personne'));

  // ----- matériel -----
  root.append(h('div.section-title', 'Matériel de cuisine'));
  const eq = h('div.card');
  eq.append(h('div.checks', Object.entries(EQUIPMENT).map(([k, label]) => toggle(!!s.equipment[k], (v) => { St.saveSettings({ equipment: { ...s.equipment, [k]: v } }); A.refreshShopping(A.currentWeek(), true); }, label))));
  eq.append(h('small.muted', 'Un appareil cassé ? Décoche-le : les recettes qui en ont besoin ne sont plus proposées.'));
  eq.append(h('div.row', field('Nombre de feux', input({ type: 'number', min: '1', max: '8', value: s.feux, onchange: (e) => St.saveSettings({ feux: parseInt(e.target.value) || 4 }) })), field('Autre matériel', input({ type: 'text', value: s.equipmentOther, placeholder: 'wok, cocotte…', onchange: (e) => St.saveSettings({ equipmentOther: e.target.value }) }))));
  eq.append(field('Congélateur', segmented([['aucun', 'Aucun'], ['petit', 'Petit'], ['moyen', 'Moyen'], ['grand', 'Grand']], s.freezer, (v) => St.saveSettings({ freezer: v }))));
  root.append(eq);

  // ----- repas & temps -----
  root.append(h('div.section-title', 'Repas à planifier'));
  const meals = h('div.card');
  meals.append(h('div.checks', Object.entries(MEALS).map(([k, m]) => toggle(!!s.meals[k], (v) => St.saveSettings({ meals: { ...s.meals, [k]: v } }), `${m.emoji} ${m.label}`))));
  const LIM = [['', 'Libre'], ['20', 'Express (20 min)'], ['30', '30 min'], ['45', '45 min']];
  const lim = (when, meal) => String(s.timeRules?.[when]?.[meal] ?? '');
  const setLim = (when, meal, v) => St.saveSettings({ timeRules: { ...s.timeRules, [when]: { ...s.timeRules[when], [meal]: v ? Number(v) : null } } });
  meals.append(field('Souper en semaine (lundi → vendredi)', select(LIM, lim('semaine', 'souper'), (v) => setLim('semaine', 'souper', v)), 'Contrainte de temps appliquée à tous les soirs de semaine'),
    field('Souper le week-end', select(LIM, lim('weekend', 'souper'), (v) => setLim('weekend', 'souper', v))),
    field('Dîner (midi) en semaine', select(LIM, lim('semaine', 'diner'), (v) => setLim('semaine', 'diner', v))));
  root.append(meals);

  // ----- budget -----
  root.append(h('div.section-title', 'Budget'));
  root.append(h('div.card', field('Budget hebdomadaire (€)', input({ type: 'number', inputmode: 'decimal', step: '5', value: s.budget, onchange: (e) => St.saveSettings({ budget: parseNum(e.target.value) || 0 }) }), 'Modifiable à tout moment'), field('Seuil des achats stratégiques (% de remise)', input({ type: 'number', min: '5', max: '70', value: s.strategicThreshold, onchange: (e) => St.saveSettings({ strategicThreshold: parseInt(e.target.value) || 25 }) }))));

  // ----- aliments refusés -----
  root.append(h('div.section-title', 'Aliments refusés par le foyer'));
  const hated = h('div.card.stack');
  const chips = h('div.chip-row');
  for (const w of s.hated ?? []) chips.append(h('button.chip-btn', { onclick: () => { St.saveSettings({ hated: s.hated.filter((x) => x !== w) }); }, 'aria-label': `Retirer ${w}` }, `${w} ✕`));
  if (!(s.hated ?? []).length) chips.append(h('small.muted', 'Aucun. « Je n’en veux pas → ne plus jamais proposer » les ajoute ici.'));
  const addIn = input({ type: 'text', placeholder: 'ex. coriandre' });
  hated.append(chips, h('div.row', addIn, h('button.btn', { onclick: () => { const w = addIn.value.trim(); if (w) { St.saveSettings({ hated: [...new Set([...(s.hated ?? []), w])] }); addIn.value = ''; } } }, 'Ajouter')));
  root.append(hated);

  // ----- réglages avancés : portions -----
  root.append(h('details.card', { style: { marginTop: '16px' } }, h('summary', 'Portions & réglages avancés'),
    h('p.muted', { style: { marginTop: '8px' } }, `Coefficient = besoin énergétique du profil ÷ besoin de l’adulte de référence (${fmtNum(REF_MJ, 2)} MJ/j, moyenne H/F 30-39 ans, activité moyenne), table EFSA 2013. L’appétit ajuste ensuite la portion.`),
    h('div.row', ...['petit', 'normal', 'gros'].map((k) => field(`Appétit ${k}`, input({ type: 'number', step: '0.01', min: '0.5', max: '1.5', value: s.appetite[k], onchange: (e) => St.saveSettings({ appetite: { ...s.appetite, [k]: parseNum(e.target.value) || s.appetite[k] } }) }))))));

  // ----- promos -----
  root.append(h('div.section-title', 'Promos Delhaize'));
  const P = St.S.meta.promos;
  const pcard = h('div.card.stack');
  pcard.append(h('div.row', h('span.grow', P.state === 'ok' ? '🟢 Promos déverrouillées' : P.state === 'locked' ? '🔒 Verrouillées' : P.state === 'offline' ? '🟠 Hors connexion' : P.state === 'none' ? '⚪ Pas encore publiées' : P.state === 'error' ? '🔴 Indisponibles' : '…'), P.updatedAt && h('small', `publiées le ${new Date(P.updatedAt).toLocaleDateString('fr-BE')}`)));
  if (P.message) pcard.append(h('small.muted', P.message));
  pcard.append(h('small.muted', 'Lecture automatique du folder deux fois par jour (GitHub Actions). Le contenu est chiffré : le code du foyer le déverrouille.'));
  pcard.append(h('div.row.wrap', h('button.btn.small', { onclick: () => showKeySheet() }, '🔒 Code du foyer'), h('button.btn.small', { onclick: async () => { await St.loadPromos(); toast(St.S.meta.promos.state === 'ok' ? 'Promos à jour' : (St.S.meta.promos.message || 'Indisponible')); } }, '↻ Recharger')));
  root.append(pcard);

  // ----- sauvegarde & transfert -----
  root.append(h('div.section-title', 'Sauvegarde et transfert'));
  root.append(h('div.card.stack',
    h('p', 'Tes données (profils, planning, stock, courses) sont enregistrées dans ce navigateur, sur cet appareil. Il n’y a pas de synchronisation automatique entre appareils : pour changer de téléphone ou partager, exporte puis importe.'),
    h('div.row.wrap',
      h('button.btn.small', { onclick: () => downloadExport() }, '⬇︎ Exporter (fichier)'),
      h('button.btn.small', { onclick: () => copyExport() }, '📋 Copier le texte'),
      h('button.btn.small', { onclick: () => importSheet() }, '⬆︎ Importer…'))));

  // ----- données -----
  root.append(h('div.section-title', 'Données personnelles'));
  root.append(h('div.card.stack',
    h('p.muted', 'Les allergies et données de santé ne quittent jamais ce navigateur : le site est statique, il n’envoie rien nulle part.'),
    h('button.btn.small.danger', { onclick: async () => { if (await confirmSheet({ title: 'Tout effacer ?', text: 'Profils, stock, planning, courses : toutes tes données sont effacées de ce navigateur. Fais d’abord un export si tu veux les garder. Action irréversible.', ok: 'Tout effacer', danger: true })) { St.wipeAll(); toast('Données effacées'); rerender(); } } }, 'Tout effacer')));
  root.append(h('div.card.flat', { style: { marginTop: '14px' } }, h('small.muted', 'Usage strictement personnel (CGU Delhaize, art. 2.3.2) : les promos ne sont ni publiques ni à partager. Besoins énergétiques : EFSA, EFSA Journal 2013;11(1):3005. Vérifie toujours les étiquettes des produits en cas d’allergie.')));
}

function downloadExport() {
  const url = URL.createObjectURL(new Blob([St.exportJson()], { type: 'application/json' }));
  const a = h('a', { href: url, download: `on-mange-quoi-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  toast('Export prêt');
}
async function copyExport() {
  const text = St.exportJson();
  try { await navigator.clipboard.writeText(text); toast('Texte copié : colle-le dans « Importer » sur l’autre appareil'); }
  catch {
    sheet({ title: 'Copier le texte', body: () => [h('p.muted', 'Sélectionne tout le texte, copie-le, puis colle-le dans « Importer » sur l’autre appareil.'), h('textarea', { readonly: true, onfocus: (e) => e.target.select() }, text)] });
  }
}
function importSheet() {
  let text = '';
  sheet({
    title: 'Importer des données',
    body: () => [
      h('p.muted', 'Colle le texte exporté depuis l’autre appareil, ou choisis le fichier. Les données de cet appareil seront remplacées.'),
      field('Texte exporté', h('textarea', { placeholder: '{ "app": "on-mange-quoi", … }', oninput: (e) => { text = e.target.value; } })),
      field('…ou fichier', h('input', { type: 'file', accept: '.json,application/json', onchange: async (e) => { const f = e.target.files?.[0]; if (f) text = await f.text(); } })),
    ],
    footer: (close) => [h('button.btn', { onclick: close }, 'Annuler'), h('button.btn.primary', { onclick: async () => {
      if (!text.trim()) return toast('Colle d’abord le texte ou choisis un fichier');
      if (!(await confirmSheet({ title: 'Remplacer les données ?', text: 'Les données actuelles de cet appareil seront remplacées par celles de l’export.', ok: 'Remplacer' }))) return;
      try { const n = St.importJson(text); toast(`${n} éléments importés ✅`); close(); rerender(); } catch (e) { toast(e.message, { ms: 6000 }); }
    } }, 'Importer')],
  });
}

// ---------- Éditeur de profil ----------
export function profileSheet(p, { onSaved } = {}) {
  const isNew = !p;
  const v = { ...newProfile(), ...(p ?? {}), id: p?.id ?? uid(), presence: JSON.parse(JSON.stringify(p?.presence ?? {})) };
  const preview = h('div');
  const updatePreview = () => { clear(preview); preview.append(h('small.muted', `Portion : × ${fmtNum(coefOf(v, St.settings()), 2)} · besoin ≈ ${fmtNum(energyNeedMJ(v), 1)} MJ/jour (EFSA)`)); };
  return sheet({
    title: isNew ? 'Nouveau profil' : v.name || 'Profil', wide: true,
    body: () => {
      updatePreview();
      const root = h('div');
      root.append(
        field('Prénom *', input({ type: 'text', value: v.name, placeholder: 'Prénom', autofocus: true, oninput: (e) => { v.name = e.target.value; } })),
        field('Catégorie d’âge *', select(Object.entries(AGE_CATS).map(([k, c]) => [k, c.label]), v.ageCat, (x) => { v.ageCat = x; updatePreview(); })),
        field('Sexe *', segmented(Object.entries(SEXES), v.sex, (x) => { v.sex = x; updatePreview(); })),
        field('Appétit', segmented(Object.entries(APPETITES), v.appetite, (x) => { v.appetite = x; updatePreview(); })),
        field('Activité physique', segmented(Object.entries(ACTIVITIES), v.activity, (x) => { v.activity = x; updatePreview(); })),
        preview,
        field('Régime', select(Object.entries(DIETS), v.diet, (x) => { v.diet = x; })),
      );
      const rel = h('div.checks');
      for (const [k, l] of Object.entries(RELIGIOUS)) rel.append(toggle(v.religious.includes(k), (on) => { v.religious = on ? [...new Set([...v.religious, k])] : v.religious.filter((x) => x !== k); }, l));
      root.append(h('div.field', h('span.lbl', 'Restrictions religieuses'), rel));
      root.append(h('details.card.flat', { style: { margin: '12px 0' } }, h('summary', `Allergies et intolérances ${v.allergens.length ? `(${v.allergens.length})` : ''}`),
        h('p.muted', 'Exclusion stricte, pour tout le repas si la personne est présente.'),
        h('div.checks', Object.entries(ALLERGENS).map(([k, l]) => toggle(v.allergens.includes(k), (on) => { v.allergens = on ? [...new Set([...v.allergens, k])] : v.allergens.filter((x) => x !== k); }, l))),
        field('Autre allergie ou intolérance', input({ type: 'text', value: v.allergenFree, placeholder: 'ex. kiwi, fraise', oninput: (e) => { v.allergenFree = e.target.value; } }), 'Séparées par des virgules, exclusion stricte')));
      root.append(field('Aliments détestés', input({ type: 'text', value: (v.hated || []).join(', '), placeholder: 'coriandre, chou-fleur', oninput: (e) => { v.hated = e.target.value.split(',').map((x) => x.trim()).filter(Boolean); } }), 'Évités, ou recette proposée sans l’ingrédient pour cette personne'));
      root.append(toggle(v.snacks, (on) => { v.snacks = on; }, 'Planifier des collations pour cette personne'));
      // grille de présence
      const grid = h('div.grid-presence', h('b'), ...['petit-dej', 'diner', 'souper'].map((m) => h('small.center', MEALS[m].label.replace('Petit-déjeuner', 'Petit-déj'))));
      for (const d of DAYS) {
        grid.append(h('span', DAY_LABELS[d].slice(0, 3)));
        for (const m of ['petit-dej', 'diner', 'souper']) grid.append(h('input', { type: 'checkbox', checked: v.presence?.[d]?.[m] !== false, 'aria-label': `${DAY_LABELS[d]} ${MEALS[m].label}`, onchange: (e) => { v.presence[d] = { ...(v.presence[d] ?? {}), [m]: e.target.checked }; if (e.target.checked && Object.values(v.presence[d]).every((x) => x)) delete v.presence[d]; } }));
      }
      root.append(h('div.field', h('span.lbl', 'Présence aux repas'), h('small.muted', 'Décoche les repas où la personne est absente (ex. midi en semaine).'), grid));
      return root;
    },
    footer: (close) => [
      !isNew && h('button.btn', { onclick: async () => { if (await confirmSheet({ title: `Supprimer ${v.name} ?`, text: 'Le profil est retiré du foyer ; les portions sont recalculées.', ok: 'Supprimer', danger: true })) { St.del('profiles', v.id); A.refreshShopping(A.currentWeek(), true); close(); } } }, 'Supprimer'),
      h('button.btn.primary', { onclick: () => {
        if (!v.name.trim()) return toast('Le prénom est obligatoire');
        St.put('profiles', { ...v, name: v.name.trim() });
        A.refreshShopping(A.currentWeek(), true);
        close(); onSaved?.();
      } }, 'Enregistrer'),
    ].filter(Boolean),
  });
}
