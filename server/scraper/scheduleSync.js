const { getDb } = require('../db');
const { getUpcomingKCMatches, isKarmineCorpMatch, getTeamRosterFromApi } = require('./lolesportsApi');
const { TEAM_NAME_MAP, LEAGUES } = require('./config');
const { broadcast } = require('../ws');

function normalizeTeamName(teamName) {
  if (TEAM_NAME_MAP[teamName]) return TEAM_NAME_MAP[teamName];
  const lower = teamName.toLowerCase();
  if (lower.includes('karmine') && lower.includes('blue')) return null;
  if (lower.includes('karmine') || lower.includes('kcorp')) return 'KC';
  return teamName;
}

function getBestOfFormat(strategy) {
  if (!strategy?.count) return 'bo1';
  if (strategy.count === 3) return 'bo3';
  if (strategy.count === 5) return 'bo5';
  return 'bo1';
}

async function syncSchedule() {
  const db = getDb();
  console.log('Syncing KC schedule...');

  try {
    const kcMatches = await getUpcomingKCMatches();
    console.log(`Found ${kcMatches.length} upcoming KC match(es)`);

    let created = 0;
    let skipped = 0;

    for (const event of kcMatches) {
      const matchId = event.match?.id || event.id;
      const teams = event.match?.teams || [];
      if (teams.length < 2) continue;

      const team1Name = normalizeTeamName(teams[0].name);
      const team2Name = normalizeTeamName(teams[1].name);
      if (!team1Name || !team2Name) continue;

      const bestOf = getBestOfFormat(event.match?.strategy);
      const scheduledTime = event.startTime || null;

      const existing = db.prepare(
        'SELECT id FROM matches WHERE lolesports_match_id = ? AND game_number = 1'
      ).get(matchId);

      if (existing) {
        skipped++;
        continue;
      }

      const leagueName = event.leagueName || 'LEC';
      const tournamentName = event.tournament?.name || '';
      const eventName = tournamentName ? `${leagueName} ${tournamentName}` : leagueName;

      let eventRow = db.prepare(
        "SELECT id FROM events WHERE name = ? AND status = 'active'"
      ).get(eventName);

      if (!eventRow) {
        const res = db.prepare('INSERT INTO events (name) VALUES (?)').run(eventName);
        eventRow = { id: res.lastInsertRowid };
        console.log(`Created event: ${eventName}`);
      }

      const seriesId = bestOf !== 'bo1' ? `series-${matchId}-${Date.now()}` : null;

      let rosters = { team1: {}, team2: {} };
      try {
        const [r1, r2] = await Promise.all([
          getTeamRosterFromApi(team1Name),
          getTeamRosterFromApi(team2Name),
        ]);
        rosters = { team1: r1, team2: r2 };
      } catch (err) {
        console.warn('Roster fetch failed:', err.message);
      }

      const result = db.prepare(`
        INSERT INTO matches (event_id, lolesports_match_id, lolesports_event_id, team1, team2,
                             best_of, game_number, series_id, scheduled_time, rosters, auto_created)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 1)
      `).run(
        eventRow.id, matchId, event.id, team1Name, team2Name,
        bestOf, seriesId, scheduledTime, JSON.stringify(rosters)
      );

      const newMatch = db.prepare('SELECT * FROM matches WHERE id = ?').get(result.lastInsertRowid);
      broadcast({ type: 'match_created', match: newMatch });

      console.log(`Created match: ${team1Name} vs ${team2Name} (${bestOf}) - ${scheduledTime}`);
      created++;
    }

    console.log(`Schedule sync done: ${created} created, ${skipped} skipped`);
    return { created, skipped };
  } catch (err) {
    console.error('Schedule sync error:', err);
    throw err;
  }
}

module.exports = { syncSchedule, normalizeTeamName };
