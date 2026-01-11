# Between Classes - Productivity App

A MERN stack application that helps students use their free time between classes efficiently by automatically detecting tasks from emails and suggesting activities during breaks.

## Project Structure

```
sb_hacks/
├── backend/          # Express.js backend server
│   ├── config/       # Passport.js authentication config
│   ├── models/       # MongoDB models
│   ├── routes/       # API routes
│   └── server.js     # Express server entry point
└── frontend/         # React frontend application
    ├── src/
    │   ├── pages/    # React page components
    │   ├── context/  # React context providers
    │   └── App.jsx   # Main app component
    └── index.html
```

## Prerequisites

- Node.js (v18 or higher)
- MongoDB (local installation or MongoDB Atlas account)
- Google Cloud Console account (for Google OAuth)
- Microsoft Azure account (for Microsoft OAuth)

## Setup Instructions

### 1. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file in the `backend` directory:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/between-classes
SESSION_SECRET=your-secret-key-here
JWT_SECRET=your-jwt-secret-here

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

# Microsoft OAuth
MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret
MICROSOFT_CALLBACK_URL=http://localhost:5000/api/auth/microsoft/callback

# Frontend URL
FRONTEND_URL=http://localhost:5173
```

### 2. Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API and Gmail API
4. Go to "Credentials" → "Create Credentials" → "OAuth client ID"
5. Choose "Web application"
6. Add authorized redirect URI: `http://localhost:5000/api/auth/google/callback`
7. Copy the Client ID and Client Secret to your `.env` file

### 3. Microsoft OAuth Setup

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to "Azure Active Directory" → "App registrations"
3. Click "New registration"
4. Name your app and set redirect URI: `http://localhost:5000/api/auth/microsoft/callback`
5. Under "API permissions", add:
   - Microsoft Graph → User.Read
   - Microsoft Graph → Calendars.Read
   - Microsoft Graph → Mail.Read
6. Copy the Application (client) ID and create a client secret
7. Add both to your `.env` file

### 4. Frontend Setup

```bash
cd frontend
npm install
```

Create a `.env` file in the `frontend` directory (optional):

```env
VITE_API_URL=http://localhost:5000
```

### 5. Start the Application

Terminal 1 - Backend:
```bash
cd backend
npm run dev
```

Terminal 2 - Frontend:
```bash
cd frontend
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:5000

## Features Implemented (B-001)

✅ **Login Screen (S-001)**
- App name display
- Google login button
- Microsoft login button
- Error handling with "Login failed. Please try again." message

✅ **Sign In Feature (F-001)**
- Google OAuth integration
- Microsoft OAuth integration
- JWT token generation
- User session management
- Redirect to dashboard after successful login

## Next Steps

The following build steps are ready to be implemented:
- B-002: Connect email and calendar (F-002, F-003)
- B-003: Create task list (F-004, D-002)
- B-004: Build dashboard (S-002)
- B-005: Add break reminders (F-005, S-003)
- B-006: Add task completion flow (F-006, S-005, D-004)
- B-007: Add custom tasks (F-007, S-004, D-005)

## Tech Stack

- **Frontend**: React, Vite, React Router
- **Backend**: Node.js, Express.js
- **Database**: MongoDB, Mongoose
- **Authentication**: Passport.js, OAuth2 (Google & Microsoft)
- **Tokens**: JWT (JSON Web Tokens)

## Notes

- Make sure MongoDB is running before starting the backend server
- In production, update the `FRONTEND_URL` and callback URLs to your production domain
- The app requires HTTPS for OAuth callbacks in production (except localhost for development)

