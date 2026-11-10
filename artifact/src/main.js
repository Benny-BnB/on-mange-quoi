import * as St from './store.js';
import * as A from './actions.js';
import { h, clear, closeTop, toast } from './ui.js';
import { nav } from './common.js';
import { renderToday } from './screens/today.js';
import { renderWeek } from './screens/week.js';
import { renderShop } from './screens/shop.js';
import { renderRecipe } from './screens/recipe.js';
import { renderStock } from './screens/stock.js';
import { renderFoyer } from './screens/foyer.js';
import { startOnboarding } from './screens/onboarding.js';

const TABS = [
  ['aujourdhui', '🏠', 'Aujourd’hui', renderToday],
  ['semaine', '📅', 'Semaine', renderWeek],
  ['courses', '🛒', 'Courses', renderShop],
  ['recette', '👩‍🍳', 'Recette', (root) => renderRecipe(root, nav.recipe)],
  ['stock', '🧊', 'Stock', renderStock],
  ['foyer', '👨‍👩‍👧', 'Foyer', renderFoyer],
];

const app = document.getElementById('app');
const tabs = document.getElementById('tabs');
const current = () => {
  const name = location.hash.replace(/^#/, '');
  return TABS.some((t) => t[0] === name) ? name : 'aujourdhui';
};

let timer = 0;
function render() {
  clearTimeout(timer);
  timer = setTimeout(() => { // setTimeout et non requestAnimationFrame : fonctionne aussi page masquée
    const name = current();
    const y = window.scrollY;
    clear(app);
    try {
      if (!St.S.meta.loaded) app.append(h('div.empty', h('span.big', '🍽️'), 'Chargement de tes données…'));
      else TABS.find((t) => t[0] === name)[3](app);
    } catch (e) { console.error(e); app.append(h('div.card.bad', h('b', 'Oups, un écran a planté'), h('pre', { style: { whiteSpace: 'pre-wrap', fontSize: '.8rem' } }, String(e.stack || e)))); }
    drawNav(name);
    window.scrollTo(0, y);
  }, 0);
}

const openLines = () => St.list('shopping').filter((l) => l.week === A.currentWeek() && !l.checked && !l.refused && l.kind !== 'manual').length;
function drawNav(active) {
  clear(tabs);
  for (const [k, ico, label] of TABS) {
    const n = St.S.meta.loaded && k === 'courses' ? openLines() : 0;
    tabs.append(h('a', { href: `#${k}`, 'aria-current': active === k ? 'page' : null }, h('span.ico', ico), label, n > 0 && h('span.dot', n > 99 ? '99+' : n)));
  }
}

window.addEventListener('hashchange', () => { closeTop(); window.scrollTo(0, 0); render(); });
window.addEventListener('omq:render', render);
window.addEventListener('omq:readonly', () => toast('Accès en lecture seule : tu ne peux pas modifier cette page.', { ms: 5000 }));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeTop(); });

let onboardingChecked = false;
St.subscribe(() => {
  if (St.S.meta.loaded) {
    try { A.refreshShopping(); } catch (e) { console.error(e); }
    if (!onboardingChecked) {
      onboardingChecked = true;
      if (!St.S.meta.readOnly && !St.settings().onboarded && !St.list('profiles').length) setTimeout(startOnboarding, 250);
    }
  }
  render();
});

async function boot() {
  render();
  await St.init(window.claude);
  render();
}
boot();
