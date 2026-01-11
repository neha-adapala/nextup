# Quick Setup Guide for B-001: Login Screen

## Prerequisites Checklist

- [ ] Node.js v18+ installed
- [ ] MongoDB installed and running (or MongoDB Atlas account)
- [ ] Google Cloud Console account
- [ ] Microsoft Azure account

## Step-by-Step Setup

### 1. Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend (in a new terminal)
cd frontend
npm install
```

### 2. MongoDB Setup

**Option A: Local MongoDB**
```bash
# Make sure MongoDB is running
mongod
```

**Option B: MongoDB Atlas**
- Create account at https://www.mongodb.com/cloud/atlas
- Create a free cluster
- Get connection string (format: `mongodb+srv://username:password@cluster.mongodb.net/between-classes`)

### 3. Backend Environment Setup

Create `backend/.env` file:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/between-classes
# OR for Atlas: mongodb+srv://username:password@cluster.mongodb.net/between-classes

SESSION_SECRET=generate-a-random-secret-key-here
JWT_SECRET=generate-another-random-secret-key-here

# Google OAuth - see step 4
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

# Microsoft OAuth - see step 5
MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret
MICROSOFT_CALLBACK_URL=http://localhost:5000/api/auth/microsoft/callback

# Frontend URL
FRONTEND_URL=http://localhost:5173
```

**Generate secrets:**
```bash
# On Mac/Linux
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Or use any random string generator
```

### 4. Google OAuth Setup

1. Go to https://console.cloud.google.com/
2. Create a new project or select existing one
3. Enable APIs:
   - Navigate to "APIs & Services" → "Library"
   - Enable: "Google+ API" (for basic profile)
   - Enable: "Gmail API" (for email access)
   - Enable: "Google Calendar API" (for calendar access)
4. Create OAuth Credentials:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth client ID"
   - Choose "Web application"
   - Name: "Between Classes"
   - Authorized redirect URIs:
     - `http://localhost:5000/api/auth/google/callback`
5. Copy Client ID and Client Secret to `backend/.env`

### 5. Microsoft OAuth Setup

1. Go to https://portal.azure.com/
2. Navigate to "Azure Active Directory" → "App registrations"
3. Click "New registration"
   - Name: "Between Classes"
   - Supported account types: "Accounts in any organizational directory and personal Microsoft accounts"
   - Redirect URI:
     - Platform: Web
     - URI: `http://localhost:5000/api/auth/microsoft/callback`
4. After registration, note the Application (client) ID
5. Create Client Secret:
   - Go to "Certificates & secrets"
   - Click "New client secret"
   - Description: "Between Classes Secret"
   - Expires: 24 months (or your preference)
   - Copy the Value (you won't see it again!)
6. Configure API Permissions:
   - Go to "API permissions"
   - Click "Add a permission" → "Microsoft Graph" → "Delegated permissions"
   - Add:
     - `User.Read` (for profile)
     - `Calendars.Read` (for calendar access)
     - `Mail.Read` (for email access)
   - Click "Grant admin consent" (if you're an admin)
7. Copy Application (client) ID and Client Secret to `backend/.env`

### 6. Start the Application

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

You should see:
```
MongoDB connected successfully
Server running on port 5000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

You should see:
```
  VITE v5.0.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
```

### 7. Test the Login

1. Open http://localhost:5173 in your browser
2. You should see the "Between Classes" login screen
3. Click "Continue with Google" or "Continue with Microsoft"
4. Complete OAuth flow
5. You should be redirected to the dashboard after successful login

## Troubleshooting

### MongoDB Connection Error
- Make sure MongoDB is running: `mongod` or check MongoDB service
- For Atlas: Check connection string and IP whitelist

### OAuth Error: "Login failed. Please try again."
- Check that redirect URIs match exactly in OAuth provider settings
- Verify CLIENT_ID and CLIENT_SECRET are correct in `.env`
- Check backend console for specific error messages
- Ensure OAuth scopes are correctly configured

### CORS Error
- Verify `FRONTEND_URL` in `backend/.env` matches your frontend URL
- Check that `credentials: true` is set in CORS config

### Microsoft OAuth Not Working
- Ensure redirect URI is exactly: `http://localhost:5000/api/auth/microsoft/callback`
- Check that required API permissions are granted
- Verify client secret hasn't expired

## What's Implemented (B-001)

✅ Login Screen (S-001) with app name and login buttons  
✅ Google OAuth authentication (F-001)  
✅ Microsoft OAuth authentication (F-001)  
✅ Error handling with "Login failed. Please try again." message  
✅ JWT token-based session management  
✅ Redirect to dashboard after successful login  
✅ User model with email, name, and provider information  

## Next Build Step

Ready to proceed with **B-002**: Connect email and calendar (F-002, F-003)

