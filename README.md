# On mange quoi ce soir ?

Web app mobile (PWA) qui répond chaque jour à « on mange quoi ? » en partant des **promos de la semaine chez Delhaize** : planning de tous les repas du foyer,
quantités calculées pour chaque personne, liste de courses triée par rayon, stock tenu à jour. Usage personnel d'un foyer.

**Mise en ligne gratuite : voir [DEPLOY-GITHUB.md](DEPLOY-GITHUB.md)** (GitHub Pages + ton domaine, lecture du folder par GitHub Actions, aucun serveur à payer).

## Comment c'est fait

```
docs/      le site publié (une page + service worker), construit par `node site/build.js`
site/      sources de la version statique (store local, chargement des promos chiffrées) et son assembleur
shared/    la logique pure : portions EFSA, ingrédients, recettes, règles, planning, courses, stock, prix, lecture du folder, chiffrement
scripts/   update-folder.js (lecture automatique du folder → docs/data/) et petits outils
.github/   la tâche planifiée (deux passages par jour)
test/      55 tests (node --test)
server/ public/ artifact/   variantes : serveur Node + SQLite (synchro en direct), et version « page Claude » ; non nécessaires au site
```

- **Données de la famille** : dans le navigateur de chaque appareil (profils, allergies, planning, stock, courses). Rien n'est envoyé nulle part. Pas de synchronisation automatique entre appareils : *Foyer → Exporter / Importer*.
- **Promos** : `scripts/update-folder.js` lit le folder Delhaize (visionneuse Publitas, `spreads.json`), le structure, puis publie `docs/data/promos.enc.json` **chiffré** (AES-GCM, clé dérivée du « code du foyer » par PBKDF2) et `docs/data/status.json` (dates, nombre d'articles). Le site étant public et le folder réservé à un usage personnel (CGU Delhaize art. 2.3.2), le contenu n'est lisible qu'avec le code.
- **Cadence** : une seule lecture réussie par folder ; le folder suivant n'est sondé que dans les 3 jours qui précèdent sa sortie ; rien n'est commité quand il n'y a rien de nouveau.

## Lancer en local

Prérequis : Node.js ≥ 22 (testé avec Node 24), aucune dépendance.

```bash
npm test                                    # 55 tests
node site/build.js                          # reconstruit docs/
PROMO_KEY="un code" node scripts/update-folder.js --out /tmp/promos   # lecture du folder → fichiers chiffrés
DATA_DIR=/tmp/promos node site/dev-server.js                           # http://localhost:3400 avec ces promos
```

## Fonctionnalités

Profils illimités (portions **EFSA 2013**, appétit, activité, présence aux repas, invités) · filtres stricts allergies / régimes / religion · aliments détestés ·
matériel de cuisine modifiable · 57 recettes en 6 catégories (souper à 2-3 propositions, « Autre idée », restes au dîner, protéines variées, temps par jour, stock qui expire d'abord) ·
planning jeudi → mercredi · liste de courses (besoins − stock, arrondie au format vendu, par rayon, passages multiples, « acheté différemment », « je n'en veux pas ») ·
budget et économies · stock (achat, cuisine, restes, jeté, inventaire) · recettes pas à pas avec minuteurs · achats stratégiques · installation sur l'écran d'accueil et usage hors connexion.

## Limites à connaître

- **Pas de synchronisation en direct entre téléphones ni de notifications** : il n'y a pas de serveur. (La variante `server/` les offre, mais exige un hébergement.)
- **Prix illisibles** : le texte du folder est bruité ; environ 12 des 47 produits alimentaires de la semaine du 5/11 ont un prix incertain (« stickers » éclatés en chiffres). Ils sont marqués « à vérifier » et se corrigent dans *Semaine → Voir les promos*.
- **Prix habituels** (sans promo) : estimations génériques dans `shared/ingredients.js`, utilisées pour le budget seulement.
- **Allergènes** : attribués par ingrédient générique, prudemment pour les produits transformés. Ce n'est **pas** une garantie : l'app affiche « vérifier les étiquettes ». Les 57 recettes ont été écrites pour cette app et n'ont pas été relues par un professionnel.
- **Portions** : coefficient = besoin énergétique du profil ÷ adulte de référence (9,75 MJ/j). Les catégories d'âge de l'app sont converties en moyennes d'âges EFSA ; senior 65+ = moyenne des tranches 60-69 et 70-79 (pas de valeur publiée ≥ 80 ans). Table reprise de l'outil officiel *EFSA DRV Finder* (mêmes valeurs que EFSA Journal 2013;11(1):3005 ; somme de contrôle des 138 valeurs identique).
- **Vérifié en réel (10/11/2026)** : lecture du folder par GitHub Actions (à la main et par la tâche planifiée), publication chiffrée, déverrouillage sur iPhone avec le code du foyer.
- **Non vérifié** : le service worker (installation sur l'écran d'accueil, usage hors connexion) n'a pas pu être testé dans l'environnement de développement ; le passage automatique au folder suivant (sondé dans les 3 jours avant sa sortie) n'a pas encore eu lieu.
- Hors périmètre : autres enseignes, commande en ligne, scan, nutrition détaillée, néerlandais, notation des recettes.
