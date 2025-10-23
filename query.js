// Database Query Tool
// Usage: node query.js "SELECT * FROM general_registrations"

const fs = require('fs');
const initSqlJs = require('sql.js');

const dbPath = './registrations.db';

async function runQuery(queryString) {
  const SQL = await initSqlJs();

  if (!fs.existsSync(dbPath)) {
    console.error('Database file not found:', dbPath);
    process.exit(1);
  }

  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  try {
    const result = db.exec(queryString);

    if (result.length === 0) {
      console.log('Query executed successfully. No results returned.');
      return;
    }

    // Display results in a formatted way
    result.forEach((queryResult, idx) => {
      if (result.length > 1) {
        console.log(`\n=== Result Set ${idx + 1} ===`);
      }

      const columns = queryResult.columns;
      const values = queryResult.values;

      if (values.length === 0) {
        console.log('No rows returned.');
        return;
      }

      // Calculate column widths
      const colWidths = columns.map((col, i) => {
        const maxValueLength = Math.max(
          ...values.map(row => String(row[i] || '').length),
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
          const str = String(val || '');
          return str.length > 50 ? str.substring(0, 47) + '...' : str.padEnd(colWidths[i]);
        }).join(' | ');
        console.log(rowStr);
      });

      console.log(`\n${values.length} row(s) returned.`);
    });

  } catch (error) {
    console.error('Query error:', error.message);
    process.exit(1);
  }

  db.close();
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
