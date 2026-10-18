#!/bin/bash
# Query the Postgres registrations database
# Usage: ./query-db.sh

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is not set. Add it to .env or export it before running this script."
  exit 1
fi

echo "=== Database Query Tool ==="
echo ""
echo "Connecting to Postgres database"
echo ""
echo "Available tables:"
psql "$DATABASE_URL" -c "\dt"
echo ""
echo "Available commands:"
echo "  \\dt                  - List all tables"
echo "  \\d [table]           - Show table structure"
echo "  SELECT * FROM ...    - Run SQL queries"
echo "  \\q or Ctrl+D         - Exit"
echo ""

# Open interactive psql shell
psql "$DATABASE_URL"
