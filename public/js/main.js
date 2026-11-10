import * as St from './store.js';
import * as A from './actions.js';
import { h, clear, toast, closeTop } from './ui.js';
import { renderToday } from './screens/today.js';
import { renderWeek } from './screens/week.js';
import { renderShop } from './screens/shop.js';
import { renderRecipe } from './screens/recipe.js';
import { renderStock } from './screens/stock.js';
import { renderFoyer } from './screens/foyer.js';
import { startOnboarding } from './screens/onboarding.js';
import { showWelcome } from './screens/welcome.js';
import { expiringSoon } from '/shared/stock.js';
import { todayStr, addDays, dow } from '/shared/util.js';

const TABS = [
  ['aujourdhui', '🏠', 'Aujourd’hui', renderToday],
  ['semaine', '📅', 'Semaine', renderWeek],
  ['courses', '🛒', 'Courses', renderShop],
  ['recette', '👩‍🍳', 'Recette', renderRecipe],
  ['stock', '🧊', 'Stock', renderStock],
  ['foyer', '👨‍👩‍👧', 'Foyer', renderFoyer],
];

const app = document.getElementById('app');
const nav = document.getElementById('tabs');
const parse = () => {
  const [, name = 'aujourdhui', ...rest] = location.hash.replace(/^#/, '').split('/');
  return { name: TABS.some((t) => t[0] === name) ? name : 'aujourdhui', param: rest.join('/') || null };
};

let raf = 0;
function render() {
  clearTimeout(raf);
  raf = setTimeout(() => { // setTimeout plutôt que rAF : fonctionne aussi quand l'onglet est en arrière-plan
    {
    const { name, param } = parse();
    const y = window.scrollY;
    const tab = TABS.find((t) => t[0] === name);
    clear(app);
    try { tab[3](app, param); } catch (e) { console.error(e); app.append(h('div.card.bad', h('b', 'Oups, un écran a planté'), h('pre', { style: { whiteSpace: 'pre-wrap', fontSize: '.8rem' } }, String(e.stack || e)))); }
    drawNav(name);
    window.scrollTo(0, y);
    }
  }, 0);
}
const openLines = () => St.list('shopping').filter((l) => l.week === A.currentWeek() && !l.checked && !l.refused && l.kind !== 'manual').length;
function drawNav(active) {
  clear(nav);
  for (const [k, ico, label] of TABS) {
    const n = k === 'courses' ? openLines() : 0;
    nav.append(h('a', { href: `#/${k}`, 'aria-current': active === k ? 'page' : null }, h('span.ico', ico), label, n > 0 && h('span.dot', n > 99 ? '99+' : n)));
  }
}

window.addEventListener('hashchange', () => { closeTop(); window.scrollTo(0, 0); render(); });
window.addEventListener('omq:render', render);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeTop(); });
St.subscribe(() => { try { A.refreshShopping(); } catch (e) { console.error(e); } render(); });

// ---------- Notifications locales (l'app doit avoir été ouverte récemment ; pas de push serveur en V1) ----------
async function notifyOnce(tag, title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const key = `omq:notif:${tag}:${todayStr()}`;
  try { if (localStorage.getItem(key)) return; localStorage.setItem(key, '1'); } catch { /* ignoré */ }
  const reg = await navigator.serviceWorker?.getRegistration();
  if (reg) reg.showNotification(title, { body, icon: '/icons/icon-192.png', tag });
  else new Notification(title, { body });
}
function checkReminders() {
  const today = todayStr();
  const soon = expiringSoon(St.list('stock'), today, 2);
  if (soon.length) notifyOnce('expire', 'À utiliser vite', soon.slice(0, 3).map((s) => s.name).join(', '));
  if (dow(today) === 2) { // mardi soir : la promo se termine mercredi
    const n = St.list('shopping').filter((l) => l.week === A.currentWeek() && !l.checked && !l.refused && l.promoId).length;
    if (n && new Date().getHours() >= 17) notifyOnce('promo-fin', 'Dernier jour des promos demain', `${n} article${n > 1 ? 's' : ''} en promo encore sur ta liste`);
  }
  const fresh = St.list('folders').find((f) => f.status === 'ok' && f.validFrom > today);
  if (fresh) notifyOnce('folder-' + fresh.slug, 'Nouveau folder disponible', 'Les promos de la semaine prochaine sont en ligne.');
}

async function boot() {
  app.append(h('div.empty', h('span.big', '🍽️'), 'Chargement…'));
  await St.init();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  const s = St.settings();
  render();
  if (!St.hasAccount()) setTimeout(showWelcome, 250);
  else if (!s.onboarded && !St.list('profiles').length) setTimeout(startOnboarding, 250);
  A.refreshShopping(A.currentWeek(), true);
  checkReminders();
  setInterval(checkReminders, 30 * 60 * 1000);
}
boot();
