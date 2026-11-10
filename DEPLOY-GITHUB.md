# Mettre l'app en ligne gratuitement (GitHub Pages + ton domaine)

Rien à payer : GitHub Pages sert l'app, GitHub Actions lit le folder deux fois par jour (sans ton Mac), et ton sous-domaine
(ex. `repas.exemple.fr`) est gratuit côté GitHub.

## Comment ça marche

- `docs/` = le site (une page, installable sur l'écran d'accueil, utilisable hors connexion). Les données de la famille restent **dans le navigateur** de chaque appareil.
- `.github/workflows/folder.yml` = la tâche GitHub qui lit le folder, puis publie les promos dans `docs/data/`.
- **Les promos sont chiffrées** (AES-256) : le dépôt et le site sont publics (obligatoire pour Pages gratuit), mais le contenu du folder Delhaize
  ne l'est pas. Le « code du foyer » les déchiffre dans le navigateur ; choisis une phrase longue (4 mots ou plus).

## Étapes (une seule fois)

1. **Compte GitHub** gratuit : github.com → Sign up. Dans *Settings → Emails*, coche « Keep my email addresses private » et relève ton adresse `…@users.noreply.github.com` (elle sert pour les commits).
2. **Nouveau dépôt** : bouton *New repository* → nom `on-mange-quoi`, **Public**, sans README → *Create*.
3. **Envoyer le projet** (Terminal, dans le dossier du projet). Remplace `ton-pseudo` et l'adresse noreply :

   ```bash
   cd chemin/vers/on-mange-quoi
   git init -b main
   git add -A
   git -c user.name="ton-pseudo" -c user.email="ID+ton-pseudo@users.noreply.github.com" commit -m "Première version"
   git remote add origin https://github.com/ton-pseudo/on-mange-quoi.git
   git push -u origin main
   ```

   Au `git push`, GitHub demande ton pseudo puis un **jeton** (pas ton mot de passe) : *Settings → Developer settings → Personal access tokens → Fine-grained tokens*, limité à ce dépôt, permission *Contents : Read and write*.
   (Plus simple si tu préfères une interface : l'app **GitHub Desktop**.)
4. **Secret** : dépôt → *Settings → Secrets and variables → Actions → New repository secret* : nom `PROMO_KEY`, valeur = ton code du foyer.
5. **Pages** : dépôt → *Settings → Pages* → *Source : Deploy from a branch* → branche `main`, dossier `/docs` → *Save*.
6. **Première lecture du folder** : onglet *Actions* → *Lecture du folder Delhaize* → *Run workflow*. Au bout d'une minute, `docs/data/` contient les promos chiffrées.
7. L'app est en ligne sur `https://ton-pseudo.github.io/on-mange-quoi/`.

## Ton domaine (ex. `repas.exemple.fr`)

1. Chez le gestionnaire DNS de `exemple.fr`, crée un enregistrement **CNAME** : nom `repas`, valeur `ton-pseudo.github.io`.
2. Dépôt → *Settings → Pages → Custom domain* → `repas.exemple.fr` → *Save* ; quand la vérification est passée, coche **Enforce HTTPS**.
   (GitHub crée tout seul le fichier `docs/CNAME` ; ne le supprime pas.) Utilise un sous-domaine : ton site actuel n'est pas touché.

## Installer sur l'iPhone

Safari → l'adresse du site → bouton *Partager* → **Sur l'écran d'accueil**. À la première ouverture : créer les profils, puis saisir le code du foyer (une fois par appareil).

## Au quotidien

- Les promos se mettent à jour toutes seules (6 h 30 et 17 h 30, heure d'hiver). Relecture immédiate : *Actions → Lecture du folder Delhaize → Run workflow*.
- Mettre à jour le code de l'app : `node site/build.js`, puis `git add -A && git commit -m "…" && git push`.
- GitHub désactive les tâches planifiées d'un dépôt resté 60 jours sans activité ; chaque nouveau folder crée un commit, donc ce cas est improbable, mais s'il arrive GitHub t'écrit et un clic dans l'onglet *Actions* la réactive.

## Limites à connaître

- **Pas de synchronisation automatique entre téléphones** (il n'y a pas de serveur) : chacun a ses données. Pour passer d'un appareil à l'autre : *Foyer → Exporter*, puis *Importer* sur l'autre.
- **Pas de notifications** (elles exigent un serveur).
- La lecture du folder part d'un serveur GitHub ; si Publitas le refusait, le workflow échoue (GitHub t'écrit) et l'import manuel du texte reste disponible.
- Le chiffrement protège contre une lecture directe du fichier, pas contre quelqu'un qui devinerait un code trop court : prends une vraie phrase.
