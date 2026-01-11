import express from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { 
      userId: user._id, 
      email: user.email,
      name: user.name 
    },
    process.env.JWT_SECRET || 'your-jwt-secret',
    { expiresIn: '7d' }
  );
};

// Handle authentication callback (shared for both Google and Microsoft)
function handleAuthCallback(req, res) {
  try {
    if (!req.user) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=login_failed`);
    }
    const token = generateToken(req.user);
    const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/callback?token=${token}`;
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('Token generation error:', error);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=login_failed`);
  }
}

// Google OAuth routes (only if configured)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  router.get('/google', 
    passport.authenticate('google', { 
      scope: ['profile', 'email', 'https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/gmail.readonly']
    })
  );

  router.get('/google/callback',
    passport.authenticate('google', { 
      failureRedirect: (process.env.FRONTEND_URL || 'http://localhost:5173') + '/login?error=login_failed',
      session: false
    }),
    handleAuthCallback
  );
} else {
  // Route exists but returns error if Google OAuth not configured
  router.get('/google', (req, res) => {
    res.status(503).json({ 
      message: 'Google OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env file.',
      error: 'oauth_not_configured'
    });
  });
}

// Microsoft OAuth routes (only if configured)
if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
  router.get('/microsoft',
    passport.authenticate('microsoft', {
      scope: ['openid', 'profile', 'email', 'User.Read', 'Calendars.Read', 'Mail.Read']
    })
  );

  // Microsoft callback - handles both GET and POST (Microsoft uses POST for form_post response)
  router.get('/microsoft/callback',
    passport.authenticate('microsoft', { 
      failureRedirect: process.env.FRONTEND_URL + '/login?error=login_failed',
      session: false
    }),
    handleAuthCallback
  );

  router.post('/microsoft/callback',
    passport.authenticate('microsoft', { 
      failureRedirect: process.env.FRONTEND_URL + '/login?error=login_failed',
      session: false
    }),
    handleAuthCallback
  );
}

// Logout route
router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ message: 'Logout failed' });
    }
    res.json({ message: 'Logged out successfully' });
  });
});

// Get available auth providers
router.get('/providers', (req, res) => {
  const providers = {
    google: !!process.env.GOOGLE_CLIENT_ID,
    microsoft: !!(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET)
  };
  res.json(providers);
});

// Verify token route
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret');
    
    // Fetch user from database to get updated completedTasksCount
    const User = (await import('../models/User.js')).default;
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ message: 'User not found', valid: false });
    }
    
    res.json({ 
      valid: true, 
      user: {
        userId: user._id,
        email: user.email,
        name: user.name,
        completedTasksCount: user.completedTasksCount || 0
      }
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token', valid: false });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired', valid: false });
    }
    console.error('Verify token error:', error);
    res.status(500).json({ message: 'Error verifying token', valid: false });
  }
});

export default router;

