// server/scraper/poller.js
const { getDb } = require('../db');
const { broadcast } = require('../ws');
const {
  getLive, getEventDetails, getGameWindow, getGameLastFrame,
  findMatchInLive, getCurrentGame, isSeriesOver,
  extractDraftFromWindow,
} = require('./lolesportsApi');
const { convertDraftToNames } = require('./championMapper');
const { calculateBetScore, checkBadges } = require('./scoring');
const { POLLING } = require('./config');
const { normalizeTeamName } = require('./scheduleSync');

function mapSeriesTeamToMatch(seriesTeam, match) {
  if (!seriesTeam) return null;
  const code = (seriesTeam.code || '').toLowerCase();
  const normalizedName = seriesTeam.name ? normalizeTeamName(seriesTeam.name) : null;
  const t1 = match.team1.toLowerCase();
  const t2 = match.team2.toLowerCase();

  if (normalizedName === match.team1) return 'team1';
  if (normalizedName === match.team2) return 'team2';
  if (code && code === t1) return 'team1';
  if (code && code === t2) return 'team2';

  const fuzzy = (seriesTeam.name || seriesTeam.code || '').toLowerCase();
  if (fuzzy && (fuzzy.includes(t1) || t1.includes(fuzzy))) return 'team1';
  if (fuzzy && (fuzzy.includes(t2) || t2.includes(fuzzy))) return 'team2';
  return null;
}

function pickWinningSide(frame) {
  const blue = frame?.blueTeam;
  const red = frame?.redTeam;
  if (!blue || !red) return null;
  if (blue.inhibitors !== red.inhibitors) return blue.inhibitors > red.inhibitors ? 'blue' : 'red';
  if (blue.towers !== red.towers) return blue.towers > red.towers ? 'blue' : 'red';
  if (blue.totalKills !== red.totalKills) return blue.totalKills > red.totalKills ? 'blue' : 'red';
  return null;
}

async function determineWinnerSide(eventDetails, gameInfo, match) {
  if (!gameInfo?.teams || !gameInfo.id) return null;

  // Primary: lolesports game-level outcome (rarely populated in practice)
  const winningGameTeam = gameInfo.teams.find((t) => t.result?.outcome === 'win');
  if (winningGameTeam) {
    const seriesTeams = eventDetails?.match?.teams || [];
    const seriesTeam = seriesTeams.find((t) => t.id === winningGameTeam.id) || winningGameTeam;
    const side = mapSeriesTeamToMatch(seriesTeam, match);
    if (side) return side;
  }

  // Fallback: feed API end-of-game frame → winner by inhibitors/towers/kills.
  // Trust the frame's gameState when still live; if event-details already marks
  // the game completed, older frames may report 'in_game' — rely on the stats.
  const frame = await getGameLastFrame(gameInfo.id);
  if (!frame) return null;
  const gameCompleted = gameInfo.state === 'completed';
  if (!gameCompleted && frame.gameState !== 'finished') return null;

  const winningSide = pickWinningSide(frame);
  if (!winningSide) return null;

  const winningSideTeam = gameInfo.teams.find((t) => t.side === winningSide);
  if (!winningSideTeam) return null;

  const seriesTeams = eventDetails?.match?.teams || [];
  const seriesTeam = seriesTeams.find((t) => t.id === winningSideTeam.id);
  return mapSeriesTeamToMatch(seriesTeam, match);
}

let pollingInterval = null;

function startPoller() {
  if (pollingInterval) return;
  console.log(`Poller started (every ${POLLING.CHECK_INTERVAL / 1000}s)`);
  pollingInterval = setInterval(pollMatches, POLLING.CHECK_INTERVAL);
  pollMatches();
}

function stopPoller() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    console.log('Poller stopped');
  }
}

async function pollMatches() {
  const db = getDb();

  try {
    // Auto-lock any open match whose lock_at has passed (regardless of source)
    const candidates = db.prepare(`
      SELECT id, lock_at FROM matches
      WHERE status = 'open' AND lock_at IS NOT NULL
    `).all();
    const nowMs = Date.now();
    for (const c of candidates) {
      if (new Date(c.lock_at).getTime() <= nowMs) {
        db.prepare("UPDATE matches SET status = 'locked', locked_at = datetime('now') WHERE id = ?").run(c.id);
        const updated = db.prepare('SELECT * FROM matches WHERE id = ?').get(c.id);
        console.log(`Match ${c.id} auto-locked (timer expired)`);
        broadcast({ type: 'match_updated', match: updated });
      }
    }

    const now = new Date();
    const windowEnd = new Date(now.getTime() + POLLING.UPCOMING_WINDOW);

    const matches = db.prepare(`
      SELECT * FROM matches
      WHERE status IN ('open', 'locked')
        AND auto_created = 1
        AND (scheduled_time IS NULL OR scheduled_time <= ?)
    `).all(windowEnd.toISOString());

    if (matches.length === 0) return;

    const liveData = await getLive();

    for (const match of matches) {
      try {
        await pollSingleMatch(match, liveData);
      } catch (err) {
        console.error(`Error polling match ${match.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('Poll cycle error:', err.message);
  }
}

async function pollSingleMatch(match, liveData) {
  const db = getDb();
  const apiMatch = findMatchInLive(liveData, match.lolesports_match_id);

  if (!apiMatch) {
    if (match.status === 'open' && match.series_id && match.best_of !== 'bo1') {
      cleanupSeriesIfDecided(match.series_id, match.best_of);
    }

    if (match.status === 'open' && match.scheduled_time) {
      const scheduledMs = new Date(match.scheduled_time).getTime();
      if (Date.now() - scheduledMs > 6 * 60 * 60 * 1000) {
        console.log(`Deleting stale match ${match.id} (6h+ past scheduled time)`);
        db.prepare('DELETE FROM matches WHERE id = ?').run(match.id);
        broadcast({ type: 'match_deleted', matchId: match.id });
        return;
      }
    }

    if (match.status === 'locked') {
      await tryCompletionFallback(match);
    }
    return;
  }

  const currentGame = getCurrentGame(apiMatch, match.game_number);
  if (!currentGame) return;

  const gameState = currentGame.state?.toLowerCase();

  if (match.status === 'open') {
    if (match.lock_at && new Date() >= new Date(match.lock_at)) {
      db.prepare(
        "UPDATE matches SET status = 'locked', locked_at = datetime('now') WHERE id = ?"
      ).run(match.id);
      console.log(`Match ${match.id} locked (timer expired)`);
      const updated = db.prepare('SELECT * FROM matches WHERE id = ?').get(match.id);
      broadcast({ type: 'match_updated', match: updated });
      await tryResolveDraft(match);
      return;
    }

    if (!match.lock_at) {
      const draftStatus = await tryDetectDraftStart(match);
      if (draftStatus.draftStarted) {
        const lockDelay = getLockDelay();
        const lockAt = new Date(Date.now() + lockDelay);
        db.prepare('UPDATE matches SET lock_at = ? WHERE id = ?')
          .run(lockAt.toISOString(), match.id);
        console.log(`Match ${match.id}: draft detected, lock at ${lockAt.toISOString()}`);
        broadcast({
          type: 'match_updated',
          match: { ...match, lock_at: lockAt.toISOString() },
        });
      }
    }
  }

  if (match.status === 'locked') {
    if (gameState === 'completed') {
      await processCompletion(match);
    } else {
      await tryResolveDraft(match);
    }
  }
}

async function tryDetectDraftStart(match) {
  try {
    const eventDetails = await getEventDetails(match.lolesports_event_id || match.lolesports_match_id);
    const gameInfo = eventDetails?.match?.games?.find(g => g.number === match.game_number);
    if (!gameInfo?.id) return { draftStarted: false };

    const windowData = await getGameWindow(gameInfo.id);
    const draftData = extractDraftFromWindow(windowData, match.team1, match.team2);
    const team1Picks = Object.keys(draftData?.draft?.team1 || {}).length;
    const team2Picks = Object.keys(draftData?.draft?.team2 || {}).length;

    return { draftStarted: true, draftComplete: team1Picks === 5 && team2Picks === 5, draftData };
  } catch {
    return { draftStarted: false };
  }
}

async function tryResolveDraft(match) {
  try {
    const eventDetails = await getEventDetails(match.lolesports_event_id || match.lolesports_match_id);
    const gameInfo = eventDetails?.match?.games?.find(g => g.number === match.game_number);
    if (!gameInfo?.id) return false;

    const windowData = await getGameWindow(gameInfo.id);
    const draftData = extractDraftFromWindow(windowData, match.team1, match.team2);
    const team1Picks = Object.keys(draftData?.draft?.team1 || {}).length;
    const team2Picks = Object.keys(draftData?.draft?.team2 || {}).length;

    if (team1Picks !== 5 || team2Picks !== 5) return false;

    const winner = await determineWinnerSide(eventDetails, gameInfo, match);

    await processResults(match.id, draftData.draft, draftData.rosters, winner);
    return true;
  } catch (err) {
    console.warn(`tryResolveDraft failed for match ${match.id}:`, err.message);
    return false;
  }
}

async function processCompletion(match) {
  try {
    const eventDetails = await getEventDetails(match.lolesports_event_id || match.lolesports_match_id);
    const gameInfo = eventDetails?.match?.games?.find(g => g.number === match.game_number);
    if (!gameInfo?.id) return;

    const windowData = await getGameWindow(gameInfo.id);
    const draftData = extractDraftFromWindow(windowData, match.team1, match.team2);
    if (!draftData?.draft) return;

    const winner = await determineWinnerSide(eventDetails, gameInfo, match);

    await processResults(match.id, draftData.draft, draftData.rosters, winner);
  } catch (err) {
    console.error(`processCompletion failed for match ${match.id}:`, err.message);
  }
}

async function tryCompletionFallback(match) {
  await processCompletion(match);
}

async function processResults(matchId, apiDraft, rosters, winner) {
  const db = getDb();
  const resultDraft = await convertDraftToNames(apiDraft);

  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId);
  if (!match || match.status === 'completed') return;

  db.prepare(`
    UPDATE matches SET
      status = 'completed',
      result_draft = ?,
      result_rosters = ?,
      winner = ?,
      completed_at = datetime('now')
    WHERE id = ?
  `).run(
    JSON.stringify(resultDraft),
    rosters ? JSON.stringify(rosters) : null,
    winner,
    matchId,
  );

  console.log(`Match ${matchId} completed (winner: ${winner})`);

  const bets = db.prepare("SELECT * FROM bets WHERE match_id = ? AND status = 'pending'").all(matchId);

  const updateBet = db.prepare(`
    UPDATE bets SET score = ?, correct_picks = ?, is_perfect = ?, status = 'scored', scored_at = datetime('now')
    WHERE id = ?
  `);

  const scoreTransaction = db.transaction(() => {
    for (const bet of bets) {
      const predictions = JSON.parse(bet.predictions);
      const { score, correctPicks, isPerfectScore } = calculateBetScore(predictions, resultDraft);
      updateBet.run(score, correctPicks, isPerfectScore ? 1 : 0, bet.id);

      db.prepare('UPDATE users SET total_score = total_score + ? WHERE id = ?')
        .run(score, bet.user_id);

      const userStats = db.prepare(`
        SELECT COUNT(*) as totalBets,
               SUM(CASE WHEN is_perfect = 1 THEN 1 ELSE 0 END) > 0 as hasPerfect,
               (SELECT total_score FROM users WHERE id = ?) as totalScore
        FROM bets WHERE user_id = ? AND status = 'scored'
      `).get(bet.user_id, bet.user_id);

      const earned = checkBadges(userStats);
      const insertBadge = db.prepare(
        'INSERT OR IGNORE INTO badges (user_id, badge_name) VALUES (?, ?)'
      );
      for (const badge of earned) {
        insertBadge.run(bet.user_id, badge);
      }
    }
  });

  scoreTransaction();

  const updatedMatch = db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId);
  // Aggregate player champion stats from this completed match
  try {
    const { processMatch } = require('./playerStats');
    processMatch(db, updatedMatch);
  } catch (err) {
    console.error('playerStats.processMatch failed:', err.message);
  }
  updatedMatch.result_draft = JSON.parse(updatedMatch.result_draft);
  broadcast({ type: 'match_updated', match: updatedMatch });

  if (match.series_id) {
    createNextGameIfNeeded(match);
    if (winner) cleanupSeriesIfDecided(match.series_id, match.best_of);
  }
}

function createNextGameIfNeeded(match) {
  const db = getDb();
  const bestOf = match.best_of || 'bo1';
  const maxGames = bestOf === 'bo3' ? 3 : bestOf === 'bo5' ? 5 : 1;
  if (match.game_number >= maxGames) return;

  const winsNeeded = Math.ceil(maxGames / 2);
  const wins = db.prepare(`
    SELECT winner, COUNT(*) as cnt FROM matches
    WHERE series_id = ? AND status = 'completed' AND winner IS NOT NULL
    GROUP BY winner
  `).all(match.series_id);

  for (const w of wins) {
    if (w.cnt >= winsNeeded) return;
  }

  const nextGame = match.game_number + 1;
  const result = db.prepare(`
    INSERT INTO matches (event_id, lolesports_match_id, lolesports_event_id, team1, team2,
                         best_of, game_number, series_id, scheduled_time, auto_created)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(match.event_id, match.lolesports_match_id, match.lolesports_event_id,
         match.team1, match.team2, match.best_of, nextGame, match.series_id, match.scheduled_time);

  const newMatch = db.prepare('SELECT * FROM matches WHERE id = ?').get(result.lastInsertRowid);
  broadcast({ type: 'match_created', match: newMatch });
  console.log(`Created game ${nextGame} for series ${match.series_id}`);
}

function cleanupSeriesIfDecided(seriesId, bestOf) {
  const db = getDb();
  if (!seriesId || bestOf === 'bo1') return;

  const maxGames = bestOf === 'bo3' ? 3 : 5;
  const winsNeeded = Math.ceil(maxGames / 2);

  const wins = db.prepare(`
    SELECT winner, COUNT(*) as cnt FROM matches
    WHERE series_id = ? AND status = 'completed' AND winner IS NOT NULL
    GROUP BY winner
  `).all(seriesId);

  const decided = wins.some(w => w.cnt >= winsNeeded);
  if (!decided) return;

  const toDelete = db.prepare(
    "SELECT id FROM matches WHERE series_id = ? AND status IN ('open', 'locked')"
  ).all(seriesId);

  if (toDelete.length === 0) return;

  for (const m of toDelete) {
    db.prepare('DELETE FROM matches WHERE id = ?').run(m.id);
    broadcast({ type: 'match_deleted', matchId: m.id });
  }

  console.log(`Series ${seriesId} decided: deleted ${toDelete.length} unplayed game(s)`);
}

function getLockDelay() {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key = 'lock_delay_minutes'").get();
  const minutes = row ? parseInt(row.value, 10) : 13;
  return minutes * 60 * 1000;
}

async function backfillMissingWinners() {
  const db = getDb();
  const candidates = db.prepare(
    "SELECT * FROM matches WHERE status = 'completed' AND winner IS NULL"
  ).all();

  if (candidates.length === 0) return;
  console.log(`Backfilling winners for ${candidates.length} completed match(es) with NULL winner...`);

  let fixed = 0;
  for (const match of candidates) {
    try {
      const eventId = match.lolesports_event_id || match.lolesports_match_id;
      if (!eventId) continue;

      const eventDetails = await getEventDetails(eventId);
      const gameInfo = eventDetails?.match?.games?.find((g) => g.number === match.game_number);
      if (!gameInfo) {
        console.log(`Backfill: match ${match.id}: gameInfo not found`);
        continue;
      }

      const winner = await determineWinnerSide(eventDetails, gameInfo, match);
      if (!winner) {
        console.log(`Backfill: match ${match.id}: still no winner detected`);
        continue;
      }

      db.prepare('UPDATE matches SET winner = ? WHERE id = ?').run(winner, match.id);
      const updated = db.prepare('SELECT * FROM matches WHERE id = ?').get(match.id);
      updated.result_draft = updated.result_draft ? JSON.parse(updated.result_draft) : null;
      updated.result_rosters = updated.result_rosters ? JSON.parse(updated.result_rosters) : null;
      updated.rosters = updated.rosters ? JSON.parse(updated.rosters) : null;
      broadcast({ type: 'match_updated', match: updated });
      console.log(`Backfill: match ${match.id} → winner = ${winner}`);
      fixed++;
    } catch (err) {
      console.error(`Backfill failed for match ${match.id}:`, err.message);
    }
  }

  console.log(`Backfill done: ${fixed}/${candidates.length} match(es) fixed`);
}

module.exports = { startPoller, stopPoller, pollMatches, backfillMissingWinners };
