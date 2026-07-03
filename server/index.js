// server/index.js — local Express server: serves the real built app (web/dist,
// from the 17b Vite port) when present, falling back to the raw repo root (the
// other reference mockups + index.html landing page, still Babel-in-browser) —
// plus the /api/* routes backed by gijoe_collection.db, unchanged since 17a.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { buildCatalog } from './catalog.js';
import { buildAccessoryCatalog } from './accessories.js';
import * as store from './instances.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());

// Don't serve the raw database/schema/CSV/backup files over HTTP.
const BLOCKED_EXT = /\.(db|sql|csv|bak)$/i;
app.use((req, res, next) => (BLOCKED_EXT.test(req.path) ? res.status(404).end() : next()));

app.get('/api/catalog', (req, res) => {
  res.json(buildCatalog());
});

app.get('/api/accessories', (req, res) => {
  res.json(buildAccessoryCatalog());
});

app.get('/api/state', (req, res) => {
  res.json(store.getState());
});

app.post('/api/instances', (req, res) => {
  const id = store.createInstance(req.body);
  res.status(201).json({ id });
});

app.patch('/api/instances/:id', (req, res) => {
  store.updateInstance(+req.params.id, req.body);
  res.json({ ok: true });
});

app.patch('/api/instances/:id/accessory', (req, res) => {
  const ok = store.setInstanceAccessory(+req.params.id, req.body.name, req.body.units);
  if (!ok) return res.status(400).json({ error: 'accessory not resolvable for this figure' });
  res.json({ ok: true });
});

app.patch('/api/instances/:id/accessory-damage', (req, res) => {
  const ok = store.setInstanceAccessoryDamage(+req.params.id, req.body.name, req.body.units);
  if (!ok) return res.status(400).json({ error: 'accessory not owned on this copy' });
  res.json({ ok: true });
});

app.delete('/api/instances/:id', (req, res) => {
  store.removeInstance(+req.params.id);
  res.status(204).end();
});

app.post('/api/parts-bin', (req, res) => {
  const ok = store.addPart(req.body);
  if (!ok) return res.status(400).json({ error: 'accessory not resolvable' });
  res.status(201).json({ ok: true });
});

app.post('/api/parts-bin/deposit', (req, res) => {
  store.depositParts(req.body.catalogId, req.body.parts || []);
  res.json({ ok: true });
});

app.patch('/api/parts-bin/:accessoryId', (req, res) => {
  store.adjustPart(+req.params.accessoryId, req.body.delta);
  res.json({ ok: true });
});

app.delete('/api/parts-bin/:accessoryId', (req, res) => {
  store.removePart(+req.params.accessoryId);
  res.status(204).end();
});

app.post('/api/parts-bin/:accessoryId/pull', (req, res) => {
  const ok = store.pullPart(+req.params.accessoryId, req.body.instanceId);
  if (!ok) return res.status(400).json({ error: 'nothing to pull' });
  res.json({ ok: true });
});

app.post('/api/clear', (req, res) => {
  store.clearAll();
  res.json({ ok: true });
});

// Bulk restore for the Export/Import backup buttons.
app.post('/api/import', (req, res) => {
  const { instances = [], bin = [] } = req.body || {};
  store.clearAll();
  for (const inst of instances) store.createInstance(inst);
  for (const entry of bin) store.addPart({ catalogId: entry.catalogId, accessory: entry.accessory, qty: entry.qty, notes: entry.notes });
  res.json({ ok: true });
});

// The repo root's index.html (the reference-mockup landing page) has the same
// filename as the Vite build's own index.html — serve the landing page for that
// exact path explicitly so it isn't shadowed by the built app's copy.
app.get('/index.html', (req, res) => res.sendFile(path.join(ROOT, 'index.html')));
app.use(express.static(path.join(ROOT, 'web', 'dist')));
app.use(express.static(ROOT, { dotfiles: 'ignore' }));

app.listen(PORT, () => {
  console.log(`G.I. Joe Tracker running at http://localhost:${PORT}`);
});
