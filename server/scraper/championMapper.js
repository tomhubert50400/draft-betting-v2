/**
 * Champion Mapper
 * Converts champion IDs from the API to champion names used in Firestore
 */

const { DATA_DRAGON } = require('./config');

// Cache for champion data
let championCache = null;
let cacheTimestamp = null;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Load champion data from Data Dragon API
 * @returns {Promise<Object>} Map of championId -> championName
 */
async function loadChampionData() {
  // Return cached data if still valid
  if (championCache && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_TTL)) {
    return championCache;
  }

  try {
    // Get latest version
    const versionsRes = await fetch(DATA_DRAGON.VERSIONS_URL);
    if (!versionsRes.ok) {
      throw new Error(`Failed to fetch versions: ${versionsRes.status}`);
    }
    const versions = await versionsRes.json();
    const latestVersion = versions[0];

    // Get champion data
    const championsUrl = DATA_DRAGON.CHAMPIONS_URL(latestVersion);
    const champRes = await fetch(championsUrl);
    if (!champRes.ok) {
      throw new Error(`Failed to fetch champions: ${champRes.status}`);
    }
    const champData = await champRes.json();

    // Build the id -> name map
    championCache = {};
    Object.values(champData.data).forEach(champion => {
      // Map both the 'id' (e.g., "LeeSin") and 'key' (e.g., "64") to the name
      championCache[champion.id] = champion.name;
      championCache[champion.key] = champion.name;
      // Also map lowercase version
      championCache[champion.id.toLowerCase()] = champion.name;
    });

    cacheTimestamp = Date.now();
    console.log(`Champion data loaded: ${Object.keys(champData.data).length} champions`);

    return championCache;
  } catch (error) {
    console.error('Error loading champion data:', error);
    // Return existing cache if available, even if expired
    if (championCache) {
      console.log('Using stale champion cache');
      return championCache;
    }
    throw error;
  }
}

/**
 * Convert a champion ID to its display name
 * @param {string|number} championId - Champion ID from the API (e.g., "LeeSin", "64")
 * @returns {Promise<string>} Champion name (e.g., "Lee Sin")
 */
async function idToName(championId) {
  if (!championId) return null;

  const cache = await loadChampionData();
  const idStr = String(championId);

  // Try direct lookup
  if (cache[idStr]) {
    return cache[idStr];
  }

  // Try lowercase lookup
  if (cache[idStr.toLowerCase()]) {
    return cache[idStr.toLowerCase()];
  }

  // Fallback: return the ID as-is with a warning
  console.warn(`Unknown champion ID: ${championId}`);
  return idStr;
}

/**
 * Convert a draft object from API IDs to display names
 * @param {Object} apiDraft - Draft with champion IDs
 * @returns {Promise<Object>} Draft with champion names
 */
async function convertDraftToNames(apiDraft) {
  if (!apiDraft) return null;

  const convertedDraft = {
    team1: {},
    team2: {},
  };

  // Convert team1
  for (const [role, championId] of Object.entries(apiDraft.team1 || {})) {
    convertedDraft.team1[role] = await idToName(championId);
  }

  // Convert team2
  for (const [role, championId] of Object.entries(apiDraft.team2 || {})) {
    convertedDraft.team2[role] = await idToName(championId);
  }

  return convertedDraft;
}

/**
 * Invalidate the champion cache (useful for testing or forcing refresh)
 */
function invalidateCache() {
  championCache = null;
  cacheTimestamp = null;
}

/**
 * Get the current cache state (for debugging)
 * @returns {Object} Cache info
 */
function getCacheInfo() {
  return {
    hasCache: !!championCache,
    cacheSize: championCache ? Object.keys(championCache).length : 0,
    cacheAge: cacheTimestamp ? Date.now() - cacheTimestamp : null,
    isExpired: cacheTimestamp ? (Date.now() - cacheTimestamp > CACHE_TTL) : true,
  };
}

module.exports = {
  loadChampionData,
  idToName,
  convertDraftToNames,
  invalidateCache,
  getCacheInfo,
};
