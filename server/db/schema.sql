PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_id TEXT UNIQUE NOT NULL,
  discord_username TEXT,
  avatar_url TEXT,
  total_score REAL DEFAULT 0,
  is_admin INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'closed')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER REFERENCES events(id),
  lolesports_match_id TEXT,
  lolesports_event_id TEXT,
  team1 TEXT NOT NULL,
  team2 TEXT NOT NULL,
  best_of TEXT DEFAULT 'bo1' CHECK(best_of IN ('bo1', 'bo3', 'bo5')),
  game_number INTEGER DEFAULT 1,
  series_id TEXT,
  status TEXT DEFAULT 'open' CHECK(status IN ('open', 'locked', 'completed')),
  scheduled_time TEXT,
  lock_at TEXT,
  locked_at TEXT,
  completed_at TEXT,
  winner TEXT CHECK(winner IN ('team1', 'team2', NULL)),
  result_draft TEXT,
  result_rosters TEXT,
  rosters TEXT,
  auto_created INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  predictions TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'scored')),
  score REAL DEFAULT 0,
  correct_picks INTEGER DEFAULT 0,
  is_perfect INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  scored_at TEXT,
  UNIQUE(user_id, match_id)
);

CREATE TABLE IF NOT EXISTS badges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  badge_name TEXT NOT NULL,
  unlocked_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, badge_name)
);

CREATE TABLE IF NOT EXISTS team_rosters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_name TEXT UNIQUE NOT NULL,
  roster TEXT NOT NULL,
  last_updated TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO settings (key, value) VALUES ('lock_delay_minutes', '13');

CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_series ON matches(series_id);
CREATE INDEX IF NOT EXISTS idx_matches_scheduled ON matches(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_bets_user ON bets(user_id);
CREATE INDEX IF NOT EXISTS idx_bets_match ON bets(match_id);
CREATE INDEX IF NOT EXISTS idx_users_discord ON users(discord_id);
