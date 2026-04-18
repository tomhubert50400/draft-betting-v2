/**
 * Firestore (v1) → SQLite (v2) migration
 *
 * IMPORTANT: This wipes existing v2 data (users, matches, bets, badges, events,
 * player_champion_stats) before importing. The schema is kept intact.
 *
 * Usage: node server/migration/migrate.js
 */
const admin = require('firebase-admin');
const path = require('path');
const Database = require('better-sqlite3');

const serviceAccount = require(path.join(__dirname, 'firebase-credentials.json'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const fdb = admin.firestore();

const DB_PATH = process.env.DB_PATH || './data/draft-betting.db';
const sqlite = new Database(path.join(__dirname, '..', '..', DB_PATH));
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

const ROLES = ['Top', 'Jungle', 'Mid', 'Bot', 'Support'];

function tsToISO(ts) {
  if (!ts) return null;
  if (typeof ts === 'string') return ts;
  if (ts._seconds != null) return new Date(ts._seconds * 1000).toISOString();
  if (ts.seconds != null) return new Date(ts.seconds * 1000).toISOString();
  if (ts.toDate) return ts.toDate().toISOString();
  return null;
}

/** Convert v1 nested draft { team1: { Top: 'Name', ... } } to v2 flat */
function nestedDraftToFlat(nested) {
  if (!nested) return null;
  const flat = {};
  for (const team of ['team1', 'team2']) {
    const obj = nested[team] || {};
    for (const role of ROLES) {
      const name = obj[role];
      if (!name) continue;
      flat[`${team}_${role.toLowerCase()}`] = { id: name, name };
    }
  }
  return flat;
}

async function migrate() {
  console.log('=== Migration started ===\n');

  // 0. Wipe existing migrable data
  console.log('Wiping existing v2 data...');
  sqlite.exec(`
    DELETE FROM player_champion_stats;
    DELETE FROM badges;
    DELETE FROM bets;
    DELETE FROM matches;
    DELETE FROM users;
    DELETE FROM events;
  `);

  // 1. Migrate settings
  console.log('\n1. Settings...');
  try {
    const settingsDoc = await fdb.collection('settings').doc('general').get();
    if (settingsDoc.exists) {
      const data = settingsDoc.data();
      const upsert = sqlite.prepare(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?'
      );
      // Map known keys
      if (data.lockDelayMinutes != null) {
        upsert.run('lock_delay_minutes', String(data.lockDelayMinutes), String(data.lockDelayMinutes));
      }
      console.log('  Settings imported');
    }
  } catch (err) { console.error('  Settings error:', err.message); }

  // 2. Migrate users (collect Firebase UID → new SQLite id mapping)
  console.log('\n2. Users...');
  const userMap = new Map(); // firebase_uid → sqlite_id
  const userBadges = new Map(); // firebase_uid → [badge_id...]

  const usersSnap = await fdb.collection('users').get();
  const insertUser = sqlite.prepare(`
    INSERT INTO users (discord_id, discord_username, avatar_url, total_score, is_admin, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const doc of usersSnap.docs) {
    const d = doc.data();
    const discordId = d.discordId || `fb_${doc.id}`; // fallback for users without discord
    const username = d.username || d.discordUsername || 'Unknown';
    const avatar = d.avatar || null;
    const totalScore = Number(d.totalScore) || 0;
    const isAdmin = d.isAdmin ? 1 : 0;
    const createdAt = tsToISO(d.createdAt) || new Date().toISOString();

    try {
      const result = insertUser.run(discordId, username, avatar, totalScore, isAdmin, createdAt);
      userMap.set(doc.id, result.lastInsertRowid);

      if (Array.isArray(d.badges) && d.badges.length > 0) {
        userBadges.set(doc.id, d.badges.map(b => b.id).filter(Boolean));
      }
    } catch (err) {
      console.warn(`  User ${doc.id} (${username}) skipped:`, err.message);
    }
  }
  console.log(`  ${userMap.size}/${usersSnap.size} users imported`);

  // 3. Migrate badges
  console.log('\n3. Badges...');
  const insertBadge = sqlite.prepare(
    'INSERT OR IGNORE INTO badges (user_id, badge_name) VALUES (?, ?)'
  );
  let badgeCount = 0;
  for (const [fbUid, badges] of userBadges) {
    const sqliteId = userMap.get(fbUid);
    if (!sqliteId) continue;
    for (const b of badges) {
      insertBadge.run(sqliteId, b);
      badgeCount++;
    }
  }
  console.log(`  ${badgeCount} badges imported`);

  // 4. Migrate events (extracted from matches' eventId field)
  console.log('\n4. Events...');
  const matchesSnap = await fdb.collection('matches').get();
  const eventIds = new Set();
  matchesSnap.docs.forEach((d) => { if (d.data().eventId) eventIds.add(d.data().eventId); });

  const insertEvent = sqlite.prepare('INSERT INTO events (name) VALUES (?)');
  const eventMap = new Map(); // firestore eventId → sqlite event.id
  for (const eid of eventIds) {
    const r = insertEvent.run(`Event ${eid.slice(0, 8)}`);
    eventMap.set(eid, r.lastInsertRowid);
  }
  console.log(`  ${eventMap.size} events created`);

  // 5. Migrate matches (Firestore doc.id → new sqlite id mapping)
  console.log('\n5. Matches...');
  const matchMap = new Map(); // firestore matchId → sqlite match.id
  const insertMatch = sqlite.prepare(`
    INSERT INTO matches (
      event_id, lolesports_match_id, lolesports_event_id,
      team1, team2, best_of, game_number, series_id,
      status, scheduled_time, lock_at, locked_at, completed_at,
      winner, result_draft, result_rosters, rosters, auto_created, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let matchCount = 0;
  for (const doc of matchesSnap.docs) {
    const d = doc.data();
    try {
      const eventId = d.eventId ? eventMap.get(d.eventId) : null;
      const bestOf = (d.bestOf || 'bo1').toLowerCase();
      // Status mapping (v1 may have other names)
      let status = (d.status || 'open').toLowerCase();
      if (status === 'pending') status = 'open';
      if (!['open', 'locked', 'completed'].includes(status)) status = 'open';

      // Winner mapping (v1 uses team name string, we want 'team1'/'team2')
      let winner = null;
      if (d.winner) {
        if (d.winner === d.team1) winner = 'team1';
        else if (d.winner === d.team2) winner = 'team2';
        else if (d.winner === 'team1' || d.winner === 'team2') winner = d.winner;
      }

      const resultDraft = nestedDraftToFlat(d.resultDraft);
      const result = insertMatch.run(
        eventId,
        d.lolesportsMatchId || null,
        d.lolesportsEventId || null,
        d.team1 || 'Unknown',
        d.team2 || 'Unknown',
        bestOf,
        d.gameNumber || 1,
        d.seriesId || null,
        status,
        tsToISO(d.scheduledTime),
        tsToISO(d.lockAt),
        tsToISO(d.lockedAt),
        tsToISO(d.completedAt),
        winner,
        resultDraft ? JSON.stringify(resultDraft) : null,
        d.resultRosters ? JSON.stringify(d.resultRosters) : null,
        d.rosters ? JSON.stringify(d.rosters) : null,
        d.autoCreated ? 1 : 0,
        tsToISO(d.createdAt) || new Date().toISOString(),
      );
      matchMap.set(doc.id, result.lastInsertRowid);
      matchCount++;
    } catch (err) {
      console.warn(`  Match ${doc.id} skipped:`, err.message);
    }
  }
  console.log(`  ${matchCount}/${matchesSnap.size} matches imported`);

  // 6. Migrate bets
  console.log('\n6. Bets...');
  const betsSnap = await fdb.collection('bets').get();
  const insertBet = sqlite.prepare(`
    INSERT OR IGNORE INTO bets (
      user_id, match_id, predictions, status, score,
      correct_picks, is_perfect, created_at, scored_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let betCount = 0, betSkipped = 0;
  for (const doc of betsSnap.docs) {
    const d = doc.data();
    const userId = userMap.get(d.userId);
    const matchId = matchMap.get(d.matchId);
    if (!userId || !matchId) { betSkipped++; continue; }

    const predictions = nestedDraftToFlat(d.predictions);
    if (!predictions) { betSkipped++; continue; }

    let status = (d.status || 'pending').toLowerCase();
    if (!['pending', 'scored'].includes(status)) status = 'pending';

    try {
      insertBet.run(
        userId, matchId,
        JSON.stringify(predictions),
        status,
        Number(d.score) || 0,
        Number(d.correctPicks) || 0,
        d.isPerfectScore ? 1 : 0,
        tsToISO(d.createdAt) || new Date().toISOString(),
        tsToISO(d.scoredAt),
      );
      betCount++;
    } catch (err) {
      betSkipped++;
    }
  }
  console.log(`  ${betCount} bets imported, ${betSkipped} skipped`);

  // 7. Backfill player_champion_stats from completed matches
  console.log('\n7. Player champion stats...');
  const { backfillAll } = require('../scraper/playerStats');
  const stats = backfillAll(sqlite);
  console.log(`  ${stats.matches} matches processed, ${stats.statsUpdated} stats lines`);

  // Summary
  console.log('\n=== Migration completed ===');
  const counts = {
    users: sqlite.prepare('SELECT COUNT(*) as c FROM users').get().c,
    events: sqlite.prepare('SELECT COUNT(*) as c FROM events').get().c,
    matches: sqlite.prepare('SELECT COUNT(*) as c FROM matches').get().c,
    bets: sqlite.prepare('SELECT COUNT(*) as c FROM bets').get().c,
    badges: sqlite.prepare('SELECT COUNT(*) as c FROM badges').get().c,
    player_champion_stats: sqlite.prepare('SELECT COUNT(*) as c FROM player_champion_stats').get().c,
  };
  console.table(counts);

  sqlite.close();
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
