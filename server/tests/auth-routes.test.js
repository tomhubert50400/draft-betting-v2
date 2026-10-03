const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const dbPath = require.resolve('../db');
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: {
  getDb() { return { prepare(sql) {
    assert.equal(sql.includes("LIKE 'fb_%'"), false, 'must not claim by display name');
    return { get() { return undefined; }, run() { return { lastInsertRowid: 42 }; } };
  } }; },
} };
const app = express();
app.use('/auth', require('../routes/auth'));
test('OAuth callback checks browser state; nickname match cannot claim an account', async () => {
  const saved = Object.fromEntries(['DISCORD_CLIENT_ID','DISCORD_CLIENT_SECRET','DISCORD_REDIRECT_URI','FRONTEND_URL','JWT_SECRET'].map(key => [key, process.env[key]]));
  Object.assign(process.env, { DISCORD_CLIENT_ID: 'test-client', DISCORD_CLIENT_SECRET: 'test-secret', DISCORD_REDIRECT_URI: 'http://localhost/auth/discord/callback', FRONTEND_URL: 'https://frontend.example', JWT_SECRET: 'test-signing-secret' });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const originalFetch = global.fetch;
  let exchanges = 0;
  global.fetch = async (url, options) => {
    if (String(url).startsWith(origin)) return originalFetch(url, options);
    exchanges++;
    if (String(url).endsWith('/oauth2/token')) return Response.json({ access_token: 'test-discord-token' });
    return Response.json({ id: '12345', username: 'legacy-admin-display-name', global_name: 'legacy-admin-display-name' });
  };
  try {
    const invalid = await fetch(`${origin}/auth/discord/callback?code=test`, { redirect: 'manual' });
    assert.match(invalid.headers.get('location'), /invalid_oauth_state/);
    assert.equal(exchanges, 0);
    const login = await fetch(`${origin}/auth/discord`, { redirect: 'manual' });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    assert.match(login.headers.get('set-cookie'), /HttpOnly/);
    assert.match(login.headers.get('set-cookie'), /SameSite=Lax/);
    const web = new URL(login.headers.get('location')).searchParams.get('web');
    const state = new URL(web).searchParams.get('state');
    assert.match(state, /^[a-f0-9]{64}$/);
    const response = await fetch(`${origin}/auth/discord/callback?code=test&state=${state}`, { redirect: 'manual', headers: { cookie } });
    assert.match(response.headers.get('location'), /discord-callback\?token=/);
    const token = new URL(response.headers.get('location')).searchParams.get('token');
    assert.equal(jwt.verify(token, process.env.JWT_SECRET).userId, 42);
    assert.equal(exchanges, 2);
    const claim = await fetch(`${origin}/auth/claim`, { method: 'POST' });
    assert.equal(claim.status, 410);
  } finally {
    global.fetch = originalFetch;
    await new Promise(resolve => server.close(resolve));
    for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
