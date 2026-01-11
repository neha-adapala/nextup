# Next Steps - Google OAuth Setup (Skip Microsoft)

You already have:
✅ MongoDB connection string configured
✅ Backend code structure ready

## Step 1: Complete Backend .env File

Update your `backend/.env` file with these required values:

```env
# You already have this:
MONGODB_CONNECTION_STRING=mongodb+srv://nu-user:<db_password>@nu-backend.zm1mp1k.mongodb.net/?appName=nu-backend

# Add these:
PORT=5000
MONGODB_URI=mongodb+srv://nu-user:<db_password>@nu-backend.zm1mp1k.mongodb.net/between-classes?appName=nu-backend
SESSION_SECRET=generate-a-random-secret-here
JWT_SECRET=generate-another-random-secret-here

# Google OAuth (REQUIRED)
GOOGLE_CLIENT_ID=your-google-client-id-here
GOOGLE_CLIENT_SECRET=your-google-client-secret-here
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

# Microsoft OAuth (OPTIONAL - leave empty to skip)
# MICROSOFT_CLIENT_ID=
# MICROSOFT_CLIENT_SECRET=
# MICROSOFT_CALLBACK_URL=http://localhost:5000/api/auth/microsoft/callback

# Frontend URL
FRONTEND_URL=http://localhost:5173
```

**Note:** Replace `<db_password>` in your MongoDB URI with your actual password.

**Generate secrets:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Run this twice to get two different secrets for SESSION_SECRET and JWT_SECRET.

## Step 2: Set Up Google OAuth

### 2.1 Go to Google Cloud Console
1. Visit: https://console.cloud.google.com/
2. Sign in with your Google account

### 2.2 Create or Select Project
1. Click the project dropdown at the top
2. Either select an existing project OR click "New Project"
3. If creating new: Name it "Between Classes" → Click "Create"

### 2.3 Enable Required APIs
1. Navigate to **"APIs & Services"** → **"Library"** (left sidebar)
2. Search for and enable these APIs (click on each, then click "Enable"):
   - **Google+ API** (or "Google Identity" - for basic profile)
   - **Gmail API** (for reading emails)
   - **Google Calendar API** (for reading calendar)

### 2.4 Create OAuth 2.0 Credentials
1. Go to **"APIs & Services"** → **"Credentials"** (left sidebar)
2. Click **"+ CREATE CREDENTIALS"** → Select **"OAuth client ID"**
3. If prompted, configure OAuth consent screen first:
   - User Type: **External** (unless you have Google Workspace)
   - App name: **Between Classes**
   - User support email: Your email
   - Developer contact: Your email
   - Click **"Save and Continue"**
   - Scopes: Click **"Add or Remove Scopes"** → Add:
     - `.../auth/userinfo.email`
     - `.../auth/userinfo.profile`
     - `https://www.googleapis.com/auth/gmail.readonly`
     - `https://www.googleapis.com/auth/calendar`
   - Click **"Save and Continue"**
   - Test users: Add your email if needed
   - Click **"Back to Dashboard"**

4. Now create OAuth Client ID:
   - Application type: **Web application**
   - Name: **Between Classes Web Client**
   - **Authorized redirect URIs** → Click **"+ ADD URI"**:
     ```
     http://localhost:5000/api/auth/google/callback
     ```
   - Click **"CREATE"**

5. **Copy the credentials:**
   - **Client ID** → Paste to `GOOGLE_CLIENT_ID` in `.env`
   - **Client secret** → Paste to `GOOGLE_CLIENT_SECRET` in `.env`
   - ⚠️ **Important:** The client secret is only shown once! Copy it now.

## Step 3: Install Dependencies

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies (new terminal)
cd frontend
npm install
```

## Step 4: Start the Application

### Terminal 1 - Backend:
```bash
cd backend
npm run dev
```

You should see:
```
MongoDB connected successfully
Server running on port 5000
```

### Terminal 2 - Frontend:
```bash
cd frontend
npm run dev
```

You should see:
```
  VITE v5.0.x  ready in xxx ms
  ➜  Local:   http://localhost:5173/
```

## Step 5: Test Login

1. Open browser: **http://localhost:5173**
2. You should see the "Between Classes" login screen
3. You'll only see the **Google** button (Microsoft is hidden if not configured)
4. Click **"Continue with Google"**
5. Sign in with your Google account
6. Grant permissions (Calendar, Gmail)
7. You should be redirected to the dashboard

## Troubleshooting

### "MongoDB connection error"
- Check your password in `MONGODB_URI` (replace `<db_password>`)
- Ensure your IP is whitelisted in MongoDB Atlas (Network Access → Add IP Address → "Allow Access from Anywhere" for development)

### "Login failed. Please try again."
- Check that `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correct in `.env`
- Verify redirect URI is exactly: `http://localhost:5000/api/auth/google/callback`
- Check backend console for specific error messages
- Make sure OAuth consent screen is configured

### "redirect_uri_mismatch"
- Go back to Google Cloud Console → Credentials
- Check that the Authorized redirect URI matches exactly: `http://localhost:5000/api/auth/google/callback`
- No trailing slash, must be http (not https) for localhost

### CORS Error
- Verify `FRONTEND_URL=http://localhost:5173` in backend `.env`
- Check that backend is running on port 5000

## What's Working Now

✅ Google OAuth login  
✅ User creation and authentication  
✅ JWT token management  
✅ Redirect to dashboard after login  
✅ Microsoft button hidden (since not configured)  
✅ MongoDB connection  

## Ready for Next Build Steps

Once login works, you're ready for:
- **B-002**: Connect email and calendar (F-002, F-003)
- **B-003**: Create task list (F-004, D-002)
- **B-004**: Build dashboard (S-002)

