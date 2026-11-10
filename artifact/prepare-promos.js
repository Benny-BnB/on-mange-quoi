// Prépare les documents de promos pour la page Claude (à écrire ensuite avec ArtifactData, action « batch »).
//   node artifact/prepare-promos.js <dossier-de-sortie>                 → lit le folder en ligne (UNE lecture, usage perso)
//   node artifact/prepare-promos.js <dossier-de-sortie> --file pages.json → utilise un texte déjà lu (aucune requête)
// Écrit : promos-<slug>.json (document `promos/<slug>`) et folders-main.json (document `folders/main`).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseFolder, checkExtraction } from '../shared/folder-parser.js';
import { fetchPages } from '../server/folder/job.js';
import { folderSlugFor, weekStartFor, todayStr } from '../shared/util.js';

const out = process.argv[2];
if (!out) { console.error('Usage : node artifact/prepare-promos.js <dossier-de-sortie> [--file pages.json] [--slug w46-2026-fr]'); process.exit(1); }
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const slug = arg('--slug') || folderSlugFor(weekStartFor(todayStr()));
mkdirSync(out, { recursive: true });

// codes de sortie : 0 = lu et préparé · 2 = folder pas encore en ligne · 3 = lecture impossible (réseau, blocage, format)
let pages;
if (arg('--file')) pages = JSON.parse(readFileSync(arg('--file'), 'utf8'));
else {
  let got;
  try { got = await fetchPages(slug); } catch (e) { console.error(`${slug} : lecture impossible — ${e.message}`); process.exit(3); }
  if (got.notPublished) { console.error(`${slug} : le folder n'est pas encore en ligne.`); process.exit(2); }
  pages = got.pages;
}
const parsed = parseFolder(pages, { slug });
const check = checkExtraction(parsed, pages);
const ts = Date.now();
const recs = Object.fromEntries(parsed.items.map((it) => [it.id, { ...it, _ts: ts, _b: slug, deleted: false }]));
writeFileSync(join(out, `promos-${slug}.json`), JSON.stringify({ _ts: ts, recs }));

// folders/main contient TOUS les folders connus : on fusionne avec l'existant s'il est fourni
const mainFile = join(out, 'folders-main.json');
const main = existsSync(mainFile) ? JSON.parse(readFileSync(mainFile, 'utf8')) : { recs: {} };
main._ts = ts;
const meta = { id: slug, slug, validFrom: parsed.validity?.from ?? null, validTo: parsed.validity?.to ?? null, fetchedAt: new Date(ts).toISOString(), status: check.ok ? 'ok' : 'incomplete', message: check.ok ? null : check.problems.join(' ; '), count: parsed.items.length, source: 'Claude (lecture Publitas)', _ts: ts, _b: 'main', deleted: false };
main.recs[slug] = meta;
writeFileSync(mainFile, JSON.stringify(main));
// mise à jour PARTIELLE de folders/main (ArtifactData « update » fusionne les objets imbriqués : les autres semaines restent)
writeFileSync(join(out, `folders-update-${slug}.json`), JSON.stringify({ _ts: ts, recs: { [slug]: meta } }));
console.log(`${slug} : ${parsed.items.length} articles, ${parsed.items.filter((i) => i.ingredientId).length} alimentaires reconnus — ${check.ok ? 'extraction OK' : 'À VÉRIFIER : ' + check.problems.join(' ; ')}`);
