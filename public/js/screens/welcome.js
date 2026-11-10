// Premier lancement sur un appareil : créer le foyer (code d'accès si le serveur en exige un) ou rejoindre un foyer existant
// avec le code affiché sur un autre appareil. Sur iPhone, l'app installée a son propre stockage : elle doit être appairée.
import * as St from '../store.js';
import { h, sheet, field, input, toast, clear } from '../ui.js';
import { startOnboarding } from './onboarding.js';

export function showWelcome() {
  let panel;
  const done = (close) => { close(); if (!St.list('profiles').length) setTimeout(startOnboarding, 200); };
  return sheet({
    title: 'Bienvenue 👋',
    onClose: () => {},
    body: (close) => {
      panel = h('div.stack');
      const draw = (mode = 'menu', msg = '') => {
        clear(panel);
        const cfg = St.S.config;
        if (!cfg) {
          panel.append(h('p', 'Le serveur est injoignable pour le moment. Vérifie ta connexion puis réessaie.'),
            h('button.btn.primary.block', { onclick: async () => { try { St.S.config = await fetch('/api/config').then((r) => r.json()); } catch { /* toujours injoignable */ } draw(); } }, 'Réessayer'),
            h('button.btn.block', { onclick: () => { St.useLocalOnly(); done(close); } }, 'Utiliser sans compte (cet appareil seulement)'));
          return;
        }
        if (mode === 'menu') {
          panel.append(h('p.muted', 'Planning des repas, courses et stock autour des promos de la semaine.'),
            h('button.btn.primary.block', { onclick: () => draw(cfg.signup === 'closed' ? 'closed' : cfg.signup === 'code' ? 'create-code' : 'creating') }, '🏠 Créer mon foyer'),
            h('button.btn.block', { onclick: () => draw('join') }, '📱 Rejoindre un foyer (code d’un autre appareil)'),
            h('button.btn.ghost.block', { onclick: () => { St.useLocalOnly(); done(close); } }, 'Utiliser sans compte (cet appareil seulement)'));
        }
        if (mode === 'closed') {
          panel.append(h('div.card.warn', h('b', 'Ce serveur n’accepte pas de nouveau foyer.'), h('p', 'Utilise le code d’appairage d’un appareil déjà connecté (Foyer → Ajouter un appareil).')), h('button.btn.primary.block', { onclick: () => draw('join') }, 'Rejoindre avec un code'), h('button.btn.block', { onclick: () => draw() }, 'Retour'));
        }
        if (mode === 'creating') {
          panel.append(h('p', 'Création du foyer…'));
          St.createHousehold('').then(() => done(close)).catch((e) => draw('menu', e.message));
        }
        if (mode === 'create-code') {
          const code = input({ type: 'text', placeholder: 'Code d’accès', autocapitalize: 'off', autocomplete: 'off', autofocus: true });
          panel.append(h('p.muted', 'Ce serveur est privé : saisis le code d’accès choisi à l’installation.'), field('Code d’accès', code),
            h('button.btn.primary.block', { onclick: async () => { try { await St.createHousehold(code.value); done(close); } catch (e) { toast(e.message, { ms: 6000 }); } } }, 'Créer le foyer'),
            h('button.btn.block', { onclick: () => draw() }, 'Retour'));
        }
        if (mode === 'join') {
          const code = input({ type: 'text', placeholder: 'XXXX-XXXX', autocapitalize: 'characters', autocomplete: 'off', autocorrect: 'off', spellcheck: 'false', style: { fontSize: '1.4rem', letterSpacing: '.12em', textAlign: 'center' } });
          panel.append(h('p.muted', 'Sur l’autre appareil : Foyer → Ajouter un appareil. Un code valable 10 minutes s’affiche ; tape-le ici.'), field('Code d’appairage', code),
            h('button.btn.primary.block', { onclick: async () => { try { await St.redeemCode(code.value); toast('Appareil ajouté ✅'); close(); } catch (e) { toast(e.message, { ms: 6000 }); } } }, 'Rejoindre le foyer'),
            h('button.btn.block', { onclick: () => draw() }, 'Retour'));
        }
        if (msg) panel.append(h('div.banner.offline', msg));
      };
      draw();
      return panel;
    },
  });
}
