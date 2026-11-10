// Lecture du folder Delhaize (Publitas) — tâche automatique hebdomadaire + relance manuelle.
//
// Choix technique (analysé le 10/11/2026) : delhaize.be/fr/folder intègre la visionneuse Publitas
// (view.publitas.com/delhaize-belgium/wNN-AAAA-fr). Elle publie `spreads.json` (≈ 165 Ko) avec le TEXTE de chaque
// page : plus léger et plus fiable que le PDF (≈ 100 Mo) ou qu'une lecture d'image. Plan B : import manuel.
//
// Cadre d'usage : strictement personnel (CGU Delhaize art. 2.3.2). Une seule lecture réussie par folder, la semaine
// suivante n'est sondée qu'une fois par jour tant qu'elle n'est pas en ligne, relance manuelle limitée à 1/min.
import { parseFolder, checkExtraction } from '../../shared/folder-parser.js';
import { folderSlugFor, weekStartFor, addDays, todayStr, diffDays } from '../../shared/util.js';

const BASE = 'https://view.publitas.com/delhaize-belgium';
const UA = 'on-mange-quoi/0.1 (usage personnel, 1 lecture par semaine)';
const DAY = 86400000;

export const folderUrl = (slug) => `${BASE}/${slug}/spreads.json`;

/** Télécharge et met en forme les pages. Lève une erreur claire si le format a changé. */
export async function fetchPages(slug, fetchImpl = fetch) {
  const res = await fetchImpl(folderUrl(slug), { headers: { 'user-agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
  if (res.status === 404) return { notPublished: true };
  if (!res.ok) throw new Error(`Publitas a répondu HTTP ${res.status}`);
  const spreads = await res.json();
  if (!Array.isArray(spreads)) throw new Error('Format inattendu : spreads.json n’est pas une liste');
  const pages = spreads.flatMap((s) => s.pages ?? []).map((p, i) => ({ n: i + 1, text: typeof p.text === 'string' ? p.text : '' }));
  if (!pages.length) throw new Error('Format inattendu : aucune page trouvée');
  return { pages };
}

/** Écrit les promos d'un folder dans le compte de chaque foyer (et purge les folders de plus de 5 semaines). */
export function fanout(db, slug, parsed, status) {
  const cutoff = addDays(todayStr(), -35);
  for (const hid of db.householdIds()) {
    const data = parsed.items.map((it) => ({ coll: 'promos', id: it.id, data: it }));
    data.push({
      coll: 'folders', id: slug,
      data: { slug, validFrom: parsed.validity?.from ?? null, validTo: parsed.validity?.to ?? null, fetchedAt: new Date().toISOString(), status: status.status, message: status.message, count: parsed.items.length, source: status.source ?? 'publitas' },
    });
    db.serverWrite(hid, data);
    // purge des vieux articles : on recopie la liste des promos existantes via export
    const old = db.exportAll(hid).filter((r) => r.coll === 'promos' && r.data?.validTo && r.data.validTo < cutoff && !r.data.manual);
    if (old.length) db.serverWrite(hid, old.map((r) => ({ coll: 'promos', id: r.id, deleted: true })));
  }
}

/**
 * Lit (ou relit) un folder. `force` = relance manuelle (ignore les délais, jamais plus d'une fois par minute).
 * @returns {Promise<{ok:boolean, status:string, message?:string, count?:number, slug:string}>}
 */
export async function readFolder(db, slug, { force = false, fetchImpl = fetch, now = Date.now() } = {}) {
  const known = db.getFolder(slug);
  if (known && !force) {
    if (known.status === 'ok') return { ok: true, status: 'ok', slug, message: 'déjà lu', count: JSON.parse(known.items_json ?? '[]').length };
    if (known.attempted_at && now - Date.parse(known.attempted_at) < (known.status === 'pending' ? DAY : 6 * 3600 * 1000)) {
      return { ok: false, status: known.status, slug, message: known.message ?? 'nouvelle tentative plus tard' };
    }
  }
  if (known?.attempted_at && force && now - Date.parse(known.attempted_at) < 60000) {
    return { ok: false, status: known.status, slug, message: 'Relance trop rapide : patientez une minute.' };
  }
  const attempted_at = new Date(now).toISOString();
  try {
    const got = await fetchPages(slug, fetchImpl);
    if (got.notPublished) {
      db.putFolder({ slug, status: 'pending', message: 'Le folder n’est pas encore en ligne.', attempted_at });
      return { ok: false, status: 'pending', slug, message: 'Le folder n’est pas encore en ligne.' };
    }
    const parsed = parseFolder(got.pages, { slug });
    const check = checkExtraction(parsed, got.pages);
    const status = check.ok ? 'ok' : 'incomplete';
    const message = check.ok ? null : `Extraction à vérifier : ${check.problems.join(' ; ')}. Complétez ou importez le folder à la main.`;
    db.putFolder({
      slug, valid_from: parsed.validity?.from, valid_to: parsed.validity?.to, fetched_at: attempted_at, attempted_at, status, message,
      items_json: JSON.stringify(parsed.items), pages_json: JSON.stringify(got.pages),
    });
    fanout(db, slug, parsed, { status, message });
    return { ok: check.ok, status, slug, message, count: parsed.items.length, stats: check.stats };
  } catch (e) {
    const message = `Lecture impossible : ${e.message}. Utilisez l’import manuel.`;
    db.putFolder({ slug, status: 'error', message, attempted_at });
    for (const hid of db.householdIds()) {
      db.serverWrite(hid, [{ coll: 'folders', id: slug, data: { slug, status: 'error', message, fetchedAt: null, count: 0 } }]);
    }
    return { ok: false, status: 'error', slug, message };
  }
}

/** Cycle automatique : folder en cours + folder de la semaine suivante dès qu'il est en ligne. */
export async function runCycle(db, opts = {}) {
  const today = opts.today ?? todayStr();
  const cur = folderSlugFor(weekStartFor(today));
  const next = folderSlugFor(addDays(weekStartFor(today), 7));
  const out = [await readFolder(db, cur, opts)];
  // la semaine suivante est sondée au plus une fois par jour, à partir du lundi qui précède la sortie
  if (diffDays(today, addDays(weekStartFor(today), 7)) <= 3) out.push(await readFolder(db, next, opts));
  return out;
}

export function startScheduler(db, log = console.log) {
  const tick = () => runCycle(db).then((r) => r.forEach((x) => x.message !== 'déjà lu' && log(`[folder] ${x.slug}: ${x.status}${x.count ? ` (${x.count} articles)` : ''}${x.message ? ` — ${x.message}` : ''}`))).catch((e) => log('[folder] erreur', e.message));
  setTimeout(tick, 3000);
  return setInterval(tick, 3 * 3600 * 1000);
}

/** Import manuel (plan B) : texte collé du folder, ou liste d'articles saisis. */
export function importManual(db, { slug, validFrom, validTo, text, items }) {
  let parsed;
  if (text) {
    const pages = [{ n: 1, text: (validFrom && validTo ? `${validFrom.slice(8)}/${validFrom.slice(5, 7)} -> ${validTo.slice(8)}/${validTo.slice(5, 7)}/${validTo.slice(0, 4)}\n\n` : '') + text }];
    parsed = parseFolder(pages, { slug });
    if (!parsed.validity && validFrom && validTo) parsed.validity = { from: validFrom, to: validTo };
  } else if (Array.isArray(items)) {
    parsed = { items: items.map((it) => ({ ...it, folder: slug, manual: true, validFrom: it.validFrom ?? validFrom ?? null, validTo: it.validTo ?? validTo ?? null })), validity: { from: validFrom, to: validTo } };
  } else throw new Error('Rien à importer');
  const status = { status: 'ok', message: null, source: 'manuel' };
  db.putFolder({ slug, valid_from: parsed.validity?.from, valid_to: parsed.validity?.to, fetched_at: new Date().toISOString(), attempted_at: new Date().toISOString(), status: 'ok', items_json: JSON.stringify(parsed.items) });
  fanout(db, slug, parsed, status);
  return { count: parsed.items.length };
}
