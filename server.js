require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3000;
const SESSION_CHILD_LIMIT = 450;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Admin credentials (in production, use a proper user database)
const ADMIN_USERS = {
  'admin': 'admin123' // username: password
};

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

  db.run(`CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,
    child_limit INTEGER NOT NULL DEFAULT 450,
    is_active INTEGER DEFAULT 1,
    display_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Initialize default sessions if table is empty
  const sessionCheck = db.exec('SELECT COUNT(*) as count FROM sessions');
  const sessionCount = sessionCheck[0]?.values[0]?.[0] || 0;

  if (sessionCount === 0) {
    console.log('Initializing default sessions...');

    // Member-only session
    db.run(`INSERT INTO sessions (name, type, child_limit, display_order) VALUES (?, ?, ?, ?)`,
      ['Wednesday December 10, 2025 6:00-8:30p (Friends & Family)', 'member', 450, 1]);

    // General sessions (available to both)
    const generalSessions = [
      'Thursday December 11, 2025 6:00-8:30p',
      'Friday December 12, 2025 6:00-8:30p',
      'Saturday December 13, 2025 2:00-4:30p',
      'Saturday December 13, 2025 6:00-8:30p',
      'Sunday December 14, 2025 2:00-4:30p',
      'Sunday December 14, 2025 6:00-8:30p'
    ];

    generalSessions.forEach((session, idx) => {
      db.run(`INSERT INTO sessions (name, type, child_limit, display_order) VALUES (?, ?, ?, ?)`,
        [session, 'both', 450, idx + 2]);
    });
  }

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

// Get session info from database
function getSessionInfo(sessionName) {
  const result = db.exec(`SELECT * FROM sessions WHERE name = ? AND is_active = 1`, [sessionName]);
  if (result.length > 0 && result[0].values.length > 0) {
    const columns = result[0].columns;
    const values = result[0].values[0];
    const session = {};
    columns.forEach((col, idx) => {
      session[col] = values[idx];
    });
    return session;
  }
  return null;
}

// Check if a session is still available (under the child limit)
function isSessionAvailable(sessionName) {
  const sessionInfo = getSessionInfo(sessionName);
  if (!sessionInfo) return false;

  const currentCount = getSessionChildCount(sessionName);
  return currentCount < sessionInfo.child_limit;
}

// Get session limit
function getSessionLimit(sessionName) {
  const sessionInfo = getSessionInfo(sessionName);
  return sessionInfo ? sessionInfo.child_limit : SESSION_CHILD_LIMIT;
}

// Get all sessions with their current child counts
function getAllSessionsWithCounts(sessionList) {
  return sessionList.map(sessionName => {
    const sessionInfo = getSessionInfo(sessionName);
    const childCount = getSessionChildCount(sessionName);
    const limit = sessionInfo ? sessionInfo.child_limit : SESSION_CHILD_LIMIT;

    return {
      session: sessionName,
      childCount: childCount,
      available: childCount < limit,
      spotsRemaining: limit - childCount,
      limit: limit
    };
  });
}

// Get sessions from database
function getSessionsFromDB(type) {
  let query = 'SELECT name FROM sessions WHERE is_active = 1';
  const params = [];

  if (type === 'general') {
    query += ' AND (type = ? OR type = ?)';
    params.push('general', 'both');
  } else if (type === 'member') {
    query += ' AND (type = ? OR type = ?)';
    params.push('member', 'both');
  }

  query += ' ORDER BY display_order';

  const result = db.exec(query, params);
  if (result.length > 0 && result[0].values.length > 0) {
    return result[0].values.map(row => row[0]);
  }
  return [];
}

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

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Invalid or expired token.' });
    }
    req.user = user;
    next();
  });
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/home', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/sessions', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'sessions.html'));
});

app.get('/general', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'general.html'));
});

app.get('/member', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'member.html'));
});

// Login endpoint
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password required' });
  }

  // Check credentials
  if (ADMIN_USERS[username] && ADMIN_USERS[username] === password) {
    // Generate JWT token
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ success: true, token, message: 'Login successful' });
  } else {
    res.status(401).json({ success: false, message: 'Invalid username or password' });
  }
});

// API endpoint to get reservations by session (protected)
app.get('/api/reservations', authenticateToken, (req, res) => {
  const { session } = req.query;

  if (!session) {
    return res.status(400).json({ success: false, message: 'Session parameter required' });
  }

  try {
    let reservations = [];

    // Get general registrations
    const generalResult = db.exec(`
      SELECT * FROM general_registrations
      WHERE session = ?
      ORDER BY created_at DESC
    `, [session]);

    if (generalResult.length > 0 && generalResult[0].values.length > 0) {
      const columns = generalResult[0].columns;
      generalResult[0].values.forEach(row => {
        const reservation = {};
        columns.forEach((col, idx) => {
          reservation[col] = row[idx];
        });
        reservation.type = 'general';
        reservations.push(reservation);
      });
    }

    // Get member registrations
    const memberResult = db.exec(`
      SELECT * FROM member_registrations
      WHERE session = ?
      ORDER BY created_at DESC
    `, [session]);

    if (memberResult.length > 0 && memberResult[0].values.length > 0) {
      const columns = memberResult[0].columns;
      memberResult[0].values.forEach(row => {
        const reservation = {};
        columns.forEach((col, idx) => {
          reservation[col] = row[idx];
        });
        reservation.type = 'member';
        reservations.push(reservation);
      });
    }

    // Calculate stats
    const totalRegistrations = reservations.length;
    const totalAdults = reservations.reduce((sum, r) => sum + (r.num_adults || 0), 0);
    const totalChildren = reservations.reduce((sum, r) => sum + (r.num_children || 0), 0);
    const sessionLimit = getSessionLimit(session);
    const spotsRemaining = sessionLimit - totalChildren;

    res.json({
      success: true,
      reservations,
      stats: {
        totalRegistrations,
        totalAdults,
        totalChildren,
        spotsRemaining,
        limit: sessionLimit
      }
    });
  } catch (err) {
    console.error('Error fetching reservations:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch reservations' });
  }
});

// API endpoint to get available general sessions
app.get('/api/sessions/general', (req, res) => {
  try {
    const sessionNames = getSessionsFromDB('general');
    const sessionsWithCounts = getAllSessionsWithCounts(sessionNames);
    const availableSessions = sessionsWithCounts.filter(s => s.available);
    res.json({
      success: true,
      sessions: availableSessions
    });
  } catch (err) {
    console.error('Error fetching general sessions:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch sessions' });
  }
});

// API endpoint to get available member sessions
app.get('/api/sessions/member', (req, res) => {
  try {
    const sessionNames = getSessionsFromDB('member');
    const sessionsWithCounts = getAllSessionsWithCounts(sessionNames);
    const availableSessions = sessionsWithCounts.filter(s => s.available);
    res.json({
      success: true,
      sessions: availableSessions
    });
  } catch (err) {
    console.error('Error fetching member sessions:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch sessions' });
  }
});

// API endpoint to get all sessions for admin (including full ones)
app.get('/api/sessions/all', authenticateToken, (req, res) => {
  try {
    const sessionNames = getSessionsFromDB('all');
    const sessionsWithCounts = getAllSessionsWithCounts(sessionNames);
    res.json({
      success: true,
      sessions: sessionsWithCounts
    });
  } catch (err) {
    console.error('Error fetching all sessions:', err);
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
    // Validate session exists and is active
    const sessionInfo = getSessionInfo(session);
    if (!sessionInfo) {
      return res.status(400).json({
        success: false,
        message: 'Invalid session selected'
      });
    }

    // Check if this session is available for general registration
    const generalSessions = getSessionsFromDB('general');
    if (!generalSessions.includes(session)) {
      return res.status(400).json({
        success: false,
        message: 'This session is not available for general registration'
      });
    }

    // Check if session would exceed child limit
    const currentChildCount = getSessionChildCount(session);
    const newChildCount = parseInt(num_children) || 0;
    const sessionLimit = sessionInfo.child_limit;

    if (currentChildCount + newChildCount > sessionLimit) {
      const spotsRemaining = sessionLimit - currentChildCount;
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
    // Validate session exists and is active
    const sessionInfo = getSessionInfo(session);
    if (!sessionInfo) {
      return res.status(400).json({
        success: false,
        message: 'Invalid session selected'
      });
    }

    // Check if this session is available for member registration
    const memberSessions = getSessionsFromDB('member');
    if (!memberSessions.includes(session)) {
      return res.status(400).json({
        success: false,
        message: 'This session is not available for member registration'
      });
    }

    // Check if session would exceed child limit
    const currentChildCount = getSessionChildCount(session);
    const newChildCount = parseInt(num_children) || 0;
    const sessionLimit = sessionInfo.child_limit;

    if (currentChildCount + newChildCount > sessionLimit) {
      const spotsRemaining = sessionLimit - currentChildCount;
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

// Session management API endpoints (protected)

// Get all sessions (including inactive)
app.get('/api/admin/sessions', authenticateToken, (req, res) => {
  try {
    const result = db.exec('SELECT * FROM sessions ORDER BY display_order, created_at');

    if (result.length === 0 || result[0].values.length === 0) {
      return res.json({ success: true, sessions: [] });
    }

    const columns = result[0].columns;
    const sessions = result[0].values.map(row => {
      const session = {};
      columns.forEach((col, idx) => {
        session[col] = row[idx];
      });
      // Add current child count
      session.currentChildCount = getSessionChildCount(session.name);
      session.spotsRemaining = session.child_limit - session.currentChildCount;
      return session;
    });

    res.json({ success: true, sessions });
  } catch (err) {
    console.error('Error fetching sessions:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch sessions' });
  }
});

// Create new session
app.post('/api/admin/sessions', authenticateToken, (req, res) => {
  const { name, type, child_limit, display_order } = req.body;

  if (!name || !type || !child_limit) {
    return res.status(400).json({
      success: false,
      message: 'Name, type, and child_limit are required'
    });
  }

  if (!['member', 'both'].includes(type)) {
    return res.status(400).json({
      success: false,
      message: 'Type must be member (Friends and Family) or both (General Session)'
    });
  }

  try {
    db.run(`INSERT INTO sessions (name, type, child_limit, display_order) VALUES (?, ?, ?, ?)`,
      [name, type, parseInt(child_limit), parseInt(display_order) || 0]);

    saveDatabase();
    res.json({ success: true, message: 'Session created successfully' });
  } catch (err) {
    console.error('Error creating session:', err);
    if (err.message && err.message.includes('UNIQUE constraint')) {
      res.status(400).json({ success: false, message: 'A session with this name already exists' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to create session' });
    }
  }
});

// Update session
app.put('/api/admin/sessions/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { name, type, child_limit, is_active, display_order } = req.body;

  if (!name || !type || child_limit === undefined) {
    return res.status(400).json({
      success: false,
      message: 'Name, type, and child_limit are required'
    });
  }

  if (!['member', 'both'].includes(type)) {
    return res.status(400).json({
      success: false,
      message: 'Type must be member (Friends and Family) or both (General Session)'
    });
  }

  try {
    db.run(`UPDATE sessions SET name = ?, type = ?, child_limit = ?, is_active = ?, display_order = ? WHERE id = ?`,
      [name, type, parseInt(child_limit), is_active ? 1 : 0, parseInt(display_order) || 0, parseInt(id)]);

    saveDatabase();
    res.json({ success: true, message: 'Session updated successfully' });
  } catch (err) {
    console.error('Error updating session:', err);
    if (err.message && err.message.includes('UNIQUE constraint')) {
      res.status(400).json({ success: false, message: 'A session with this name already exists' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to update session' });
    }
  }
});

// Delete session (soft delete - mark as inactive)
app.delete('/api/admin/sessions/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  try {
    // Check if there are registrations for this session
    const sessionResult = db.exec('SELECT name FROM sessions WHERE id = ?', [parseInt(id)]);

    if (sessionResult.length === 0 || sessionResult[0].values.length === 0) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    const sessionName = sessionResult[0].values[0][0];
    const registrationCount = getSessionChildCount(sessionName);

    if (registrationCount > 0) {
      // Has registrations, just deactivate
      db.run('UPDATE sessions SET is_active = 0 WHERE id = ?', [parseInt(id)]);
      saveDatabase();
      return res.json({
        success: true,
        message: 'Session deactivated (has existing registrations)',
        deactivated: true
      });
    } else {
      // No registrations, safe to delete
      db.run('DELETE FROM sessions WHERE id = ?', [parseInt(id)]);
      saveDatabase();
      return res.json({
        success: true,
        message: 'Session deleted successfully',
        deleted: true
      });
    }
  } catch (err) {
    console.error('Error deleting session:', err);
    res.status(500).json({ success: false, message: 'Failed to delete session' });
  }
});

// Start server
initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});
