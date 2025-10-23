// Add test data for Friends & Family Session
// Usage: node add-test-data.js

const fs = require('fs');
const initSqlJs = require('sql.js');

const dbPath = './registrations.db';

async function addTestData() {
  const SQL = await initSqlJs();

  if (!fs.existsSync(dbPath)) {
    console.error('Database file not found:', dbPath);
    process.exit(1);
  }

  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  const session = 'Wednesday December 10, 2025 6:00-8:30p (Friends & Family)';

  // Test data: Member registrations
  const testRegistrations = [
    {
      member_first_name: 'John',
      member_last_name: 'Smith',
      first_name: 'Emily',
      last_name: 'Johnson',
      email: 'emily.johnson@example.com',
      phone: '555-0101',
      street_address: '123 Main St',
      city: 'Springfield',
      state: 'IL',
      zip: '62701',
      num_adults: 2,
      num_children: 3,
      children_details: JSON.stringify([
        { name: 'Sophie Johnson', age: '8' },
        { name: 'Lucas Johnson', age: '6' },
        { name: 'Emma Johnson', age: '4' }
      ]),
      comments: 'Looking forward to the event!',
      request_church_info: 1
    },
    {
      member_first_name: 'Sarah',
      member_last_name: 'Williams',
      first_name: 'Michael',
      last_name: 'Davis',
      email: 'michael.davis@example.com',
      phone: '555-0102',
      street_address: '456 Oak Ave',
      city: 'Springfield',
      state: 'IL',
      zip: '62702',
      num_adults: 2,
      num_children: 2,
      children_details: JSON.stringify([
        { name: 'Olivia Davis', age: '7' },
        { name: 'Noah Davis', age: '5' }
      ]),
      comments: '',
      request_church_info: 0
    },
    {
      member_first_name: 'Robert',
      member_last_name: 'Brown',
      first_name: 'Jessica',
      last_name: 'Martinez',
      email: 'jessica.martinez@example.com',
      phone: '555-0103',
      street_address: '789 Pine Rd',
      city: 'Springfield',
      state: 'IL',
      zip: '62703',
      num_adults: 3,
      num_children: 4,
      children_details: JSON.stringify([
        { name: 'Ava Martinez', age: '9' },
        { name: 'Liam Martinez', age: '7' },
        { name: 'Mia Martinez', age: '5' },
        { name: 'Ethan Martinez', age: '3' }
      ]),
      comments: 'We have dietary restrictions - no nuts please.',
      request_church_info: 1
    },
    {
      member_first_name: 'David',
      member_last_name: 'Wilson',
      first_name: 'Amanda',
      last_name: 'Anderson',
      email: 'amanda.anderson@example.com',
      phone: '555-0104',
      street_address: '321 Elm St',
      city: 'Springfield',
      state: 'IL',
      zip: '62704',
      num_adults: 2,
      num_children: 1,
      children_details: JSON.stringify([
        { name: 'Isabella Anderson', age: '6' }
      ]),
      comments: '',
      request_church_info: 0
    },
    {
      member_first_name: 'Jennifer',
      member_last_name: 'Taylor',
      first_name: 'Christopher',
      last_name: 'Thomas',
      email: 'chris.thomas@example.com',
      phone: '555-0105',
      street_address: '654 Maple Dr',
      city: 'Springfield',
      state: 'IL',
      zip: '62705',
      num_adults: 4,
      num_children: 5,
      children_details: JSON.stringify([
        { name: 'James Thomas', age: '10' },
        { name: 'Charlotte Thomas', age: '8' },
        { name: 'Benjamin Thomas', age: '6' },
        { name: 'Amelia Thomas', age: '4' },
        { name: 'Mason Thomas', age: '2' }
      ]),
      comments: 'Excited to bring the whole family!',
      request_church_info: 1
    },
    {
      member_first_name: 'Richard',
      member_last_name: 'Moore',
      first_name: 'Lisa',
      last_name: 'Jackson',
      email: 'lisa.jackson@example.com',
      phone: '555-0106',
      street_address: '987 Cedar Ln',
      city: 'Springfield',
      state: 'IL',
      zip: '62706',
      num_adults: 2,
      num_children: 2,
      children_details: JSON.stringify([
        { name: 'Harper Jackson', age: '9' },
        { name: 'Elijah Jackson', age: '7' }
      ]),
      comments: 'Is parking available?',
      request_church_info: 0
    },
    {
      member_first_name: 'Patricia',
      member_last_name: 'White',
      first_name: 'Daniel',
      last_name: 'Harris',
      email: 'daniel.harris@example.com',
      phone: '555-0107',
      street_address: '147 Birch St',
      city: 'Springfield',
      state: 'IL',
      zip: '62707',
      num_adults: 2,
      num_children: 3,
      children_details: JSON.stringify([
        { name: 'Evelyn Harris', age: '8' },
        { name: 'Alexander Harris', age: '6' },
        { name: 'Abigail Harris', age: '4' }
      ]),
      comments: 'Thank you for organizing this event!',
      request_church_info: 1
    },
    {
      member_first_name: 'James',
      member_last_name: 'Martin',
      first_name: 'Mary',
      last_name: 'Thompson',
      email: 'mary.thompson@example.com',
      phone: '555-0108',
      street_address: '258 Spruce Ave',
      city: 'Springfield',
      state: 'IL',
      zip: '62708',
      num_adults: 2,
      num_children: 1,
      children_details: JSON.stringify([
        { name: 'Sofia Thompson', age: '5' }
      ]),
      comments: '',
      request_church_info: 0
    }
  ];

  console.log(`Adding ${testRegistrations.length} test registrations for "${session}"...\n`);

  let totalChildren = 0;
  let insertedCount = 0;

  try {
    testRegistrations.forEach((reg, index) => {
      db.run(`INSERT INTO member_registrations
        (member_first_name, member_last_name, first_name, last_name, email, phone,
         street_address, city, state, zip, num_adults, num_children, children_details,
         comments, request_church_info, session)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          reg.member_first_name,
          reg.member_last_name,
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

      totalChildren += reg.num_children;
      insertedCount++;
      console.log(`✓ Added registration ${index + 1}: ${reg.first_name} ${reg.last_name} (${reg.num_children} children)`);
    });

    // Save database
    const data = db.export();
    const bufferOut = Buffer.from(data);
    fs.writeFileSync(dbPath, bufferOut);

    console.log(`\n✓ Successfully added ${insertedCount} registrations with ${totalChildren} total children`);
    console.log(`\nSession: ${session}`);
    console.log(`Total Registrations: ${insertedCount}`);
    console.log(`Total Adults: ${testRegistrations.reduce((sum, r) => sum + r.num_adults, 0)}`);
    console.log(`Total Children: ${totalChildren}`);

  } catch (error) {
    console.error('Error inserting test data:', error);
    process.exit(1);
  }

  db.close();
}

addTestData();
