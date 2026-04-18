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

router.get('/:id/champion-stats', (req, res) => {
  const db = getDb();
  const bets = db.prepare(`
    SELECT b.predictions, b.status, m.result_draft
    FROM bets b
    JOIN matches m ON b.match_id = m.id
    WHERE b.user_id = ?
  `).all(req.params.id);

  // stats[champId] = { picks, hits }
  const stats = {};
  const ROLES = ['top', 'jungle', 'mid', 'bot', 'support'];

  for (const bet of bets) {
    let preds, result;
    try { preds = JSON.parse(bet.predictions); } catch { continue; }
    try { result = bet.result_draft ? JSON.parse(bet.result_draft) : null; } catch { result = null; }

    for (const team of ['team1', 'team2']) {
      for (const role of ROLES) {
        const pick = preds[`${team}_${role}`];
        if (!pick?.id) continue;
        if (!stats[pick.id]) stats[pick.id] = { id: pick.id, name: pick.name, picks: 0, hits: 0 };
        stats[pick.id].picks += 1;
        if (result) {
          const actual = result[`${team}_${role}`];
          if (actual?.id === pick.id) stats[pick.id].hits += 1;
        }
      }
    }
  }

  res.json(Object.values(stats));
});

module.exports = router;
