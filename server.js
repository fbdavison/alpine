const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

const app = express();
const PORT = 3000;

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

// Handle general registration form submission
app.post('/api/register/general', (req, res) => {
  const {
    first_name, last_name, email, phone, street_address, city, state, zip,
    num_adults, num_children, children_details, comments, request_church_info, session
  } = req.body;

  try {
    db.run(`INSERT INTO general_registrations 
      (first_name, last_name, email, phone, street_address, city, state, zip, 
       num_adults, num_children, children_details, comments, request_church_info, session)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [first_name, last_name, email, phone, street_address, city, state, zip,
       num_adults, num_children, children_details || '', comments || '', 
       request_church_info ? 1 : 0, session]
    );

    saveDatabase();
    res.json({ success: true, message: 'Registration successful!' });
  } catch (err) {
    console.error('Error inserting general registration:', err);
    res.status(500).json({ success: false, message: 'Registration failed' });
  }
});

// Handle member registration form submission
app.post('/api/register/member', (req, res) => {
  const {
    member_first_name, member_last_name, first_name, last_name, email, phone, 
    street_address, city, state, zip, num_adults, num_children, children_details, 
    comments, request_church_info, session
  } = req.body;

  try {
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
