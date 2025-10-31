# Reminder Email Script

This document explains how to use the `send-reminders.js` script to send reminder emails to registered participants.

## Overview

The `send-reminders.js` script allows you to send reminder emails to:
- All registrants across all sessions
- Registrants for a specific session only

The script supports both **general registrations** and **member + guest registrations**, sending appropriately formatted emails to each type.

## Prerequisites

Before running the script, ensure:

1. **Email configuration** is set up in your `.env` file:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@example.com
   SMTP_PASS=your-app-password
   ```

2. **Dependencies** are installed:
   ```bash
   npm install
   ```

3. **Database** exists with registration data at `./registrations.db`

## Usage

### 1. List All Available Sessions

To see what sessions have registrations:

```bash
node send-reminders.js --list-sessions
```

**Output:**
```
============================================================
Event Reminder Email Sender
============================================================

Database loaded successfully

Available Sessions:
------------------------------------------------------------
1. Thursday December 11, 2025 6:00-8:30p
2. Wednesday December 10, 2025 6:00-8:30p (Friends & Family)

Total sessions: 2
```

### 2. Dry Run (Test Mode)

**ALWAYS test with dry run first** before sending actual emails:

#### Test for all registrations:
```bash
node send-reminders.js --dry-run
```

#### Test for a specific session:
```bash
node send-reminders.js "Thursday December 11, 2025 6:00-8:30p" --dry-run
```

**What happens in dry run mode:**
- Shows exactly who would receive emails
- Displays summary statistics
- **Does NOT actually send any emails**
- No confirmation prompt required

**Output:**
```
Summary:
------------------------------------------------------------
Session: Thursday December 11, 2025 6:00-8:30p
Total recipients: 151
General registrations: 151
Member registrations: 0
Mode: DRY RUN (no emails will be sent)
------------------------------------------------------------

Sending reminders...
------------------------------------------------------------
[DRY RUN] Would send to: liam.smith1@example.com (Liam Smith) - Thursday...
[DRY RUN] Would send to: olivia.johnson2@example.com (Olivia Johnson) - Thursday...
...
```

### 3. Send Actual Emails

Once you've verified the dry run output is correct, remove the `--dry-run` flag:

#### Send to all registrations:
```bash
node send-reminders.js
```

**The script will:**
1. Display a summary
2. **Ask for confirmation** (type "yes" to proceed)
3. Send emails with progress indicators
4. Show final results

#### Send to a specific session:
```bash
node send-reminders.js "Wednesday December 10, 2025 6:00-8:30p (Friends & Family)"
```

**Important:** Session names must match exactly (including capitalization and punctuation)

## Email Content

### General Registration Reminder

Recipients will receive an email with:
- Event reminder heading
- Their complete registration details
- Session date/time (highlighted)
- Number of adults and children
- Children's details (names and ages)
- Important reminders:
  - Arrive 10-15 minutes early
  - Bring entire party as registered
  - Children must be accompanied by adults

### Member + Guest Registration Reminder

Similar to general registration but also includes:
- Member name (who sponsored the registration)
- Guest name
- Color-coded styling for member registrations

## Safety Features

### Built-in Safeguards:

1. **Confirmation Prompt** - Requires typing "yes" for live sends
2. **Dry Run Mode** - Test without sending emails
3. **Progress Indicators** - See each email as it's sent
4. **Error Handling** - Continues sending even if individual emails fail
5. **Rate Limiting** - 100ms delay between emails to avoid overwhelming SMTP server

### Error Reporting

If any emails fail, the script will:
- Continue sending to remaining recipients
- Display which emails failed
- Show error details in the final summary

Example error output:
```
============================================================
Final Results:
------------------------------------------------------------
Total: 151
Successful: 149
Failed: 2

Errors:
  - invalid@example.com: Invalid recipient address
  - bounced@example.com: Mailbox full
============================================================
```

## Examples

### Example 1: Testing before sending

```bash
# Step 1: See what sessions exist
node send-reminders.js --list-sessions

# Step 2: Test sending to one session
node send-reminders.js "Thursday December 11, 2025 6:00-8:30p" --dry-run

# Step 3: If everything looks good, send for real
node send-reminders.js "Thursday December 11, 2025 6:00-8:30p"
# (Type "yes" when prompted)
```

### Example 2: Sending to all registrants

```bash
# Step 1: Test first
node send-reminders.js --dry-run

# Step 2: Review the output, then send
node send-reminders.js
# (Type "yes" when prompted)
```

### Example 3: Testing email configuration

```bash
# Create a test session with just your email
# Then run:
node send-reminders.js "Test Session" --dry-run
# Verify your email appears in the output

# Send test email to yourself
node send-reminders.js "Test Session"
# (Type "yes" when prompted)
# Check your inbox to verify formatting
```

## Troubleshooting

### Common Issues

**"Database file not found"**
- Ensure `registrations.db` exists in the project root
- Run the application at least once to create the database

**"No registrations found"**
- Verify you have registrations in the database
- Check that the session name matches exactly (use `--list-sessions`)

**Emails not sending**
- Verify SMTP credentials in `.env` file
- For Gmail, use an App Password (not your regular password)
- Check that SMTP_HOST and SMTP_PORT are correct

**"Authentication failed"**
- Gmail users: Enable 2-factor authentication and create an App Password
- Check that SMTP_USER and SMTP_PASS are set correctly

**Emails going to spam**
- Verify SPF/DKIM records for your domain
- Consider using a dedicated email service (SendGrid, Mailgun, etc.)

## Best Practices

1. **Always test with dry run first** - Verify recipients before sending
2. **Use session-specific sends** - Rather than sending to all at once
3. **Test with yourself first** - Create a test registration with your email
4. **Send during off-peak hours** - Avoid overwhelming your SMTP server
5. **Monitor the output** - Watch for errors during sending
6. **Keep records** - Save the output for your records

## Advanced Usage

### Saving Output to a File

```bash
node send-reminders.js --dry-run > reminder-preview.txt
```

### Sending to Multiple Sessions

```bash
# Send to each session separately
node send-reminders.js "Session 1"
node send-reminders.js "Session 2"
node send-reminders.js "Session 3"
```

### Scripting Multiple Sends

Create a bash script (`send-all-reminders.sh`):

```bash
#!/bin/bash

sessions=(
  "Wednesday December 10, 2025 6:00-8:30p (Friends & Family)"
  "Thursday December 11, 2025 6:00-8:30p"
  "Friday December 12, 2025 6:00-8:30p"
)

for session in "${sessions[@]}"; do
  echo "Sending reminders for: $session"
  echo "yes" | node send-reminders.js "$session"
  echo "---"
done
```

Make it executable:
```bash
chmod +x send-all-reminders.sh
./send-all-reminders.sh
```

## Related Files

- `server.js` - Contains email configuration and functions
- `add-test-data.js` - Script to add test registrations
- `.env` - Email credentials (not committed to git)

## Support

For issues or questions about the reminder email script, please check:
1. This documentation
2. The troubleshooting section above
3. The script's error messages for specific guidance
