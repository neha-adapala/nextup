# Port Changed from 5000 to 5001

## Why?
Port 5000 is used by macOS Control Center (ControlCe), so we switched to port 5001.

## ✅ Code Updated
- `server.js` - Default port changed to 5001
- `config/passport.js` - Default callback URLs updated to use port 5001

## ⚠️ Update Your .env File

Update your `backend/.env` file with these new values:

```env
PORT=5001

# Update the callback URL to use port 5001
GOOGLE_CALLBACK_URL=http://localhost:5001/api/auth/google/callback

# Microsoft callback (if using)
MICROSOFT_CALLBACK_URL=http://localhost:5001/api/auth/microsoft/callback

# Frontend URL stays the same
FRONTEND_URL=http://localhost:5173
```

## 🔑 Important: Update Google Cloud Console

You MUST update your Google OAuth redirect URI in Google Cloud Console:

1. Go to: https://console.cloud.google.com/apis/credentials
2. Click your OAuth 2.0 Client ID
3. Under "Authorized redirect URIs", **add**:
   ```
   http://localhost:5001/api/auth/google/callback
   ```
4. You can keep the old 5000 one or remove it
5. Click **Save**

## 🚀 Start Server

```bash
cd backend
npm run dev
```

The server will now run on port 5001.

## ✅ Verify Server Started

```bash
lsof -i:5001
```

Should show your Node process, e.g.:
```
COMMAND   PID        USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
node    87600 nehaadapala  20u  IPv6 ...  TCP *:5001 (LISTEN)
```

## 🛑 Safely Stop Server

```bash
# Find and kill process on port 5001
lsof -ti:5001 | xargs kill -9

# Or stop nodemon with Ctrl+C in the terminal running it
```

## 🔍 Check What's Running

```bash
# Check port 5001
lsof -i:5001

# Should show your Node server, or nothing if stopped
```

