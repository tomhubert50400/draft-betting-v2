const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calculateBetScore, checkBadges, ROLES } = require('../scraper/scoring');
const draft = Object.fromEntries(['team1', 'team2'].flatMap(team => ROLES.map(role => [`${team}_${role}`, { id: `${team}-${role}` }])));
test('perfect predictions receive the documented 12-point bonus', () => {
  assert.deepEqual(calculateBetScore(draft, draft), { score: 12, correctPicks: 10, isPerfectScore: true });
});
test('partial points distinguish same-role, same-team and cross-team predictions', () => {
  for (const [id, score] of [['team1-top', 1], ['team2-top', 0.5], ['team1-mid', 0.5], ['team2-mid', 0.25], ['unknown', 0]]) {
    assert.equal(calculateBetScore({ team1_top: { id } }, draft).score, score);
  }
});
test('empty predictions cannot gain points', () => {
  for (const predictions of [null, undefined, {}]) assert.deepEqual(calculateBetScore(predictions, draft), { score: 0, correctPicks: 0, isPerfectScore: false });
});
test('badges are awarded only at their documented thresholds', () => {
  assert.deepEqual(checkBadges({ totalBets: 0, totalScore: 0, hasPerfect: false }), []);
  assert.deepEqual(checkBadges({ totalBets: 1, totalScore: 0, hasPerfect: false }), ['first_bet']);
  assert.equal(checkBadges({ totalBets: 50, totalScore: 1000, hasPerfect: true }).length, 5);
});
