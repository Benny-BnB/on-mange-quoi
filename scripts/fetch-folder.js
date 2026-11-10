// Lecture manuelle du folder en ligne de commande (même code que la tâche hebdomadaire).
//   node scripts/fetch-folder.js            → folder de la semaine en cours (+ suivant s'il est en ligne)
//   node scripts/fetch-folder.js --force    → ignore les délais (au plus une relance par minute)
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from '../server/db.js';
import { runCycle } from '../server/folder/job.js';

const db = openDb(process.env.DB_PATH || join(fileURLToPath(new URL('..', import.meta.url)), 'data', 'app.db'));
for (const r of await runCycle(db, { force: process.argv.includes('--force') })) {
  console.log(`${r.slug}: ${r.status}${r.count ? ` (${r.count} articles)` : ''}${r.message ? ` — ${r.message}` : ''}`);
}
