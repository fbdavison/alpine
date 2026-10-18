// Shared Postgres access layer.
// Mirrors the sql.js result shape ({ columns, values }) the app was built
// around, so route handlers mostly just needed `await` added, not a rewrite.

const { Pool, types } = require('pg');

// COUNT(*) and SUM(int_column) come back as the bigint OID (20), which pg
// returns as a string by default. Our totals never exceed safe-integer
// range, so parse them to numbers to match the app's numeric comparisons.
types.setTypeParser(20, (val) => parseInt(val, 10));

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set. See .env.example.');
}

// Default to SSL (without strict verification, since hosted Postgres often
// terminates TLS with a self-signed/internal CA cert) unless the connection
// string targets localhost or explicitly disables SSL.
const isLocalDb = /^postgres(ql)?:\/\/[^/]*@?(localhost|127\.0\.0\.1)/i.test(process.env.DATABASE_URL);
const sslDisabled = /sslmode=disable/i.test(process.env.DATABASE_URL) || process.env.PGSSLMODE === 'disable';
const useSsl = !isLocalDb && !sslDisabled;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
  console.error('Unexpected Postgres pool error:', err);
});

// Converts `?` placeholders (as used throughout this codebase) to $1, $2, ...
function toPgQuery(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

// SELECT helper. Returns [] when there are no rows, otherwise
// [{ columns: string[], values: any[][] }] to match sql.js's db.exec().
async function exec(sql, params = []) {
  const result = await pool.query(toPgQuery(sql), params);
  if (!result.rows || result.rows.length === 0) {
    return [];
  }
  const columns = result.fields.map((f) => f.name);
  const values = result.rows.map((row) => columns.map((col) => row[col]));
  return [{ columns, values }];
}

// INSERT/UPDATE/DELETE helper. Returns the raw pg result (rowCount, etc).
async function run(sql, params = []) {
  return pool.query(toPgQuery(sql), params);
}

// Creates tables if they don't exist yet, and seeds the default sessions
// the first time the sessions table is empty.
async function ensureSchema() {
  await run(`CREATE TABLE IF NOT EXISTS general_registrations (
    id SERIAL PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    street_address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    zip TEXT NOT NULL,
    num_adults INTEGER NOT NULL,
    num_children INTEGER NOT NULL,
    children_details TEXT,
    comments TEXT,
    request_church_info INTEGER DEFAULT 0,
    session TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS member_registrations (
    id SERIAL PRIMARY KEY,
    member_first_name TEXT NOT NULL,
    member_last_name TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    street_address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    zip TEXT NOT NULL,
    num_adults INTEGER NOT NULL,
    num_children INTEGER NOT NULL,
    children_details TEXT,
    comments TEXT,
    request_church_info INTEGER DEFAULT 0,
    session TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,
    child_limit INTEGER NOT NULL DEFAULT 450,
    is_active INTEGER DEFAULT 1,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  const sessionCheck = await exec('SELECT COUNT(*) as count FROM sessions');
  const sessionCount = sessionCheck[0]?.values[0]?.[0] || 0;

  if (sessionCount === 0) {
    console.log('Initializing default sessions...');

    await run(`INSERT INTO sessions (name, type, child_limit, display_order) VALUES (?, ?, ?, ?)`,
      ['Wednesday December 10, 2025 6:00-8:30p (Friends & Family)', 'member', 450, 1]);

    const generalSessions = [
      'Thursday December 11, 2025 6:00-8:30p',
      'Friday December 12, 2025 6:00-8:30p',
      'Saturday December 13, 2025 2:00-4:30p',
      'Saturday December 13, 2025 6:00-8:30p',
      'Sunday December 14, 2025 2:00-4:30p',
      'Sunday December 14, 2025 6:00-8:30p'
    ];

    for (let idx = 0; idx < generalSessions.length; idx++) {
      await run(`INSERT INTO sessions (name, type, child_limit, display_order) VALUES (?, ?, ?, ?)`,
        [generalSessions[idx], 'both', 450, idx + 2]);
    }
  }

  console.log('Database schema ready');
}

module.exports = { pool, exec, run, ensureSchema };
