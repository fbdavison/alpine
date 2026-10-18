// One-time migration: copy data from the legacy sql.js/SQLite file
// (registrations.db) into the new Postgres database.
//
// Usage: node migrate-to-postgres.js
//
// Reads registrations.db with Node's built-in node:sqlite module (no sql.js
// dependency needed), and inserts everything into the tables created by
// db.ensureSchema(). Safe to re-run: existing session names are skipped via
// ON CONFLICT, but registrations will be duplicated if run twice, so only
// run this once per target database.

const fs = require('fs');
if (fs.existsSync('.env')) {
  require('dotenv').config();
}

const { DatabaseSync } = require('node:sqlite');
const db = require('./db');

const SQLITE_PATH = './registrations.db';

function readAll(sqliteDb, table) {
  return sqliteDb.prepare(`SELECT * FROM ${table}`).all();
}

async function migrateSessions(sqliteDb) {
  const rows = readAll(sqliteDb, 'sessions');
  let migrated = 0;
  for (const row of rows) {
    await db.run(
      `INSERT INTO sessions (name, type, child_limit, is_active, display_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (name) DO NOTHING`,
      [row.name, row.type, row.child_limit, row.is_active, row.display_order, row.created_at]
    );
    migrated++;
  }
  console.log(`✓ Migrated ${migrated} sessions (existing names skipped)`);
}

async function migrateRegistrations(sqliteDb, table, columns) {
  const rows = readAll(sqliteDb, table);
  const placeholders = columns.map(() => '?').join(', ');
  for (const row of rows) {
    const values = columns.map((col) => row[col]);
    await db.run(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
      values
    );
  }
  console.log(`✓ Migrated ${rows.length} rows from ${table}`);
}

async function main() {
  if (!fs.existsSync(SQLITE_PATH)) {
    console.error(`Legacy database file not found: ${SQLITE_PATH}`);
    process.exit(1);
  }

  const sqliteDb = new DatabaseSync(SQLITE_PATH, { readOnly: true });

  try {
    await db.ensureSchema();

    await migrateSessions(sqliteDb);

    await migrateRegistrations(sqliteDb, 'general_registrations', [
      'first_name', 'last_name', 'email', 'phone', 'street_address', 'city',
      'state', 'zip', 'num_adults', 'num_children', 'children_details',
      'comments', 'request_church_info', 'session', 'created_at'
    ]);

    await migrateRegistrations(sqliteDb, 'member_registrations', [
      'member_first_name', 'member_last_name', 'first_name', 'last_name',
      'email', 'phone', 'street_address', 'city', 'state', 'zip',
      'num_adults', 'num_children', 'children_details', 'comments',
      'request_church_info', 'session', 'created_at'
    ]);

    console.log('\n✓ Migration complete.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    sqliteDb.close();
    await db.pool.end();
  }
}

main();
