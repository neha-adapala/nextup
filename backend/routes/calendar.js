import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { fetchCalendarEvents, findFreeTimeSlots, getNextBreak } from '../services/calendarService.js';

const router = express.Router();

/**
 * GET /api/calendar/events
 * Fetches calendar events for the next week
 * Requires authentication
 */
router.get('/events', authenticateToken, async (req, res) => {
  try {
    const user = req.user;

    // Only support Google for now (Microsoft implementation can be added later)
    if (user.provider !== 'google') {
      return res.status(400).json({ 
        message: 'Calendar reading is currently only supported for Google accounts',
        error: 'provider_not_supported'
      });
    }

    if (!user.accessToken) {
      return res.status(401).json({ 
        message: 'No access token found. Please login again.',
        error: 'no_access_token'
      });
    }

    const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date();
    const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const events = await fetchCalendarEvents(user.accessToken, startDate, endDate);

    res.json({
      success: true,
      eventCount: events.length,
      events: events
    });
  } catch (error) {
    console.error('Error reading calendar:', error);
    
    // Check for specific error types
    if (error.message?.includes('401') || error.message?.includes('invalid_token')) {
      return res.status(401).json({ 
        message: 'Could not read your calendar. Your session may have expired. Please login again.',
        error: 'invalid_token'
      });
    }

    if (error.message?.includes('403') || error.message?.includes('insufficient_permission')) {
      return res.status(403).json({ 
        message: 'Could not read your calendar. Calendar access permission is required.',
        error: 'insufficient_permission'
      });
    }

    res.status(500).json({ 
      message: 'Could not read your calendar.',
      error: error.message || 'unknown_error'
    });
  }
});

/**
 * GET /api/calendar/free-time
 * Finds free time slots between classes (longer than 10 minutes)
 * Requires authentication
 */
router.get('/free-time', authenticateToken, async (req, res) => {
  try {
    const user = req.user;

    if (user.provider !== 'google') {
      return res.status(400).json({ 
        message: 'Calendar reading is currently only supported for Google accounts',
        error: 'provider_not_supported'
      });
    }

    if (!user.accessToken) {
      return res.status(401).json({ 
        message: 'No access token found. Please login again.',
        error: 'no_access_token'
      });
    }

    const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date();
    const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const minDuration = parseInt(req.query.minDuration) || 10;

    const freeSlots = await findFreeTimeSlots(user.accessToken, startDate, endDate, minDuration);

    res.json({
      success: true,
      slotCount: freeSlots.length,
      freeTimeSlots: freeSlots
    });
  } catch (error) {
    console.error('Error finding free time:', error);
    
    if (error.message?.includes('401') || error.message?.includes('invalid_token')) {
      return res.status(401).json({ 
        message: 'Could not read your calendar. Your session may have expired. Please login again.',
        error: 'invalid_token'
      });
    }

    if (error.message?.includes('403') || error.message?.includes('insufficient_permission')) {
      return res.status(403).json({ 
        message: 'Could not read your calendar. Calendar access permission is required.',
        error: 'insufficient_permission'
      });
    }

    res.status(500).json({ 
      message: 'Could not read your calendar.',
      error: error.message || 'unknown_error'
    });
  }
});

/**
 * GET /api/calendar/next-break
 * Gets the next free time slot (break)
 * Requires authentication
 */
router.get('/next-break', authenticateToken, async (req, res) => {
  try {
    const user = req.user;

    if (user.provider !== 'google') {
      return res.status(400).json({ 
        message: 'Calendar reading is currently only supported for Google accounts',
        error: 'provider_not_supported'
      });
    }

    if (!user.accessToken) {
      return res.status(401).json({ 
        message: 'No access token found. Please login again.',
        error: 'no_access_token'
      });
    }

    const nextBreak = await getNextBreak(user.accessToken);
    console.log("nextBreak: ", nextBreak);

    if (!nextBreak) {
      return res.json({
        success: true,
        hasBreak: false,
        message: 'No free time found in the next 24 hours'
      });
    }

    res.json({
      success: true,
      hasBreak: true,
      nextBreak: nextBreak
    });
  } catch (error) {
    console.error('Error getting next break:', error);
    
    if (error.message?.includes('401') || error.message?.includes('invalid_token')) {
      return res.status(401).json({ 
        message: 'Could not read your calendar. Your session may have expired. Please login again.',
        error: 'invalid_token'
      });
    }

    if (error.message?.includes('403') || error.message?.includes('insufficient_permission')) {
      return res.status(403).json({ 
        message: 'Could not read your calendar. Calendar access permission is required.',
        error: 'insufficient_permission'
      });
    }

    res.status(500).json({ 
      message: 'Could not read your calendar.',
      error: error.message || 'unknown_error'
    });
  }
});

export default router;

