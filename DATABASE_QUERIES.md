# Database Query Guide

## Database Location
The SQLite database is located at: `./registrations.db`

## Available Tables
- `general_registrations` - General public registrations
- `member_registrations` - Member + Guest registrations

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

## Method 2: Using SQLite Command Line

Open an interactive SQLite session:

```bash
sqlite3 registrations.db
```

Or use the helper script:
```bash
./query-db.sh
```

### Useful SQLite Commands:

```sql
-- Show all tables
.tables

-- Show table structure
.schema general_registrations
.schema member_registrations

-- Enable headers and column mode for better output
.headers on
.mode column

-- Run queries
SELECT * FROM general_registrations;
SELECT * FROM member_registrations;

-- Export to CSV
.mode csv
.output registrations.csv
SELECT * FROM general_registrations;
.output stdout

-- Exit
.quit
```

---

## Method 3: Quick One-Line Queries

Run queries directly from the command line:

```bash
# Count total registrations
sqlite3 registrations.db "SELECT COUNT(*) as total FROM general_registrations"

# List all sessions with child counts
sqlite3 registrations.db "SELECT session, SUM(num_children) as children FROM general_registrations GROUP BY session"

# Export all data to CSV
sqlite3 -header -csv registrations.db "SELECT * FROM general_registrations" > general_registrations.csv
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
)
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
WHERE datetime(created_at) > datetime('now', '-1 day')
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
