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

/**
 * GET /api/calendar/break-reminder
 * Gets break reminder data with suggested tasks that fit the break duration (F-005, S-003)
 * Requires authentication
 */
router.get('/break-reminder', authenticateToken, async (req, res) => {
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

    if (!nextBreak) {
      return res.json({
        success: true,
        hasBreak: false,
        message: 'No break found in the next 24 hours'
      });
    }

    // Check if break is starting or has started (within 5 minutes of start time)
    const now = new Date();
    const breakStart = new Date(nextBreak.start);
    const timeUntilStart = breakStart.getTime() - now.getTime();
    const breakDuration = nextBreak.durationMinutes;
    
    // Break is "starting" if it's within 5 minutes of start or has started in last 30 minutes
    const isBreakTime = timeUntilStart <= 5 * 60 * 1000 && timeUntilStart > -30 * 60 * 1000;

    if (!isBreakTime) {
      return res.json({
        success: true,
        hasBreak: true,
        isBreakTime: false,
        nextBreak: {
          start: nextBreak.start.toISOString ? nextBreak.start.toISOString() : new Date(nextBreak.start).toISOString(),
          end: nextBreak.end.toISOString ? nextBreak.end.toISOString() : new Date(nextBreak.end).toISOString(),
          durationMinutes: nextBreak.durationMinutes,
          isStartingSoon: nextBreak.isStartingSoon,
          minutesUntilStart: nextBreak.minutesUntilStart
        },
        message: `Break starts in ${Math.ceil(timeUntilStart / (60 * 1000))} minutes`
      });
    }

    // Get tasks that fit the break duration
    const Task = (await import('../models/Task.js')).default;
    const tasks = await Task.find({ 
      userId: user._id, 
      done: false 
    }).sort({ importance: -1, createdAt: -1 });

    // Filter tasks that fit the break duration
    // Include tasks with estimatedMinutes <= breakDuration, or tasks without estimated time
    const suitableTasks = tasks.filter(task => {
      if (!task.estimatedMinutes) {
        // Tasks without estimated time are included (let user decide)
        return true;
      }
      // Include tasks that fit in the break (with 5 minute buffer)
      return task.estimatedMinutes <= (breakDuration - 5);
    });

    // Sort by time (estimatedMinutes) and importance
    // Priority: tasks with estimated time that fit exactly, then by importance
    suitableTasks.sort((a, b) => {
      // First sort by importance (higher first)
      if (b.importance !== a.importance) {
        return b.importance - a.importance;
      }
      // Then by estimated time (shorter first - can fit more)
      if (a.estimatedMinutes && b.estimatedMinutes) {
        return a.estimatedMinutes - b.estimatedMinutes;
      }
      // Tasks without estimated time go last
      if (!a.estimatedMinutes && b.estimatedMinutes) return 1;
      if (a.estimatedMinutes && !b.estimatedMinutes) return -1;
      // Both without time - sort by creation date (newer first)
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    res.json({
      success: true,
      hasBreak: true,
      isBreakTime: true,
      nextBreak: {
        start: nextBreak.start.toISOString ? nextBreak.start.toISOString() : new Date(nextBreak.start).toISOString(),
        end: nextBreak.end.toISOString ? nextBreak.end.toISOString() : new Date(nextBreak.end).toISOString(),
        durationMinutes: nextBreak.durationMinutes,
        isStartingSoon: nextBreak.isStartingSoon,
        minutesUntilStart: nextBreak.minutesUntilStart
      },
      suggestedTasks: suitableTasks.slice(0, 10).map(task => ({
        id: task._id.toString(),
        name: task.name,
        description: task.description,
        importance: task.importance,
        dueDate: task.dueDate ? new Date(task.dueDate).toISOString() : null,
        estimatedMinutes: task.estimatedMinutes,
        source: task.source,
        sourceData: task.sourceData,
        createdAt: task.createdAt ? new Date(task.createdAt).toISOString() : null
      })),
      taskCount: suitableTasks.length,
      breakDuration: breakDuration
    });
  } catch (error) {
    console.error('Error getting break reminder:', error);
    
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
      message: 'Could not get break reminder.',
      error: error.message || 'unknown_error'
    });
  }
});

export default router;

