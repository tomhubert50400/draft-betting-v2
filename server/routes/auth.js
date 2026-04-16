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

    let user = db.prepare('SELECT * FROM users WHERE discord_id = ?').get(discord.id);
    const avatarUrl = discord.avatar
      ? `https://cdn.discordapp.com/avatars/${discord.id}/${discord.avatar}.png`
      : null;

    if (!user) {
      const result = db.prepare(
        'INSERT INTO users (discord_id, discord_username, avatar_url) VALUES (?, ?, ?)'
      ).run(discord.id, discord.global_name || discord.username, avatarUrl);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    } else {
      db.prepare(
        'UPDATE users SET discord_username = ?, avatar_url = ? WHERE id = ?'
      ).run(discord.global_name || discord.username, avatarUrl, user.id);
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.redirect(`${FRONTEND}/discord-callback?token=${token}`);
  } catch (err) {
    console.error('Discord auth error:', err);
    res.redirect(`${FRONTEND}/login?error=auth_failed`);
  }
});

module.exports = router;
