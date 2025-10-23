require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');
const nodemailer = require('nodemailer');

const app = express();
const PORT = 3000;
const SESSION_CHILD_LIMIT = 450;

// Email configuration
// NOTE: Configure these environment variables or update with your SMTP settings
const emailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || 'your-email@example.com',
    pass: process.env.SMTP_PASS || 'your-password'
  }
});

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));

let db;
const dbPath = './registrations.db';

// Initialize SQLite Database
async function initializeDatabase() {
  const SQL = await initSqlJs();
  
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Create tables
  db.run(`CREATE TABLE IF NOT EXISTS general_registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    street_address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    zip TEXT NOT NULL,
    num_adults INTEGER NOT NULL,
    num_children INTEGER NOT NULL,
    children_details TEXT,
    comments TEXT,
    request_church_info INTEGER DEFAULT 0,
    session TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS member_registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_first_name TEXT NOT NULL,
    member_last_name TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    street_address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    zip TEXT NOT NULL,
    num_adults INTEGER NOT NULL,
    num_children INTEGER NOT NULL,
    children_details TEXT,
    comments TEXT,
    request_church_info INTEGER DEFAULT 0,
    session TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  saveDatabase();
  console.log('Database initialized successfully');
}

// Save database to file
function saveDatabase() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

// Get total children count for a specific session
function getSessionChildCount(session) {
  let totalChildren = 0;

  // Count children from general registrations
  const generalResult = db.exec(`
    SELECT SUM(num_children) as total
    FROM general_registrations
    WHERE session = ?
  `, [session]);

  if (generalResult.length > 0 && generalResult[0].values.length > 0) {
    totalChildren += generalResult[0].values[0][0] || 0;
  }

  // Count children from member registrations
  const memberResult = db.exec(`
    SELECT SUM(num_children) as total
    FROM member_registrations
    WHERE session = ?
  `, [session]);

  if (memberResult.length > 0 && memberResult[0].values.length > 0) {
    totalChildren += memberResult[0].values[0][0] || 0;
  }

  return totalChildren;
}

// Check if a session is still available (under the child limit)
function isSessionAvailable(session) {
  const currentCount = getSessionChildCount(session);
  return currentCount < SESSION_CHILD_LIMIT;
}

// Get all sessions with their current child counts
function getAllSessionsWithCounts(sessionList) {
  return sessionList.map(session => ({
    session,
    childCount: getSessionChildCount(session),
    available: isSessionAvailable(session),
    spotsRemaining: SESSION_CHILD_LIMIT - getSessionChildCount(session)
  }));
}

// Define all available sessions
const GENERAL_SESSIONS = [
  'Thursday December 11, 2025 6:00-8:30p',
  'Friday December 12, 2025 6:00-8:30p',
  'Saturday December 13, 2025 2:00-4:30p',
  'Saturday December 13, 2025 6:00-8:30p',
  'Sunday December 14, 2025 2:00-4:30p',
  'Sunday December 14, 2025 6:00-8:30p'
];

const MEMBER_SESSIONS = [
  'Wednesday December 10, 2025 6:00-8:30p (Friends & Family)',
  ...GENERAL_SESSIONS
];

// Email sending functions
async function sendGeneralRegistrationEmail(registrationData) {
  const childrenList = registrationData.children_details
    ? JSON.parse(registrationData.children_details).map((child, index) =>
        `${index + 1}. ${child.name} (Age: ${child.age})`
      ).join('\n        ')
    : 'None';

  const mailOptions = {
    from: process.env.SMTP_USER || 'your-email@example.com',
    to: registrationData.email,
    subject: 'Registration Confirmation - Event Registration',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #667eea;">Registration Confirmation</h2>
        <p>Dear ${registrationData.first_name} ${registrationData.last_name},</p>
        <p>Thank you for registering for our event. Your registration has been confirmed.</p>

        <h3 style="color: #764ba2;">Registration Details:</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Name:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${registrationData.first_name} ${registrationData.last_name}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Email:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${registrationData.email}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Phone:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${registrationData.phone}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Address:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${registrationData.street_address}, ${registrationData.city}, ${registrationData.state} ${registrationData.zip}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Session:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${registrationData.session}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Number of Adults:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${registrationData.num_adults}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Number of Children:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${registrationData.num_children}</td>
          </tr>
          ${registrationData.num_children > 0 ? `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;" valign="top"><strong>Children:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><pre style="margin: 0; font-family: Arial, sans-serif;">${childrenList}</pre></td>
          </tr>
          ` : ''}
          ${registrationData.comments ? `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;" valign="top"><strong>Comments:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${registrationData.comments}</td>
          </tr>
          ` : ''}
        </table>

        <p style="margin-top: 20px;">We look forward to seeing you at the event!</p>
        <p>If you have any questions, please don't hesitate to contact us.</p>

        <p style="color: #666; font-size: 12px; margin-top: 30px;">This is an automated confirmation email. Please do not reply to this message.</p>
      </div>
    `
  };

  try {
    await emailTransporter.sendMail(mailOptions);
    console.log('Email sent successfully to:', registrationData.email);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

async function sendMemberRegistrationEmail(registrationData) {
  const childrenList = registrationData.children_details
    ? JSON.parse(registrationData.children_details).map((child, index) =>
        `${index + 1}. ${child.name} (Age: ${child.age})`
      ).join('\n        ')
    : 'None';

  const mailOptions = {
    from: process.env.SMTP_USER || 'your-email@example.com',
    to: registrationData.email,
    subject: 'Registration Confirmation - Member + Guest Registration',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f093fb;">Member + Guest Registration Confirmation</h2>
        <p>Dear ${registrationData.first_name} ${registrationData.last_name},</p>
        <p>Thank you for registering for our event. Your registration has been confirmed.</p>

        <h3 style="color: #f5576c;">Registration Details:</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Member Name:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${registrationData.member_first_name} ${registrationData.member_last_name}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Guest Name:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${registrationData.first_name} ${registrationData.last_name}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Email:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${registrationData.email}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Phone:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${registrationData.phone}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Address:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${registrationData.street_address}, ${registrationData.city}, ${registrationData.state} ${registrationData.zip}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Session:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${registrationData.session}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Number of Adults:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${registrationData.num_adults}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Number of Children:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${registrationData.num_children}</td>
          </tr>
          ${registrationData.num_children > 0 ? `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;" valign="top"><strong>Children:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;"><pre style="margin: 0; font-family: Arial, sans-serif;">${childrenList}</pre></td>
          </tr>
          ` : ''}
          ${registrationData.comments ? `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;" valign="top"><strong>Comments:</strong></td>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${registrationData.comments}</td>
          </tr>
          ` : ''}
        </table>

        <p style="margin-top: 20px;">We look forward to seeing you at the event!</p>
        <p>If you have any questions, please don't hesitate to contact us.</p>

        <p style="color: #666; font-size: 12px; margin-top: 30px;">This is an automated confirmation email. Please do not reply to this message.</p>
      </div>
    `
  };

  try {
    await emailTransporter.sendMail(mailOptions);
    console.log('Email sent successfully to:', registrationData.email);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/general', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'general.html'));
});

app.get('/member', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'member.html'));
});

// API endpoint to get available general sessions
app.get('/api/sessions/general', (req, res) => {
  try {
    const sessionsWithCounts = getAllSessionsWithCounts(GENERAL_SESSIONS);
    const availableSessions = sessionsWithCounts.filter(s => s.available);
    res.json({
      success: true,
      sessions: availableSessions,
      limit: SESSION_CHILD_LIMIT
    });
  } catch (err) {
    console.error('Error fetching general sessions:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch sessions' });
  }
});

// API endpoint to get available member sessions
app.get('/api/sessions/member', (req, res) => {
  try {
    const sessionsWithCounts = getAllSessionsWithCounts(MEMBER_SESSIONS);
    const availableSessions = sessionsWithCounts.filter(s => s.available);
    res.json({
      success: true,
      sessions: availableSessions,
      limit: SESSION_CHILD_LIMIT
    });
  } catch (err) {
    console.error('Error fetching member sessions:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch sessions' });
  }
});

// Handle general registration form submission
app.post('/api/register/general', async (req, res) => {
  const {
    first_name, last_name, email, phone, street_address, city, state, zip,
    num_adults, num_children, children_details, comments, request_church_info, session
  } = req.body;

  try {
    // Validate session exists
    if (!GENERAL_SESSIONS.includes(session)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid session selected'
      });
    }

    // Check if session would exceed child limit
    const currentChildCount = getSessionChildCount(session);
    const newChildCount = parseInt(num_children) || 0;

    if (currentChildCount + newChildCount > SESSION_CHILD_LIMIT) {
      const spotsRemaining = SESSION_CHILD_LIMIT - currentChildCount;
      return res.status(400).json({
        success: false,
        message: `This session has reached its capacity. Only ${spotsRemaining} child spots remaining, but you are trying to register ${newChildCount} children.`
      });
    }

    db.run(`INSERT INTO general_registrations
      (first_name, last_name, email, phone, street_address, city, state, zip,
       num_adults, num_children, children_details, comments, request_church_info, session)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [first_name, last_name, email, phone, street_address, city, state, zip,
       num_adults, num_children, children_details || '', comments || '',
       request_church_info ? 1 : 0, session]
    );

    saveDatabase();

    // Send confirmation email
    await sendGeneralRegistrationEmail({
      first_name,
      last_name,
      email,
      phone,
      street_address,
      city,
      state,
      zip,
      num_adults,
      num_children,
      children_details,
      comments,
      session
    });

    res.json({ success: true, message: 'Registration successful!' });
  } catch (err) {
    console.error('Error inserting general registration:', err);
    res.status(500).json({ success: false, message: 'Registration failed' });
  }
});

// Handle member registration form submission
app.post('/api/register/member', async (req, res) => {
  const {
    member_first_name, member_last_name, first_name, last_name, email, phone,
    street_address, city, state, zip, num_adults, num_children, children_details,
    comments, request_church_info, session
  } = req.body;

  try {
    // Validate session exists
    if (!MEMBER_SESSIONS.includes(session)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid session selected'
      });
    }

    // Check if session would exceed child limit
    const currentChildCount = getSessionChildCount(session);
    const newChildCount = parseInt(num_children) || 0;

    if (currentChildCount + newChildCount > SESSION_CHILD_LIMIT) {
      const spotsRemaining = SESSION_CHILD_LIMIT - currentChildCount;
      return res.status(400).json({
        success: false,
        message: `This session has reached its capacity. Only ${spotsRemaining} child spots remaining, but you are trying to register ${newChildCount} children.`
      });
    }

    db.run(`INSERT INTO member_registrations
      (member_first_name, member_last_name, first_name, last_name, email, phone,
       street_address, city, state, zip, num_adults, num_children, children_details,
       comments, request_church_info, session)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [member_first_name, member_last_name, first_name, last_name, email, phone,
       street_address, city, state, zip, num_adults, num_children,
       children_details || '', comments || '', request_church_info ? 1 : 0, session]
    );

    saveDatabase();

    // Send confirmation email
    await sendMemberRegistrationEmail({
      member_first_name,
      member_last_name,
      first_name,
      last_name,
      email,
      phone,
      street_address,
      city,
      state,
      zip,
      num_adults,
      num_children,
      children_details,
      comments,
      session
    });

    res.json({ success: true, message: 'Registration successful!' });
  } catch (err) {
    console.error('Error inserting member registration:', err);
    res.status(500).json({ success: false, message: 'Registration failed' });
  }
});

// Start server
initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});
