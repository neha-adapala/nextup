// Load environment variables FIRST before any other imports
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file from the backend directory
dotenv.config({ path: join(__dirname, '.env') });

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import './config/passport.js';
import authRoutes from './routes/auth.js';
import emailRoutes from './routes/email.js';
import calendarRoutes from './routes/calendar.js';
import taskRoutes from './routes/tasks.js';

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));
app.use(passport.initialize());
app.use(passport.session());

// MongoDB connection
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/between-classes';

// Fix connection string: add database name and handle placeholders
let mongoConnectionString = mongoURI;

// Check if password placeholder exists
if (mongoConnectionString.includes('<db_password>')) {
  console.error('❌ ERROR: MONGODB_URI contains placeholder <db_password>');
  console.error('   Please replace <db_password> with your actual MongoDB password in .env file');
  console.error('   Example: mongodb+srv://nu-user:YOUR_ACTUAL_PASSWORD@nu-backend.zm1mp1k.mongodb.net/between-classes?appName=nu-backend');
}

// Ensure database name is in connection string (before query params)
if (mongoConnectionString.includes('mongodb+srv://')) {
  // For MongoDB Atlas, add database name before query string
  if (mongoConnectionString.includes('/?') || mongoConnectionString.endsWith('/')) {
    mongoConnectionString = mongoConnectionString.replace(/(mongodb\+srv:\/\/[^\/]+)\/?(\?|$)/, '$1/between-classes$2');
  } else if (!mongoConnectionString.match(/\/[^\/?]+\?/) && !mongoConnectionString.match(/\/[^\/?]+$/)) {
    // No database name, add it
    if (mongoConnectionString.includes('?')) {
      mongoConnectionString = mongoConnectionString.replace('?', '/between-classes?');
    } else {
      mongoConnectionString = mongoConnectionString + '/between-classes';
    }
  }
} else if (!mongoConnectionString.includes('/between-classes')) {
  // For local MongoDB
  if (!mongoConnectionString.match(/\/\w+(\?|$)/)) {
    mongoConnectionString = mongoConnectionString.replace(/(mongodb:\/\/[^\/]+)\/?(\?|$)/, '$1/between-classes$2');
  }
}

mongoose.connect(mongoConnectionString, {
  serverSelectionTimeoutMS: 10000, // Timeout after 10s
  socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
  maxPoolSize: 10,
  retryWrites: true,
  w: 'majority'
})
.then(() => {
  console.log('✅ MongoDB connected successfully');
  console.log(`   Database: ${mongoose.connection.name}`);
  console.log(`   Host: ${mongoose.connection.host}:${mongoose.connection.port || 'N/A'}`);
})
.catch((err) => {
  console.error('❌ MongoDB connection error:', err.message);
  if (err.message.includes('buffering timed out') || err.message.includes('timeout')) {
    console.error('');
    console.error('   Troubleshooting steps:');
    console.error('   1. Check MONGODB_URI in .env file');
    console.error('   2. Replace <db_password> with your actual MongoDB password');
    console.error('   3. Ensure database name is in the connection string: /between-classes');
    console.error('   4. For Atlas: Check Network Access → Add your IP address (or use 0.0.0.0/0 for testing)');
    console.error('   5. Verify your MongoDB cluster is running');
    console.error('');
    console.error('   Example correct format:');
    console.error('   mongodb+srv://username:actualpassword@cluster.mongodb.net/between-classes?appName=nu-backend');
  } else if (err.message.includes('authentication failed')) {
    console.error('   → Password is incorrect. Check your .env MONGODB_URI');
  } else if (err.message.includes('ENOTFOUND') || err.message.includes('getaddrinfo')) {
    console.error('   → Cannot reach MongoDB server. Check your connection string and network.');
  }
  // Continue running server, but database operations will fail
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/tasks', taskRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.stack : {}
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

