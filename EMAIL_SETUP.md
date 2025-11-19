# Email Setup Guide

This guide provides detailed instructions for configuring email notifications for the Alpine Village Event Registration System.

## Table of Contents

- [Overview](#overview)
- [Configuration Methods](#configuration-methods)
- [Quick Start (Local Development)](#quick-start-local-development)
- [Production Deployment (Server Environment Variables)](#production-deployment-server-environment-variables)
- [Provider-Specific Setup](#provider-specific-setup)
  - [Gmail](#gmail)
  - [Office 365](#office-365)
  - [Outlook.com](#outlookcom)
  - [Yahoo Mail](#yahoo-mail)
  - [Custom SMTP Server](#custom-smtp-server)
- [Testing Your Email Configuration](#testing-your-email-configuration)
- [Setting Up Automated Reminder Emails](#setting-up-automated-reminder-emails)
- [Troubleshooting](#troubleshooting)
- [Email Types](#email-types)

## Overview

The Alpine Village Registration System uses **Nodemailer** to send three types of emails:

1. **General Registration Confirmations** - Sent when someone completes the general registration form
2. **Member Registration Confirmations** - Sent when a member completes the member+guest registration form
3. **Reminder Emails** - Automatically sent 48 hours before each session (requires cron job setup)

All emails include the Alpine Village logo and are formatted with HTML for a professional appearance.

## Configuration Methods

The application supports two methods for configuring email settings:

### Method 1: .env File (Local Development)
- **Best for:** Local development and testing
- **How it works:** Create a `.env` file in the project root with your SMTP credentials
- **Advantages:** Easy to set up, keeps credentials out of code, works offline

### Method 2: Server Environment Variables (Production)
- **Best for:** Production deployments (Heroku, Render, AWS, DigitalOcean, etc.)
- **How it works:** Set environment variables directly on your server or hosting platform
- **Advantages:** More secure, follows 12-factor app principles, easier to manage across environments

**The application automatically detects which method you're using:**
- If a `.env` file exists, it will be loaded (useful for local development)
- If no `.env` file exists, the app will use server environment variables (production)
- Server environment variables take precedence if both are present

## Quick Start (Local Development)

For local development using a `.env` file:

1. **Copy the environment template:**
   ```bash
   cp .env.example .env
   ```

2. **Edit the `.env` file** with your SMTP credentials:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@example.com
   SMTP_PASS=your-app-password
   ```

3. **Restart the server** to apply the changes:
   ```bash
   npm start
   ```

## Production Deployment (Server Environment Variables)

For production deployments, configure environment variables directly on your server instead of using a `.env` file.

### Required Environment Variables

Set these four environment variables on your server:

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-app-password
```

### Platform-Specific Instructions

#### Heroku

```bash
heroku config:set SMTP_HOST=smtp.gmail.com
heroku config:set SMTP_PORT=587
heroku config:set SMTP_USER=your-email@example.com
heroku config:set SMTP_PASS=your-app-password
```

Or via the Heroku Dashboard:
1. Go to your app's **Settings** tab
2. Click **Reveal Config Vars**
3. Add each variable: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`

#### Render

1. Go to your web service dashboard
2. Navigate to **Environment** tab
3. Add environment variables:
   - Key: `SMTP_HOST`, Value: `smtp.gmail.com`
   - Key: `SMTP_PORT`, Value: `587`
   - Key: `SMTP_USER`, Value: `your-email@example.com`
   - Key: `SMTP_PASS`, Value: `your-app-password`
4. Click **Save Changes**

#### AWS Elastic Beanstalk

```bash
eb setenv SMTP_HOST=smtp.gmail.com SMTP_PORT=587 SMTP_USER=your-email@example.com SMTP_PASS=your-app-password
```

Or via AWS Console:
1. Go to your Elastic Beanstalk environment
2. Navigate to **Configuration** → **Software**
3. Scroll to **Environment properties**
4. Add each variable

#### DigitalOcean App Platform

1. Go to your app in the DigitalOcean control panel
2. Navigate to **Settings** → **App-Level Environment Variables**
3. Click **Edit**, then **Add Variable**
4. Add: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
5. Click **Save**

#### Railway

1. Go to your project dashboard
2. Click on **Variables** tab
3. Click **New Variable**
4. Add each variable: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`

#### Linux Server (systemd service)

Create/edit your systemd service file (e.g., `/etc/systemd/system/alpine.service`):

```ini
[Unit]
Description=Alpine Village Registration System
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/alpine
Environment="SMTP_HOST=smtp.gmail.com"
Environment="SMTP_PORT=587"
Environment="SMTP_USER=your-email@example.com"
Environment="SMTP_PASS=your-app-password"
Environment="NODE_ENV=production"
ExecStart=/usr/bin/node server.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Then reload and restart:
```bash
sudo systemctl daemon-reload
sudo systemctl restart alpine
```

#### Docker

Pass environment variables when running the container:

```bash
docker run -d \
  -e SMTP_HOST=smtp.gmail.com \
  -e SMTP_PORT=587 \
  -e SMTP_USER=your-email@example.com \
  -e SMTP_PASS=your-app-password \
  -p 3000:3000 \
  alpine-village
```

Or in `docker-compose.yml`:

```yaml
version: '3'
services:
  alpine:
    image: alpine-village
    ports:
      - "3000:3000"
    environment:
      - SMTP_HOST=smtp.gmail.com
      - SMTP_PORT=587
      - SMTP_USER=your-email@example.com
      - SMTP_PASS=your-app-password
```

#### Manual Export (Linux/macOS)

For manual server setup, export variables in your shell profile (`.bashrc`, `.bash_profile`, or `.zshrc`):

```bash
export SMTP_HOST=smtp.gmail.com
export SMTP_PORT=587
export SMTP_USER=your-email@example.com
export SMTP_PASS=your-app-password
```

Then reload your profile:
```bash
source ~/.bashrc  # or ~/.bash_profile or ~/.zshrc
```

**For cron jobs**, you must set environment variables in the crontab itself:
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-app-password

0 9 * * * cd /path/to/alpine && node send-reminders.js >> /var/log/alpine-reminders.log 2>&1
```

### Verifying Environment Variables

After setting environment variables, verify they're loaded correctly:

**On your server:**
```bash
echo $SMTP_HOST
echo $SMTP_USER
```

**In your application:**

When you start the server, you should see:
```
✓ Using server environment variables (no .env file found)
✓ Email configuration loaded: smtp.gmail.com as your-email@example.com
```

If you see warnings about missing configuration, double-check your environment variables.

## Provider-Specific Setup

### Gmail

Gmail is the recommended email provider for ease of setup.

#### Step 1: Enable 2-Factor Authentication

1. Go to your Google Account settings: https://myaccount.google.com/
2. Navigate to **Security** → **2-Step Verification**
3. Follow the prompts to enable 2-factor authentication

#### Step 2: Generate an App Password

1. Go to https://myaccount.google.com/apppasswords
2. In the "Select app" dropdown, choose **Mail**
3. In the "Select device" dropdown, choose **Other (Custom name)**
4. Enter a name like "Alpine Village Registration"
5. Click **Generate**
6. Copy the 16-character password (it will look like: `xxxx xxxx xxxx xxxx`)

#### Step 3: Configure Your .env File

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx
```

**Important Notes:**
- Use the app password, NOT your regular Gmail password
- Remove spaces from the app password if they cause issues
- The email address in `SMTP_USER` will appear as the sender

### Office 365

For organizations using Microsoft 365 / Office 365.

#### Step 1: Enable SMTP Authentication

1. Sign in to the Microsoft 365 admin center
2. Go to **Users** → **Active users**
3. Select the user account
4. Navigate to **Mail** → **Manage email apps**
5. Ensure **Authenticated SMTP** is checked

#### Step 2: Configure Your .env File

```
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=your-email@yourdomain.com
SMTP_PASS=your-password
```

**Important Notes:**
- Use your full Microsoft 365 email address
- Use your regular account password (or app password if MFA is enabled)
- If you have MFA enabled, you may need to generate an app password

### Outlook.com

For personal Outlook.com / Hotmail accounts.

#### Step 1: Configure Your .env File

```
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=your-email@outlook.com
SMTP_PASS=your-password
```

**Important Notes:**
- Works with @outlook.com, @hotmail.com, and @live.com addresses
- If you have 2-factor authentication enabled, generate an app password
- App passwords can be created at: https://account.live.com/proofs/AppPassword

### Yahoo Mail

#### Step 1: Generate an App Password

1. Go to your Yahoo Account Security page: https://login.yahoo.com/account/security
2. Click **Generate app password**
3. Select **Other App** and enter "Alpine Village"
4. Click **Generate**
5. Copy the generated password

#### Step 2: Configure Your .env File

```
SMTP_HOST=smtp.mail.yahoo.com
SMTP_PORT=587
SMTP_USER=your-email@yahoo.com
SMTP_PASS=your-app-password
```

### Custom SMTP Server

If you're using a custom SMTP server or another email provider:

1. **Find your SMTP settings** from your email provider's documentation
2. **Common ports:**
   - Port 587: TLS/STARTTLS (recommended)
   - Port 465: SSL (older, but still supported)
   - Port 25: Unencrypted (not recommended)

3. **Configure Your .env File:**
   ```
   SMTP_HOST=smtp.yourprovider.com
   SMTP_PORT=587
   SMTP_USER=your-email@yourprovider.com
   SMTP_PASS=your-password
   ```

**Note:** The application uses STARTTLS with port 587 by default. If your provider requires SSL (port 465), you'll need to modify `server.js` and `send-reminders.js` to use `secure: true`.

## Testing Your Email Configuration

After configuring your `.env` file, test the email functionality:

### Method 1: Submit a Test Registration

1. Start the server:
   ```bash
   npm start
   ```

2. Open http://localhost:3000 in your browser

3. Fill out a registration form with your email address

4. Check your email inbox for the confirmation email

### Method 2: Check Server Logs

Monitor the server console for email-related messages:

- **Success:** You'll see confirmation that the email was sent
- **Failure:** Error messages will indicate what went wrong

Common error messages:
- `Invalid login` - Wrong username or password
- `Connection timeout` - SMTP host or port is incorrect
- `Authentication failed` - Need to use an app password

### Method 3: Test Reminder Script

Test the reminder email script independently:

```bash
node send-reminders.js
```

Check the output for:
- Database connection success
- Sessions found for upcoming dates
- Email sending confirmations

## Setting Up Automated Reminder Emails

The `send-reminders.js` script automatically sends reminder emails 48 hours before each session.

### Prerequisites

- Your `.env` file must be configured with SMTP settings
- The database must contain registrations with valid email addresses
- The server doesn't need to be running (this is a standalone script)

### Option 1: Linux/macOS Cron Job

1. **Edit your crontab:**
   ```bash
   crontab -e
   ```

2. **Add a daily cron job** (runs at 9:00 AM every day):
   ```bash
   0 9 * * * cd /path/to/alpine && node send-reminders.js >> /var/log/alpine-reminders.log 2>&1
   ```

3. **Replace `/path/to/alpine`** with the actual path to your project

4. **Save and exit** the crontab editor

### Option 2: Windows Task Scheduler

1. Open **Task Scheduler**
2. Click **Create Basic Task**
3. Name: "Alpine Village Reminder Emails"
4. Trigger: Daily at 9:00 AM
5. Action: Start a program
   - Program/script: `node`
   - Arguments: `send-reminders.js`
   - Start in: `C:\path\to\alpine`
6. Finish and enable the task

### Option 3: Manual Execution

Run the script manually whenever you want to send reminders:

```bash
cd /path/to/alpine
node send-reminders.js
```

### How It Works

The reminder script:
1. Connects to the SQLite database
2. Queries all registrations for upcoming sessions (46-50 hours from now)
3. Parses session dates and times
4. Sends personalized reminder emails with:
   - Session date and time
   - Number of children and adults registered
   - Event guidelines and information
   - Alpine Village logo
5. Logs all activity to the console

### Monitoring Reminders

To monitor reminder email activity:

```bash
# View the log file
tail -f /var/log/alpine-reminders.log

# Or check recent activity
tail -n 100 /var/log/alpine-reminders.log
```

## Troubleshooting

### Email Not Sending

**Check your .env file:**
```bash
cat .env
```
Ensure all four variables are set correctly.

**Verify the .env file is loaded:**
Add this temporarily to `server.js` to debug:
```javascript
console.log('SMTP Config:', {
  host: process.env.SMTP_HOST,
  user: process.env.SMTP_USER
});
```

**Restart the server** after any `.env` changes.

### "Invalid Login" or "Authentication Failed"

**For Gmail:**
- Verify 2-factor authentication is enabled
- Generate a new app password
- Remove spaces from the app password in `.env`

**For Office 365:**
- Check that Authenticated SMTP is enabled
- Use your full email address as `SMTP_USER`
- Try generating an app password if MFA is enabled

**For all providers:**
- Double-check username and password for typos
- Ensure you're using an app password if 2FA/MFA is enabled

### "Connection Timeout" or "ECONNREFUSED"

- Verify the `SMTP_HOST` is correct
- Check that `SMTP_PORT` is 587
- Ensure your firewall allows outbound connections on port 587
- Try using a different network (some networks block SMTP)

### Emails Going to Spam

- Add `alpinevillage@trinitybaptistchurch.org` to contacts
- Check that your SMTP credentials are for a legitimate email account
- Avoid sending too many test emails in quick succession
- Consider using a business email domain instead of Gmail/Yahoo

### Reminder Emails Not Sending

**Verify the cron job is running:**
```bash
crontab -l  # List all cron jobs
```

**Check cron job logs:**
```bash
grep CRON /var/log/syslog  # On Ubuntu/Debian
tail /var/log/alpine-reminders.log  # Your custom log
```

**Test the script manually:**
```bash
cd /path/to/alpine
node send-reminders.js
```

**Common issues:**
- `.env` file not in the correct directory
- Incorrect path in cron job
- Database file permissions
- Node.js not in the cron environment PATH

**Solution for PATH issues:**
Use the full path to node in your crontab:
```bash
0 9 * * * cd /path/to/alpine && /usr/bin/node send-reminders.js >> /var/log/alpine-reminders.log 2>&1
```

Find your node path with: `which node`

### Logo Not Appearing in Emails

The Alpine Village logo should be embedded in all emails.

**Verify the logo file exists:**
```bash
ls -lh public/images/AV\ Logo.png
```

**Check file permissions:**
```bash
chmod 644 public/images/AV\ Logo.png
```

**If the logo is missing**, ensure the file is in the correct location:
- Path: `public/images/AV Logo.png`
- File should be ~91KB

## Email Types

### 1. General Registration Confirmation

**Sent when:** Someone submits the general registration form

**Includes:**
- Selected session date and time
- Number of children and adults registered
- Event guidelines (age requirements, pricing, timing)
- Contact information
- Alpine Village logo
- Bible verse footer (Luke 2:10-12)

**From:** Your configured SMTP email address
**Subject:** "Alpine Village Registration Confirmation"

### 2. Member Registration Confirmation

**Sent when:** A member submits the member+guest registration form

**Includes:**
- Member's first and last name
- Selected session date and time
- Number of children and adults registered
- Event guidelines
- Contact information
- Alpine Village logo
- Bible verse footer

**From:** Your configured SMTP email address
**Subject:** "Alpine Village Registration Confirmation"

### 3. Reminder Email

**Sent when:** 48 hours before a registered session (automated via cron job)

**Includes:**
- Reminder that the session is in 2 days
- Session date and time
- Number of children and adults registered
- Event guidelines and reminders
- Contact information
- Alpine Village logo
- Bible verse footer

**From:** Your configured SMTP email address
**Subject:** "Reminder: Alpine Village Session in 2 Days!"

---

## Support

For additional help:
- Check the main [README.md](README.md) for general setup
- Review [DATABASE_QUERIES.md](DATABASE_QUERIES.md) for database operations
- Contact: alpinevillage@trinitybaptistchurch.org

## Security Best Practices

1. **Never commit your `.env` file** to version control (it's already in `.gitignore`)
2. **Use app passwords** instead of your main account password
3. **Rotate passwords periodically**, especially if they're exposed
4. **Limit email account permissions** to only what's needed for sending emails
5. **Monitor email logs** for suspicious activity
6. **Keep dependencies updated:** `npm update` regularly
