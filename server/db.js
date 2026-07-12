// server/db.js — single shared better-sqlite3 connection.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'gijoe_collection.db');

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL'); // lets TablePlus write while this connection stays open (OPEN_QUESTIONS_Claude.md #20)

export default db;
