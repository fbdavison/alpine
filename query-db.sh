#!/bin/bash
# Query the registrations database
# Usage: ./query-db.sh

echo "=== Database Query Tool ==="
echo ""
echo "Opening SQLite database: registrations.db"
echo ""
echo "Available tables:"
sqlite3 registrations.db ".tables"
echo ""
echo "Available commands:"
echo "  .tables              - List all tables"
echo "  .schema [table]      - Show table structure"
echo "  SELECT * FROM ...    - Run SQL queries"
echo "  .quit or Ctrl+D      - Exit"
echo ""

# Open interactive SQLite shell
sqlite3 registrations.db
