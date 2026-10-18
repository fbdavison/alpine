# Event Registration System

A Node.js web application with two registration forms connected to a Postgres database.

## Features

- **General Registration Form**: For public event registration with 6 session options
- **Member + Guest Registration Form**: For members bringing guests, includes Wednesday friends & family session
- **Session Capacity Management**: Automatically limits each session to 450 children and removes full sessions from the dropdown
- **Email Confirmation**: Sends automated confirmation emails to registrants with their full registration details and Alpine Village logo
- **Reminder Emails**: Automated reminder emails sent 48 hours before each session
- **Alpine Village Branding**: Beautiful logo displayed on all pages and included in emails
- Dynamic child information fields based on number of children selected
- Postgres database for storing all registrations
- Clean, responsive UI with gradient themes

## Setup Instructions

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure the Database**

   Create a `.env` file in the root directory (use `.env.example` as a template):
   ```bash
   cp .env.example .env
   ```

   Then set `DATABASE_URL` in `.env` to your Postgres connection string:
   ```
   DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DBNAME?sslmode=require
   ```

   The app creates its tables automatically on startup (see [Database](#database) below).
   If you're migrating from the old SQLite-backed version, see
   [Migrating from SQLite](#migrating-from-sqlite).

3. **Configure Email Settings**

   The application supports two methods for configuring email:

   **Option A: Using .env file (recommended for local development)**

   Create a `.env` file in the root directory (use `.env.example` as a template):
   ```bash
   cp .env.example .env
   ```

   Then edit `.env` with your SMTP email credentials:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@example.com
   SMTP_PASS=your-app-password
   ```

   **Option B: Using server environment variables (recommended for production)**

   Set the following environment variables on your server or hosting platform:
   ```bash
   export SMTP_HOST=smtp.gmail.com
   export SMTP_PORT=587
   export SMTP_USER=your-email@example.com
   export SMTP_PASS=your-app-password
   ```

   Or on your hosting platform (Heroku, Render, AWS, etc.):
   - Navigate to your app's environment variable settings
   - Add: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`

   **For Gmail Users:**
   - Enable 2-factor authentication on your Google account
   - Generate an "App Password" at https://myaccount.google.com/apppasswords
   - Use the generated app password (not your regular Gmail password)

   **For Other Email Providers:**
   - Office 365: `smtp.office365.com` (Port 587)
   - Yahoo: `smtp.mail.yahoo.com` (Port 587)
   - Outlook: `smtp-mail.outlook.com` (Port 587)

   See [EMAIL_SETUP.md](EMAIL_SETUP.md) for detailed configuration instructions.

4. **Start the Server**
   ```bash
   npm start
   ```

5. **Access the Application**
   Open your browser and go to: `http://localhost:3000`

6. **Set Up Reminder Emails (Optional)**

   To automatically send reminder emails 48 hours before each session, set up a daily cron job:

   ```bash
   # Edit crontab
   crontab -e

   # Add this line to run daily at 9 AM
   0 9 * * * cd /path/to/alpine && node send-reminders.js >> /var/log/alpine-reminders.log 2>&1
   ```

   The script will automatically:
   - Parse session dates and times
   - Find all registrations for sessions happening in 46-50 hours
   - Send personalized reminder emails with the Alpine Village logo
   - Log all activity for monitoring

   **Note**: Make sure your `.env` file is properly configured with SMTP settings before running the reminder script.

## Database

The application connects to Postgres via `DATABASE_URL` and automatically creates the
following tables on startup if they don't already exist:
- `general_registrations` - Stores general registration submissions
- `member_registrations` - Stores member + guest registration submissions
- `sessions` - Session definitions (name, type, child limit, display order), seeded
  with the default sessions the first time the table is empty

See [DATABASE_QUERIES.md](DATABASE_QUERIES.md) for example queries.

## Migrating from SQLite

Earlier versions of this app stored data in a local `registrations.db` file (via
`sql.js`). If you have an existing `registrations.db` with data you want to keep:

1. Set `DATABASE_URL` in `.env` to point at your target Postgres database.
2. Run:
   ```bash
   node migrate-to-postgres.js
   ```

This copies all rows from `registrations.db` into the Postgres tables (creating them
first if needed) and is safe to leave `registrations.db` in place afterward — the app
no longer reads it. Note: re-running the script will duplicate registration rows, so
only run it once per target database.

## Forms

### General Registration
Available sessions:
- Thursday December 11, 2025 6:00-8:30p
- Friday December 12, 2025 6:00-8:30p
- Saturday December 13, 2025 2:00-4:30p
- Saturday December 13, 2025 6:00-8:30p
- Sunday December 14, 2025 2:00-4:30p
- Sunday December 14, 2025 6:00-8:30p

### Member + Guest Registration
Includes all general sessions PLUS:
- Wednesday December 10, 2025 6:00-8:30p (Friends & Family)

Additional fields:
- Member First Name
- Member Last Name

## Technologies Used

- Node.js
- Express.js
- Postgres (via `pg`)
- HTML/CSS/JavaScript
