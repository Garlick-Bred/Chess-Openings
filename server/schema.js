// Database schema for the openings site (local SQLite via node:sqlite, or
// Cloudflare D1). Kept as separate statements because D1 runs them as a batch.
//
// Accounts are shared with the endgame site (endgames.garlick.ca): the users
// table lives in *its* database, bound here as AUTH_DB. This site only reads
// users and writes the shared account fields (name, avatar, colour, chess
// rating, password). Everything about openings lives in this site's own
// database, keyed by the shared user id.
//
// When no separate account database is configured (local development, tests),
// USERS_TABLE is created in the same database, with the endgame site's columns.

export const USERS_TABLE = `CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name  TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  avatar        TEXT NOT NULL DEFAULT '♞',
  color         TEXT NOT NULL DEFAULT '#81b64c',
  settings      TEXT NOT NULL DEFAULT '{}',
  rating        INTEGER,
  rating_source TEXT,
  eg_rating     REAL,
  eg_games      INTEGER NOT NULL DEFAULT 0,
  shields       INTEGER NOT NULL DEFAULT 0,
  braid         REAL NOT NULL DEFAULT 0,
  golden_since  INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL
)`;

export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS profiles (
    user_id      INTEGER PRIMARY KEY,
    op_rating    REAL,
    op_games     INTEGER NOT NULL DEFAULT 0,
    shields      INTEGER NOT NULL DEFAULT 0,
    braid        REAL NOT NULL DEFAULT 0,
    golden_since INTEGER NOT NULL DEFAULT 0,
    settings     TEXT NOT NULL DEFAULT '{}',
    created_at   INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS login_failures (
    key   TEXT PRIMARY KEY,
    count INTEGER NOT NULL,
    until INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS attempts (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL,
    kind          TEXT NOT NULL,
    item_id       TEXT NOT NULL,
    chapter       TEXT,
    mode          TEXT,
    success       INTEGER NOT NULL,
    misses        INTEGER NOT NULL DEFAULT 0,
    alternatives  INTEGER NOT NULL DEFAULT 0,
    idea_hints    INTEGER NOT NULL DEFAULT 0,
    move_hints    INTEGER NOT NULL DEFAULT 0,
    timed         INTEGER NOT NULL DEFAULT 0,
    slow_moves    INTEGER NOT NULL DEFAULT 0,
    surprise      TEXT,
    surprise_found INTEGER,
    first_miss    TEXT,
    principle     TEXT,
    duration_ms   INTEGER NOT NULL,
    user_moves    INTEGER NOT NULL,
    points        INTEGER NOT NULL,
    clove_gain    REAL NOT NULL DEFAULT 0,
    lesson_replay INTEGER NOT NULL DEFAULT 0,
    puzzle_rating INTEGER,
    rating_before REAL,
    rating_after  REAL,
    golden        INTEGER NOT NULL DEFAULT 0,
    stars         INTEGER NOT NULL DEFAULT 0,
    breakdown     TEXT NOT NULL DEFAULT '[]',
    day           TEXT NOT NULL,
    created_at    INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS attempts_user_item ON attempts(user_id, item_id)`,
  `CREATE INDEX IF NOT EXISTS attempts_user_day ON attempts(user_id, day)`,
  `CREATE TABLE IF NOT EXISTS progress (
    user_id     INTEGER NOT NULL,
    item_id     TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'new',
    clean_days  INTEGER NOT NULL DEFAULT 0,
    last_day    TEXT,
    review_due  TEXT,
    review_step INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, item_id)
  )`,
  `CREATE TABLE IF NOT EXISTS deck_progress (
    user_id  INTEGER NOT NULL,
    item_id  TEXT NOT NULL,
    status   TEXT NOT NULL DEFAULT 'new',
    step     INTEGER NOT NULL DEFAULT 0,
    due      TEXT,
    last_day TEXT,
    PRIMARY KEY (user_id, item_id)
  )`,
  `CREATE TABLE IF NOT EXISTS days (
    user_id   INTEGER NOT NULL,
    day       TEXT NOT NULL,
    cloves    REAL NOT NULL DEFAULT 0,
    bulb_done INTEGER NOT NULL DEFAULT 0,
    bonus     INTEGER NOT NULL DEFAULT 0,
    protected INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, day)
  )`,
  `CREATE TABLE IF NOT EXISTS achievements (
    user_id        INTEGER NOT NULL,
    achievement_id TEXT NOT NULL,
    unlocked_at    INTEGER NOT NULL,
    PRIMARY KEY (user_id, achievement_id)
  )`,
  `CREATE TABLE IF NOT EXISTS explorer_cache (
    fen        TEXT PRIMARY KEY,
    data       TEXT NOT NULL,
    fetched_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS games_cache (
    username   TEXT PRIMARY KEY,
    data       TEXT NOT NULL,
    fetched_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
];

/** Bump when SCHEMA or ADDED_COLUMNS change, so existing databases migrate. */
export const SCHEMA_VERSION = 2;

/** Columns added after the first release: [table, column, type]. */
export const ADDED_COLUMNS = [
  // v2: stars per exercise (the Garlick Path rework)
  ['attempts', 'stars', 'INTEGER NOT NULL DEFAULT 0'],
];

/** One-off data changes, run once when a database moves past that version. */
export const DATA_MIGRATIONS = {};

/**
 * Create tables and add any missing columns. Costs a single query when the
 * database is already up to date (it runs on every cold start of a Worker).
 * `ownsUsers`: create the users table here too (no separate account database).
 */
export async function ensureSchema(store, { ownsUsers = false } = {}) {
  let from = 0;
  try {
    const row = await store.get("SELECT value FROM meta WHERE key = 'schema_version'");
    from = Number(row?.value ?? 0);
    if (from >= SCHEMA_VERSION) return;
  } catch {
    // meta table missing: new database
  }
  await store.batch([...(ownsUsers ? [[USERS_TABLE, []]] : []), ...SCHEMA.map((sql) => [sql, []])]);
  for (const [table, column, type] of ADDED_COLUMNS) {
    const cols = await store.all(`PRAGMA table_info(${table})`);
    if (!cols.some((c) => c.name === column)) await store.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
  for (const [version, statements] of Object.entries(DATA_MIGRATIONS)) {
    if (Number(version) > from) for (const sql of statements) await store.run(sql);
  }
  await store.run(
    "INSERT INTO meta (key, value) VALUES ('schema_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    String(SCHEMA_VERSION),
  );
}
