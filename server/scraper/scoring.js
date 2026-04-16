const ROLES = ['Top', 'Jungle', 'Mid', 'Bot', 'Support'];

function calculateBetScore(predictions, resultDraft) {
  let score = 0;
  let correctPicks = 0;
  const totalPicks = 10;

  const resultTeam1Values = Object.values(resultDraft.team1 || {}).filter(Boolean);
  const resultTeam2Values = Object.values(resultDraft.team2 || {}).filter(Boolean);

  for (const team of ['team1', 'team2']) {
    const otherTeam = team === 'team1' ? 'team2' : 'team1';
    const sameTeamValues = team === 'team1' ? resultTeam1Values : resultTeam2Values;
    const otherTeamValues = team === 'team1' ? resultTeam2Values : resultTeam1Values;

    for (const role of ROLES) {
      const predicted = predictions[team]?.[role];
      if (!predicted) continue;

      const actual = resultDraft[team]?.[role];
      if (predicted === actual) {
        score += 1;
        correctPicks++;
      } else if (sameTeamValues.includes(predicted)) {
        score += 0.5;
      } else if (resultDraft[otherTeam]?.[role] === predicted) {
        score += 0.5;
      } else if (otherTeamValues.includes(predicted)) {
        score += 0.25;
      }
    }
  }

  const isPerfectScore = correctPicks === totalPicks;
  if (isPerfectScore) score = 12;

  return { score, correctPicks, isPerfectScore };
}

const BADGE_THRESHOLDS = {
  first_bet: { check: (stats) => stats.totalBets >= 1 },
  perfect_score: { check: (stats) => stats.hasPerfect },
  dedicated_bettor: { check: (stats) => stats.totalBets >= 10 },
  veteran: { check: (stats) => stats.totalBets >= 50 },
  top_scorer: { check: (stats) => stats.totalScore >= 1000 },
};

function checkBadges(stats) {
  const earned = [];
  for (const [badge, { check }] of Object.entries(BADGE_THRESHOLDS)) {
    if (check(stats)) earned.push(badge);
  }
  return earned;
}

module.exports = { calculateBetScore, checkBadges, ROLES };
