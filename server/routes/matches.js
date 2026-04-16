const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const db = getDb();
  const matches = db.prepare(`
    SELECT m.*, e.name as event_name
    FROM matches m
    LEFT JOIN events e ON m.event_id = e.id
    WHERE m.status IN ('open', 'locked')
       OR (m.status = 'completed' AND m.completed_at > datetime('now', '-7 days'))
    ORDER BY
      CASE m.status
        WHEN 'open' THEN 0
        WHEN 'locked' THEN 1
        WHEN 'completed' THEN 2
      END,
      m.scheduled_time ASC
  `).all();

  const parsed = matches.map(m => ({
    ...m,
    result_draft: m.result_draft ? JSON.parse(m.result_draft) : null,
    result_rosters: m.result_rosters ? JSON.parse(m.result_rosters) : null,
    rosters: m.rosters ? JSON.parse(m.rosters) : null,
  }));

  res.json(parsed);
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const match = db.prepare(`
    SELECT m.*, e.name as event_name
    FROM matches m
    LEFT JOIN events e ON m.event_id = e.id
    WHERE m.id = ?
  `).get(req.params.id);

  if (!match) return res.status(404).json({ error: 'Match not found' });

  match.result_draft = match.result_draft ? JSON.parse(match.result_draft) : null;
  match.result_rosters = match.result_rosters ? JSON.parse(match.result_rosters) : null;
  match.rosters = match.rosters ? JSON.parse(match.rosters) : null;

  res.json(match);
});

module.exports = router;
