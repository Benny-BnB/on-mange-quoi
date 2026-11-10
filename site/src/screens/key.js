// Saisie du « code du foyer » : il déchiffre les promos publiées (le site est public, le folder Delhaize ne l'est pas).
import * as St from '../store.js';
import { h, sheet, field, input, toast } from '../ui.js';

export function showKeySheet(message = '') {
  const code = input({ type: 'text', placeholder: 'code du foyer', autocapitalize: 'off', autocomplete: 'off', autocorrect: 'off', spellcheck: 'false' });
  const note = h('div');
  return sheet({
    title: '🔒 Code du foyer',
    body: () => [
      h('p', 'Les promos Delhaize sont publiées chiffrées. Saisis le code du foyer (le même sur tous les appareils) pour les afficher.'),
      message && h('div.banner.offline', message),
      field('Code', code),
      note,
      h('small.muted', 'Il reste enregistré dans ce navigateur : tu ne le saisis qu’une fois par appareil.'),
    ],
    footer: (close) => [
      h('button.btn', { onclick: close }, 'Plus tard'),
      h('button.btn.primary', { onclick: async () => {
        if (!code.value.trim()) return toast('Saisis le code');
        toast('Déverrouillage…', { ms: 2500 });
        const ok = await St.setCode(code.value);
        if (ok) { toast('Promos déverrouillées ✅'); close(); }
        else { note.replaceChildren(h('div.banner.offline', St.S.meta.promos.message || 'Code incorrect.')); }
      } }, 'Déverrouiller'),
    ],
  });
}
