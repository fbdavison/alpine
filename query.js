// Database Query Tool
// Usage: node query.js "SELECT * FROM general_registrations"

const fs = require('fs');
if (fs.existsSync('.env')) {
  require('dotenv').config();
}

const { Pool } = require('pg');

async function runQuery(queryString) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const result = await pool.query(queryString);
    const columns = result.fields.map(f => f.name);
    const values = result.rows.map(row => columns.map(col => row[col]));

    if (values.length === 0) {
      console.log('Query executed successfully. No results returned.');
      return;
    }

    // Calculate column widths
    const colWidths = columns.map((col, i) => {
      const maxValueLength = Math.max(
        ...values.map(row => String(row[i] ?? '').length),
        col.length
      );
      return Math.min(maxValueLength, 50); // Max width 50
    });

    // Print header
    const header = columns.map((col, i) => col.padEnd(colWidths[i])).join(' | ');
    console.log(header);
    console.log(colWidths.map(w => '-'.repeat(w)).join('-+-'));

    // Print rows
    values.forEach(row => {
      const rowStr = row.map((val, i) => {
        const str = String(val ?? '');
        return str.length > 50 ? str.substring(0, 47) + '...' : str.padEnd(colWidths[i]);
      }).join(' | ');
      console.log(rowStr);
    });

    console.log(`\n${values.length} row(s) returned.`);
  } catch (error) {
    console.error('Query error:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

// Get query from command line argument
const query = process.argv[2];

if (!query) {
  console.log('Database Query Tool');
  console.log('Usage: node query.js "YOUR SQL QUERY"');
  console.log('');
  console.log('Examples:');
  console.log('  node query.js "SELECT * FROM general_registrations"');
  console.log('  node query.js "SELECT session, COUNT(*) as count FROM general_registrations GROUP BY session"');
  console.log('  node query.js "SELECT * FROM member_registrations WHERE session LIKE \'%December 10%\'"');
  console.log('');
  console.log('Available tables:');
  console.log('  - general_registrations');
  console.log('  - member_registrations');
  process.exit(0);
}

runQuery(query);
