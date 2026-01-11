import Task from '../models/Task.js';
import { fetchEmails } from './gmailService.js';

/**
 * Normalizes task name for similarity comparison
 * Removes common action verbs and extra whitespace
 * @param {string} taskName - Task name to normalize
 * @returns {string} Normalized task name
 */
function normalizeTaskName(taskName) {
  if (!taskName) return '';
  
  // Convert to lowercase and trim
  let normalized = taskName.toLowerCase().trim();
  
  // Remove common action verbs and prefixes
  normalized = normalized.replace(/^(complete|submit|finish|do|work on|prepare|attend|reply to|respond to)\s+/i, '');
  
  // Remove extra whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  // Remove common suffixes
  normalized = normalized.replace(/\s+(homework|assignment|project|task)$/i, '');
  
  return normalized;
}

/**
 * Checks if two task names are similar
 * @param {string} taskName1 - First task name
 * @param {string} taskName2 - Second task name
 * @returns {boolean} True if tasks are similar
 */
function areTasksSimilar(taskName1, taskName2) {
  const normalized1 = normalizeTaskName(taskName1);
  const normalized2 = normalizeTaskName(taskName2);
  
  // Exact match after normalization
  if (normalized1 === normalized2) {
    return true;
  }
  
  // Check if one contains the other (for cases like "Complete Datathon" vs "Datathon")
  if (normalized1.length > 0 && normalized2.length > 0) {
    if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
      // Only consider similar if the shorter name is at least 5 characters
      const shorter = normalized1.length < normalized2.length ? normalized1 : normalized2;
      if (shorter.length >= 5) {
        return true;
      }
    }
  }
  
  // Check word-based similarity
  const words1 = normalized1.split(/\s+/).filter(w => w.length > 2);
  const words2 = normalized2.split(/\s+/).filter(w => w.length > 2);
  
  if (words1.length === 0 || words2.length === 0) {
    return false;
  }
  
  // If most significant words match, consider similar
  const matchingWords = words1.filter(w => words2.includes(w));
  const similarity = matchingWords.length / Math.max(words1.length, words2.length);
  
  // Consider similar if > 70% of words match and at least 2 words match
  return similarity >= 0.7 && matchingWords.length >= 2;
}

/**
 * Filters out similar tasks, keeping only one of each similar group
 * Prefers tasks with earlier due dates, then higher importance
 * @param {Array} tasks - Array of tasks to deduplicate
 * @returns {Array} Deduplicated tasks
 */
function deduplicateSimilarTasks(tasks) {
  if (tasks.length === 0) return [];
  
  const uniqueTasks = [];
  
  for (const task of tasks) {
    // Check if we've seen a similar task
    let isSimilar = false;
    let similarIndex = -1;
    
    for (let i = 0; i < uniqueTasks.length; i++) {
      if (areTasksSimilar(task.name, uniqueTasks[i].name)) {
        isSimilar = true;
        similarIndex = i;
        break;
      }
    }
    
    if (!isSimilar) {
      // No similar task found, add it
      uniqueTasks.push(task);
    } else {
      // Similar task exists, decide which to keep
      const existingTask = uniqueTasks[similarIndex];
      
      // Prefer task with earlier due date
      if (task.dueDate && existingTask.dueDate) {
        if (new Date(task.dueDate) < new Date(existingTask.dueDate)) {
          uniqueTasks[similarIndex] = task;
        }
      } else if (task.dueDate && !existingTask.dueDate) {
        // Keep task with due date
        uniqueTasks[similarIndex] = task;
      } else if (!task.dueDate && existingTask.dueDate) {
        // Keep existing task with due date
        // Do nothing
      } else {
        // Both have no due date, prefer higher importance
        if (task.importance > existingTask.importance) {
          uniqueTasks[similarIndex] = task;
        }
      }
    }
  }
  
  return uniqueTasks;
}

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
        const emails = await fetchEmails(accessToken, 100);
        
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
            
            // Use deadline from task if available, otherwise use email deadline
            const taskDeadline = taskData.dueDate ? new Date(taskData.dueDate) : emailDeadline;

            // Check if task already exists for this thread
              const existingTask = dbTasks.find(t => 
                t.source === 'email' && 
              (t.sourceId === threadId || (t.sourceData?.threadId === threadId)) &&
                t.name && taskName &&
                (t.name.toLowerCase().includes(taskName.toLowerCase().substring(0, 50)) ||
                 taskName.toLowerCase().includes(t.name.toLowerCase().substring(0, 50)))
              );

              if (!existingTask) {
                // Use estimate from taskData, fallback to 60 minutes if missing
                const estimatedMinutes = taskData.estimatedMinutes || 60;
                
                emailTasks.push({
                name: taskName,
                  importance: taskData.importance || 3,
                dueDate: taskDeadline,
                  estimatedMinutes: estimatedMinutes,
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
                // Default estimate for deadline-based tasks: 60 minutes
                emailTasks.push({
                  name: taskName,
                description: `Deadline from email: ${latestEmail.subject}`,
                  importance: 4, // Deadlines are important
                dueDate: emailDeadline,
                  estimatedMinutes: 60,
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

    const tasksArray = allTasks.map(task => task.toObject());
    
    // Deduplicate similar tasks before returning
    const deduplicatedTasks = deduplicateSimilarTasks(tasksArray);
    
    return deduplicatedTasks;
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

