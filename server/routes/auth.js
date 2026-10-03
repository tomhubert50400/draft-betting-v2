const express = require('express');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db');

const { createState, verifyState } = require('../utils/oauthState');
const router = express.Router();
const STATE_COOKIE = 'discord_oauth_state';
const stateCookieOptions = () => ({
  httpOnly: true, sameSite: 'lax', path: '/auth/discord',
  secure: process.env.DISCORD_REDIRECT_URI?.startsWith('https://') === true,
});

function loginUrl(error) {
  const frontendUrl = process.env.FRONTEND_URL || '/';
  return `${frontendUrl.replace(/\/?$/, '/') }login?error=${error}`;
}

function getOAuthConfig() {
  const config = {
    clientId: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    redirectUri: process.env.DISCORD_REDIRECT_URI,
    frontendUrl: process.env.FRONTEND_URL,
    jwtSecret: process.env.JWT_SECRET,
  };

  return Object.values(config).every(Boolean) ? config : null;
}

router.get('/discord', (req, res) => {
  const config = getOAuthConfig();
  if (!config) {
    return res.redirect(loginUrl('discord_config_missing'));
  }

  const state = createState();
  res.cookie(STATE_COOKIE, state, { ...stateCookieOptions(), maxAge: 10 * 60 * 1000 });
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: 'identify',
    state,
  });
  const bridgeParams = new URLSearchParams({
    app: `discord://-/oauth2/authorize?${params}`,
    web: `https://discord.com/oauth2/authorize?${params}`,
  });
  res.redirect(`${config.frontendUrl}/discord-open?${bridgeParams}`);
});

router.get('/discord/callback', async (req, res) => {
  const config = getOAuthConfig();
  if (!config) {
    return res.redirect(loginUrl('discord_config_missing'));
  }

  const { code, error, state } = req.query;
  const FRONTEND = config.frontendUrl;
  res.clearCookie(STATE_COOKIE, stateCookieOptions());
  if (!verifyState(state, req.headers.cookie, STATE_COOKIE)) {
    return res.redirect(`${FRONTEND}/login?error=invalid_oauth_state`);
  }

  if (error || !code) {
    return res.redirect(`${FRONTEND}/login?error=discord_denied`);
  }

  try {
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
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
      const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: '7d' });
      return res.redirect(`${FRONTEND}/discord-callback?token=${token}`);
    }

    // Display names are not proof of ownership. Keep legacy accounts unchanged;
    // recovery must verify the previous identity before linking a Discord ID.
    // No legacy match: create a fresh account
    const result = db.prepare(
      'INSERT INTO users (discord_id, discord_username, avatar_url) VALUES (?, ?, ?)'
    ).run(discord.id, username, avatarUrl);
    const token = jwt.sign({ userId: result.lastInsertRowid }, config.jwtSecret, { expiresIn: '7d' });
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

router.post('/claim', (req, res) => {
  res.status(410).json({ error: 'Legacy recovery requires verified ownership. Contact an administrator.' });
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
