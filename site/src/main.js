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
import { showKeySheet } from './screens/key.js';

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
  const name = location.hash.replace(/^#\/?/, '');
  return TABS.some((t) => t[0] === name) ? name : 'aujourdhui';
};

let timer = 0;
function render() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    const name = current();
    const y = window.scrollY;
    clear(app);
    try { TABS.find((t) => t[0] === name)[3](app); }
    catch (e) { console.error(e); app.append(h('div.card.bad', h('b', 'Oups, un écran a planté'), h('pre', { style: { whiteSpace: 'pre-wrap', fontSize: '.8rem' } }, String(e.stack || e)))); }
    drawNav(name);
    window.scrollTo(0, y);
  }, 0);
}

const openLines = () => St.list('shopping').filter((l) => l.week === A.currentWeek() && !l.checked && !l.refused && l.kind !== 'manual').length;
function drawNav(active) {
  clear(tabs);
  for (const [k, ico, label] of TABS) {
    const n = k === 'courses' ? openLines() : 0;
    tabs.append(h('a', { href: `#${k}`, 'aria-current': active === k ? 'page' : null }, h('span.ico', ico), label, n > 0 && h('span.dot', n > 99 ? '99+' : n)));
  }
}

window.addEventListener('hashchange', () => { closeTop(); window.scrollTo(0, 0); render(); });
window.addEventListener('omq:render', render);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeTop(); });

let keyAsked = false;
St.subscribe(() => {
  try { A.refreshShopping(); } catch (e) { console.error(e); }
  // première ouverture du site avec des promos publiées mais pas de code : on le demande une fois
  if (!keyAsked && St.S.meta.promos.state === 'locked' && St.settings().onboarded) { keyAsked = true; setTimeout(() => showKeySheet(St.S.meta.promos.message), 400); }
  render();
});

async function boot() {
  render();
  await St.init();
  render();
  if (!St.settings().onboarded && !St.list('profiles').length) setTimeout(startOnboarding, 250);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => { /* hors ligne / navigation privée : l'app marche sans */ });
}
boot();
