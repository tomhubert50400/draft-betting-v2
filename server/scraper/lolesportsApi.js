/**
 * LoL Esports API Client
 * Handles all communication with the lolesports API
 */

const { LOLESPORTS_API, FEED_API, LEAGUES } = require('./config');

// Feed API for live stats and draft data
const FEED_API_BASE = FEED_API.BASE_URL;

/**
 * Make a request to the lolesports API
 * @param {string} endpoint - API endpoint path
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} API response data
 */
async function apiRequest(endpoint, params = {}) {
  const url = new URL(`${LOLESPORTS_API.BASE_URL}/${endpoint}`);
  url.searchParams.set('hl', LOLESPORTS_API.LOCALE);

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url.toString(), {
    headers: {
      'x-api-key': LOLESPORTS_API.API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`LoL Esports API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.data;
}

/**
 * Get all available leagues
 * @returns {Promise<Array>} List of leagues
 */
async function getLeagues() {
  const data = await apiRequest('getLeagues');
  return data.leagues || [];
}

/**
 * Get schedule for a specific league
 * @param {string} leagueId - League ID
 * @returns {Promise<Object>} Schedule data
 */
async function getSchedule(leagueId) {
  const data = await apiRequest('getSchedule', { leagueId });
  return data.schedule || {};
}

/**
 * Get all live matches
 * @returns {Promise<Object>} Live data
 */
async function getLive() {
  const data = await apiRequest('getLive');
  return data;
}

/**
 * Get details for a specific event/match
 * @param {string} eventId - Event ID from lolesports
 * @returns {Promise<Object>} Event details
 */
async function getEventDetails(eventId) {
  const data = await apiRequest('getEventDetails', { id: eventId });
  return data.event || {};
}

/**
 * Get teams for a specific league/tournament
 * @param {string} leagueId - League ID (optional, will fetch from all tracked leagues if not provided)
 * @returns {Promise<Array>} List of teams with their players
 */
async function getTeams(leagueId = null) {
  try {
    const data = await apiRequest('getTeams', leagueId ? { leagueId } : {});
    return data.teams || [];
  } catch (error) {
    console.error('Error fetching teams:', error);
    return [];
  }
}

/**
 * Get standings for a tournament (includes team rosters)
 * @param {string} tournamentId - Tournament ID
 * @returns {Promise<Object>} Standings data with team info
 */
async function getStandings(tournamentId) {
  try {
    const data = await apiRequest('getStandings', { tournamentId });
    return data.standings || [];
  } catch (error) {
    console.error('Error fetching standings:', error);
    return [];
  }
}

/**
 * Extract roster from team data
 * @param {Object} team - Team data from API
 * @returns {Object} Roster object { Top: 'Name', Jungle: 'Name', ... }
 */
function extractRosterFromTeam(team) {
  if (!team || !team.players) {
    return {};
  }

  const roster = {};
  team.players.forEach(player => {
    const role = player.role?.toLowerCase();
    const normalizedRole = normalizeRole(role);
    // Only assign if role is valid and not already assigned (take first player per role)
    if (normalizedRole && player.summonerName && !roster[normalizedRole]) {
      roster[normalizedRole] = player.summonerName;
    }
  });

  return roster;
}

/**
 * Check if team name matches search term - returns match priority (0 = no match, higher = better)
 * @param {Object} team - Team object from API
 * @param {string} searchTerm - Search term (normalized to lowercase)
 * @returns {number} Match priority (0 = no match)
 */
function teamMatchPriority(team, searchTerm) {
  const name = (team.name || '').toLowerCase();
  const code = (team.code || '').toLowerCase();
  const slug = (team.slug || '').toLowerCase();

  // Exact code match (highest priority)
  if (code === searchTerm) return 100;

  // Special handling for KC (KCB excluded)
  if (searchTerm === 'kc' && name.includes('karmine') && !name.includes('blue') && !name.includes('stars')) return 90;

  // Team name mappings (old name -> new name in API)
  // MAD Lions was renamed to Movistar KOI
  if (searchTerm === 'mad' && code === 'mkoi') return 95;
  if (searchTerm === 'koi' && code === 'mkoi') return 95;

  // BDS was renamed to Shifters
  if (searchTerm === 'bds' && code === 'shft') return 95;
  if (searchTerm === 'shifters' && code === 'shft') return 95;

  // Los Ratones
  if (searchTerm === 'lr' && code === 'lr') return 100;
  if (searchTerm === 'los ratones' && code === 'lr') return 95;
  if (searchTerm === 'ratones' && code === 'lr') return 95;

  // Exact name match
  if (name === searchTerm) return 80;

  // Exact slug match
  if (slug === searchTerm) return 70;

  return 0;
}

/**
 * Find best matching team from list
 * @param {Array} teams - List of teams
 * @param {string} searchTerm - Search term (normalized to lowercase)
 * @param {boolean} requireFullRoster - If true, only match teams with 5+ players
 * @returns {Object|null} Best matching team or null
 */
function findBestMatchingTeam(teams, searchTerm, requireFullRoster = false) {
  let bestMatch = null;
  let bestPriority = 0;

  for (const team of teams) {
    // Skip teams without full roster if required
    if (requireFullRoster) {
      const roster = extractRosterFromTeam(team);
      if (Object.keys(roster).length < 5) {
        continue;
      }
    }

    const priority = teamMatchPriority(team, searchTerm);
    if (priority > bestPriority) {
      bestPriority = priority;
      bestMatch = team;
    }
  }

  return bestMatch;
}

/**
 * Check if team matches search term (simple boolean check)
 * @param {Object} team - Team object from API
 * @param {string} searchTerm - Search term (normalized to lowercase)
 * @returns {boolean}
 */
function teamMatchesSearch(team, searchTerm) {
  return teamMatchPriority(team, searchTerm) > 0;
}

/**
 * Get roster for a specific team by name from the API
 * Tries multiple endpoints: getTeams, getStandings, getSchedule
 * @param {string} teamName - Team name to search for
 * @param {string} leagueId - Optional league ID to narrow search
 * @returns {Promise<Object>} Roster object or empty object if not found
 */
async function getTeamRosterFromApi(teamName, leagueId = null) {
  const normalizedSearch = teamName.toLowerCase();

  // 1. Try getTeams endpoint
  try {
    console.log(`Trying getTeams for ${teamName}...`);
    const teams = await getTeams(leagueId);

    if (teams && teams.length > 0) {
      // requireFullRoster = true to skip teams without 5 players
      const team = findBestMatchingTeam(teams, normalizedSearch, true);

      if (team) {
        const roster = extractRosterFromTeam(team);
        if (Object.keys(roster).length >= 5) {
          console.log(`Found roster via getTeams for ${teamName}:`, roster);
          return roster;
        }
      }
    }
  } catch (error) {
    console.log(`getTeams failed for ${teamName}:`, error.message);
  }

  // 2. Try getStandings for tracked leagues
  try {
    console.log(`Trying getStandings for ${teamName}...`);
    const leaguesToCheck = leagueId ? [leagueId] : Object.values(LEAGUES);

    for (const lgId of leaguesToCheck) {
      try {
        const standings = await getStandings(lgId);

        if (standings && Array.isArray(standings)) {
          for (const standing of standings) {
            if (standing.teams) {
              const team = standing.teams.find(t => teamMatchesSearch(t, normalizedSearch));
              if (team) {
                const roster = extractRosterFromTeam(team);
                if (Object.keys(roster).length >= 5) {
                  console.log(`Found roster via getStandings for ${teamName}:`, roster);
                  return roster;
                }
              }
            }
          }
        }
      } catch (e) {
        // Continue to next league
      }
    }
  } catch (error) {
    console.log(`getStandings failed for ${teamName}:`, error.message);
  }

  // 3. Try to extract from recent schedule events
  try {
    console.log(`Trying schedule events for ${teamName}...`);
    const leaguesToCheck = leagueId ? [leagueId] : Object.values(LEAGUES);

    for (const lgId of leaguesToCheck) {
      try {
        const schedule = await getSchedule(lgId);

        if (schedule && schedule.events) {
          // Look for completed events with this team to get their roster
          const teamEvents = schedule.events.filter(event => {
            if (!event.match || !event.match.teams) return false;
            return event.match.teams.some(t => teamMatchesSearch(t, normalizedSearch));
          });

          // Check completed events first (they have actual roster data)
          const completedEvents = teamEvents.filter(e => e.state === 'completed');

          for (const event of completedEvents) {
            try {
              const details = await getEventDetails(event.id);
              if (details && details.match && details.match.games) {
                // Get roster from the most recent game
                const game = details.match.games[details.match.games.length - 1];
                if (game && game.teams) {
                  const teamData = game.teams.find(t => teamMatchesSearch(t, normalizedSearch));
                  if (teamData && teamData.players) {
                    const roster = {};
                    teamData.players.forEach(player => {
                      const role = player.role?.toLowerCase();
                      const normalizedRole = normalizeRole(role);
                      if (normalizedRole && player.summonerName) {
                        roster[normalizedRole] = player.summonerName;
                      }
                    });
                    if (Object.keys(roster).length >= 5) {
                      console.log(`Found roster via event details for ${teamName}:`, roster);
                      return roster;
                    }
                  }
                }
              }
            } catch (e) {
              // Continue to next event
            }
          }
        }
      } catch (e) {
        // Continue to next league
      }
    }
  } catch (error) {
    console.log(`Schedule search failed for ${teamName}:`, error.message);
  }

  console.log(`No roster found via API for ${teamName}`);
  return {};
}

/**
 * Get schedule for all tracked leagues (LEC, LFL)
 * @returns {Promise<Array>} Combined schedule from all leagues
 */
async function getAllTrackedSchedules() {
  const schedules = [];

  for (const [leagueName, leagueId] of Object.entries(LEAGUES)) {
    try {
      const schedule = await getSchedule(leagueId);
      if (schedule.events) {
        schedules.push(...schedule.events.map(event => ({
          ...event,
          leagueName,
          leagueId,
        })));
      }
    } catch (error) {
      console.error(`Error fetching schedule for ${leagueName}:`, error);
    }
  }

  return schedules;
}

/**
 * Check if a team name matches Karmine Corp (excludes KC Blue/KCB)
 * @param {string} teamName - Team name from API
 * @returns {boolean}
 */
function isKarmineCorpMatch(teamName) {
  const normalizedName = teamName.toLowerCase();
  // Exclude KCB / Karmine Corp Blue
  if (normalizedName === 'kcb' || normalizedName.includes('karmine corp blue') || normalizedName.includes('blue')) {
    return false;
  }
  return normalizedName.includes('karmine') ||
         normalizedName.includes('kcorp') ||
         normalizedName === 'kc';
}

/**
 * Filter events to only include Karmine Corp matches
 * @param {Array} events - List of events
 * @returns {Array} Filtered events with KC
 */
function filterKCMatches(events) {
  return events.filter(event => {
    if (!event.match || !event.match.teams) return false;

    const teams = event.match.teams;
    return teams.some(team => isKarmineCorpMatch(team.name));
  });
}

/**
 * Get upcoming KC matches from all tracked leagues
 * @returns {Promise<Array>} Upcoming KC matches
 */
async function getUpcomingKCMatches() {
  const allEvents = await getAllTrackedSchedules();

  // Filter for KC matches that haven't been completed
  const kcMatches = filterKCMatches(allEvents).filter(event => {
    return event.state !== 'completed';
  });

  return kcMatches;
}

/**
 * Find a match in live data by its event ID
 * @param {Object} liveData - Live data from getLive()
 * @param {string} eventId - Event ID to find
 * @returns {Object|null} Match data or null if not found
 */
function findMatchInLive(liveData, eventId) {
  if (!liveData || !liveData.schedule || !liveData.schedule.events) {
    return null;
  }

  return liveData.schedule.events.find(event => event.id === eventId) || null;
}

/**
 * Get the current game state from a live match
 * @param {Object} matchData - Match data from live feed
 * @param {number} gameNumber - Game number (1, 2, 3, etc.)
 * @returns {Object|null} Current game state
 */
function getCurrentGame(matchData, gameNumber) {
  if (!matchData || !matchData.match || !matchData.match.games) {
    return null;
  }

  const games = matchData.match.games;
  // Games are indexed from 0, gameNumber starts from 1
  const game = games.find(g => g.number === gameNumber);

  return game || null;
}

/**
 * Check if a series is completed
 * @param {Object} matchData - Match data
 * @returns {boolean}
 */
function isSeriesOver(matchData) {
  if (!matchData || !matchData.match) return false;

  const match = matchData.match;

  // Check if match state is completed
  if (match.state === 'completed') return true;

  // Check team scores for Bo3/Bo5
  if (match.teams && match.teams.length === 2) {
    const [team1, team2] = match.teams;
    const team1Wins = team1.result?.gameWins || 0;
    const team2Wins = team2.result?.gameWins || 0;

    // Determine win condition based on match type
    const strategy = match.strategy || {};
    const count = strategy.count || 1;
    const winsNeeded = Math.ceil(count / 2);

    if (team1Wins >= winsNeeded || team2Wins >= winsNeeded) {
      return true;
    }
  }

  return false;
}

/**
 * Get game window data from the feed API (contains draft info)
 * @param {string} gameId - Game ID (from event.match.games[].id)
 * @returns {Promise<Object>} Game window data with draft info
 */
async function getGameWindow(gameId) {
  const url = `${FEED_API_BASE}/window/${gameId}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Feed API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Extract draft picks from game window data
 * @param {Object} windowData - Data from getGameWindow
 * @param {string} firestoreTeam1 - Team1 name from Firestore match (optional, for correct mapping)
 * @param {string} firestoreTeam2 - Team2 name from Firestore match (optional, for correct mapping)
 * @returns {Object} Draft picks and rosters organized by team
 */
function extractDraftFromWindow(windowData, firestoreTeam1 = null, firestoreTeam2 = null) {
  if (!windowData || !windowData.gameMetadata) {
    return null;
  }

  const metadata = windowData.gameMetadata;

  // Extract data for blue and red teams
  const blueData = { draft: {}, roster: {} };
  const redData = { draft: {}, roster: {} };

  // Get team names from metadata (esportsTeamId contains team code)
  const blueTeamName = metadata.blueTeamMetadata?.esportsTeamId || '';
  const redTeamName = metadata.redTeamMetadata?.esportsTeamId || '';

  // Blue team data
  if (metadata.blueTeamMetadata?.participantMetadata) {
    metadata.blueTeamMetadata.participantMetadata.forEach(player => {
      const role = player.role?.toLowerCase();
      const championId = player.championId;
      const summonerName = player.summonerName;

      if (role && championId) {
        const normalizedRole = normalizeRole(role);
        if (normalizedRole) {
          blueData.draft[normalizedRole] = championId;
          if (summonerName) {
            blueData.roster[normalizedRole] = summonerName;
          }
        }
      }
    });
  }

  // Red team data
  if (metadata.redTeamMetadata?.participantMetadata) {
    metadata.redTeamMetadata.participantMetadata.forEach(player => {
      const role = player.role?.toLowerCase();
      const championId = player.championId;
      const summonerName = player.summonerName;

      if (role && championId) {
        const normalizedRole = normalizeRole(role);
        if (normalizedRole) {
          redData.draft[normalizedRole] = championId;
          if (summonerName) {
            redData.roster[normalizedRole] = summonerName;
          }
        }
      }
    });
  }

  // Determine which API team (blue/red) matches which Firestore team (team1/team2)
  // by checking player names or team identifiers
  let team1IsBlue = true; // Default: blue = team1

  if (firestoreTeam1 && firestoreTeam2) {
    // Try to match by team name in player summoner names
    const bluePlayerNames = Object.values(blueData.roster).join(' ').toLowerCase();
    const redPlayerNames = Object.values(redData.roster).join(' ').toLowerCase();

    const team1Lower = firestoreTeam1.toLowerCase();
    const team2Lower = firestoreTeam2.toLowerCase();

    // Check if blue team players have team1 tag or red team players have team1 tag
    const blueMatchesTeam1 = bluePlayerNames.includes(team1Lower) ||
                             blueTeamName.toLowerCase().includes(team1Lower) ||
                             matchTeamCode(blueTeamName, team1Lower);
    const redMatchesTeam1 = redPlayerNames.includes(team1Lower) ||
                            redTeamName.toLowerCase().includes(team1Lower) ||
                            matchTeamCode(redTeamName, team1Lower);

    if (redMatchesTeam1 && !blueMatchesTeam1) {
      team1IsBlue = false;
      console.log(`Team mapping: ${firestoreTeam1} is RED side, ${firestoreTeam2} is BLUE side`);
    } else if (blueMatchesTeam1) {
      team1IsBlue = true;
      console.log(`Team mapping: ${firestoreTeam1} is BLUE side, ${firestoreTeam2} is RED side`);
    } else {
      // Fallback: check team2
      const blueMatchesTeam2 = bluePlayerNames.includes(team2Lower) ||
                               blueTeamName.toLowerCase().includes(team2Lower) ||
                               matchTeamCode(blueTeamName, team2Lower);
      if (blueMatchesTeam2) {
        team1IsBlue = false;
        console.log(`Team mapping (via team2): ${firestoreTeam1} is RED side, ${firestoreTeam2} is BLUE side`);
      }
    }
  }

  // Assign based on mapping
  const draft = {
    team1: team1IsBlue ? blueData.draft : redData.draft,
    team2: team1IsBlue ? redData.draft : blueData.draft,
  };
  const rosters = {
    team1: team1IsBlue ? blueData.roster : redData.roster,
    team2: team1IsBlue ? redData.roster : blueData.roster,
  };

  return { draft, rosters, blueTeamName, redTeamName, team1IsBlue };
}

/**
 * Check if API team code matches a team name
 * @param {string} apiTeamCode - Team code from API (e.g., "109998264302708658")
 * @param {string} teamName - Team name to match (e.g., "kc", "shifters")
 * @returns {boolean}
 */
function matchTeamCode(apiTeamCode, teamName) {
  // Common team codes mapping
  const teamCodes = {
    'kc': ['karmine', 'kcorp'],
    'kcb': ['karmine', 'blue'],
    'shifters': ['shft', 'shift', 'bds'],
    'fnatic': ['fnc', 'fnatic'],
    'g2': ['g2'],
    'vitality': ['vit'],
  };

  const normalizedName = teamName.toLowerCase();

  // Check if any known codes match
  for (const [key, patterns] of Object.entries(teamCodes)) {
    if (normalizedName.includes(key) || key.includes(normalizedName)) {
      if (patterns.some(p => apiTeamCode.toLowerCase().includes(p))) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Extract draft picks from game data (legacy, uses getEventDetails)
 * @param {Object} gameData - Game data from the API
 * @returns {Object} Draft picks and rosters organized by team
 */
function extractDraftFromGame(gameData) {
  if (!gameData || !gameData.teams) {
    return null;
  }

  const draft = {
    team1: {},
    team2: {},
  };
  const rosters = {
    team1: {},
    team2: {},
  };

  gameData.teams.forEach((team, index) => {
    const teamKey = index === 0 ? 'team1' : 'team2';

    if (team.players) {
      team.players.forEach(player => {
        const role = player.role?.toLowerCase();
        const championId = player.championId;
        const summonerName = player.summonerName;

        if (role && championId) {
          // Map the role to our format
          const normalizedRole = normalizeRole(role);
          if (normalizedRole) {
            draft[teamKey][normalizedRole] = championId;
            if (summonerName) {
              rosters[teamKey][normalizedRole] = summonerName;
            }
          }
        }
      });
    }
  });

  return { draft, rosters };
}

/**
 * Normalize role name from API to our format
 * @param {string} role - Role from API
 * @returns {string|null} Normalized role name
 */
function normalizeRole(role) {
  const roleMap = {
    'top': 'Top',
    'jungle': 'Jungle',
    'mid': 'Mid',
    'middle': 'Mid',
    'bottom': 'Bot',
    'adc': 'Bot',
    'support': 'Support',
    'utility': 'Support',
  };

  return roleMap[role.toLowerCase()] || null;
}

module.exports = {
  apiRequest,
  getLeagues,
  getSchedule,
  getLive,
  getEventDetails,
  getGameWindow,
  getTeams,
  getStandings,
  getAllTrackedSchedules,
  getUpcomingKCMatches,
  filterKCMatches,
  isKarmineCorpMatch,
  findMatchInLive,
  getCurrentGame,
  isSeriesOver,
  extractDraftFromGame,
  extractDraftFromWindow,
  extractRosterFromTeam,
  getTeamRosterFromApi,
  normalizeRole,
};
