// server/backup-db.mjs — on-demand snapshot of the live gijoe_collection.db into
// backups/ (gitignored — see OPEN_QUESTIONS_Claude.md #21). Distinct from
// seed.mjs's pre-reseed safety .bak: this is a periodic manual backup, run
// whenever ("npm run backup"), not tied to a destructive operation. Keeps the
// most recent BACKUP_KEEP snapshots and prunes older ones so backups/ doesn't
// grow unbounded over years of runs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
fs.copyFileSync(DB_PATH, dest);
console.log(`Backed up -> ${path.relative(ROOT, dest)}`);

const snapshots = fs.readdirSync(BACKUP_DIR)
  .filter((f) => /^gijoe_collection_\d{14}\.db$/.test(f))
  .sort();

const stale = snapshots.slice(0, Math.max(0, snapshots.length - BACKUP_KEEP));
for (const f of stale) {
  fs.unlinkSync(path.join(BACKUP_DIR, f));
  console.log(`Pruned old backup -> backups/${f}`);
}

console.log(`${snapshots.length - stale.length}/${BACKUP_KEEP} backups kept.`);
