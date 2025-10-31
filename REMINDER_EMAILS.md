# Automated Reminder Email System

This document explains how the automated reminder email system works and how to manage it.

## Overview

The system **automatically sends reminder emails 2 days before each session** to all registered participants. The scheduler runs daily at 9:00 AM and checks for upcoming sessions. No manual intervention is required!

### Key Features

- **Fully Automated**: Reminders are sent automatically without manual intervention
- **Smart Tracking**: Never sends duplicate reminders to the same person
- **Session-Aware**: Only sends reminders to sessions happening in exactly 2 days
- **Type Support**: Handles both general registrations and member + guest registrations
- **Scheduled Execution**: Runs every day at 9:00 AM
- **Error Handling**: Continues sending even if individual emails fail

## How It Works

### Automated Schedule

1. **Daily Check**: Every day at 9:00 AM, the scheduler wakes up and checks for upcoming sessions
2. **2-Day Calculation**: It calculates which sessions are happening exactly 2 days from now
3. **Fetch Registrations**: For each matching session, it fetches all registrations
4. **Smart Filtering**: Only sends to people who haven't already received a reminder
5. **Send Emails**: Sends personalized reminder emails to each registrant
6. **Track Sent**: Records each sent email to prevent duplicates

### Database Tables

The system uses two new database features:

1. **`sessions.session_date`**: ISO 8601 datetime field (e.g., `2025-12-11T18:00:00`)
   - **Important**: Sessions MUST have a `session_date` value for reminders to work
   - When creating/editing sessions in the admin panel, always set the session date

2. **`reminder_emails_sent`**: Tracks which reminders have been sent
   - Prevents duplicate reminders to the same person
   - Records: session name, registration ID, type, email, and timestamp

## Prerequisites

1. **Email configuration** must be set up in your `.env` file:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@example.com
   SMTP_PASS=your-app-password
   ```

2. **Dependencies** must be installed:
   ```bash
   npm install
   ```

3. **Server must be running**: The scheduler only runs when the server is running

4. **Sessions must have dates**: All sessions must have a `session_date` value set

## CRITICAL: Setting Session Dates

**The scheduler will NOT send reminders for sessions without a `session_date`!**

When you create or update sessions via the admin panel (`/sessions`), you must set the `session_date` field. The format should be ISO 8601:

```
2025-12-11T18:00:00  (for 6:00 PM on December 11, 2025)
2025-12-13T14:00:00  (for 2:00 PM on December 13, 2025)
```

### Updating Existing Sessions

If you have existing sessions without dates, you can update them:

1. Log in to the admin panel at `/login`
2. Navigate to "Manage Sessions"
3. Edit each session and add the `session_date` field
4. Save the changes

Alternatively, you can update directly in the database using `query.js`:

```bash
node query.js "UPDATE sessions SET session_date = '2025-12-11T18:00:00' WHERE name = 'Thursday December 11, 2025 6:00-8:30p'"
```

## Running the System

### Start the Server

The scheduler starts automatically when you start the server:

```bash
node server.js
```

You should see these messages:
```
[Reminder Scheduler] Initializing scheduler to run at 9:00 AM daily
[Reminder Scheduler] Scheduler started successfully
Server running on http://localhost:3000
```

The scheduler is now active and will run every day at 9:00 AM!

### Testing the Scheduler

To test the scheduler without waiting until 9:00 AM, use the test script:

```bash
node test-reminders.js
```

**Sample Output:**
```
============================================================
Testing Reminder Email System
============================================================

Database loaded successfully


============================================================
[Reminder Scheduler] Running at 2025-10-31T01:19:55.851Z
============================================================
[Reminder Scheduler] Looking for sessions on 2025-11-02

[Reminder Scheduler] Processing session: Thursday December 11, 2025 6:00-8:30p
[Reminder Scheduler] Found 151 registrations
[Reminder Scheduler] ✓ Sent to: liam.smith1@example.com
[Reminder Scheduler] ✓ Sent to: olivia.johnson2@example.com
...
[Reminder Scheduler] Summary: 151 sent, 0 skipped, 0 errors

[Reminder Scheduler] Completed successfully
============================================================
```

## Email Content

### What Recipients Receive

Recipients will get an email with:
- **Subject**: "Event Reminder - Your Registration Details" (or "Member + Guest" for member registrations)
- **Highlight**: "This is a friendly reminder about your upcoming event in **2 days**!"
- **Complete registration details**: Name, email, phone, session date/time, counts, children details
- **Important reminders**:
  - Arrive 10-15 minutes early
  - Bring entire party as registered
  - Children must be accompanied by adults

### General Registration Email

For general registrations, the email includes:
- Participant's full details
- Session date/time (highlighted in purple/blue)
- Number of adults and children
- Children's names and ages

### Member + Guest Registration Email

For member registrations, the email also includes:
- Member name (who sponsored)
- Guest name
- Color-coded styling (pink/red theme)

## Monitoring the System

### Check Server Logs

When the server is running, you can see scheduler activity in the logs:

```bash
# If running in a terminal
node server.js

# The scheduler will log at 9:00 AM each day
[Reminder Scheduler] Running at 2025-12-11T09:00:00.000Z
[Reminder Scheduler] Looking for sessions on 2025-12-13
[Reminder Scheduler] Found 1 session(s) in 2 days
...
```

### Check Sent Reminders

You can query the database to see which reminders have been sent:

```bash
node query.js "SELECT * FROM reminder_emails_sent ORDER BY sent_at DESC LIMIT 10"
```

This shows the last 10 reminder emails sent.

## Changing the Schedule

The default schedule is **9:00 AM daily**. To change it, edit `reminder-scheduler.js`:

```javascript
// Current: Run at 9:00 AM every day
const cronSchedule = '0 9 * * *';

// Examples of other schedules:
// '0 10 * * *'  = 10:00 AM every day
// '0 8 * * *'   = 8:00 AM every day
// '0 9 * * 1'   = 9:00 AM every Monday only
// '0 */6 * * *' = Every 6 hours
```

Cron format: `minute hour day-of-month month day-of-week`

After changing, restart the server for the new schedule to take effect.

## Troubleshooting

### No Reminders Being Sent

**Check 1: Are there sessions in 2 days?**
```bash
node test-reminders.js
```
Look for: `[Reminder Scheduler] No sessions found in 2 days`

**Check 2: Do sessions have `session_date` values?**
```bash
node query.js "SELECT id, name, session_date FROM sessions"
```
If `session_date` is NULL, you need to set it!

**Check 3: Is the server running?**
The scheduler only works when `node server.js` is running.

**Check 4: Have reminders already been sent?**
```bash
node query.js "SELECT * FROM reminder_emails_sent WHERE session_name = 'Your Session Name'"
```

### Emails Not Delivering

**Check email configuration in `.env`:**
```bash
cat .env | grep SMTP
```

Should show:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-app-password
```

**For Gmail users:**
- Enable 2-factor authentication
- Create an App Password (not your regular password)
- Use the App Password in `SMTP_PASS`

**Test email sending:**
```bash
node test-reminders.js
```

Watch for errors like:
```
[Reminder Scheduler] ✗ Failed to send to john@example.com: Authentication failed
```

### Resending Reminders

If you need to resend reminders to a specific session (e.g., after fixing email issues):

1. **Delete the sent records:**
   ```bash
   node query.js "DELETE FROM reminder_emails_sent WHERE session_name = 'Your Session Name'"
   ```

2. **Run the test script:**
   ```bash
   node test-reminders.js
   ```

**Warning**: This will resend to ALL registrants for that session. Only do this if you're sure!

## Production Deployment

### Running as a Background Service

For production, you should run the server as a background service that automatically restarts.

#### Using PM2 (Recommended)

```bash
# Install PM2 globally
npm install -g pm2

# Start the server
pm2 start server.js --name "alpine-events"

# Save the process list
pm2 save

# Setup PM2 to start on boot
pm2 startup

# View logs
pm2 logs alpine-events

# Monitor
pm2 monit
```

#### Using systemd (Linux)

Create `/etc/systemd/system/alpine-events.service`:

```ini
[Unit]
Description=Alpine Events Registration System
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/path/to/alpine
ExecStart=/usr/bin/node server.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl enable alpine-events
sudo systemctl start alpine-events
sudo systemctl status alpine-events
```

### Monitoring in Production

- **Set up log rotation** to prevent log files from growing too large
- **Monitor email delivery** by checking the `reminder_emails_sent` table daily
- **Set up alerts** if the server goes down (use monitoring tools like UptimeRobot, Pingdom, etc.)

## Manual Override (send-reminders.js)

The old manual script (`send-reminders.js`) is still available if you need to manually send reminders outside of the 2-day window:

```bash
# Send to all registrants
node send-reminders.js

# Send to specific session
node send-reminders.js "Session Name"

# Test without sending
node send-reminders.js --dry-run
```

**Note**: This bypasses the 2-day rule and tracking system, so use with caution!

## Summary

### For Normal Operation

1. ✅ Set up email configuration in `.env`
2. ✅ Ensure all sessions have `session_date` values
3. ✅ Start the server: `node server.js`
4. ✅ Let it run! Reminders send automatically at 9:00 AM daily

### For Testing

```bash
# Test the scheduler right now
node test-reminders.js

# Check if sessions have dates
node query.js "SELECT name, session_date FROM sessions"

# Check sent reminders
node query.js "SELECT COUNT(*) as count FROM reminder_emails_sent"
```

### For Troubleshooting

1. Check server logs for errors
2. Run `node test-reminders.js` to see what would happen
3. Verify email configuration
4. Ensure sessions have `session_date` values
5. Check `reminder_emails_sent` table for tracking issues

---

**Questions or issues?** Check the server logs and test with `node test-reminders.js` first!
