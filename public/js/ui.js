// Petits utilitaires d'interface : construction DOM sûre (jamais d'innerHTML sur du texte saisi), feuilles, toasts.

/** h('div.carte', { onclick }, 'texte', enfant) */
export function h(tag, attrs, ...kids) {
  const m = tag.match(/^([a-z0-9]*)(?:#([\w-]+))?((?:\.[\w-]+)*)$/i) ?? [tag, 'div', undefined, ''];
  const el = document.createElement(m[1] || 'div');
  if (m[2]) el.id = m[2];
  const classes = m[3].split('.').filter(Boolean);
  if (classes.length) el.className = classes.join(' ');
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === false || v == null) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.className += (el.className ? ' ' : '') + v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'open') el[k] = !!v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, kids);
  return el;
}
export function append(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}
export const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };

export const chip = (text, cls = '', attrs = {}) => h(`span.chip${cls ? '.' + cls.split(' ').join('.') : ''}`, attrs, text);
export const icon = (e) => h('span.ico', { 'aria-hidden': 'true' }, e);

// ---------- Toasts ----------
let toastTimer;
export function toast(msg, { undo = null, ms = 4000 } = {}) {
  let el = document.getElementById('toast');
  if (!el) { el = h('div#toast', { role: 'status', 'aria-live': 'polite' }); document.body.append(el); }
  clear(el);
  append(el, [h('span', msg), undo && h('button.link', { onclick: () => { undo(); el.classList.remove('show'); } }, 'Annuler')]);
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

// ---------- Feuille (bottom sheet) ----------
const stack = [];
/**
 * @param {{title:string, body:(close:Function)=>Node|Node[], footer?:(close:Function)=>Node|Node[], wide?:boolean, onClose?:Function}} o
 */
export function sheet({ title, body, footer, wide = false, onClose }) {
  const back = h('div.backdrop');
  const panel = h('div.sheet' + (wide ? '.wide' : ''), { role: 'dialog', 'aria-modal': 'true', 'aria-label': title });
  const close = () => {
    panel.classList.add('out'); back.classList.add('out');
    setTimeout(() => { back.remove(); panel.remove(); }, 160);
    const i = stack.indexOf(close); if (i >= 0) stack.splice(i, 1);
    onClose?.();
  };
  const head = h('header.sheet-head', h('h2', title), h('button.icon-btn', { onclick: close, 'aria-label': 'Fermer' }, '✕'));
  const content = h('div.sheet-body', body(close));
  panel.append(head, content);
  if (footer) panel.append(h('footer.sheet-foot', footer(close)));
  back.addEventListener('click', close);
  document.body.append(back, panel);
  stack.push(close);
  setTimeout(() => { panel.classList.add('in'); back.classList.add('in'); }, 10);
  return { close, content, panel };
}
export const closeTop = () => stack.at(-1)?.();

export function confirmSheet({ title, text, ok = 'Confirmer', danger = false }) {
  return new Promise((resolve) => {
    let done = false;
    sheet({
      title, onClose: () => { if (!done) resolve(false); },
      body: () => h('p', text),
      footer: (close) => [
        h('button.btn', { onclick: () => close() }, 'Annuler'),
        h('button.btn.primary' + (danger ? '.danger' : ''), { onclick: () => { done = true; resolve(true); close(); } }, ok),
      ],
    });
  });
}

// ---------- Champs ----------
export const field = (label, control, hint) => h('label.field', h('span.lbl', label), control, hint && h('small.hint', hint));
export const input = (props) => h('input', props);
export const select = (options, value, onchange, attrs = {}) =>
  h('select', { onchange: (e) => onchange(e.target.value), ...attrs }, options.map(([v, l]) => h('option', { value: v, selected: v === value }, l)));
export const segmented = (options, value, onchange) =>
  h('div.seg', { role: 'radiogroup' }, options.map(([v, l]) => h('button.seg-btn' + (v === value ? '.on' : ''), { type: 'button', role: 'radio', 'aria-checked': v === value ? 'true' : 'false', onclick: (e) => { e.target.parentElement.querySelectorAll('.seg-btn').forEach((b) => { b.classList.toggle('on', b === e.target); b.setAttribute('aria-checked', b === e.target ? 'true' : 'false'); }); onchange(v); } }, l)));
export const toggle = (checked, onchange, label) =>
  h('label.tog', h('input', { type: 'checkbox', checked, onchange: (e) => onchange(e.target.checked) }), h('span', label));

export const fmtNum = (n, d = 1) => String(Math.round(n * 10 ** d) / 10 ** d).replace('.', ',');
export const parseNum = (s) => parseFloat(String(s).replace(',', '.'));
