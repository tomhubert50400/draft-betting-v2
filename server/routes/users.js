const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

router.get('/leaderboard', (req, res) => {
  const db = getDb();
  const users = db.prepare(`
    SELECT u.id, u.discord_username, u.avatar_url, u.total_score,
           COUNT(b.id) as total_bets,
           SUM(CASE WHEN b.is_perfect = 1 THEN 1 ELSE 0 END) as perfect_scores
    FROM users u
    LEFT JOIN bets b ON u.id = b.user_id AND b.status = 'scored'
    GROUP BY u.id
    HAVING total_bets > 0
    ORDER BY u.total_score DESC
  `).all();

  const badgeStmt = db.prepare('SELECT badge_name FROM badges WHERE user_id = ?');
  const result = users.map(u => ({
    ...u,
    badges: badgeStmt.all(u.id).map(b => b.badge_name),
  }));

  res.json(result);
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const user = db.prepare(`
    SELECT id, discord_username, avatar_url, total_score, created_at
    FROM users WHERE id = ?
  `).get(req.params.id);

  if (!user) return res.status(404).json({ error: 'User not found' });

  user.badges = db.prepare(
    'SELECT badge_name, unlocked_at FROM badges WHERE user_id = ?'
  ).all(user.id);

  const stats = db.prepare(`
    SELECT COUNT(*) as total_bets,
           SUM(CASE WHEN is_perfect = 1 THEN 1 ELSE 0 END) as perfect_scores,
           AVG(score) as avg_score
    FROM bets WHERE user_id = ? AND status = 'scored'
  `).get(user.id);

  res.json({ ...user, ...stats });
});

router.get('/:id/bets', (req, res) => {
  const db = getDb();
  const bets = db.prepare(`
    SELECT b.*, m.team1, m.team2, m.result_draft, m.scheduled_time,
           m.game_number, m.best_of
    FROM bets b
    JOIN matches m ON b.match_id = m.id
    WHERE b.user_id = ?
    ORDER BY b.created_at DESC
  `).all(req.params.id);

  const parsed = bets.map(b => ({
    ...b,
    predictions: JSON.parse(b.predictions),
    result_draft: b.result_draft ? JSON.parse(b.result_draft) : null,
  }));

  res.json(parsed);
});

module.exports = router;
