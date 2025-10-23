// Update Thursday session limit to 450
const fs = require('fs');
const initSqlJs = require('sql.js');

async function updateLimit() {
  const SQL = await initSqlJs();
  const dbPath = './registrations.db';
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  db.run(`UPDATE sessions SET child_limit = 450 WHERE name = 'Thursday December 11, 2025 6:00-8:30p'`);

  // Save database
  const data = db.export();
  const bufferOut = Buffer.from(data);
  fs.writeFileSync(dbPath, bufferOut);

  console.log('Updated Thursday session limit to 450');
  db.close();
}

updateLimit();
