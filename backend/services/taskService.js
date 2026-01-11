import Task from '../models/Task.js';
import { fetchEmails } from './gmailService.js';

/**
 * Combines email tasks with user-created tasks
 * @param {string} userId - User ID
 * @param {string} accessToken - Google OAuth access token (optional, for fetching emails)
 * @param {boolean} refreshFromEmail - Whether to fetch fresh tasks from emails
 * @returns {Promise<Array>} Combined list of tasks
 */
export async function getCombinedTaskList(userId, accessToken = null, refreshFromEmail = false) {
  try {
    // Get all tasks from database (convert to plain objects for comparison)
    const dbTasks = (await Task.find({ userId, done: false })
      .sort({ importance: -1, dueDate: 1, createdAt: -1 }))
      .map(task => task.toObject());

    // If refreshFromEmail is true and we have access token, fetch fresh email tasks
    let emailTasks = [];
    if (refreshFromEmail && accessToken) {
      try {
        const emails = await fetchEmails(accessToken, 50);
        
        // Group emails by thread ID (email chain)
        const emailThreads = new Map();
        emails.forEach(email => {
          const threadId = email.threadId || email.id; // Use threadId, fallback to messageId if no thread
          if (!emailThreads.has(threadId)) {
            emailThreads.set(threadId, []);
          }
          emailThreads.get(threadId).push(email);
        });

        // Process each thread: get latest email and extract one task
        emailThreads.forEach((threadEmails, threadId) => {
          // Sort by date (latest first)
          threadEmails.sort((a, b) => new Date(b.date) - new Date(a.date));
          const latestEmail = threadEmails[0]; // Get the latest email in the thread

          // Get the first deadline from the latest email
          const emailDeadline = latestEmail.deadlines && latestEmail.deadlines.length > 0 
            ? new Date(latestEmail.deadlines[0].date) 
            : null;

          // Extract one task from the latest email
          if (latestEmail.tasks && latestEmail.tasks.length > 0) {
            // Use the first task found (most relevant)
            const taskData = latestEmail.tasks[0];
            const taskName = taskData.text?.substring(0, 500) || latestEmail.subject;

            // Check if task already exists for this thread
            const existingTask = dbTasks.find(t => 
              t.source === 'email' && 
              (t.sourceId === threadId || (t.sourceData?.threadId === threadId)) &&
              t.name && taskName &&
              (t.name.toLowerCase().includes(taskName.toLowerCase().substring(0, 50)) ||
               taskName.toLowerCase().includes(t.name.toLowerCase().substring(0, 50)))
            );

            if (!existingTask) {
              emailTasks.push({
                name: taskName,
                importance: taskData.importance || 3,
                dueDate: emailDeadline,
                source: 'email',
                sourceId: threadId, // Use threadId as sourceId
                sourceData: {
                  emailSubject: latestEmail.subject,
                  emailFrom: latestEmail.from,
                  emailDate: latestEmail.date,
                  threadId: threadId,
                  messageId: latestEmail.id,
                  threadEmailCount: threadEmails.length
                }
              });
            }
          } else if (emailDeadline) {
            // If no tasks found but there's a deadline, create a task from the deadline
            const taskName = `${latestEmail.subject} - Due ${new Date(emailDeadline).toLocaleDateString()}`;
            const existingTask = dbTasks.find(t => 
              t.source === 'email' && 
              (t.sourceId === threadId || (t.sourceData?.threadId === threadId)) &&
              t.dueDate &&
              Math.abs(new Date(t.dueDate) - emailDeadline) < 24 * 60 * 60 * 1000 // Within 24 hours
            );

            if (!existingTask) {
              emailTasks.push({
                name: taskName,
                description: `Deadline from email: ${latestEmail.subject}`,
                importance: 4, // Deadlines are important
                dueDate: emailDeadline,
                source: 'email',
                sourceId: threadId,
                sourceData: {
                  emailSubject: latestEmail.subject,
                  emailFrom: latestEmail.from,
                  emailDate: latestEmail.date,
                  threadId: threadId,
                  messageId: latestEmail.id,
                  threadEmailCount: threadEmails.length,
                  isDeadline: true
                }
              });
            }
          }
        });

        // Save new email tasks to database
        if (emailTasks.length > 0) {
          const tasksToSave = emailTasks.map(task => ({
            ...task,
            userId: userId
          }));
          await Task.insertMany(tasksToSave);
        }
      } catch (error) {
        console.error('Error fetching email tasks:', error);
        // Continue with existing tasks if email fetch fails
      }
    }

    // Get updated task list
    const allTasks = await Task.find({ userId, done: false })
      .sort({ importance: -1, dueDate: 1, createdAt: -1 });

    return allTasks.map(task => task.toObject());
  } catch (error) {
    console.error('Error getting combined task list:', error);
    throw error;
  }
}

/**
 * Create a task from email data
 * @param {string} userId - User ID
 * @param {Object} taskData - Task data from email
 * @param {Object} emailInfo - Email information
 * @returns {Promise<Object>} Created task
 */
export async function createTaskFromEmail(userId, taskData, emailInfo) {
  try {
    const task = new Task({
      userId,
      name: taskData.text || taskData.name,
      importance: taskData.importance || 3,
      source: 'email',
      sourceId: emailInfo.id,
      sourceData: {
        emailSubject: emailInfo.subject,
        emailFrom: emailInfo.from,
        emailDate: emailInfo.date
      },
      dueDate: taskData.dueDate ? new Date(taskData.dueDate) : null
    });

    await task.save();
    return task;
  } catch (error) {
    console.error('Error creating task from email:', error);
    throw error;
  }
}

/**
 * Get task statistics for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Task statistics
 */
export async function getTaskStats(userId) {
  try {
    const totalTasks = await Task.countDocuments({ userId, done: false });
    const completedTasks = await Task.countDocuments({ userId, done: true });
    const overdueTasks = await Task.countDocuments({ 
      userId, 
      done: false, 
      dueDate: { $lt: new Date() }
    });
    const tasksByImportance = await Task.aggregate([
      { $match: { userId, done: false } },
      { $group: { _id: '$importance', count: { $sum: 1 } } },
      { $sort: { _id: -1 } }
    ]);

    return {
      totalTasks,
      completedTasks,
      overdueTasks,
      tasksByImportance: tasksByImportance.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {})
    };
  } catch (error) {
    console.error('Error getting task stats:', error);
    throw error;
  }
}

