# Database Query Guide

## Database Location
The app connects to Postgres via the `DATABASE_URL` environment variable (see `.env.example`).

## Available Tables
- `general_registrations` - General public registrations
- `member_registrations` - Member + Guest registrations
- `sessions` - Session definitions and capacity limits

---

## Method 1: Using the Query Script (Easiest)

Use the provided Node.js script to run queries:

```bash
node query.js "YOUR SQL QUERY"
```

### Examples:

**View all general registrations:**
```bash
node query.js "SELECT * FROM general_registrations"
```

**View all member registrations:**
```bash
node query.js "SELECT * FROM member_registrations"
```

**Count registrations by session:**
```bash
node query.js "SELECT session, COUNT(*) as count, SUM(num_adults) as adults, SUM(num_children) as children FROM general_registrations GROUP BY session"
```

**Find registrations by email:**
```bash
node query.js "SELECT * FROM general_registrations WHERE email LIKE '%example.com%'"
```

**Get registrations for a specific session:**
```bash
node query.js "SELECT first_name, last_name, email, num_adults, num_children FROM general_registrations WHERE session = 'Thursday December 11, 2025 6:00-8:30p'"
```

**Combined view of both tables:**
```bash
node query.js "SELECT 'General' as type, first_name, last_name, email, session FROM general_registrations UNION ALL SELECT 'Member' as type, first_name, last_name, email, session FROM member_registrations"
```

---

## Method 2: Using psql

Open an interactive psql session against the configured database:

```bash
psql "$DATABASE_URL"
```

Or use the helper script, which loads `DATABASE_URL` from `.env` for you:
```bash
./query-db.sh
```

### Useful psql Commands:

```sql
-- Show all tables
\dt

-- Show table structure
\d general_registrations
\d member_registrations

-- Run queries
SELECT * FROM general_registrations;
SELECT * FROM member_registrations;

-- Export to CSV
\copy (SELECT * FROM general_registrations) TO 'general_registrations.csv' WITH CSV HEADER

-- Exit
\q
```

---

## Method 3: Quick One-Line Queries

Run queries directly from the command line:

```bash
# Count total registrations
psql "$DATABASE_URL" -c "SELECT COUNT(*) as total FROM general_registrations"

# List all sessions with child counts
psql "$DATABASE_URL" -c "SELECT session, SUM(num_children) as children FROM general_registrations GROUP BY session"

# Export all data to CSV
psql "$DATABASE_URL" -c "\copy (SELECT * FROM general_registrations) TO STDOUT WITH CSV HEADER" > general_registrations.csv
```

---

## Method 4: Using the Admin Web Interface

1. Start the server: `node server.js`
2. Visit: http://localhost:3000/login
3. Login with: username `admin`, password `admin123`
4. Select a session to view reservations
5. Export to CSV using the export button

---

## Common Queries

### Get session statistics:
```sql
SELECT
    session,
    COUNT(*) as total_registrations,
    SUM(num_adults) as total_adults,
    SUM(num_children) as total_children,
    450 - SUM(num_children) as spots_remaining
FROM (
    SELECT session, num_adults, num_children FROM general_registrations
    UNION ALL
    SELECT session, num_adults, num_children FROM member_registrations
) sub
GROUP BY session
ORDER BY session;
```

### Find registrations with comments:
```sql
SELECT first_name, last_name, email, comments
FROM general_registrations
WHERE comments IS NOT NULL AND comments != '';
```

### Get all children details:
```sql
SELECT
    first_name,
    last_name,
    email,
    session,
    num_children,
    children_details
FROM general_registrations
WHERE num_children > 0;
```

### Recent registrations (last 24 hours):
```sql
SELECT * FROM general_registrations
WHERE created_at > now() - interval '1 day'
ORDER BY created_at DESC;
```

### People requesting church info:
```sql
SELECT first_name, last_name, email, phone
FROM general_registrations
WHERE request_church_info = 1;
```

---

## Table Schemas

### general_registrations
- `id` - Primary key
- `first_name` - First name
- `last_name` - Last name
- `email` - Email address
- `phone` - Phone number
- `street_address` - Street address
- `city` - City
- `state` - State
- `zip` - ZIP code
- `num_adults` - Number of adults
- `num_children` - Number of children
- `children_details` - JSON string with child names and ages
- `comments` - Additional comments
- `request_church_info` - 1 if requested, 0 otherwise
- `session` - Session date/time
- `created_at` - Registration timestamp

### member_registrations
Same as above, plus:
- `member_first_name` - Member's first name
- `member_last_name` - Member's last name
