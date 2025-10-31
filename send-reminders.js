#!/usr/bin/env node

/**
 * send-reminders.js
 *
 * Script to send reminder emails to all registrants or a specific session
 *
 * Usage:
 *   node send-reminders.js                          # Send to all registrants
 *   node send-reminders.js "Session Name"           # Send to specific session
 *   node send-reminders.js --list-sessions          # List all available sessions
 *   node send-reminders.js --dry-run                # Test without sending emails
 *   node send-reminders.js "Session Name" --dry-run # Test for specific session
 */

require('dotenv').config();
const fs = require('fs');
const initSqlJs = require('sql.js');
const nodemailer = require('nodemailer');

// Email configuration
const emailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'your-email@example.com',
    pass: process.env.SMTP_PASS || 'your-password'
  }
});

const dbPath = './registrations.db';
let db;

// Initialize database
async function initializeDatabase() {
  const SQL = await initSqlJs();

  if (!fs.existsSync(dbPath)) {
    console.error('Error: Database file not found at', dbPath);
    process.exit(1);
  }

  const buffer = fs.readFileSync(dbPath);
  db = new SQL.Database(buffer);
  console.log('Database loaded successfully\n');
}

// Get all unique sessions
function getAllSessions() {
  const generalResult = db.exec('SELECT DISTINCT session FROM general_registrations ORDER BY session');
  const memberResult = db.exec('SELECT DISTINCT session FROM member_registrations ORDER BY session');

  const sessions = new Set();

  if (generalResult.length > 0 && generalResult[0].values.length > 0) {
    generalResult[0].values.forEach(row => sessions.add(row[0]));
  }

  if (memberResult.length > 0 && memberResult[0].values.length > 0) {
    memberResult[0].values.forEach(row => sessions.add(row[0]));
  }

  return Array.from(sessions).sort();
}

// Get registrations by session (or all if no session specified)
function getRegistrations(sessionName = null) {
  const registrations = [];

  // Get general registrations
  let generalQuery = 'SELECT * FROM general_registrations';
  let generalParams = [];

  if (sessionName) {
    generalQuery += ' WHERE session = ?';
    generalParams = [sessionName];
  }

  const generalResult = db.exec(generalQuery, generalParams);

  if (generalResult.length > 0 && generalResult[0].values.length > 0) {
    const columns = generalResult[0].columns;
    generalResult[0].values.forEach(row => {
      const registration = {};
      columns.forEach((col, idx) => {
        registration[col] = row[idx];
      });
      registration.type = 'general';
      registrations.push(registration);
    });
  }

  // Get member registrations
  let memberQuery = 'SELECT * FROM member_registrations';
  let memberParams = [];

  if (sessionName) {
    memberQuery += ' WHERE session = ?';
    memberParams = [sessionName];
  }

  const memberResult = db.exec(memberQuery, memberParams);

  if (memberResult.length > 0 && memberResult[0].values.length > 0) {
    const columns = memberResult[0].columns;
    memberResult[0].values.forEach(row => {
      const registration = {};
      columns.forEach((col, idx) => {
        registration[col] = row[idx];
      });
      registration.type = 'member';
      registrations.push(registration);
    });
  }

  return registrations;
}

// Send reminder email for general registration
async function sendGeneralReminderEmail(registration) {
  const childrenList = registration.children_details
    ? JSON.parse(registration.children_details).map((child, index) =>
        `${index + 1}. ${child.name} (Age: ${child.age})`
      ).join('\n        ')
    : 'None';

  const mailOptions = {
    from: process.env.SMTP_USER || 'your-email@example.com',
    to: registration.email,
    subject: 'Event Reminder - Your Registration Details',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #667eea;">Event Reminder</h2>
        <p>Dear ${registration.first_name} ${registration.last_name},</p>
        <p>This is a friendly reminder about your upcoming event registration.</p>

        <h3 style="color: #764ba2;">Your Registration Details:</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Name:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${registration.first_name} ${registration.last_name}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Email:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${registration.email}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Phone:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${registration.phone}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Session:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong style="color: #667eea; font-size: 1.1em;">${registration.session}</strong></td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Adults & Older Children (6th grade+):</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${registration.num_adults}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Number of Children:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${registration.num_children}</td>
          </tr>
          ${registration.num_children > 0 ? `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;" valign="top"><strong>Children:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><pre style="margin: 0; font-family: Arial, sans-serif;">${childrenList}</pre></td>
          </tr>
          ` : ''}
        </table>

        <div style="background-color: #f0f0f0; padding: 15px; margin-top: 20px; border-radius: 8px;">
          <p style="margin: 0; font-weight: 600;">Important Reminders:</p>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li>Please arrive 10-15 minutes before your scheduled session time</li>
            <li>Bring your entire party as registered</li>
            <li>Children must be accompanied by adults at all times</li>
          </ul>
        </div>

        <p style="margin-top: 20px;">We look forward to seeing you at the event!</p>
        <p>If you have any questions or need to make changes to your registration, please contact us.</p>

        <p style="color: #666; font-size: 12px; margin-top: 30px;">This is an automated reminder email. Please do not reply to this message.</p>
      </div>
    `
  };

  await emailTransporter.sendMail(mailOptions);
}

// Send reminder email for member registration
async function sendMemberReminderEmail(registration) {
  const childrenList = registration.children_details
    ? JSON.parse(registration.children_details).map((child, index) =>
        `${index + 1}. ${child.name} (Age: ${child.age})`
      ).join('\n        ')
    : 'None';

  const mailOptions = {
    from: process.env.SMTP_USER || 'your-email@example.com',
    to: registration.email,
    subject: 'Event Reminder - Your Member + Guest Registration',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f093fb;">Member + Guest Event Reminder</h2>
        <p>Dear ${registration.first_name} ${registration.last_name},</p>
        <p>This is a friendly reminder about your upcoming event registration.</p>

        <h3 style="color: #f5576c;">Your Registration Details:</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Member Name:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${registration.member_first_name} ${registration.member_last_name}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Guest Name:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${registration.first_name} ${registration.last_name}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Email:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${registration.email}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Phone:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${registration.phone}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Session:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong style="color: #f093fb; font-size: 1.1em;">${registration.session}</strong></td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Adults & Older Children (6th grade+):</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${registration.num_adults}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Number of Children:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${registration.num_children}</td>
          </tr>
          ${registration.num_children > 0 ? `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;" valign="top"><strong>Children:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><pre style="margin: 0; font-family: Arial, sans-serif;">${childrenList}</pre></td>
          </tr>
          ` : ''}
        </table>

        <div style="background-color: #f0f0f0; padding: 15px; margin-top: 20px; border-radius: 8px;">
          <p style="margin: 0; font-weight: 600;">Important Reminders:</p>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li>Please arrive 10-15 minutes before your scheduled session time</li>
            <li>Bring your entire party as registered</li>
            <li>Children must be accompanied by adults at all times</li>
          </ul>
        </div>

        <p style="margin-top: 20px;">We look forward to seeing you at the event!</p>
        <p>If you have any questions or need to make changes to your registration, please contact us.</p>

        <p style="color: #666; font-size: 12px; margin-top: 30px;">This is an automated reminder email. Please do not reply to this message.</p>
      </div>
    `
  };

  await emailTransporter.sendMail(mailOptions);
}

// Send reminder to a single registration
async function sendReminder(registration, dryRun = false) {
  if (dryRun) {
    console.log(`[DRY RUN] Would send to: ${registration.email} (${registration.first_name} ${registration.last_name}) - ${registration.session}`);
    return { success: true, dryRun: true };
  }

  try {
    if (registration.type === 'member') {
      await sendMemberReminderEmail(registration);
    } else {
      await sendGeneralReminderEmail(registration);
    }
    console.log(`✓ Sent to: ${registration.email} (${registration.first_name} ${registration.last_name})`);
    return { success: true };
  } catch (error) {
    console.error(`✗ Failed to send to ${registration.email}:`, error.message);
    return { success: false, error: error.message };
  }
}

// Main function
async function main() {
  const args = process.argv.slice(2);

  // Parse command line arguments
  const isDryRun = args.includes('--dry-run');
  const isListSessions = args.includes('--list-sessions');
  const sessionName = args.find(arg => !arg.startsWith('--'));

  console.log('='.repeat(60));
  console.log('Event Reminder Email Sender');
  console.log('='.repeat(60));
  console.log();

  await initializeDatabase();

  // List sessions mode
  if (isListSessions) {
    const sessions = getAllSessions();
    console.log('Available Sessions:');
    console.log('-'.repeat(60));
    sessions.forEach((session, index) => {
      console.log(`${index + 1}. ${session}`);
    });
    console.log();
    console.log('Total sessions:', sessions.length);
    process.exit(0);
  }

  // Get registrations
  const registrations = getRegistrations(sessionName);

  if (registrations.length === 0) {
    console.log('No registrations found' + (sessionName ? ` for session: ${sessionName}` : ''));
    process.exit(0);
  }

  // Display summary
  console.log('Summary:');
  console.log('-'.repeat(60));
  if (sessionName) {
    console.log(`Session: ${sessionName}`);
  } else {
    console.log('Sending to ALL registrations');
  }
  console.log(`Total recipients: ${registrations.length}`);
  console.log(`General registrations: ${registrations.filter(r => r.type === 'general').length}`);
  console.log(`Member registrations: ${registrations.filter(r => r.type === 'member').length}`);
  console.log(`Mode: ${isDryRun ? 'DRY RUN (no emails will be sent)' : 'LIVE (emails will be sent)'}`);
  console.log('-'.repeat(60));
  console.log();

  // Confirmation prompt (skip in dry-run mode)
  if (!isDryRun) {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise(resolve => {
      readline.question('Are you sure you want to send reminder emails? (yes/no): ', resolve);
    });
    readline.close();

    if (answer.toLowerCase() !== 'yes') {
      console.log('\nCancelled. No emails sent.');
      process.exit(0);
    }
    console.log();
  }

  // Send reminders
  console.log('Sending reminders...');
  console.log('-'.repeat(60));

  const results = {
    total: registrations.length,
    success: 0,
    failed: 0,
    errors: []
  };

  for (const registration of registrations) {
    const result = await sendReminder(registration, isDryRun);

    if (result.success) {
      results.success++;
    } else {
      results.failed++;
      results.errors.push({
        email: registration.email,
        error: result.error
      });
    }

    // Add small delay between emails to avoid overwhelming the SMTP server
    if (!isDryRun) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Final summary
  console.log();
  console.log('='.repeat(60));
  console.log('Final Results:');
  console.log('-'.repeat(60));
  console.log(`Total: ${results.total}`);
  console.log(`Successful: ${results.success}`);
  console.log(`Failed: ${results.failed}`);

  if (results.errors.length > 0) {
    console.log();
    console.log('Errors:');
    results.errors.forEach(err => {
      console.log(`  - ${err.email}: ${err.error}`);
    });
  }

  console.log('='.repeat(60));

  if (isDryRun) {
    console.log('\nDRY RUN completed. No actual emails were sent.');
    console.log('Remove --dry-run flag to send emails for real.');
  }
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
