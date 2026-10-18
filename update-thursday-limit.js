// Update Thursday session limit to 450
const fs = require('fs');
if (fs.existsSync('.env')) {
  require('dotenv').config();
}

const db = require('./db');

async function updateLimit() {
  await db.run(`UPDATE sessions SET child_limit = 450 WHERE name = 'Thursday December 11, 2025 6:00-8:30p'`);
  console.log('Updated Thursday session limit to 450');
  await db.pool.end();
}

updateLimit();
