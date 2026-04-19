const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const db = getDb();
  // Compute 7-day windows in JS to avoid SQLite/ISO datetime comparison quirks
  const nowMs = Date.now();
  const in7DaysIso = new Date(nowMs + 7 * 24 * 60 * 60 * 1000).toISOString();
  const minus7DaysIso = new Date(nowMs - 7 * 24 * 60 * 60 * 1000).toISOString();

  const matches = db.prepare(`
    SELECT m.*, e.name as event_name
    FROM matches m
    LEFT JOIN events e ON m.event_id = e.id
    WHERE
      (m.status = 'open' AND (m.scheduled_time IS NULL OR m.scheduled_time <= ?))
      OR m.status = 'locked'
      OR (m.status = 'completed' AND m.completed_at > ?)
    ORDER BY
      CASE m.status
        WHEN 'open' THEN 0
        WHEN 'locked' THEN 1
        WHEN 'completed' THEN 2
      END,
      m.scheduled_time ASC
  `).all(in7DaysIso, minus7DaysIso);

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

  // Series score (BO3/BO5)
  if (match.series_id && match.best_of !== 'bo1') {
    const games = db.prepare(`
      SELECT team1, team2, winner FROM matches
      WHERE series_id = ? AND status = 'completed' AND winner IS NOT NULL
    `).all(match.series_id);
    let t1 = 0, t2 = 0;
    for (const g of games) {
      if (g.winner === 'team1') t1++;
      else if (g.winner === 'team2') t2++;
    }
    match.series_score = { team1: t1, team2: t2 };
  }

  res.json(match);
});

module.exports = router;
