// server/backup-db.mjs — on-demand snapshot of the live gijoe_collection.db into
// backups/ (gitignored — see OPEN_QUESTIONS.md Q21). Distinct from
// seed.mjs's pre-reseed safety .bak: this is a periodic manual backup, run
// whenever ("npm run backup"), not tied to a destructive operation. Keeps the
// most recent BACKUP_KEEP snapshots and prunes older ones so backups/ doesn't
// grow unbounded over years of runs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DB_PATH = path.join(ROOT, 'gijoe_collection.db');
const BACKUP_DIR = path.join(ROOT, 'backups');
const BACKUP_KEEP = 30;

if (!fs.existsSync(DB_PATH)) {
  console.error(`No DB found at ${DB_PATH} — nothing to back up.`);
  process.exit(1);
}

fs.mkdirSync(BACKUP_DIR, { recursive: true });

const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
const dest = path.join(BACKUP_DIR, `gijoe_collection_${stamp}.db`);
// The live DB runs in WAL mode, so a plain file copy of gijoe_collection.db
// misses every write still sitting in gijoe_collection.db-wal (it went ~4 weeks
// without a checkpoint — every snapshot in that stretch was a Sep 23 copy).
// SQLite's online backup API reads through the WAL and is safe while the
// server has the DB open.
const src = new Database(DB_PATH, { readonly: true, fileMustExist: true });
await src.backup(dest);
src.close();
console.log(`Backed up -> ${path.relative(ROOT, dest)}`);

const snapshots = fs.readdirSync(BACKUP_DIR)
  .filter((f) => /^gijoe_collection_\d{14}\.db$/.test(f))
  .sort();

const stale = snapshots.slice(0, Math.max(0, snapshots.length - BACKUP_KEEP));
for (const f of stale) {
  // Pre-.backup() snapshots (before 2026-10-24) were plain file copies that left
  // -wal/-shm sidecars behind — remove those with their .db.
  for (const side of [f, `${f}-wal`, `${f}-shm`]) {
    fs.rmSync(path.join(BACKUP_DIR, side), { force: true });
  }
  console.log(`Pruned old backup -> backups/${f}`);
}

console.log(`${snapshots.length - stale.length}/${BACKUP_KEEP} backups kept.`);
