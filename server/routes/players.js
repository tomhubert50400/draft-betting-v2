const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

router.get('/:name/champion-stats', (req, res) => {
  const db = getDb();
  const stats = db.prepare(`
    SELECT champion_id as id, champion_name as name, picks, wins
    FROM player_champion_stats
    WHERE player_name = ?
    ORDER BY picks DESC, wins DESC
  `).all(req.params.name);

  res.json(stats);
});

module.exports = router;
