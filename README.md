# Event Registration System

A Node.js web application with two registration forms connected to an SQLite database.

## Features

- **General Registration Form**: For public event registration with 6 session options
- **Member + Guest Registration Form**: For members bringing guests, includes Wednesday friends & family session
- **Session Capacity Management**: Automatically limits each session to 450 children and removes full sessions from the dropdown
- **Email Confirmation**: Sends automated confirmation emails to registrants with their full registration details
- Dynamic child information fields based on number of children selected
- SQLite database for storing all registrations
- Clean, responsive UI with gradient themes

## Setup Instructions

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Email Settings**

   Create a `.env` file in the root directory (use `.env.example` as a template):
   ```bash
   cp .env.example .env
   ```

   Then edit `.env` with your SMTP email credentials:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@example.com
   SMTP_PASS=your-app-password
   ```

   **For Gmail Users:**
   - Enable 2-factor authentication on your Google account
   - Generate an "App Password" at https://myaccount.google.com/apppasswords
   - Use the generated app password (not your regular Gmail password)

   **For Other Email Providers:**
   - Office 365: `smtp.office365.com` (Port 587)
   - Yahoo: `smtp.mail.yahoo.com` (Port 587)
   - Outlook: `smtp-mail.outlook.com` (Port 587)

3. **Start the Server**
   ```bash
   npm start
   ```

4. **Access the Application**
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
