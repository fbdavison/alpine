#!/usr/bin/env node

/**
 * test-reminders.js
 *
 * Test script to manually trigger the reminder scheduler
 * Useful for testing without waiting for the cron schedule
 *
 * Usage:
 *   node test-reminders.js
 */

require('dotenv').config();
const fs = require('fs');
const initSqlJs = require('sql.js');
const { runNow } = require('./reminder-scheduler');

const dbPath = './registrations.db';

async function testReminders() {
  console.log('='.repeat(60));
  console.log('Testing Reminder Email System');
  console.log('='.repeat(60));
  console.log();

  // Initialize database
  const SQL = await initSqlJs();

  if (!fs.existsSync(dbPath)) {
    console.error('Error: Database file not found at', dbPath);
    process.exit(1);
  }

  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  const saveDatabase = () => {
    const data = db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
  };

  console.log('Database loaded successfully\n');

  // Run the reminder check
  await runNow(db, saveDatabase);

  console.log('\nTest completed');
}

testReminders().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
