# Event Registration System

A Node.js web application with two registration forms connected to an SQLite database.

## Features

- **General Registration Form**: For public event registration with 6 session options
- **Member + Guest Registration Form**: For members bringing guests, includes Wednesday friends & family session
- Dynamic child information fields based on number of children selected
- SQLite database for storing all registrations
- Clean, responsive UI with gradient themes

## Setup Instructions

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start the Server**
   ```bash
   npm start
   ```

3. **Access the Application**
   Open your browser and go to: `http://localhost:3000`

## Database

The application automatically creates an SQLite database file (`registrations.db`) with two tables:
- `general_registrations` - Stores general registration submissions
- `member_registrations` - Stores member + guest registration submissions

## Forms

### General Registration
Available sessions:
- Thursday December 11, 2025 6:00-8:30p
- Friday December 12, 2025 6:00-8:30p
- Saturday December 13, 2025 2:00-4:30p
- Saturday December 13, 2025 6:00-8:30p
- Sunday December 14, 2025 2:00-4:30p
- Sunday December 14, 2025 6:00-8:30p

### Member + Guest Registration
Includes all general sessions PLUS:
- Wednesday December 10, 2025 6:00-8:30p (Friends & Family)

Additional fields:
- Member First Name
- Member Last Name

## Technologies Used

- Node.js
- Express.js
- SQLite3
- HTML/CSS/JavaScript
