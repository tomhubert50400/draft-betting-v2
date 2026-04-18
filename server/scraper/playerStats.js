/**
 * Player champion stats aggregator
 * Reads completed matches and updates player_champion_stats table
 */
const { getTeamRoster } = require('./teamRosters');

const ROLES = ['top', 'jungle', 'mid', 'bot', 'support'];
const ROLE_KEYS = { top: 'Top', jungle: 'Jungle', mid: 'Mid', bot: 'Bot', support: 'Support' };

/**
 * Process a single completed match and update player_champion_stats
 * @param {Database} db - better-sqlite3 instance
 * @param {Object} match - row from matches table (raw, with TEXT columns)
 */
function processMatch(db, match) {
  if (!match || match.status !== 'completed' || !match.result_draft) return 0;

  let draft;
  try { draft = JSON.parse(match.result_draft); } catch { return 0; }

  // Try to use match.rosters if present, else fallback to TEAM_ROSTERS
  let rosters = null;
  if (match.rosters) {
    try { rosters = JSON.parse(match.rosters); } catch { rosters = null; }
  }
  if (!rosters) {
    rosters = {
      team1: getTeamRoster(match.team1) || {},
      team2: getTeamRoster(match.team2) || {},
    };
  }

  const upsert = db.prepare(`
    INSERT INTO player_champion_stats (player_name, champion_id, champion_name, picks, wins, last_updated)
    VALUES (?, ?, ?, 1, ?, datetime('now'))
    ON CONFLICT(player_name, champion_id) DO UPDATE SET
      picks = picks + 1,
      wins = wins + excluded.wins,
      last_updated = datetime('now')
  `);

  let updated = 0;
  for (const team of ['team1', 'team2']) {
    const isWinner = match.winner === team;
    const teamRoster = rosters[team] || {};
    for (const role of ROLES) {
      const champion = draft[`${team}_${role}`];
      if (!champion?.id) continue;
      const playerName = teamRoster[ROLE_KEYS[role]];
      if (!playerName) continue;
      upsert.run(playerName, champion.id, champion.name, isWinner ? 1 : 0);
      updated++;
    }
  }
  return updated;
}

/**
 * Backfill stats from all completed matches (idempotent only if you wipe table first)
 */
function backfillAll(db) {
  const matches = db.prepare(`SELECT * FROM matches WHERE status = 'completed' AND result_draft IS NOT NULL`).all();
  let total = 0;
  for (const m of matches) total += processMatch(db, m);
  return { matches: matches.length, statsUpdated: total };
}

module.exports = { processMatch, backfillAll };
