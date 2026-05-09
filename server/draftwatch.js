const WebSocket = require('ws');
const { getDb } = require('./db');
const { broadcast } = require('./ws');

const DRAFT_START_EVENT = 'draft_start';
const LOCKED_STATE = 'LOCKED';
const RECONNECT_DELAY_MS = 5000;

let reconnectTimer = null;

function startDraftWatchMonitor() {
  const wsUrl = process.env.DRAFTWATCH_WS_URL;
  const token = process.env.DRAFTWATCH_TOKEN;
  const webhookUrl = process.env.DRAFTWATCH_DISCORD_WEBHOOK_URL;

  if (!wsUrl || !token) {
    console.log('DraftWatch monitor disabled');
    return;
  }

  connectDraftWatch({ wsUrl, token, webhookUrl });
}

function connectDraftWatch(config) {
  const ws = new WebSocket(config.wsUrl);

  ws.on('open', () => {
    ws.send(JSON.stringify({ token: config.token }));
    console.log('DraftWatch monitor connected');
  });

  ws.on('message', (rawMessage) => {
    handleDraftWatchMessage(rawMessage, config.webhookUrl).catch((err) => {
      console.error('DraftWatch message error:', err);
    });
  });

  ws.on('close', () => {
    console.error('DraftWatch monitor disconnected');
    scheduleReconnect(config);
  });

  ws.on('error', (err) => {
    console.error('DraftWatch monitor error:', err.message);
  });
}

function scheduleReconnect(config) {
  if (reconnectTimer) return;

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectDraftWatch(config);
  }, RECONNECT_DELAY_MS);
}

async function handleDraftWatchMessage(rawMessage, webhookUrl) {
  const payload = parseJson(rawMessage);
  if (!payload) return;

  if (payload.event !== DRAFT_START_EVENT || payload.state !== LOCKED_STATE) return;

  const lockedMatch = lockDraftWatchMatch(payload);
  if (webhookUrl) {
    await sendDiscordDraftStart(webhookUrl, payload, lockedMatch);
  }
}

function lockDraftWatchMatch(payload) {
  const matchInfo = payload.match_info || {};
  const lolesportsMatchId = matchInfo.match_id;
  const gameNumber = Number(matchInfo.game_number || 1);

  if (!lolesportsMatchId || !Number.isInteger(gameNumber)) {
    console.error('DraftWatch LOCKED payload missing match_id or game_number');
    return null;
  }

  const db = getDb();
  const match = db.prepare(`
    SELECT * FROM matches
    WHERE lolesports_match_id = ? AND game_number = ?
  `).get(lolesportsMatchId, gameNumber);

  if (!match) {
    console.error(`DraftWatch match not found: ${lolesportsMatchId} game ${gameNumber}`);
    return null;
  }

  if (match.status !== 'open') {
    console.log(`DraftWatch match ${match.id} ignored because status is ${match.status}`);
    return match;
  }

  db.prepare(`
    UPDATE matches
    SET status = 'locked', locked_at = datetime('now'), lock_at = NULL
    WHERE id = ? AND status = 'open'
  `).run(match.id);

  const updated = db.prepare('SELECT * FROM matches WHERE id = ?').get(match.id);
  broadcast({ type: 'match_updated', match: updated });
  console.log(`DraftWatch locked match ${updated.id} (${lolesportsMatchId} game ${gameNumber})`);
  return updated;
}

function parseJson(rawMessage) {
  try {
    return JSON.parse(rawMessage.toString());
  } catch (err) {
    console.error('DraftWatch invalid JSON:', err.message);
    return null;
  }
}

async function sendDiscordDraftStart(webhookUrl, payload, lockedMatch) {
  const match = payload.match_info || {};
  const teams = Array.isArray(match.teams) ? match.teams : [];
  const teamLabel = teams.map((team) => team.code || team.name).filter(Boolean).join(' vs ');
  const content = [
    'DraftWatch LOCKED detected',
    match.league ? `League: ${match.league}` : null,
    match.match_id ? `Match ID: ${match.match_id}` : null,
    match.game_number ? `Game: ${match.game_number}` : null,
    lockedMatch ? `Local match: ${lockedMatch.id} (${lockedMatch.status})` : 'Local match: not found',
    teamLabel ? `Teams: ${teamLabel}` : null,
    typeof payload.confidence === 'number' ? `Confidence: ${payload.confidence}` : null,
  ].filter(Boolean).join('\n');

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    throw new Error(`Discord webhook failed with status ${response.status}`);
  }
}

module.exports = { startDraftWatchMonitor };
