import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { fetchEmails } from '../services/gmailService.js';

const router = express.Router();

/**
 * GET /api/email
 * Fetches emails and extracts tasks/deadlines
 * Requires authentication
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = req.user;

    // Only support Google for now (Microsoft implementation can be added later)
    if (user.provider !== 'google') {
      return res.status(400).json({ 
        message: 'Email reading is currently only supported for Google accounts',
        error: 'provider_not_supported'
      });
    }

    if (!user.accessToken) {
      return res.status(401).json({ 
        message: 'No access token found. Please login again.',
        error: 'no_access_token'
      });
    }

    const emails = await fetchEmails(user.accessToken, 100);
    
    // Extract all tasks and deadlines from emails
    const allTasks = [];
    const allDeadlines = [];

    emails.forEach(email => {
      if (email.tasks && email.tasks.length > 0) {
        email.tasks.forEach(task => {
          allTasks.push({
            ...task,
            emailSubject: email.subject,
            emailFrom: email.from,
            emailDate: email.date,
            emailId: email.id
          });
        });
      }

      if (email.deadlines && email.deadlines.length > 0) {
        email.deadlines.forEach(deadline => {
          allDeadlines.push({
            ...deadline,
            emailSubject: email.subject,
            emailFrom: email.from
          });
        });
      }
    });

    res.json({
      success: true,
      emailCount: emails.length,
      tasks: allTasks.slice(0, 20), // Limit to 20 tasks
      deadlines: allDeadlines.slice(0, 10), // Limit to 10 deadlines
      emails: emails.slice(0, 10) // Return first 10 emails for reference
    });
  } catch (error) {
    console.error('Error reading emails:', error);
    
    // Check for specific error types
    if (error.message?.includes('401') || error.message?.includes('invalid_token')) {
      return res.status(401).json({ 
        message: 'Could not read your email. Your session may have expired. Please login again.',
        error: 'invalid_token'
      });
    }

    if (error.message?.includes('403') || error.message?.includes('insufficient_permission')) {
      return res.status(403).json({ 
        message: 'Could not read your email. Gmail access permission is required.',
        error: 'insufficient_permission'
      });
    }

    res.status(500).json({ 
      message: 'Could not read your email.',
      error: error.message || 'unknown_error'
    });
  }
});

export default router;

