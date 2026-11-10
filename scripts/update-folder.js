// Lecture automatique du folder Delhaize → fichiers publiés sur le site (docs/data/).
// Lancé par GitHub Actions (.github/workflows/folder.yml) deux fois par jour, ou à la main :
//   PROMO_KEY="le code du foyer" node scripts/update-folder.js [--out docs/data] [--force]
//
// Règles (usage strictement personnel, CGU Delhaize art. 2.3.2) :
//  - une seule lecture réussie par folder ; le folder suivant n'est sondé que dans les 3 jours qui précèdent sa sortie ;
//  - un folder « pas encore en ligne » ne modifie aucun fichier (donc aucun commit) ;
//  - le contenu des promos est CHIFFRÉ (promos.enc.json) : le site est public, pas le folder ;
//  - jamais de contournement d'un blocage : en cas d'erreur le script s'arrête avec un message clair.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFolder, checkExtraction } from '../shared/folder-parser.js';
import { fetchPages } from '../server/folder/job.js';
import { seal, open } from '../shared/seal.js';
import { folderSlugFor, weekStartFor, addDays, todayStr, diffDays } from '../shared/util.js';

const KEEP_DAYS = 35;

/**
 * @param {{out:string, key:string, today?:string, force?:boolean, fetchImpl?:Function, pagesFor?:Function, now?:()=>Date}} o
 * @returns {Promise<{changed:boolean, results:string[]}>}
 */
export async function updateFolder({ out, key, today = todayStr(), force = false, fetchImpl, pagesFor, now = () => new Date() }) {
  if (!key) throw new Error('PROMO_KEY manquant : définis le code du foyer (secret GitHub PROMO_KEY).');
  mkdirSync(out, { recursive: true });
  const statusFile = join(out, 'status.json');
  const promosFile = join(out, 'promos.enc.json');
  const status = existsSync(statusFile) ? JSON.parse(readFileSync(statusFile, 'utf8')) : { folders: {} };
  let store = { folders: {} };
  if (existsSync(promosFile)) {
    try { store = await open(JSON.parse(readFileSync(promosFile, 'utf8')), key); }
    catch { throw new Error('PROMO_KEY ne déchiffre pas promos.enc.json : le code a-t-il changé ? Supprime ce fichier pour repartir de zéro.'); }
  }

  const weekStart = weekStartFor(today);
  const slugs = [folderSlugFor(weekStart), folderSlugFor(addDays(weekStart, 7))];
  const results = [];
  let changed = false;

  for (const [i, slug] of slugs.entries()) {
    const known = status.folders[slug];
    const isNext = i === 1;
    if (known?.status === 'ok' && !(force && !isNext)) { results.push(`${slug} : déjà lu (${known.count} articles)`); continue; }
    if (isNext && diffDays(today, addDays(weekStart, 7)) > 3) { results.push(`${slug} : trop tôt pour le sonder`); continue; }

    const got = pagesFor ? await pagesFor(slug) : await fetchPages(slug, fetchImpl);
    if (got.notPublished) { results.push(`${slug} : pas encore en ligne`); continue; }

    const parsed = parseFolder(got.pages, { slug });
    const check = checkExtraction(parsed, got.pages);
    store.folders[slug] = { items: parsed.items };
    status.folders[slug] = {
      slug, validFrom: parsed.validity?.from ?? null, validTo: parsed.validity?.to ?? null,
      status: check.ok ? 'ok' : 'incomplete', message: check.ok ? null : `Extraction à vérifier : ${check.problems.join(' ; ')}`,
      count: parsed.items.length, food: parsed.items.filter((it) => it.ingredientId).length, fetchedAt: now().toISOString(),
    };
    changed = true;
    results.push(`${slug} : ${parsed.items.length} articles (${status.folders[slug].food} alimentaires) — ${check.ok ? 'extraction OK' : 'À VÉRIFIER : ' + check.problems.join(' ; ')}`);
  }

  // anciens folders oubliés
  for (const [slug, f] of Object.entries(status.folders)) {
    if (f.validTo && diffDays(f.validTo, today) > KEEP_DAYS) { delete status.folders[slug]; delete store.folders[slug]; changed = true; results.push(`${slug} : ancien folder retiré`); }
  }

  if (changed) {
    status.updatedAt = now().toISOString();
    writeFileSync(promosFile, JSON.stringify(await seal(store, key)));
    writeFileSync(statusFile, JSON.stringify(status, null, 1));
  }
  return { changed, results };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
  const out = arg('--out') || join(fileURLToPath(new URL('..', import.meta.url)), 'docs', 'data');
  try {
    const { changed, results } = await updateFolder({ out, key: process.env.PROMO_KEY, force: process.argv.includes('--force') });
    for (const r of results) console.log(r);
    console.log(changed ? 'Fichiers mis à jour.' : 'Rien à mettre à jour.');
  } catch (e) {
    console.error(`ERREUR : ${e.message}`);
    process.exit(1);
  }
}
