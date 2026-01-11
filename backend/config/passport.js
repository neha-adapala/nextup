import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Ensure .env is loaded (in case it wasn't loaded in server.js yet)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as OAuth2Strategy } from 'passport-oauth2';
import User from '../models/User.js';

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user._id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Google OAuth Strategy (only if credentials are provided)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5001/api/auth/google/callback'
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      let user = await User.findOne({ 
        provider: 'google',
        providerId: profile.id 
      });

      if (user) {
        // Update last login and tokens
        user.lastLoginAt = new Date();
        user.accessToken = accessToken;
        if (refreshToken) user.refreshToken = refreshToken;
        await user.save();
      } else {
        // Create new user
        user = await User.create({
          email: profile.emails[0].value,
          name: profile.displayName || profile.name?.givenName + ' ' + profile.name?.familyName,
          provider: 'google',
          providerId: profile.id,
          accessToken: accessToken,
          refreshToken: refreshToken || null
        });
      }

      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  }));
  console.log('✓ Google OAuth configured successfully');
} else {
  console.warn('⚠️  Google OAuth not configured - GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET required in .env file');
}

// Microsoft OAuth Strategy using OAuth2 (only if credentials are provided)
if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
  passport.use('microsoft', new OAuth2Strategy({
    authorizationURL: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenURL: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    clientID: process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    callbackURL: process.env.MICROSOFT_CALLBACK_URL || 'http://localhost:5001/api/auth/microsoft/callback',
    scope: 'openid profile email User.Read Calendars.Read Mail.Read'
  }, async (accessToken, refreshToken, profile, done) => {
  try {
    // Fetch user profile from Microsoft Graph API (profile from OAuth2 is empty for Microsoft)
    const fetch = (await import('node-fetch')).default;
    const graphResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!graphResponse.ok) {
      const errorText = await graphResponse.text();
      console.error('Microsoft Graph API error:', errorText);
      throw new Error('Failed to fetch user profile from Microsoft Graph');
    }

    const graphProfile = await graphResponse.json();
    const microsoftId = graphProfile.id;
    
    if (!microsoftId) {
      throw new Error('Microsoft ID not found in profile');
    }

    let user = await User.findOne({ 
      provider: 'microsoft',
      providerId: microsoftId
    });

    const email = graphProfile.mail || graphProfile.userPrincipalName || '';
    const name = graphProfile.displayName || `${graphProfile.givenName || ''} ${graphProfile.surname || ''}`.trim() || 'User';

    if (!email) {
      throw new Error('Email not found in Microsoft profile');
    }

    if (user) {
      // Update last login and tokens
      user.lastLoginAt = new Date();
      user.accessToken = accessToken;
      if (refreshToken) user.refreshToken = refreshToken;
      user.name = name;
      await user.save();
    } else {
      // Create new user
      user = await User.create({
        email: email,
        name: name,
        provider: 'microsoft',
        providerId: microsoftId,
        accessToken: accessToken,
        refreshToken: refreshToken || null
      });
    }

    return done(null, user);
  } catch (error) {
    console.error('Microsoft OAuth error:', error);
    return done(error, null);
  }
  }));
} else {
  console.log('Microsoft OAuth not configured - skipping Microsoft login');
}

