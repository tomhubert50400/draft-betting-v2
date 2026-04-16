/**
 * Configuration for the LoL Esports scraper
 * Contains league IDs and other constants
 */

// League IDs from lolesports API
// These are the leagues where Karmine Corp competes
const LEAGUES = {
  LEC: '98767991302996019',           // LEC (League of Legends European Championship)
};

// Team names that should be tracked
const TRACKED_TEAMS = [
  'Karmine Corp',
  'KCorp',
  'KC',
];

// Team name normalization (API name -> Display name)
const TEAM_NAME_MAP = {
  'Karmine Corp': 'KC',
  'KCorp': 'KC',
};

// API configuration
// Set MOCK_API_URL env var to use mock server (e.g. http://localhost:3456)
const MOCK_API_URL = process.env.MOCK_API_URL || null;

const LOLESPORTS_API = {
  BASE_URL: MOCK_API_URL ? `${MOCK_API_URL}/persisted/gw` : 'https://esports-api.lolesports.com/persisted/gw',
  API_KEY: '0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z',
  LOCALE: 'en-US',
};

const FEED_API = {
  BASE_URL: MOCK_API_URL ? `${MOCK_API_URL}/livestats/v1` : 'https://feed.lolesports.com/livestats/v1',
};

const DATA_DRAGON = {
  VERSIONS_URL: 'https://ddragon.leagueoflegends.com/api/versions.json',
  CHAMPIONS_URL: (version) =>
    `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`,
};

// Polling configuration
const POLLING = {
  CHECK_INTERVAL: 10 * 1000,           // 10 seconds
  UPCOMING_WINDOW: 30 * 60 * 1000,     // 30 minutes before match
  MAX_POLL_DURATION: 3 * 60 * 60 * 1000, // 3 hours max
};

// Role mapping from API to our format
const ROLE_MAP = {
  'top': 'Top',
  'jungle': 'Jungle',
  'mid': 'Mid',
  'bottom': 'Bot',
  'support': 'Support',
  'adc': 'Bot',
};

module.exports = {
  LEAGUES,
  TRACKED_TEAMS,
  TEAM_NAME_MAP,
  LOLESPORTS_API,
  FEED_API,
  DATA_DRAGON,
  POLLING,
  ROLE_MAP,
};
