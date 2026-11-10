import * as St from '../store.js';
import * as A from '../actions.js';
import { h, chip, toast, clear } from '../ui.js';
import { header, syncBanner, catChip, go, openCookSheet, openSlotSheet, reportRecipe, slotView } from '../common.js';
import { CATEGORIES, EQUIPMENT, MEALS, totalTime } from '/shared/recipes.js';
import { INGREDIENTS, ALLERGENS } from '/shared/ingredients.js';
import { derivedTags, allergensOf } from '/shared/rules.js';
import { linesCost } from '/shared/planner.js';
import { fmtQty, eur, todayStr, fmtDayShort, uniq } from '/shared/util.js';
import { stockQty } from '/shared/stock.js';

const cook = { key: null, on: false, step: 0, wake: null };
const timers = new Map(); // `${key}:${step}` → { total, endAt, left, running }
let ticker = null;
const rerender = () => window.dispatchEvent(new Event('omq:render'));
const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.max(0, Math.round(s % 60))).padStart(2, '0')}`;

function beep() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.35, 0.7].forEach((t) => { const o = ac.createOscillator(); const g = ac.createGain(); o.connect(g); g.connect(ac.destination); o.frequency.value = 880; g.gain.setValueAtTime(0.25, ac.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + t + 0.3); o.start(ac.currentTime + t); o.stop(ac.currentTime + t + 0.3); });
  } catch { /* audio indisponible */ }
  navigator.vibrate?.([300, 150, 300]);
}
function tick() {
  let any = false;
  for (const [k, t] of timers) {
    if (!t.running) continue;
    any = true;
    t.left = Math.max(0, (t.endAt - Date.now()) / 1000);
    const el = document.getElementById(`tm-${k.replace(/[^a-z0-9]/gi, '_')}`);
    if (el) el.textContent = mmss(t.left);
    if (t.left <= 0) {
      t.running = false; t.done = true;
      beep();
      toast('⏰ Minuteur terminé !', { ms: 8000 });
      if ('Notification' in window && Notification.permission === 'granted') new Notification('Minuteur terminé', { body: 'Une étape de cuisson est finie.' });
      rerender();
    }
  }
  if (!any) { clearInterval(ticker); ticker = null; }
}
const startTimer = (key, minutes) => {
  const t = timers.get(key) ?? { total: minutes * 60, left: minutes * 60, running: false };
  if (t.done) { t.left = t.total; t.done = false; }
  t.endAt = Date.now() + t.left * 1000; t.running = true;
  timers.set(key, t);
  if (!ticker) ticker = setInterval(tick, 250);
  if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
  rerender();
};
const pauseTimer = (key) => { const t = timers.get(key); if (t) { t.left = Math.max(0, (t.endAt - Date.now()) / 1000); t.running = false; rerender(); } };
const resetTimer = (key, minutes) => { timers.set(key, { total: minutes * 60, left: minutes * 60, running: false }); rerender(); };

async function setWake(on) {
  try {
    if (on && 'wakeLock' in navigator) cook.wake = await navigator.wakeLock.request('screen');
    else { await cook.wake?.release(); cook.wake = null; }
  } catch { /* refusé : pas grave */ }
}
document.addEventListener('visibilitychange', () => { if (cook.on && !document.hidden && !cook.wake) setWake(true); });

function resolveTarget(param) {
  const today = todayStr();
  if (param?.startsWith('r~')) {
    const recipe = A.recipeById(param.slice(2));
    if (!recipe) return null;
    return { slot: { id: 'preview', date: today, meal: recipe.meals[0], kind: 'recipe', recipeId: recipe.id, guests: 0, over: {}, resolved: {}, dropped: [], batch: 1 }, preview: true };
  }
  if (param) { const slot = St.get('plan', param); return slot ? { slot } : null; }
  const slots = A.slotsOfWeek(A.currentWeek()).filter((s) => s.kind === 'recipe' && s.recipeId && s.status !== 'done');
  const pick = slots.find((s) => s.date === today && s.meal === 'souper') ?? slots.find((s) => s.date === today) ?? slots.find((s) => s.date > today);
  return pick ? { slot: pick } : null;
}

export function renderRecipe(root, param) {
  const target = resolveTarget(param);
  if (!target) {
    root.append(header('Recette'), syncBanner(), h('div.empty', h('span.big', '👩‍🍳'), h('h2', 'Aucune recette en cours'), h('p', 'Ouvre un repas depuis Aujourd’hui ou la Semaine.'), h('button.btn.primary', { onclick: () => go('aujourdhui') }, 'Voir aujourd’hui')));
    return;
  }
  const { slot, preview } = target;
  if (slot.kind === 'leftover' || !slot.recipeId) { root.append(header('Recette'), h('div.empty', 'Ce repas n’a pas de recette à cuisiner.')); return; }
  const e = A.evalFor(slot);
  if (!e) { root.append(header('Recette'), h('div.empty', 'Recette introuvable.')); return; }
  const { recipe, ev, ctx } = e;
  const key = slot.id + ':' + recipe.id;
  if (cook.key !== key) { cook.key = key; cook.on = false; cook.step = 0; }
  const portions = ev.info.portions;
  const cost = linesCost(ev.lines, ctx);
  const steps = recipe.steps.map((s) => (Array.isArray(s) ? { t: s[0], min: s[1] } : { t: s }));

  if (cook.on) return renderCooking(root, { slot, recipe, steps, preview });

  root.append(header('Recette', preview ? 'aperçu' : `${fmtDayShort(slot.date)} · ${MEALS[slot.meal].label}`,
    h('button.icon-btn', { onclick: () => history.back(), 'aria-label': 'Retour' }, '←')), syncBanner());
  root.append(h('div.hero', h('div.big', recipe.emoji), h('h1', recipe.name),
    h('div.chip-row', { style: { justifyContent: 'center', marginTop: '8px' } }, catChip(recipe.cat), ...derivedTags(recipe, ev.lines.filter((l) => !l.dropped).map((l) => l.ing)).filter((t) => ['vegetarien', 'vegetalien', 'pesco', 'enfants', 'emporter', 'sans-four', 'apero'].includes(t)).map((t) => chip(TAG[t] ?? t, 'green')))));
  root.append(h('div.stats', { style: { margin: '10px 0' } },
    h('div.stat', h('b', `${recipe.prep} min`), h('small', 'préparation')),
    h('div.stat', h('b', `${recipe.cook} min`), h('small', 'cuisson')),
    h('div.stat', h('b', `${totalTime(recipe)} min`), h('small', `total · ${recipe.diff}`))));

  root.append(h('div.card.row', h('div.grow', h('b', `${ev.info.couverts} couvert${ev.info.couverts > 1 ? 's' : ''}`), h('div', h('small', `${ev.info.people.map((p) => p.name || '—').join(', ')}${ev.info.guests ? ` + ${ev.info.guests} invité${ev.info.guests > 1 ? 's' : ''}` : ''}`))),
    h('div', { style: { textAlign: 'right' } }, h('b', eur(cost.cost)), h('div', h('small', `${eur(cost.cost / Math.max(1, ev.info.couverts))} / personne`)))));
  if (!ev.ok) root.append(h('div.card.bad', h('b', '⛔ Incompatible avec une personne présente'), ev.reasons.map((r) => h('div', r))));
  if (ev.hated?.length) root.append(h('div.card.warn', ev.hated.map((x) => h('div', `😬 ${x.who || 'Quelqu’un'} n’aime pas : ${INGREDIENTS[x.ing]?.name}`))));
  if (slot.batch > 1) root.append(h('div.banner.demo', { style: { marginTop: '10px' } }, `🍲 Batch cooking : quantités ×${slot.batch} — il restera ${Math.round((slot.batch - 1) * portions * 2) / 2} portions pour le repas suivant ou le congélateur.`));

  // ----- ingrédients -----
  const stock = St.list('stock');
  root.append(h('div.section-title', 'Ingrédients'));
  const card = h('div.card');
  for (const l of ev.lines) {
    const ing = INGREDIENTS[l.ing];
    const have = stockQty(stock, l.ing, slot.date);
    const promo = ctx.promoIdx.get(l.ing);
    let status;
    if (l.basic) status = chip('basique');
    else if (have >= l.q) status = chip('en stock', 'green');
    else if (have > 0) status = chip(`stock partiel (${fmtQty(have, l.unit)})`, 'blue');
    else if (promo) status = chip(`en promo${promo.mechanic ? ' · ' + promo.mechanic : ''}`, 'promo');
    else status = chip('à acheter hors promo', 'amber');
    card.append(h('div.ing' + (l.dropped ? '.dropped' : ''), h('div', h('b', ing.name), l.opt && h('small', ' (facultatif)'), h('div', status)), h('div.q', l.basic ? 'au goût' : fmtQty(l.q, l.unit))));
  }
  root.append(card);

  const eq = recipe.eq.map((x) => (Array.isArray(x) ? x.map((k) => EQUIPMENT[k]).join(' ou ') : EQUIPMENT[x])).filter(Boolean);
  const alls = allergensOf(ev.lines.filter((l) => !l.dropped).map((l) => l.ing));
  root.append(h('div.card.stack', { style: { marginTop: '12px' } },
    eq.length > 0 && h('div', h('b', 'Matériel : '), eq.join(' · ')),
    recipe.keep && h('div', h('b', 'Restes : '), recipe.keep),
    alls.length > 0 && h('div', h('b', 'Contient : '), alls.map((a) => ALLERGENS[a]).join(', '), h('div', h('small.muted', 'Pense à vérifier les étiquettes des produits.')))));

  // ----- étapes -----
  root.append(h('div.section-title', 'Préparation'));
  root.append(h('div.card', steps.map((s, i) => h('div.step', h('div.n', i + 1), h('div', s.t, s.min ? h('div', chip(`⏱ ${s.min} min`, 'blue')) : '')))));

  root.append(h('div.stack', { style: { marginTop: '16px' } },
    h('button.btn.primary.block', { onclick: () => { cook.on = true; cook.step = 0; setWake(true); rerender(); } }, '👩‍🍳 Commencer à cuisiner'),
    !preview && slot.status !== 'done' && h('button.btn.good.block', { onclick: () => openCookSheet(slot) }, '✅ C’est fait'),
    !preview && h('button.btn.block', { onclick: () => openSlotSheet(slot) }, '⋯ Options du repas'),
    h('button.btn.ghost.block', { onclick: () => reportRecipe(recipe) }, '🚩 Signaler un problème')));
}

const TAG = { vegetarien: 'végétarien', vegetalien: 'végétalien', pesco: 'pesco', enfants: 'adapté enfants', emporter: 'à emporter', 'sans-four': 'sans four', apero: 'apéro' };

function renderCooking(root, { slot, recipe, steps, preview }) {
  const i = Math.min(cook.step, steps.length - 1);
  const s = steps[i];
  const tkey = `${cook.key}:${i}`;
  const t = s.min ? (timers.get(tkey) ?? { total: s.min * 60, left: s.min * 60, running: false }) : null;
  root.append(h('div.top', h('div.grow', h('div.sub', recipe.name), h('b', `Étape ${i + 1} / ${steps.length}`)), h('button.icon-btn', { onclick: () => { cook.on = false; setWake(false); rerender(); }, 'aria-label': 'Quitter le mode cuisine' }, '✕')));
  root.append(h('div.bar', { style: { marginBottom: '14px' } }, h('i', { style: { width: `${((i + 1) / steps.length) * 100}%` } })));
  root.append(h('div.card.stack', { style: { minHeight: '40vh', justifyContent: 'center' } },
    h('div.cook-step', s.t),
    t && h('div.stack', h('div.timer' + (t.done ? '.ring' : ''), { id: `tm-${tkey.replace(/[^a-z0-9]/gi, '_')}` }, mmss(t.running ? Math.max(0, (t.endAt - Date.now()) / 1000) : t.left)),
      h('div.row', { style: { justifyContent: 'center' } },
        t.running ? h('button.btn', { onclick: () => pauseTimer(tkey) }, '⏸ Pause') : h('button.btn.primary', { onclick: () => startTimer(tkey, s.min) }, t.done ? '↻ Relancer' : '▶︎ Lancer le minuteur'),
        h('button.btn', { onclick: () => resetTimer(tkey, s.min) }, 'Remise à zéro')))));
  // minuteurs en cours sur d'autres étapes
  const others = [...timers].filter(([k, v]) => k.startsWith(cook.key + ':') && k !== tkey && v.running);
  if (others.length) root.append(h('div.banner.demo', { style: { marginTop: '10px' } }, '⏱ Minuteur en cours à l’étape ', others.map(([k]) => Number(k.split(':').pop()) + 1).join(', ')));
  root.append(h('div.row', { style: { marginTop: '14px' } },
    h('button.btn.grow', { disabled: i === 0, onclick: () => { cook.step = i - 1; rerender(); } }, '← Précédente'),
    i < steps.length - 1 ? h('button.btn.primary.grow', { onclick: () => { cook.step = i + 1; rerender(); } }, 'Étape suivante →')
      : h('button.btn.good.grow', { onclick: () => { cook.on = false; setWake(false); if (preview) rerender(); else openCookSheet(slot); rerender(); } }, '✅ C’est fait')));
  root.append(h('small.kbd-hint', { style: { display: 'block', marginTop: '10px', textAlign: 'center' } }, cook.wake ? '🔆 L’écran reste allumé' : 'L’écran peut s’éteindre (non supporté par ce navigateur)'));
}
