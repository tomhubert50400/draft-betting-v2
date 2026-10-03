const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createState, verifyState } = require('../utils/oauthState');
test('OAuth state is random and bound to the initiating browser cookie', () => {
  const state = createState();
  assert.match(state, /^[a-f0-9]{64}$/);
  assert.notEqual(state, createState());
  assert.equal(verifyState(state, `other=x; discord_oauth_state=${state}`, 'discord_oauth_state'), true);
  for (const input of [undefined, '', 'undefined', 'a'.repeat(63), ['a'.repeat(64)], createState()]) {
    assert.equal(verifyState(input, `discord_oauth_state=${state}`, 'discord_oauth_state'), false);
  }
  assert.equal(verifyState(state, '', 'discord_oauth_state'), false);
  assert.equal(verifyState(state, 'discord_oauth_state=%', 'discord_oauth_state'), false);
});
