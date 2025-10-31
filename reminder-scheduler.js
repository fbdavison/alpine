/**
 * reminder-scheduler.js
 *
 * Automated scheduler to send reminder emails 2 days before each session
 */

const cron = require('node-cron');
const nodemailer = require('nodemailer');

// Email configuration (shared with server.js)
const emailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'your-email@example.com',
    pass: process.env.SMTP_PASS || 'your-password'
  }
});

// Reference to the database (will be set by initScheduler)
let db = null;
let saveDatabase = null;

/**
 * Send reminder email for general registration
 */
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
        <p>This is a friendly reminder about your upcoming event in <strong>2 days</strong>!</p>

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

/**
 * Send reminder email for member registration
 */
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
        <p>This is a friendly reminder about your upcoming event in <strong>2 days</strong>!</p>

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

/**
 * Check if a reminder has already been sent
 */
function hasReminderBeenSent(sessionName, registrationId, registrationType) {
  const result = db.exec(`
    SELECT COUNT(*) as count FROM reminder_emails_sent
    WHERE session_name = ? AND registration_id = ? AND registration_type = ?
  `, [sessionName, registrationId, registrationType]);

  return result[0]?.values[0]?.[0] > 0;
}

/**
 * Record that a reminder was sent
 */
function recordReminderSent(sessionName, registrationId, registrationType, email) {
  try {
    db.run(`
      INSERT INTO reminder_emails_sent (session_name, registration_id, registration_type, email)
      VALUES (?, ?, ?, ?)
    `, [sessionName, registrationId, registrationType, email]);
    saveDatabase();
  } catch (err) {
    // Ignore duplicate errors (UNIQUE constraint)
    if (!err.message.includes('UNIQUE constraint')) {
      throw err;
    }
  }
}

/**
 * Get sessions that are exactly 2 days away
 */
function getSessionsIn2Days() {
  // Calculate date 2 days from now
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 2);
  targetDate.setHours(0, 0, 0, 0);

  const nextDay = new Date(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);

  // Format dates for comparison (YYYY-MM-DD)
  const targetDateStr = targetDate.toISOString().split('T')[0];
  const nextDayStr = nextDay.toISOString().split('T')[0];

  console.log(`[Reminder Scheduler] Looking for sessions on ${targetDateStr}`);

  // Get active sessions with dates in the target range
  const result = db.exec(`
    SELECT * FROM sessions
    WHERE is_active = 1
    AND session_date IS NOT NULL
    AND date(session_date) >= ?
    AND date(session_date) < ?
  `, [targetDateStr, nextDayStr]);

  if (result.length === 0 || result[0].values.length === 0) {
    return [];
  }

  const columns = result[0].columns;
  return result[0].values.map(row => {
    const session = {};
    columns.forEach((col, idx) => {
      session[col] = row[idx];
    });
    return session;
  });
}

/**
 * Get all registrations for a specific session
 */
function getRegistrationsForSession(sessionName) {
  const registrations = [];

  // Get general registrations
  const generalResult = db.exec(`
    SELECT * FROM general_registrations WHERE session = ?
  `, [sessionName]);

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
  const memberResult = db.exec(`
    SELECT * FROM member_registrations WHERE session = ?
  `, [sessionName]);

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

/**
 * Process reminders for a specific session
 */
async function processSessionReminders(session) {
  console.log(`\n[Reminder Scheduler] Processing session: ${session.name}`);

  const registrations = getRegistrationsForSession(session.name);
  console.log(`[Reminder Scheduler] Found ${registrations.length} registrations`);

  let sent = 0;
  let skipped = 0;
  let errors = 0;

  for (const registration of registrations) {
    try {
      // Check if reminder already sent
      if (hasReminderBeenSent(session.name, registration.id, registration.type)) {
        console.log(`[Reminder Scheduler] Skipping ${registration.email} - already sent`);
        skipped++;
        continue;
      }

      // Send reminder email
      if (registration.type === 'member') {
        await sendMemberReminderEmail(registration);
      } else {
        await sendGeneralReminderEmail(registration);
      }

      // Record that reminder was sent
      recordReminderSent(session.name, registration.id, registration.type, registration.email);

      console.log(`[Reminder Scheduler] ✓ Sent to: ${registration.email}`);
      sent++;

      // Small delay to avoid overwhelming SMTP server
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error(`[Reminder Scheduler] ✗ Failed to send to ${registration.email}:`, error.message);
      errors++;
    }
  }

  console.log(`[Reminder Scheduler] Summary: ${sent} sent, ${skipped} skipped, ${errors} errors`);
}

/**
 * Main scheduled task - runs daily
 */
async function checkAndSendReminders() {
  console.log('\n' + '='.repeat(60));
  console.log(`[Reminder Scheduler] Running at ${new Date().toISOString()}`);
  console.log('='.repeat(60));

  try {
    const sessions = getSessionsIn2Days();

    if (sessions.length === 0) {
      console.log('[Reminder Scheduler] No sessions found in 2 days');
      return;
    }

    console.log(`[Reminder Scheduler] Found ${sessions.length} session(s) in 2 days`);

    for (const session of sessions) {
      await processSessionReminders(session);
    }

    console.log('\n[Reminder Scheduler] Completed successfully');
  } catch (error) {
    console.error('[Reminder Scheduler] Error:', error);
  }

  console.log('='.repeat(60));
}

/**
 * Initialize the scheduler
 */
function initScheduler(database, saveDatabaseFunc) {
  db = database;
  saveDatabase = saveDatabaseFunc;

  // Schedule to run every day at 9:00 AM
  // Cron format: second minute hour day month weekday
  // 0 9 * * * = At 9:00 AM every day
  const cronSchedule = '0 9 * * *';

  console.log(`[Reminder Scheduler] Initializing scheduler to run at 9:00 AM daily`);

  cron.schedule(cronSchedule, async () => {
    await checkAndSendReminders();
  });

  console.log('[Reminder Scheduler] Scheduler started successfully');

  // For testing: run immediately on startup (comment out in production)
  // setTimeout(() => checkAndSendReminders(), 5000);
}

/**
 * Manual trigger for testing (can be called from console)
 */
async function runNow(database, saveDatabaseFunc) {
  db = database;
  saveDatabase = saveDatabaseFunc;
  await checkAndSendReminders();
}

module.exports = {
  initScheduler,
  runNow,
  checkAndSendReminders
};
