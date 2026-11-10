import * as St from '../store.js';
import * as A from '../actions.js';
import { h, chip, toast } from '../ui.js';
import { header, syncBanner, slotView, mealRow, catChip, go, openSlotSheet, openCookSheet } from '../common.js';
import { MEALS, totalTime } from '/shared/recipes.js';
import { fmtDayLong, todayStr, addDays, weekStartFor, fmtDM } from '/shared/util.js';
import { expiringSoon, daysLeft } from '/shared/stock.js';
import { fmtQty } from '/shared/util.js';
import { promoEndingTomorrow } from '/shared/shopping.js';
import { startOnboarding } from './onboarding.js';

const ORDER = ['petit-dej', 'diner', 'souper', 'collation'];

export function renderToday(root) {
  const today = todayStr();
  const ws = weekStartFor(today);
  const profiles = St.list('profiles');
  const settings = St.settings();
  root.append(header('Aujourd’hui', fmtDayLong(today)), syncBanner());

  if (!profiles.length && St.S.meta.readOnly) {
    root.append(h('div.empty', h('span.big', '👀'), h('h2', 'Rien à afficher pour l’instant'), h('p', 'Cette page est en lecture seule et ne contient pas encore de profils. La personne qui l’a créée doit d’abord configurer le foyer.')));
    return;
  }
  if (!profiles.length) {
    root.append(h('div.empty', h('span.big', '👋'), h('h2', 'Bienvenue !'), h('p', 'Crée les profils du foyer en moins de 5 minutes, puis l’app planifie tous les repas autour des promos Delhaize.'), h('button.btn.primary', { onclick: () => startOnboarding() }, 'Commencer')));
    return;
  }

  const slots = A.slotsOfWeek(ws);
  const todays = slots.filter((s) => s.date === today).sort((a, b) => ORDER.indexOf(a.meal) - ORDER.indexOf(b.meal));

  // ----- alertes -----
  const alerts = [];
  const soon = expiringSoon(St.list('stock'), today, 2);
  if (soon.length) alerts.push(h('div.card.warn', h('b', `⏳ À utiliser vite (${soon.length})`), h('div', { style: { marginTop: '4px' } }, soon.slice(0, 5).map((s) => h('div', `${s.name} — ${fmtQty(s.qty, s.unit)} · ${daysLeft(s, today) <= 0 ? 'aujourd’hui' : `dans ${daysLeft(s, today)} j`}`)), soon.length > 5 && h('small', `+ ${soon.length - 5} autres`)), h('button.link', { onclick: () => go('stock') }, 'Voir le stock')));
  const ending = promoEndingTomorrow(St.list('shopping').filter((l) => l.week === ws), St.list('promos'), today);
  if (ending.length) alerts.push(h('div.card.warn', h('b', `🏷️ ${ending.length} promo${ending.length > 1 ? 's' : ''} se termine${ending.length > 1 ? 'nt' : ''} demain`), h('div', ending.slice(0, 4).map((l) => h('div', l.name))), h('button.link', { onclick: () => go('courses') }, 'Aller aux courses')));
  const fold = St.list('folders').sort((a, b) => b.slug.localeCompare(a.slug))[0];
  if (!fold || fold.status !== 'ok') alerts.push(h('div.card', h('b', fold ? '⚠️ Folder à vérifier' : 'ℹ️ Pas encore de promos'), h('p.muted', fold?.message ?? 'Les promos Delhaize ne sont pas encore publiées : la lecture automatique a lieu deux fois par jour. Tu peux aussi coller le texte du folder depuis l’écran Semaine.'), h('button.link', { onclick: () => go('semaine') }, 'Ouvrir la Semaine')));
  if (alerts.length) root.append(h('div.stack', alerts));

  if (!slots.length) {
    root.append(h('div.empty', h('span.big', '📅'), h('h2', 'Pas encore de planning'), h('p', 'Génère la semaine en un clic, tu pourras ensuite ajuster chaque repas.'), h('button.btn.primary', { onclick: () => { toast('Planning en cours…'); setTimeout(() => { A.generatePlan(ws); go('semaine'); }, 30); } }, '✨ Générer la semaine')));
    return;
  }

  root.append(h('div.section-title', 'Au menu aujourd’hui'));
  if (!todays.length) root.append(h('div.card.center', h('p', 'Aucun repas planifié aujourd’hui.'), h('button.btn', { onclick: () => go('semaine') }, 'Voir la semaine')));
  for (const s of todays) root.append(mealCard(s));

  // demain
  const tomorrow = slots.filter((s) => s.date === addDays(today, 1) && s.meal === 'souper' && s.recipeId);
  if (tomorrow.length) {
    const v = slotView(tomorrow[0]);
    root.append(h('div.section-title', 'Demain soir'), h('div.card.tight', mealRow(tomorrow[0], () => openSlotSheet(tomorrow[0]))));
  }
}

function mealCard(s) {
  const v = slotView(s);
  const done = s.status === 'done';
  const card = h('div.card.stack' + (done ? '.flat' : ''));
  card.append(h('div.meal' + (done ? '.done' : ''),
    h('div.emoji', done ? '✅' : v.emoji),
    h('div', h('div.slot-lbl', MEALS[s.meal].label), h('div.name', v.name), h('small', v.sub), v.recipe && s.kind === 'recipe' && h('div', { style: { marginTop: '4px' } }, catChip(v.recipe.cat))),
    h('button.icon-btn', { onclick: () => openSlotSheet(s), 'aria-label': 'Options du repas' }, '⋯')));
  if (!done && s.recipeId) {
    card.append(h('div.row.wrap',
      s.kind === 'recipe' && h('button.btn.small', { onclick: () => go(`recette/${s.id}`) }, 'Ouvrir la recette'),
      s.kind === 'recipe' && h('button.btn.small', { onclick: () => { if (!A.anotherIdea(s)) toast('Pas d’autre idée compatible'); } }, '🎲 Autre idée'),
      h('button.btn.small.good.right', { onclick: () => openCookSheet(s) }, '✅ C’est fait')));
  }
  return card;
}
