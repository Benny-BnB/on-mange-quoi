// Première utilisation : profils → matériel → repas → inventaire (facultatif) → première génération. Moins de 5 minutes.
import * as St from '../store.js';
import * as A from '../actions.js';
import { h, chip, toast, sheet, field, input, select, segmented, toggle, clear, parseNum } from '../ui.js';
import { profileSheet } from './foyer.js';
import { inventorySheet } from './stock.js';
import { EQUIPMENT, MEALS } from '/shared/recipes.js';
import { AGE_CATS } from '/shared/efsa.js';
import { coefOf } from '/shared/rules.js';
import { fmtNum } from '../ui.js';
import { go } from '../common.js';

export function startOnboarding() {
  let step = 0;
  const STEPS = ['Le foyer', 'La cuisine', 'Les repas', 'Le stock', 'C’est parti'];
  let panel;
  const s = sheet({
    title: 'Bienvenue 👋', wide: true,
    onClose: () => {},
    body: () => { panel = h('div'); draw(); return panel; },
  });
  function draw() {
    const settings = St.settings();
    const profiles = St.list('profiles');
    clear(panel);
    panel.append(h('div.wizard-steps', STEPS.map((_, i) => h('i' + (i <= step ? '.on' : ''))), ), h('h2', `${step + 1}. ${STEPS[step]}`));
    const nav = (canNext = true, label = 'Suivant') => h('div.row', { style: { marginTop: '18px' } },
      step > 0 && h('button.btn', { onclick: () => { step--; draw(); } }, 'Retour'),
      h('button.btn.primary.grow', { disabled: !canNext, onclick: () => { step++; draw(); } }, label));

    if (step === 0) {
      panel.append(h('p.muted', 'Chaque personne en moins d’une minute : prénom, âge, sexe — c’est tout ce qu’il faut pour calculer les portions. Le reste est facultatif (allergies, régime, goûts).'));
      const card = h('div.card.tight');
      for (const p of profiles) card.append(h('div.stock-row', h('div', h('b', p.name), h('small', ` ${AGE_CATS[p.ageCat].label}`)), chip(`× ${fmtNum(coefOf(p, settings), 2)}`, 'blue')));
      if (profiles.length) panel.append(card);
      panel.append(h('button.btn.block', { style: { marginTop: '10px' }, onclick: () => profileSheet(null, { onSaved: draw }) }, profiles.length ? '+ Ajouter une autre personne' : '+ Ajouter la première personne'), nav(profiles.length > 0));
    }
    if (step === 1) {
      panel.append(h('p.muted', 'Les recettes qui demandent un appareil que tu n’as pas ne seront jamais proposées.'));
      panel.append(h('div.card', h('div.checks', Object.entries(EQUIPMENT).map(([k, l]) => toggle(!!settings.equipment[k], (v) => St.saveSettings({ equipment: { ...St.settings().equipment, [k]: v } }), l))),
        field('Congélateur', segmented([['aucun', 'Aucun'], ['petit', 'Petit'], ['moyen', 'Moyen'], ['grand', 'Grand']], settings.freezer, (v) => St.saveSettings({ freezer: v }))),
        field('Budget courses par semaine (€)', input({ type: 'number', inputmode: 'decimal', value: settings.budget, onchange: (e) => St.saveSettings({ budget: parseNum(e.target.value) || 0 }) }))));
      panel.append(nav());
    }
    if (step === 2) {
      panel.append(h('div.card', h('div.checks', Object.entries(MEALS).map(([k, m]) => toggle(!!settings.meals[k], (v) => St.saveSettings({ meals: { ...St.settings().meals, [k]: v } }), `${m.emoji} ${m.label}`))),
        toggle(settings.timeRules.semaine.souper === 20, (v) => St.saveSettings({ timeRules: { ...St.settings().timeRules, semaine: { ...St.settings().timeRules.semaine, souper: v ? 20 : null } } }), 'En semaine, souper express (20 min max)')));
      panel.append(h('small.muted', { style: { display: 'block', marginTop: '8px' } }, 'Les absences (ex. midi en semaine) se règlent dans chaque profil.'), nav());
    }
    if (step === 3) {
      panel.append(h('p.muted', 'Facultatif : indique ce que tu as déjà pour des listes justes dès la première semaine. Sans inventaire, le stock démarre vide et se remplit tout seul quand tu coches « Acheté ».'),
        h('button.btn.block', { onclick: () => inventorySheet() }, '📦 Faire l’inventaire rapide'), nav(true, 'Passer / Suivant'));
    }
    if (step === 4) {
      panel.append(h('p', 'Tout est prêt. L’app lit le folder Delhaize de la semaine, planifie les repas autour des promos et prépare la liste de courses.'));
      panel.append(h('button.btn.primary.block', { onclick: async () => {
        St.saveSettings({ onboarded: true });
        toast('Planning en cours…');
        const ws = A.currentWeek();
        // le serveur lit le folder chaque semaine ; on ne relance qu'en l'absence de promos valides
        if (!St.list('folders').some((f) => f.status === 'ok')) { try { await St.api('/api/folder/refresh', { method: 'POST', body: JSON.stringify({}) }); await St.syncNow(); } catch { /* hors ligne : on planifie avec les prix habituels */ } }
        setTimeout(() => { A.generatePlan(ws); s.close(); go('semaine'); }, 30);
      } }, '✨ Générer ma première semaine'), h('div.row', { style: { marginTop: '10px' } }, h('button.btn', { onclick: () => { step--; draw(); } }, 'Retour')));
    }
  }
  return s;
}
