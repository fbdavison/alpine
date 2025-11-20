// Load .env file if it exists (for local development)
// In production, use server environment variables instead
const dotenv = require('dotenv');
const fs = require('fs');
if (fs.existsSync('.env')) {
  dotenv.config();
  console.log('✓ Loaded environment variables from .env file');
} else {
  console.log('✓ Using server environment variables (no .env file found)');
}

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const initSqlJs = require('sql.js');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_CHILD_LIMIT = 450;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Admin credentials (in production, use a proper user database)
const ADMIN_USERS = {
  'admin': 'admin123' // username: password
};

// Email configuration
// Configure via environment variables (either .env file or server environment variables)
// Required variables: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
const emailConfig = {
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
};

// Validate email configuration
if (!emailConfig.host || !emailConfig.auth.user || !emailConfig.auth.pass) {
  console.warn('⚠️  Warning: Email configuration incomplete. Set SMTP_HOST, SMTP_USER, and SMTP_PASS environment variables.');
  console.warn('   Email notifications will not work until these are configured.');
} else {
  console.log('✓ Email configuration loaded:', emailConfig.host, 'as', emailConfig.auth.user);
}

const emailTransporter = nodemailer.createTransport(emailConfig);

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

  const generalCount = (generalResult.length > 0 && generalResult[0].values.length > 0)
    ? (generalResult[0].values[0][0] || 0)
    : 0;

  // Count children from member registrations
  const memberResult = db.exec(`
    SELECT SUM(num_children) as total
    FROM member_registrations
    WHERE session = ?
  `, [session]);

  const memberCount = (memberResult.length > 0 && memberResult[0].values.length > 0)
    ? (memberResult[0].values[0][0] || 0)
    : 0;

  totalChildren = generalCount + memberCount;

  console.log(`🔍 getSessionChildCount("${session}"): general=${generalCount}, member=${memberCount}, total=${totalChildren}`);

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
      ).join('<br>')
    : 'None';

  const mailOptions = {
    from: process.env.SMTP_USER || 'your-email@example.com',
    to: registrationData.email,
    subject: 'Alpine Village 2025 Registration Confirmation',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <img src="cid:logo" alt="Alpine Village Logo" style="max-width: 200px; height: auto;">
        </div>

        <p>Hi ${registrationData.first_name},</p>

        <p>You have reserved the following tickets for Alpine Village 2025 at Trinity Baptist Church.</p>

        <p><strong>Session:</strong> ${registrationData.session}</p>
        <p><strong>Adult/older children (6th grade +) tickets:</strong> ${registrationData.num_adults}</p>
        <p><strong>Children (up to 5th grade) tickets:</strong> ${registrationData.num_children}</p>

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
      path: __dirname + '/public/images/AV Logo.png',
      cid: 'logo'
    }]
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
      ).join('<br>')
    : 'None';

  const mailOptions = {
    from: process.env.SMTP_USER || 'your-email@example.com',
    to: registrationData.email,
    subject: 'Alpine Village 2025 Registration Confirmation',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <img src="cid:logo" alt="Alpine Village Logo" style="max-width: 200px; height: auto;">
        </div>

        <p>Hi ${registrationData.first_name},</p>

        <p>You have reserved the following tickets for Alpine Village 2025 at Trinity Baptist Church.</p>

        <p><strong>Session:</strong> ${registrationData.session}</p>
        <p><strong>Adult/older children (6th grade +) tickets:</strong> ${registrationData.num_adults}</p>
        <p><strong>Children (up to 5th grade) tickets:</strong> ${registrationData.num_children}</p>

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
      path: __dirname + '/public/images/AV Logo.png',
      cid: 'logo'
    }]
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

// Reminder email function
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
      path: __dirname + '/public/images/AV Logo.png',
      cid: 'logo'
    }]
  };

  try {
    await emailTransporter.sendMail(mailOptions);
    console.log('Reminder email sent successfully to:', registrationData.email);
    return true;
  } catch (error) {
    console.error('Error sending reminder email:', error);
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

// API endpoint to get all sessions including inactive ones for admin
app.get('/api/sessions/all-with-inactive', authenticateToken, (req, res) => {
  try {
    const query = 'SELECT name, is_active, type, child_limit FROM sessions ORDER BY display_order';
    const result = db.exec(query);

    if (result.length > 0 && result[0].values.length > 0) {
      const sessions = result[0].values.map(row => {
        const sessionName = row[0];
        const isActive = row[1];
        const childCount = getSessionChildCount(sessionName);
        const limit = row[3] || SESSION_CHILD_LIMIT;

        return {
          name: sessionName,
          is_active: isActive === 1,
          type: row[2],
          childCount: childCount,
          available: childCount < limit,
          spotsRemaining: limit - childCount,
          limit: limit
        };
      });

      res.json({
        success: true,
        sessions: sessions
      });
    } else {
      res.json({
        success: true,
        sessions: []
      });
    }
  } catch (err) {
    console.error('Error fetching all sessions with inactive:', err);
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

    console.log('📊 Sessions query result:', {
      hasResults: result.length > 0,
      rowCount: result[0]?.values?.length || 0
    });

    if (result.length === 0 || result[0].values.length === 0) {
      console.log('⚠️ No sessions found in database');
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

      console.log(`📋 Session "${session.name}": ${session.currentChildCount} children, ${session.spotsRemaining} spots remaining`);

      return session;
    });

    console.log(`✅ Returning ${sessions.length} sessions to client`);

    // Prevent browser caching of session data
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.json({ success: true, sessions });
  } catch (err) {
    console.error('❌ Error fetching sessions:', err);
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

// Update registration (admin only)
app.put('/api/admin/registrations/:type/:id', authenticateToken, (req, res) => {
  const { type, id } = req.params;
  const {
    first_name, last_name, email, phone, street_address, city, state, zip,
    num_adults, num_children, children_details, comments, request_church_info,
    session, member_first_name, member_last_name
  } = req.body;

  // Validate type
  if (!['general', 'member'].includes(type)) {
    return res.status(400).json({ success: false, message: 'Invalid registration type' });
  }

  try {
    const tableName = type === 'general' ? 'general_registrations' : 'member_registrations';

    // Check if registration exists
    const checkResult = db.exec(`SELECT * FROM ${tableName} WHERE id = ?`, [parseInt(id)]);
    if (checkResult.length === 0 || checkResult[0].values.length === 0) {
      return res.status(404).json({ success: false, message: 'Registration not found' });
    }

    // Build update query based on type
    if (type === 'general') {
      db.run(`UPDATE general_registrations SET
        first_name = ?, last_name = ?, email = ?, phone = ?,
        street_address = ?, city = ?, state = ?, zip = ?,
        num_adults = ?, num_children = ?, children_details = ?,
        comments = ?, request_church_info = ?, session = ?
        WHERE id = ?`,
        [first_name, last_name, email, phone, street_address, city, state, zip,
         num_adults, num_children, children_details || '', comments || '',
         request_church_info ? 1 : 0, session, parseInt(id)]
      );
    } else {
      db.run(`UPDATE member_registrations SET
        member_first_name = ?, member_last_name = ?,
        first_name = ?, last_name = ?, email = ?, phone = ?,
        street_address = ?, city = ?, state = ?, zip = ?,
        num_adults = ?, num_children = ?, children_details = ?,
        comments = ?, request_church_info = ?, session = ?
        WHERE id = ?`,
        [member_first_name, member_last_name, first_name, last_name, email, phone,
         street_address, city, state, zip, num_adults, num_children,
         children_details || '', comments || '', request_church_info ? 1 : 0,
         session, parseInt(id)]
      );
    }

    saveDatabase();
    res.json({ success: true, message: 'Registration updated successfully' });
  } catch (err) {
    console.error('Error updating registration:', err);
    res.status(500).json({ success: false, message: 'Failed to update registration' });
  }
});

// Bulk delete all registrations (admin only)
app.delete('/api/admin/registrations/bulk/all', authenticateToken, (req, res) => {
  try {
    // Get counts before deletion
    const generalCount = db.exec('SELECT COUNT(*) as count FROM general_registrations');
    const memberCount = db.exec('SELECT COUNT(*) as count FROM member_registrations');

    const generalDeleted = generalCount[0]?.values[0]?.[0] || 0;
    const memberDeleted = memberCount[0]?.values[0]?.[0] || 0;
    const totalDeleted = generalDeleted + memberDeleted;

    // Delete all registrations from both tables
    db.run('DELETE FROM general_registrations');
    db.run('DELETE FROM member_registrations');
    saveDatabase();

    res.json({
      success: true,
      message: `Successfully deleted ${totalDeleted} registrations (${generalDeleted} general, ${memberDeleted} member)`,
      deleted: totalDeleted
    });
  } catch (err) {
    console.error('Error bulk deleting all registrations:', err);
    res.status(500).json({ success: false, message: 'Failed to delete registrations' });
  }
});

// Bulk delete registrations by type (admin only)
app.delete('/api/admin/registrations/bulk/:type', authenticateToken, (req, res) => {
  const { type } = req.params;

  // Validate type
  if (!['general', 'member'].includes(type)) {
    return res.status(400).json({ success: false, message: 'Invalid registration type. Use "general" or "member"' });
  }

  try {
    const tableName = type === 'general' ? 'general_registrations' : 'member_registrations';

    // Get count before deletion
    const countResult = db.exec(`SELECT COUNT(*) as count FROM ${tableName}`);
    const deletedCount = countResult[0]?.values[0]?.[0] || 0;

    // Delete all registrations of this type
    db.run(`DELETE FROM ${tableName}`);
    saveDatabase();

    res.json({
      success: true,
      message: `Successfully deleted ${deletedCount} ${type} registrations`,
      deleted: deletedCount
    });
  } catch (err) {
    console.error(`Error bulk deleting ${type} registrations:`, err);
    res.status(500).json({ success: false, message: 'Failed to delete registrations' });
  }
});

// Bulk delete registrations by session (admin only)
app.delete('/api/admin/registrations/bulk/session/:sessionName', authenticateToken, (req, res) => {
  const { sessionName } = req.params;

  try {
    // Get counts before deletion
    const generalResult = db.exec('SELECT COUNT(*) as count FROM general_registrations WHERE session = ?', [sessionName]);
    const memberResult = db.exec('SELECT COUNT(*) as count FROM member_registrations WHERE session = ?', [sessionName]);

    const generalDeleted = generalResult[0]?.values[0]?.[0] || 0;
    const memberDeleted = memberResult[0]?.values[0]?.[0] || 0;
    const totalDeleted = generalDeleted + memberDeleted;

    // Delete registrations for this session
    db.run('DELETE FROM general_registrations WHERE session = ?', [sessionName]);
    db.run('DELETE FROM member_registrations WHERE session = ?', [sessionName]);
    saveDatabase();

    res.json({
      success: true,
      message: `Successfully deleted ${totalDeleted} registrations for session "${sessionName}" (${generalDeleted} general, ${memberDeleted} member)`,
      deleted: totalDeleted
    });
  } catch (err) {
    console.error('Error bulk deleting registrations by session:', err);
    res.status(500).json({ success: false, message: 'Failed to delete registrations' });
  }
});

// Delete registration (admin only)
app.delete('/api/admin/registrations/:type/:id', authenticateToken, (req, res) => {
  const { type, id } = req.params;

  // Validate type
  if (!['general', 'member'].includes(type)) {
    return res.status(400).json({ success: false, message: 'Invalid registration type' });
  }

  try {
    const tableName = type === 'general' ? 'general_registrations' : 'member_registrations';

    // Check if registration exists
    const checkResult = db.exec(`SELECT * FROM ${tableName} WHERE id = ?`, [parseInt(id)]);
    if (checkResult.length === 0 || checkResult[0].values.length === 0) {
      return res.status(404).json({ success: false, message: 'Registration not found' });
    }

    // Delete the registration
    db.run(`DELETE FROM ${tableName} WHERE id = ?`, [parseInt(id)]);
    saveDatabase();

    res.json({ success: true, message: 'Registration deleted successfully' });
  } catch (err) {
    console.error('Error deleting registration:', err);
    res.status(500).json({ success: false, message: 'Failed to delete registration' });
  }
});

// Debug endpoint to check session name mismatches
app.get('/api/admin/debug/session-names', authenticateToken, (req, res) => {
  try {
    // Get all session names from sessions table
    const sessionsResult = db.exec('SELECT name FROM sessions ORDER BY name');
    const sessionNames = sessionsResult[0]?.values.map(row => row[0]) || [];

    // Get unique session names from general registrations
    const generalResult = db.exec('SELECT DISTINCT session FROM general_registrations ORDER BY session');
    const generalSessions = generalResult[0]?.values.map(row => row[0]) || [];

    // Get unique session names from member registrations
    const memberResult = db.exec('SELECT DISTINCT session FROM member_registrations ORDER BY session');
    const memberSessions = memberResult[0]?.values.map(row => row[0]) || [];

    // Get counts for each
    const generalCountResult = db.exec('SELECT COUNT(*) as count FROM general_registrations');
    const memberCountResult = db.exec('SELECT COUNT(*) as count FROM member_registrations');

    const generalTotal = generalCountResult[0]?.values[0]?.[0] || 0;
    const memberTotal = memberCountResult[0]?.values[0]?.[0] || 0;

    res.json({
      success: true,
      debug: {
        sessionNames: sessionNames,
        generalRegistrationSessions: generalSessions,
        memberRegistrationSessions: memberSessions,
        totalGeneralRegistrations: generalTotal,
        totalMemberRegistrations: memberTotal,
        sessionCount: sessionNames.length,
        generalSessionCount: generalSessions.length,
        memberSessionCount: memberSessions.length
      }
    });
  } catch (err) {
    console.error('Error in debug endpoint:', err);
    res.status(500).json({ success: false, message: 'Debug query failed' });
  }
});

// Start server
initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});
