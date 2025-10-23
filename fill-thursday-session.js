// Add test data to fill Thursday session to capacity (450 children)
// Usage: node fill-thursday-session.js

const fs = require('fs');
const initSqlJs = require('sql.js');

const dbPath = './registrations.db';

async function fillThursdaySession() {
  const SQL = await initSqlJs();

  if (!fs.existsSync(dbPath)) {
    console.error('Database file not found:', dbPath);
    process.exit(1);
  }

  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  const session = 'Thursday December 11, 2025 6:00-8:30p';
  const targetChildren = 450;

  // Check current count
  const countResult = db.exec(`
    SELECT SUM(num_children) as total
    FROM general_registrations
    WHERE session = ?
  `, [session]);

  let currentChildren = 0;
  if (countResult.length > 0 && countResult[0].values.length > 0) {
    currentChildren = countResult[0].values[0][0] || 0;
  }

  const childrenNeeded = targetChildren - currentChildren;

  if (childrenNeeded <= 0) {
    console.log(`Thursday session already has ${currentChildren} children (target: ${targetChildren})`);
    console.log('No additional registrations needed.');
    db.close();
    return;
  }

  console.log(`Current children: ${currentChildren}`);
  console.log(`Target: ${targetChildren}`);
  console.log(`Children needed: ${childrenNeeded}\n`);

  // Generate diverse family sizes to reach exactly 450 children
  const familySizes = [1, 2, 2, 3, 3, 3, 4, 4, 5]; // Average ~3 children per family
  const registrations = [];
  let totalChildren = 0;
  let registrationNum = 1;

  // First names pool
  const firstNames = [
    'Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Ethan', 'Sophia', 'Mason',
    'Isabella', 'William', 'Mia', 'James', 'Charlotte', 'Benjamin', 'Amelia',
    'Lucas', 'Harper', 'Henry', 'Evelyn', 'Alexander', 'Abigail', 'Michael',
    'Emily', 'Daniel', 'Elizabeth', 'Matthew', 'Sofia', 'Jackson', 'Avery',
    'Sebastian', 'Ella', 'Jack', 'Scarlett', 'Aiden', 'Grace', 'Owen',
    'Chloe', 'Samuel', 'Victoria', 'Joseph', 'Riley', 'John', 'Aria',
    'David', 'Lily', 'Wyatt', 'Aubrey', 'Carter', 'Zoey', 'Jayden',
    'Hannah', 'Luke', 'Addison', 'Dylan', 'Ellie', 'Grayson', 'Natalie',
    'Isaac', 'Luna', 'Gabriel', 'Savannah', 'Julian', 'Brooklyn', 'Anthony',
    'Leah', 'Jaxon', 'Zoe', 'Lincoln', 'Penelope', 'Joshua', 'Lillian',
    'Christopher', 'Audrey', 'Andrew', 'Claire', 'Theodore', 'Skylar',
    'Caleb', 'Bella', 'Ryan', 'Paisley', 'Asher', 'Everly', 'Nathan',
    'Anna', 'Thomas', 'Caroline', 'Leo', 'Nova', 'Isaiah', 'Genesis',
    'Charles', 'Emilia', 'Josiah', 'Kennedy', 'Hudson', 'Samantha',
    'Christian', 'Maya', 'Hunter', 'Willow', 'Connor', 'Kinsley', 'Eli'
  ];

  // Last names pool
  const lastNames = [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller',
    'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez',
    'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
    'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark',
    'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King',
    'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores', 'Green',
    'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell',
    'Carter', 'Roberts', 'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz',
    'Parker', 'Cruz', 'Edwards', 'Collins', 'Reyes', 'Stewart', 'Morris',
    'Morales', 'Murphy', 'Cook', 'Rogers', 'Gutierrez', 'Ortiz', 'Morgan',
    'Cooper', 'Peterson', 'Bailey', 'Reed', 'Kelly', 'Howard', 'Ramos',
    'Kim', 'Cox', 'Ward', 'Richardson', 'Watson', 'Brooks', 'Chavez',
    'Wood', 'James', 'Bennett', 'Gray', 'Mendoza', 'Ruiz', 'Hughes',
    'Price', 'Alvarez', 'Castillo', 'Sanders', 'Patel', 'Myers', 'Long'
  ];

  // Children names
  const childNames = [
    'Sophie', 'Lucas', 'Emma', 'Oliver', 'Ava', 'Elijah', 'Charlotte',
    'Mason', 'Amelia', 'Logan', 'Harper', 'Ethan', 'Evelyn', 'Jackson',
    'Abigail', 'Sebastian', 'Emily', 'Aiden', 'Elizabeth', 'Carter',
    'Mila', 'Grayson', 'Ella', 'Jack', 'Avery', 'Wyatt', 'Scarlett',
    'Luke', 'Grace', 'Jayden', 'Chloe', 'Levi', 'Victoria', 'Isaac',
    'Riley', 'Owen', 'Aria', 'Dylan', 'Lily', 'Gabriel', 'Aubrey',
    'Lincoln', 'Zoey', 'Anthony', 'Penelope', 'Joshua', 'Lillian',
    'Andrew', 'Addison', 'Caleb', 'Layla', 'Christopher', 'Natalie',
    'Nolan', 'Bella', 'Hunter', 'Hannah', 'Christian', 'Ellie',
    'Isaiah', 'Paisley', 'Thomas', 'Savannah', 'Aaron', 'Brooklyn',
    'Charles', 'Leah', 'Eli', 'Audrey', 'Landon', 'Claire', 'Jonathan'
  ];

  // Generate registrations
  while (totalChildren < childrenNeeded) {
    const remaining = childrenNeeded - totalChildren;
    let numChildren;

    if (remaining < 5) {
      numChildren = remaining;
    } else {
      numChildren = familySizes[registrationNum % familySizes.length];
    }

    const firstName = firstNames[registrationNum % firstNames.length];
    const lastName = lastNames[Math.floor(registrationNum / 2) % lastNames.length];
    const numAdults = numChildren <= 2 ? 2 : (numChildren <= 4 ? 3 : 4);

    // Generate children details
    const children = [];
    for (let i = 0; i < numChildren; i++) {
      const childName = childNames[(registrationNum * 7 + i) % childNames.length];
      const age = 3 + (i % 8); // Ages 3-10
      children.push({ name: `${childName} ${lastName}`, age: age.toString() });
    }

    const comments = [
      '',
      '',
      '',
      'Looking forward to the event!',
      'Thank you for organizing this!',
      'Do you have parking available?',
      'Excited to attend!',
      'Is there handicap access?',
      'Can we arrive early?',
      'What time should we arrive?'
    ];

    registrations.push({
      first_name: firstName,
      last_name: lastName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${registrationNum}@example.com`,
      phone: `555-${String(1000 + registrationNum).padStart(4, '0')}`,
      street_address: `${100 + registrationNum} ${['Main', 'Oak', 'Pine', 'Elm', 'Maple', 'Cedar', 'Birch', 'Spruce'][registrationNum % 8]} St`,
      city: 'Springfield',
      state: 'IL',
      zip: `627${String(registrationNum % 100).padStart(2, '0')}`,
      num_adults: numAdults,
      num_children: numChildren,
      children_details: JSON.stringify(children),
      comments: comments[registrationNum % comments.length],
      request_church_info: registrationNum % 3 === 0 ? 1 : 0
    });

    totalChildren += numChildren;
    registrationNum++;
  }

  console.log(`Generated ${registrations.length} registrations with ${totalChildren} children\n`);
  console.log('Inserting registrations into database...\n');

  let insertedCount = 0;
  let insertedChildren = 0;

  try {
    registrations.forEach((reg, index) => {
      db.run(`INSERT INTO general_registrations
        (first_name, last_name, email, phone, street_address, city, state, zip,
         num_adults, num_children, children_details, comments, request_church_info, session)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          reg.first_name,
          reg.last_name,
          reg.email,
          reg.phone,
          reg.street_address,
          reg.city,
          reg.state,
          reg.zip,
          reg.num_adults,
          reg.num_children,
          reg.children_details,
          reg.comments,
          reg.request_church_info,
          session
        ]
      );

      insertedChildren += reg.num_children;
      insertedCount++;

      if ((index + 1) % 25 === 0 || index === registrations.length - 1) {
        console.log(`✓ Inserted ${index + 1}/${registrations.length} registrations (${insertedChildren} children)`);
      }
    });

    // Save database
    const data = db.export();
    const bufferOut = Buffer.from(data);
    fs.writeFileSync(dbPath, bufferOut);

    console.log(`\n✓ Successfully filled Thursday session to capacity!`);
    console.log(`\nSession: ${session}`);
    console.log(`Total Registrations: ${insertedCount}`);
    console.log(`Total Adults: ${registrations.reduce((sum, r) => sum + r.num_adults, 0)}`);
    console.log(`Total Children: ${insertedChildren}`);
    console.log(`Session Status: FULL (${insertedChildren}/${targetChildren})`);

  } catch (error) {
    console.error('Error inserting test data:', error);
    process.exit(1);
  }

  db.close();
}

fillThursdaySession();
