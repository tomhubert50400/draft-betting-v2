const ROLES = ['top', 'jungle', 'mid', 'bot', 'support'];

/**
 * Predictions and resultDraft are flat: { team1_top: {id, name}, ... }
 * Scoring rules:
 *  - exact match (right team, right role): 1 point
 *  - same team but wrong role (champ played by ally team in another role): 0.5
 *  - right role on the OTHER team: 0.5
 *  - other team but wrong role: 0.25
 *  - perfect score (10/10 exact): bonus → score = 12
 */
function calculateBetScore(predictions, resultDraft) {
  if (!predictions || !resultDraft) {
    return { score: 0, correctPicks: 0, isPerfectScore: false };
  }

  const championIdAt = (draft, team, role) => draft[`${team}_${role}`]?.id;

  // Pre-compute champion ids per team for fuzzy matches
  const teamChamps = (draft, team) =>
    new Set(ROLES.map((r) => championIdAt(draft, team, r)).filter(Boolean));
  const result = {
    team1: teamChamps(resultDraft, 'team1'),
    team2: teamChamps(resultDraft, 'team2'),
  };

  let score = 0;
  let correctPicks = 0;

  for (const team of ['team1', 'team2']) {
    const otherTeam = team === 'team1' ? 'team2' : 'team1';
    for (const role of ROLES) {
      const predicted = championIdAt(predictions, team, role);
      if (!predicted) continue;
      const actual = championIdAt(resultDraft, team, role);

      if (predicted === actual) {
        score += 1;
        correctPicks++;
      } else if (championIdAt(resultDraft, otherTeam, role) === predicted) {
        score += 0.5; // right role, wrong team
      } else if (result[team].has(predicted)) {
        score += 0.5; // same team, wrong role
      } else if (result[otherTeam].has(predicted)) {
        score += 0.25; // other team, wrong role
      }
    }
  }

  const isPerfectScore = correctPicks === 10;
  if (isPerfectScore) score = 12;

  return { score, correctPicks, isPerfectScore };
}

const BADGE_THRESHOLDS = {
  first_bet: { check: (s) => s.totalBets >= 1 },
  perfect_score: { check: (s) => s.hasPerfect },
  dedicated_bettor: { check: (s) => s.totalBets >= 10 },
  veteran: { check: (s) => s.totalBets >= 50 },
  top_scorer: { check: (s) => s.totalScore >= 1000 },
};

function checkBadges(stats) {
  const earned = [];
  for (const [badge, { check }] of Object.entries(BADGE_THRESHOLDS)) {
    if (check(stats)) earned.push(badge);
  }
  return earned;
}

module.exports = { calculateBetScore, checkBadges, ROLES };
