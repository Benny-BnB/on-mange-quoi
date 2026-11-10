// Stockage SQLite (node:sqlite) : un « foyer » = un compte. Tous les enregistrements synchronisés sont des
// documents { coll, id, data } avec dernière écriture gagnante (horodatage client) et un compteur de révision par foyer.
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export const COLLECTIONS = new Set([
  'settings', 'profiles', 'plan', 'stock', 'shopping', 'promos', 'folders', 'weeks', 'waste', 'recipes', 'flags',
]);

const sha = (s) => createHash('sha256').update(s).digest('hex');

export function openDb(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS households (
      id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, created_at TEXT NOT NULL, rev INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS tokens (
      hid TEXT NOT NULL, token_hash TEXT PRIMARY KEY, label TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS records (
      hid TEXT NOT NULL, coll TEXT NOT NULL, id TEXT NOT NULL, data TEXT, rev INTEGER NOT NULL,
      updated_at INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (hid, coll, id)
    );
    CREATE INDEX IF NOT EXISTS records_rev ON records (hid, rev);
    CREATE TABLE IF NOT EXISTS folders (
      slug TEXT PRIMARY KEY, valid_from TEXT, valid_to TEXT, fetched_at TEXT, attempted_at TEXT,
      status TEXT NOT NULL, message TEXT, items_json TEXT, pages_json TEXT
    );
  `);

  const q = {
    getH: db.prepare('SELECT * FROM households WHERE id = ?'),
    insT: db.prepare('INSERT INTO tokens (hid, token_hash, label, created_at) VALUES (?, ?, ?, ?)'),
    getT: db.prepare('SELECT hid FROM tokens WHERE token_hash = ? AND hid = ?'),
    delT: db.prepare('DELETE FROM tokens WHERE hid = ?'),
    countH: db.prepare('SELECT COUNT(*) AS n FROM households'),
    insH: db.prepare('INSERT INTO households (id, token_hash, created_at) VALUES (?, ?, ?)'),
    bumpH: db.prepare('UPDATE households SET rev = rev + 1 WHERE id = ? RETURNING rev'),
    getR: db.prepare('SELECT updated_at FROM records WHERE hid = ? AND coll = ? AND id = ?'),
    putR: db.prepare(`INSERT INTO records (hid, coll, id, data, rev, updated_at, deleted) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (hid, coll, id) DO UPDATE SET data = excluded.data, rev = excluded.rev, updated_at = excluded.updated_at, deleted = excluded.deleted`),
    since: db.prepare('SELECT coll, id, data, rev, updated_at, deleted FROM records WHERE hid = ? AND rev > ? ORDER BY rev LIMIT 5000'),
    all: db.prepare('SELECT coll, id, data, updated_at, deleted FROM records WHERE hid = ? AND deleted = 0'),
    delRecords: db.prepare('DELETE FROM records WHERE hid = ?'),
    delH: db.prepare('DELETE FROM households WHERE id = ?'),
    listH: db.prepare('SELECT id FROM households'),
    getF: db.prepare('SELECT * FROM folders WHERE slug = ?'),
    putF: db.prepare(`INSERT INTO folders (slug, valid_from, valid_to, fetched_at, attempted_at, status, message, items_json, pages_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (slug) DO UPDATE SET valid_from = excluded.valid_from, valid_to = excluded.valid_to, fetched_at = excluded.fetched_at,
        attempted_at = excluded.attempted_at, status = excluded.status, message = excluded.message, items_json = excluded.items_json, pages_json = excluded.pages_json`),
    listF: db.prepare('SELECT slug, valid_from, valid_to, fetched_at, attempted_at, status, message FROM folders ORDER BY slug DESC LIMIT 12'),
  };

  const tx = (fn) => {
    db.exec('BEGIN IMMEDIATE');
    try {
      const out = fn();
      db.exec('COMMIT');
      return out;
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  };

  return {
    raw: db,
    createHousehold() {
      const id = randomBytes(8).toString('hex');
      const token = randomBytes(24).toString('hex');
      q.insH.run(id, sha(token), new Date().toISOString());
      return { id, token };
    },
    householdCount: () => q.countH.get().n,
    hasHousehold: (id) => !!q.getH.get(String(id)),
    authenticate(id, token) {
      const h = q.getH.get(String(id));
      if (!h || !token) return null;
      const hash = sha(String(token));
      const a = Buffer.from(h.token_hash, 'hex');
      const b = Buffer.from(hash, 'hex');
      if (a.length === b.length && timingSafeEqual(a, b)) return h;
      return q.getT.get(hash, h.id) ? h : null; // jeton d'un autre appareil du foyer
    },
    /** Nouveau jeton pour un appareil supplémentaire (appairage) : chaque appareil a le sien. */
    addToken(hid, label = 'appareil') {
      const token = randomBytes(24).toString('hex');
      q.insT.run(hid, sha(token), label, new Date().toISOString());
      return token;
    },
    householdIds: () => q.listH.all().map((r) => r.id),
    rev: (hid) => q.getH.get(hid)?.rev ?? 0,

    /** Applique des changements (dernière écriture gagnante) et retourne les enregistrements plus récents que `since`. */
    sync(hid, since, changes = []) {
      return tx(() => {
        let changed = false;
        for (const c of changes) {
          if (!COLLECTIONS.has(c.coll) || !c.id || typeof c.id !== 'string' || c.id.length > 200) continue;
          const ts = Number(c.ts) || Date.now();
          const cur = q.getR.get(hid, c.coll, c.id);
          if (cur && cur.updated_at > ts) continue;
          const rev = q.bumpH.get(hid).rev;
          q.putR.run(hid, c.coll, c.id, c.deleted ? null : JSON.stringify(c.data ?? null), rev, ts, c.deleted ? 1 : 0);
          changed = true;
        }
        const rows = q.since.all(hid, Number(since) || 0);
        return {
          changed,
          rev: q.getH.get(hid).rev,
          records: rows.map((r) => ({ coll: r.coll, id: r.id, data: r.data ? JSON.parse(r.data) : null, rev: r.rev, ts: r.updated_at, deleted: !!r.deleted })),
        };
      });
    },

    /** Écriture initiée par le serveur (folder). */
    serverWrite(hid, items) {
      return tx(() => {
        let n = 0;
        for (const { coll, id, data, deleted } of items) {
          const rev = q.bumpH.get(hid).rev;
          q.putR.run(hid, coll, id, deleted ? null : JSON.stringify(data), rev, Date.now(), deleted ? 1 : 0);
          n++;
        }
        return n;
      });
    },

    exportAll(hid) {
      return q.all.all(hid).map((r) => ({ coll: r.coll, id: r.id, data: r.data ? JSON.parse(r.data) : null, updated_at: r.updated_at }));
    },
    deleteHousehold(hid) {
      tx(() => {
        q.delRecords.run(hid);
        q.delT.run(hid);
        q.delH.run(hid);
      });
    },

    getFolder: (slug) => q.getF.get(slug),
    putFolder: (f) =>
      q.putF.run(f.slug, f.valid_from ?? null, f.valid_to ?? null, f.fetched_at ?? null, f.attempted_at ?? null, f.status, f.message ?? null, f.items_json ?? null, f.pages_json ?? null),
    listFolders: () => q.listF.all(),
  };
}
