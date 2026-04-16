const express = require('express');
const { getDb } = require('../db');
const { authRequired } = require('../middleware/auth');
const { adminRequired } = require('../middleware/admin');
const { broadcast } = require('../ws');

const router = express.Router();
router.use(authRequired, adminRequired);

router.post('/matches', (req, res) => {
  const db = getDb();
  const { event_id, team1, team2, best_of, scheduled_time } = req.body;

  const result = db.prepare(`
    INSERT INTO matches (event_id, team1, team2, best_of, scheduled_time)
    VALUES (?, ?, ?, ?, ?)
  `).run(event_id, team1, team2, best_of || 'bo1', scheduled_time);

  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(result.lastInsertRowid);
  broadcast({ type: 'match_created', match });
  res.status(201).json(match);
});

router.put('/matches/:id', (req, res) => {
  const db = getDb();
  const fields = req.body;
  const allowed = ['team1', 'team2', 'best_of', 'scheduled_time', 'event_id', 'status'];
  const updates = [];
  const values = [];

  for (const [key, val] of Object.entries(fields)) {
    if (allowed.includes(key)) {
      updates.push(`${key} = ?`);
      values.push(val);
    }
  }

  if (updates.length === 0) return res.status(400).json({ error: 'No valid fields' });

  values.push(req.params.id);
  db.prepare(`UPDATE matches SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(req.params.id);
  broadcast({ type: 'match_updated', match });
  res.json(match);
});

router.delete('/matches/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM matches WHERE id = ?').run(req.params.id);
  broadcast({ type: 'match_deleted', matchId: Number(req.params.id) });
  res.json({ deleted: true });
});

router.post('/matches/:id/lock', (req, res) => {
  const db = getDb();
  db.prepare(
    "UPDATE matches SET status = 'locked', locked_at = datetime('now') WHERE id = ? AND status = 'open'"
  ).run(req.params.id);

  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(req.params.id);
  broadcast({ type: 'match_updated', match });
  res.json(match);
});

router.post('/matches/:id/unlock', (req, res) => {
  const db = getDb();
  db.prepare(
    "UPDATE matches SET status = 'open', locked_at = NULL, lock_at = NULL WHERE id = ? AND status = 'locked'"
  ).run(req.params.id);

  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(req.params.id);
  broadcast({ type: 'match_updated', match });
  res.json(match);
});

router.get('/settings', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  rows.forEach(r => { settings[r.key] = r.value; });
  res.json(settings);
});

router.put('/settings', (req, res) => {
  const db = getDb();
  const upsert = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?'
  );
  for (const [key, value] of Object.entries(req.body)) {
    upsert.run(key, String(value), String(value));
  }
  res.json({ updated: true });
});

router.post('/events', (req, res) => {
  const db = getDb();
  const { name } = req.body;
  const result = db.prepare('INSERT INTO events (name) VALUES (?)').run(name);
  res.status(201).json({ id: result.lastInsertRowid, name, status: 'active' });
});

router.get('/events', (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM events ORDER BY created_at DESC').all());
});

module.exports = router;
