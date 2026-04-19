/**
 * Team Rosters Database
 * Maintains current rosters for tracked teams
 */

// Default rosters for teams - LEC 2026 (fallback only, auto-updated from real matches)
// NOTE: These are fallback defaults. The system will automatically fetch current rosters from the API
// and update them in Firestore after each match.
// Last updated: February 2026
const TEAM_ROSTERS = {
  'KC': {
    Top: 'Canna',
    Jungle: 'Yike',
    Mid: 'kyeahoo',
    Bot: 'Caliste',
    Support: 'Busio',
  },
  'G2': {
    Top: 'BrokenBlade',
    Jungle: 'SkewMond',
    Mid: 'Caps',
    Bot: 'Hans Sama',
    Support: 'Labrov',
  },
  'FNC': {
    Top: 'Empyros',
    Jungle: 'Razork',
    Mid: 'Vladi',
    Bot: 'Upset',
    Support: 'Lospa',
  },
  'KOI': {
    Top: 'Myrwn',
    Jungle: 'Elyoya',
    Mid: 'Jojopyun',
    Bot: 'Supa',
    Support: 'Alvaro',
  },
  'VIT': {
    Top: 'Naak Nako',
    Jungle: 'Lyncas',
    Mid: 'Humanoid',
    Bot: 'Carzzy',
    Support: 'Fleshy',
  },
  'SHFT': {
    Top: 'Rooster',
    Jungle: 'Boukada',
    Mid: 'nuc',
    Bot: 'Paduck',
    Support: 'Trymbi',
  },
  'SK': {
    Top: 'Wunder',
    Jungle: 'Skeanz',
    Mid: 'LIDER',
    Bot: 'Jopa',
    Support: 'Mikyx',
  },
  'GX': {
    Top: 'Lot',
    Jungle: 'ISMA',
    Mid: 'Jackies',
    Bot: 'Noah',
    Support: 'Jun',
  },
  'TH': {
    Top: 'Tracyn',
    Jungle: 'Sheo',
    Mid: 'Serin',
    Bot: 'Ice',
    Support: 'Stend',
  },
  'NAVI': {
    Top: 'Maynter',
    Jungle: 'Rhilech',
    Mid: 'Poby',
    Bot: 'SamD',
    Support: 'Parus',
  },
  'LR': {
    Top: 'Baus',
    Jungle: 'Velja',
    Mid: 'Nemesis',
    Bot: 'Crownie',
    Support: 'Rekkles',
  },
};

/**
 * Get roster for a team
 * @param {string} teamName - Team name (e.g., "KC", "G2")
 * @returns {Object|null} Roster object or null if not found
 */
function getTeamRoster(teamName) {
  // Try exact match first
  if (TEAM_ROSTERS[teamName]) {
    return { ...TEAM_ROSTERS[teamName] };
  }

  // Try case-insensitive match
  const normalizedName = teamName.toUpperCase();
  for (const [key, value] of Object.entries(TEAM_ROSTERS)) {
    if (key.toUpperCase() === normalizedName) {
      return { ...value };
    }
  }

  return null;
}

/**
 * Get rosters for both teams in a match
 * @param {string} team1Name - First team name
 * @param {string} team2Name - Second team name
 * @returns {Object} Object with team1 and team2 rosters
 */
function getMatchRosters(team1Name, team2Name) {
  return {
    team1: getTeamRoster(team1Name) || {},
    team2: getTeamRoster(team2Name) || {},
  };
}

/**
 * Check if a team has a known roster
 * @param {string} teamName - Team name
 * @returns {boolean}
 */
function hasRoster(teamName) {
  return getTeamRoster(teamName) !== null;
}

module.exports = {
  TEAM_ROSTERS,
  getTeamRoster,
  getMatchRosters,
  hasRoster,
};
