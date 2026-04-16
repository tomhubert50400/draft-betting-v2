const express = require('express');
const { getDb } = require('../db');
const { authRequired } = require('../middleware/auth');
const { betLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.post('/', authRequired, betLimiter, (req, res) => {
  const db = getDb();
  const { matchId, predictions } = req.body;

  if (!matchId || !predictions) {
    return res.status(400).json({ error: 'matchId and predictions required' });
  }

  const match = db.prepare('SELECT status FROM matches WHERE id = ?').get(matchId);
  if (!match) return res.status(404).json({ error: 'Match not found' });
  if (match.status !== 'open') {
    return res.status(400).json({ error: 'Match is not open for betting' });
  }

  const existing = db.prepare(
    'SELECT id FROM bets WHERE user_id = ? AND match_id = ?'
  ).get(req.user.id, matchId);

  if (existing) {
    db.prepare(
      'UPDATE bets SET predictions = ? WHERE id = ?'
    ).run(JSON.stringify(predictions), existing.id);
    res.json({ id: existing.id, updated: true });
  } else {
    const result = db.prepare(
      'INSERT INTO bets (user_id, match_id, predictions) VALUES (?, ?, ?)'
    ).run(req.user.id, matchId, JSON.stringify(predictions));
    res.status(201).json({ id: result.lastInsertRowid, updated: false });
  }
});

router.get('/me', authRequired, (req, res) => {
  const db = getDb();
  const bets = db.prepare(`
    SELECT b.*, m.team1, m.team2, m.status as match_status,
           m.result_draft, m.scheduled_time, m.game_number, m.best_of
    FROM bets b
    JOIN matches m ON b.match_id = m.id
    WHERE b.user_id = ?
    ORDER BY b.created_at DESC
  `).all(req.user.id);

  const parsed = bets.map(b => ({
    ...b,
    predictions: JSON.parse(b.predictions),
    result_draft: b.result_draft ? JSON.parse(b.result_draft) : null,
  }));

  res.json(parsed);
});

module.exports = router;
