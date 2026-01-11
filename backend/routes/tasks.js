import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import Task from '../models/Task.js';
import User from '../models/User.js';
import { getCombinedTaskList, getTaskStats } from '../services/taskService.js';

const router = express.Router();

/**
 * GET /api/tasks
 * Get all tasks for the authenticated user
 * Requires authentication
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { refresh } = req.query;

    // Get tasks, optionally refresh from emails
    const refreshFromEmail = refresh === 'true' && user.accessToken && user.provider === 'google';
    const tasks = await getCombinedTaskList(user._id, user.accessToken, refreshFromEmail);

    // Get task statistics
    const stats = await getTaskStats(user._id);

    res.json({
      success: true,
      tasks: tasks.map(task => ({
        id: task._id,
        name: task.name,
        description: task.description,
        importance: task.importance,
        dueDate: task.dueDate,
        estimatedMinutes: task.estimatedMinutes,
        done: task.done,
        completedAt: task.completedAt,
        source: task.source,
        sourceData: task.sourceData,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt
      })),
      stats
    });
  } catch (error) {
    console.error('Error getting tasks:', error);
    res.status(500).json({ 
      message: 'Could not make task list.',
      error: error.message || 'unknown_error'
    });
  }
});

/**
 * POST /api/tasks
 * Create a new task
 * Requires authentication
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { name, description, importance, dueDate, estimatedMinutes } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ 
        message: 'Task name is required',
        error: 'validation_error'
      });
    }

    const task = new Task({
      userId: user._id,
      name: name.trim(),
      description: description?.trim() || '',
      importance: importance || 3,
      dueDate: dueDate ? new Date(dueDate) : null,
      estimatedMinutes: estimatedMinutes || null,
      source: 'manual'
    });

    await task.save();

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      task: {
        id: task._id,
        name: task.name,
        description: task.description,
        importance: task.importance,
        dueDate: task.dueDate,
        estimatedMinutes: task.estimatedMinutes,
        done: task.done,
        source: task.source,
        createdAt: task.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ 
      message: 'Could not save task.',
      error: error.message || 'unknown_error'
    });
  }
});

/**
 * PUT /api/tasks/:id
 * Update a task
 * Requires authentication
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { name, description, importance, dueDate, estimatedMinutes, done } = req.body;

    const task = await Task.findOne({ _id: id, userId: user._id });

    if (!task) {
      return res.status(404).json({ 
        message: 'Task not found',
        error: 'not_found'
      });
    }

    // Update fields
    if (name !== undefined) task.name = name.trim();
    if (description !== undefined) task.description = description?.trim() || '';
    if (importance !== undefined) task.importance = importance;
    if (dueDate !== undefined) task.dueDate = dueDate ? new Date(dueDate) : null;
    if (estimatedMinutes !== undefined) task.estimatedMinutes = estimatedMinutes;

    // Handle task completion
    if (done !== undefined) {
      task.done = done;
      if (done && !task.completedAt) {
        task.completedAt = new Date();
        // Increment user's completed tasks count
        await User.findByIdAndUpdate(user._id, {
          $inc: { completedTasksCount: 1 }
        });
      } else if (!done) {
        task.completedAt = null;
        // Decrement user's completed tasks count
        await User.findByIdAndUpdate(user._id, {
          $inc: { completedTasksCount: -1 }
        });
      }
    }

    task.updatedAt = new Date();
    await task.save();

    res.json({
      success: true,
      message: 'Task updated successfully',
      task: {
        id: task._id,
        name: task.name,
        description: task.description,
        importance: task.importance,
        dueDate: task.dueDate,
        estimatedMinutes: task.estimatedMinutes,
        done: task.done,
        completedAt: task.completedAt,
        source: task.source,
        sourceData: task.sourceData,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt
      }
    });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ 
      message: 'Could not update task.',
      error: error.message || 'unknown_error'
    });
  }
});

/**
 * DELETE /api/tasks/:id
 * Delete a task
 * Requires authentication
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    const task = await Task.findOne({ _id: id, userId: user._id });

    if (!task) {
      return res.status(404).json({ 
        message: 'Task not found',
        error: 'not_found'
      });
    }

    // If task was completed, decrement count
    if (task.done) {
      await User.findByIdAndUpdate(user._id, {
        $inc: { completedTasksCount: -1 }
      });
    }

    await Task.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Task deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ 
      message: 'Could not delete task.',
      error: error.message || 'unknown_error'
    });
  }
});

/**
 * POST /api/tasks/:id/complete
 * Mark a task as completed (F-006)
 * Requires authentication
 */
router.post('/:id/complete', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    const task = await Task.findOne({ _id: id, userId: user._id });

    if (!task) {
      return res.status(404).json({ 
        message: 'Task not found',
        error: 'not_found'
      });
    }

    if (task.done) {
      return res.status(400).json({ 
        message: 'Task is already completed',
        error: 'already_completed'
      });
    }

    task.done = true;
    task.completedAt = new Date();
    await task.save();

    // Increment user's completed tasks count
    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      { $inc: { completedTasksCount: 1 } },
      { new: true }
    );

    res.json({
      success: true,
      message: 'Task completed successfully',
      task: {
        id: task._id,
        name: task.name,
        done: task.done,
        completedAt: task.completedAt
      },
      completedTasksCount: updatedUser.completedTasksCount
    });
  } catch (error) {
    console.error('Error completing task:', error);
    res.status(500).json({ 
      message: 'Could not complete task.',
      error: error.message || 'unknown_error'
    });
  }
});

export default router;

