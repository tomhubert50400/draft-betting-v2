const express = require('express');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db');

const router = express.Router();

router.get('/discord', (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: process.env.DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify',
  });
  res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
});

router.get('/discord/callback', async (req, res) => {
  const { code, error } = req.query;
  const FRONTEND = process.env.FRONTEND_URL;

  if (error || !code) {
    return res.redirect(`${FRONTEND}/login?error=discord_denied`);
  }

  try {
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI,
      }),
    });

    if (!tokenRes.ok) {
      return res.redirect(`${FRONTEND}/login?error=token_exchange_failed`);
    }

    const { access_token } = await tokenRes.json();

    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!userRes.ok) {
      return res.redirect(`${FRONTEND}/login?error=user_fetch_failed`);
    }

    const discord = await userRes.json();
    const db = getDb();
    const username = discord.global_name || discord.username;
    const avatarUrl = discord.avatar
      ? `https://cdn.discordapp.com/avatars/${discord.id}/${discord.avatar}.png`
      : null;

    let user = db.prepare('SELECT * FROM users WHERE discord_id = ?').get(discord.id);

    if (user) {
      // Existing user: just refresh display info
      db.prepare(
        'UPDATE users SET discord_username = ?, avatar_url = ? WHERE id = ?'
      ).run(username, avatarUrl, user.id);
      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
      return res.redirect(`${FRONTEND}/discord-callback?token=${token}`);
    }

    // No match by discord_id. Check for legacy fb_ accounts with same username
    const candidate = db.prepare(
      "SELECT id, discord_username, total_score, (SELECT COUNT(*) FROM bets WHERE user_id = users.id) as bets FROM users WHERE discord_id LIKE 'fb_%' AND LOWER(discord_username) = LOWER(?)"
    ).get(username);

    if (candidate) {
      // Issue a short-lived pending-claim token containing the Discord identity + candidate
      const pending = jwt.sign(
        {
          purpose: 'claim',
          discordId: discord.id,
          discordUsername: username,
          avatarUrl,
          candidateUserId: candidate.id,
        },
        process.env.JWT_SECRET,
        { expiresIn: '10m' }
      );
      const params = new URLSearchParams({
        pending,
        candidate_username: candidate.discord_username,
        candidate_score: String(candidate.total_score),
        candidate_bets: String(candidate.bets),
      });
      return res.redirect(`${FRONTEND}/claim-account?${params}`);
    }

    // No legacy match: create a fresh account
    const result = db.prepare(
      'INSERT INTO users (discord_id, discord_username, avatar_url) VALUES (?, ?, ?)'
    ).run(discord.id, username, avatarUrl);
    const token = jwt.sign({ userId: result.lastInsertRowid }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.redirect(`${FRONTEND}/discord-callback?token=${token}`);
  } catch (err) {
    console.error('Discord auth error:', err);
    res.redirect(`${FRONTEND}/login?error=auth_failed`);
  }
});

// Verify a pending-claim token and return the candidate info (for the claim page)
function verifyPending(token) {
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  if (payload.purpose !== 'claim') throw new Error('Invalid pending token');
  return payload;
}

router.post('/claim', express.json(), (req, res) => {
  const { pending } = req.body;
  if (!pending) return res.status(400).json({ error: 'pending token required' });

  let payload;
  try { payload = verifyPending(pending); }
  catch { return res.status(401).json({ error: 'Invalid or expired pending token' }); }

  const db = getDb();
  // Re-check candidate is still claimable (still fb_)
  const candidate = db.prepare(
    "SELECT * FROM users WHERE id = ? AND discord_id LIKE 'fb_%'"
  ).get(payload.candidateUserId);
  if (!candidate) return res.status(409).json({ error: 'Candidate already claimed or not found' });

  // Make sure no other user is already using this discord_id (race condition)
  const existing = db.prepare('SELECT id FROM users WHERE discord_id = ?').get(payload.discordId);
  if (existing) return res.status(409).json({ error: 'This Discord account is already linked to another user' });

  db.prepare(
    'UPDATE users SET discord_id = ?, discord_username = ?, avatar_url = ? WHERE id = ?'
  ).run(payload.discordId, payload.discordUsername, payload.avatarUrl, candidate.id);

  const token = jwt.sign({ userId: candidate.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ token });
});

router.post('/claim-skip', express.json(), (req, res) => {
  const { pending } = req.body;
  if (!pending) return res.status(400).json({ error: 'pending token required' });

  let payload;
  try { payload = verifyPending(pending); }
  catch { return res.status(401).json({ error: 'Invalid or expired pending token' }); }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE discord_id = ?').get(payload.discordId);
  if (existing) {
    const token = jwt.sign({ userId: existing.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token });
  }

  const result = db.prepare(
    'INSERT INTO users (discord_id, discord_username, avatar_url) VALUES (?, ?, ?)'
  ).run(payload.discordId, payload.discordUsername, payload.avatarUrl);
  const token = jwt.sign({ userId: result.lastInsertRowid }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ token });
});

module.exports = router;
