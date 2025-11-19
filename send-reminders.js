#!/usr/bin/env node

/**
 * Script to send reminder emails 48 hours before Alpine Village sessions
 * This script should be run daily via a cron job or scheduled task
 *
 * Example cron job (runs daily at 9 AM):
 * 0 9 * * * cd /path/to/alpine && node send-reminders.js
 */

const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

// Load .env file if it exists (for local development)
// In production, use server environment variables instead
const dotenv = require('dotenv');
if (fs.existsSync('.env')) {
  dotenv.config();
  console.log('✓ Loaded environment variables from .env file');
} else {
  console.log('✓ Using server environment variables (no .env file found)');
}

// Database setup
const db = new sqlite3.Database('./registrations.db');

// Email transporter setup
// Configure via environment variables (either .env file or server environment variables)
// Required variables: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
const emailConfig = {
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
};

// Validate email configuration
if (!emailConfig.host || !emailConfig.auth.user || !emailConfig.auth.pass) {
  console.error('❌ Error: Email configuration incomplete. Set SMTP_HOST, SMTP_USER, and SMTP_PASS environment variables.');
  console.error('   Cannot send reminder emails without proper configuration.');
  process.exit(1);
}

console.log('✓ Email configuration loaded:', emailConfig.host, 'as', emailConfig.auth.user);

const emailTransporter = nodemailer.createTransport(emailConfig);

// Send reminder email function
async function sendReminderEmail(registrationData) {
  const mailOptions = {
    from: process.env.SMTP_USER || 'your-email@example.com',
    to: registrationData.email,
    subject: 'Alpine Village 2025 - Reminder for Your Upcoming Session',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <img src="cid:logo" alt="Alpine Village Logo" style="max-width: 200px; height: auto;">
        </div>

        <p>Hi ${registrationData.first_name},</p>

        <p>Trinity is looking forward to having your family attend the 27th year of Alpine Village.</p>

        <p>You have tickets reserved for the session on <strong>${registrationData.session}</strong>. You have <strong>${registrationData.num_adults}</strong> adult/older children (6th grade +) tickets and <strong>${registrationData.num_children}</strong> children tickets reserved.</p>

        <p>Please email <a href="mailto:alpinevillage@trinitybaptistchurch.org">alpinevillage@trinitybaptistchurch.org</a>, if these ticket reservations need to be changed or cancelled. Space is limited for all sessions. When we know about changes and cancellations we can offer unused tickets to others.</p>

        <p>At all sessions we are collecting non-perishable food donations for Brinkley Heights Ministries. These donations are not required to attend, but the opportunity is available for all that want to participate. Specific items requested include: canned meat, canned fruit, canned vegetables, canned beans, mac & cheese, cereal, saltines, and peanut butter. Please do not donate expired items.</p>

        <h3 style="color: #c54545;">Here are a few reminders as you prepare to come to Alpine Village this year:</h3>
        <ul>
          <li>Paper tickets are not required. You will check-in at the registration table when you arrive.</li>
          <li>Doors will open promptly at the start time of the session and all activities will be available until the Village closes at the designed end time. However, the North Pole line will close 15 minutes before the session ends.</li>
          <li>For your safety, our security team will be checking all bags when you enter. Please be assured that our team is well trained and will handle this with the upmost professionalism.</li>
          <li>No strollers are allowed in the Village, except for children with special needs.</li>
          <li>No animals are allowed in the Village. Registered service animals are permitted, with prior notification. Documentation must be presented at the church and verified by the Alpine Village director, prior to attending Alpine Village.</li>
          <li>We recommend, if possible, leaving heavy coats in your car. We do not have the space to store winter gear for our guests. If there is more than one adult in your party, you are welcome to drop off party members under the awning at the door.</li>
        </ul>

        <p>If you have any questions, please contact us at <a href="mailto:alpinevillage@trinitybaptistchurch.org">alpinevillage@trinitybaptistchurch.org</a>.</p>

        <p><strong>Christmas Blessings to all!</strong><br>
        The Alpine Village Team</p>

        <div style="margin-top: 30px; padding: 15px; background-color: #f5f5f5; border-left: 4px solid #c54545;">
          <p style="margin: 0; font-style: italic; color: #666;">
            "And the angel said unto them, Fear not: for, behold, I bring you good tidings of great joy, which shall be to all people. For unto you is born this day in the city of David a Saviour, which is Christ the Lord. And this shall be a sign unto you; Ye shall find the babe wrapped in swaddling clothes, lying in a manger." - Luke 2:10-12
          </p>
        </div>
      </div>
    `,
    attachments: [{
      filename: 'AV Logo.png',
      path: path.join(__dirname, 'public', 'images', 'AV Logo.png'),
      cid: 'logo'
    }]
  };

  try {
    await emailTransporter.sendMail(mailOptions);
    console.log('Reminder email sent successfully to:', registrationData.email);
    return true;
  } catch (error) {
    console.error('Error sending reminder email to', registrationData.email, ':', error);
    return false;
  }
}

// Parse session string to get date/time
function parseSessionDateTime(sessionString) {
  // Example formats:
  // "Friday, Dec. 9th, 6:00 - 8:30 PM"
  // "Thursday, December 12th, 2024 6:00 PM - 8:30 PM"

  // Try to extract date components
  const monthMap = {
    'jan': 0, 'january': 0,
    'feb': 1, 'february': 1,
    'mar': 2, 'march': 2,
    'apr': 3, 'april': 3,
    'may': 4,
    'jun': 5, 'june': 5,
    'jul': 6, 'july': 6,
    'aug': 7, 'august': 7,
    'sep': 8, 'september': 8,
    'oct': 9, 'october': 9,
    'nov': 10, 'november': 10,
    'dec': 11, 'december': 11
  };

  // Extract month
  const monthMatch = sessionString.toLowerCase().match(/(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/);
  if (!monthMatch) return null;

  const month = monthMap[monthMatch[1]];

  // Extract day
  const dayMatch = sessionString.match(/(\d{1,2})(st|nd|rd|th)/);
  if (!dayMatch) return null;
  const day = parseInt(dayMatch[1]);

  // Extract year (default to current year if not found)
  const yearMatch = sessionString.match(/\b(20\d{2})\b/);
  const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();

  // Extract time (assume first time mentioned is the start time)
  const timeMatch = sessionString.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  let hour = 0, minute = 0;

  if (timeMatch) {
    hour = parseInt(timeMatch[1]);
    minute = parseInt(timeMatch[2]);
    const ampm = timeMatch[3].toUpperCase();

    if (ampm === 'PM' && hour !== 12) {
      hour += 12;
    } else if (ampm === 'AM' && hour === 12) {
      hour = 0;
    }
  }

  return new Date(year, month, day, hour, minute);
}

// Main function to send reminders
async function sendReminders() {
  console.log('Starting reminder email process...');
  console.log('Current time:', new Date().toISOString());

  // Calculate the target time (48 hours from now)
  const now = new Date();
  const target48HoursOut = new Date(now.getTime() + (48 * 60 * 60 * 1000));

  // We'll send reminders for sessions that are within a window around 48 hours
  // Window: 46-50 hours from now (4-hour window to account for daily script runs)
  const windowStart = new Date(now.getTime() + (46 * 60 * 60 * 1000));
  const windowEnd = new Date(now.getTime() + (50 * 60 * 60 * 1000));

  console.log('Looking for sessions between:');
  console.log('  Start:', windowStart.toISOString());
  console.log('  End:', windowEnd.toISOString());

  // Get all registrations
  db.all(`
    SELECT * FROM general_registrations
    UNION ALL
    SELECT * FROM member_registrations
  `, [], async (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      db.close();
      process.exit(1);
    }

    let emailsSent = 0;
    let emailsFailed = 0;
    let sessionsSkipped = 0;

    for (const registration of rows) {
      const sessionDate = parseSessionDateTime(registration.session);

      if (!sessionDate) {
        console.log(`Could not parse session date for: ${registration.session}`);
        sessionsSkipped++;
        continue;
      }

      // Check if session is within our 46-50 hour window
      if (sessionDate >= windowStart && sessionDate <= windowEnd) {
        console.log(`\nSending reminder for session: ${registration.session}`);
        console.log(`  To: ${registration.email} (${registration.first_name} ${registration.last_name})`);
        console.log(`  Session date: ${sessionDate.toISOString()}`);

        const success = await sendReminderEmail(registration);
        if (success) {
          emailsSent++;
        } else {
          emailsFailed++;
        }
      }
    }

    console.log('\n=== Reminder Email Summary ===');
    console.log(`Emails sent successfully: ${emailsSent}`);
    console.log(`Emails failed: ${emailsFailed}`);
    console.log(`Sessions skipped (unparseable): ${sessionsSkipped}`);
    console.log('==============================\n');

    db.close();
  });
}

// Run the script
sendReminders().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
